import { redis } from "./redis";
import { nvidiaChat, isNvidiaConfigured, NVIDIA_MODEL } from "./nvidia";
import { getStockNews, type NewsItem } from "./news";
import type { Quote } from "./upstox";
import type { Fundamentals } from "./fundamentals";
import { NSE_SYMBOLS } from "./nse-symbols";
import { tryParseJson } from "./doctor/json";

export type StockStory = {
  symbol: string;
  headline: string;
  story: string;
  beats: string[];
  outlook: string;
  source: "llm" | "fallback";
  generatedAt: number;
};

const CACHE_PREFIX = "stock-story:v1:";
const CACHE_TTL_SEC = 60 * 60;

function fmtPct(n?: number | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "n/a";
  return `${(n * 100).toFixed(1)}%`;
}

function rangePos(q: Quote, f: Fundamentals | null): number | null {
  const hi = q.yearHigh ?? f?.yearHigh;
  const lo = q.yearLow ?? f?.yearLow;
  if (!hi || !lo || hi <= lo) return null;
  return ((q.lastPrice - lo) / (hi - lo)) * 100;
}

function deterministicFallback(
  symbol: string,
  name: string,
  sector: string,
  q: Quote,
  f: Fundamentals | null,
): StockStory {
  const pos = rangePos(q, f);
  const beats: string[] = [];
  if (Math.abs(q.changePct) > 2) {
    beats.push(`${q.changePct > 0 ? "Up" : "Down"} ${q.changePct.toFixed(1)}% today — outsized vs typical session.`);
  }
  if (pos !== null) {
    if (pos > 90) beats.push(`Pressing the 52-week high at ${pos.toFixed(0)}% of the year's range.`);
    else if (pos < 15) beats.push(`Sitting in the bottom ${pos.toFixed(0)}% of its 52-week range.`);
  }
  if (f?.revenueGrowth !== undefined && f.revenueGrowth !== null && f.revenueGrowth > 0.2) {
    beats.push(`Revenue compounding at ${fmtPct(f.revenueGrowth)} YoY — top-line momentum intact.`);
  } else if (f?.revenueGrowth !== undefined && f.revenueGrowth !== null && f.revenueGrowth < -0.05) {
    beats.push(`Revenue contracting ${fmtPct(f.revenueGrowth)} YoY — demand or pricing under pressure.`);
  }
  if (f?.earningsDate) {
    const days = Math.round((f.earningsDate - Date.now()) / (1000 * 60 * 60 * 24));
    if (days >= -1 && days <= 14) {
      beats.push(days <= 0 ? "Just reported — next print sets the trajectory." : `Earnings in ${days} day${days === 1 ? "" : "s"} — the next set-piece event.`);
    }
  }
  return {
    symbol,
    headline: `${name} — ${sector} story`,
    story: `${name} is a ${sector.toLowerCase()} business currently trading at ₹${q.lastPrice.toFixed(0)}. Live narrative is unavailable, so this view is a deterministic snapshot of the numbers — connect a model key to surface news-driven context.`,
    beats: beats.slice(0, 4),
    outlook: "Watch upcoming results and sector flows. Set alerts on the 52-week range edges to catch decisive breaks.",
    source: "fallback",
    generatedAt: Date.now(),
  };
}

function buildPrompt(
  symbol: string,
  name: string,
  sector: string,
  industry: string | undefined,
  q: Quote,
  f: Fundamentals | null,
  news: NewsItem[],
): string {
  const pos = rangePos(q, f);
  const newsBlock = news.slice(0, 8)
    .map((n, i) => `${i + 1}. [${n.publisher}] ${n.title} (${new Date(n.publishedAt).toISOString().slice(0, 10)})`)
    .join("\n") || "(no recent news available — rely on numbers only)";

  return `Stock: ${symbol} — ${name} (${sector}${industry ? ` / ${industry}` : ""})

PRICE
- Last: ₹${q.lastPrice.toFixed(2)} (today ${q.changePct.toFixed(2)}%)
- 52W: ₹${(q.yearLow ?? f?.yearLow ?? 0).toFixed(0)} – ₹${(q.yearHigh ?? f?.yearHigh ?? 0).toFixed(0)}${pos !== null ? ` (${pos.toFixed(0)}% of range)` : ""}

FUNDAMENTALS
- Revenue growth YoY: ${fmtPct(f?.revenueGrowth)}
- Earnings growth YoY: ${fmtPct(f?.earningsGrowth)}
- Profit margin: ${fmtPct(f?.profitMargin)}
- ROE: ${fmtPct(f?.returnOnEquity)}
- Debt/Equity: ${f?.debtToEquity?.toFixed(0) ?? "n/a"}
- Earnings date: ${f?.earningsDate ? new Date(f.earningsDate).toISOString().slice(0, 10) : "n/a"}

RECENT HEADLINES (most recent first)
${newsBlock}

TASK
Write a punchy, specific stock story for a retail Indian investor reading this *today*. No generic platitudes. Cite concrete numbers and named headlines.

Return ONLY this JSON shape (no markdown, no prose around it):
{
  "headline": "<=10 words, the one-sentence hook a friend would text you about this stock right now. Specific, not generic.",
  "story": "2-3 sentences (max 60 words) tying what's happening NOW: name the recent driver from the headlines or a fresh number from fundamentals. No 'company operates in X sector' filler.",
  "beats": ["3-4 short specific bullets (<=14 words each) — each names a number, headline theme, or upcoming event. No restating P/E without context."],
  "outlook": "1-2 sentences (max 40 words) on what to watch in the next 1-3 months — catalyst, sector cycle, or risk vector. Forward-looking but no price targets."
}

HARD RULES
- NEVER use the words "buy", "sell", "target ₹", "₹X target", "should buy/sell". This is SEBI-restricted territory.
- NEVER predict a specific future price.
- Forward-looking phrasing only as "watch for", "monitor", "track", "if X then Y observation" — never as recommendation.
- If headlines mention a concrete event (earnings beat, regulatory move, contract win, MD change, sector tailwind), surface it.
- If no material news, lean on numbers — but make them feel current ("margins compressed 200bps YoY", not "margins are 14%").
- Plain text only. No emojis, no markdown inside strings.
- Output strict JSON only.`;
}

const POST_BANNED = /\b(buy|sell)\b|target\s*₹|₹\s*\d+\s*target/i;
function stripBanned(s: string): string {
  return s.replace(POST_BANNED, "watch").trim();
}

function parseStory(raw: string): {
  headline: string; story: string; beats: string[]; outlook: string;
} | null {
  const obj = tryParseJson(raw);
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const headline = typeof o.headline === "string" ? o.headline.trim() : "";
  const story = typeof o.story === "string" ? o.story.trim() : "";
  const outlook = typeof o.outlook === "string" ? o.outlook.trim() : "";
  const beats = Array.isArray(o.beats) ? o.beats.map((b) => String(b).trim()).filter(Boolean).slice(0, 5) : [];
  if (!story || !headline) return null;
  return {
    headline: stripBanned(headline),
    story: stripBanned(story),
    beats: beats.map(stripBanned),
    outlook: stripBanned(outlook),
  };
}

export async function getStockStory(
  symbol: string,
  exchange: "NSE" | "BSE",
  quote: Quote | null,
  fundamentals: Fundamentals | null,
): Promise<StockStory | null> {
  if (!quote) return null;

  const cacheKey = `${CACHE_PREFIX}${exchange}:${symbol}`;
  const cached = await redis.get<StockStory>(cacheKey).catch(() => null);
  if (cached) return cached;

  const meta = NSE_SYMBOLS.find((s) => s.symbol === symbol);
  const name = meta?.name ?? symbol;
  const sector = meta?.sector ?? "Equities";

  if (!isNvidiaConfigured()) {
    const fb = deterministicFallback(symbol, name, sector, quote, fundamentals);
    await redis.set(cacheKey, fb, { ex: CACHE_TTL_SEC }).catch(() => {});
    return fb;
  }

  const news = await getStockNews(symbol, exchange, 8).catch(() => [] as NewsItem[]);
  const prompt = buildPrompt(symbol, name, sector, meta?.industry, quote, fundamentals, news);
  const raw = await nvidiaChat(
    [
      {
        role: "system",
        content:
          "You are a senior Indian-equity analyst writing short, punchy investor briefs. You ALWAYS reply with strict JSON only. You NEVER give buy/sell calls or specific price targets — SEBI rules forbid it. You cite specific recent news and concrete numbers, never generic platitudes.",
      },
      { role: "user", content: prompt },
    ],
    { maxTokens: 700, temperature: 0.55 },
  );
  if (!raw) {
    const fb = deterministicFallback(symbol, name, sector, quote, fundamentals);
    await redis.set(cacheKey, fb, { ex: CACHE_TTL_SEC / 4 }).catch(() => {});
    return fb;
  }

  const parsed = parseStory(raw);
  if (!parsed) {
    const fb = deterministicFallback(symbol, name, sector, quote, fundamentals);
    await redis.set(cacheKey, fb, { ex: CACHE_TTL_SEC / 4 }).catch(() => {});
    return fb;
  }

  const story: StockStory = {
    symbol,
    ...parsed,
    source: "llm",
    generatedAt: Date.now(),
  };
  await redis.set(cacheKey, story, { ex: CACHE_TTL_SEC }).catch(() => {});
  return story;
}

export const _model = NVIDIA_MODEL;
