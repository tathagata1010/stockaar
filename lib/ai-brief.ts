import { redis } from "./redis";
import { nvidiaChat, isNvidiaConfigured, NVIDIA_MODEL } from "./nvidia";
import { getStockNews, type NewsItem } from "./news";
import { getQuote } from "./upstox";
import { getFundamentals, type Fundamentals } from "./fundamentals";
import { buildScorecard, deriveSignal, type Scorecard } from "./scorecard";
import { NSE_SYMBOLS } from "./nse-symbols";

export type AIBrief = {
  symbol: string;
  summary: string;
  bullPoints: string[];
  bearPoints: string[];
  takeaway: string;
  latestUpdate: string;
  riskLevel: "Low" | "Medium" | "High" | "";
  moat: string;
  horizon: "Short" | "Medium" | "Long" | "";
  investorFit: { value: number; growth: number; dividend: number; momentum: number };
  scenarios: {
    bull: { price: number | null; pct: number | null; rationale: string };
    base: { price: number | null; pct: number | null; rationale: string };
    bear: { price: number | null; pct: number | null; rationale: string };
  };
  catalysts: string[];
  analytics: {
    composite: number | null;
    signal: string | null;
    pillars: { valuation: number | null; growth: number | null; quality: number | null; momentum: number | null };
    price: number | null;
    changePct: number | null;
    yearHigh: number | null;
    yearLow: number | null;
    pe: number | null;
    pb: number | null;
    roe: number | null;
    debtToEquity: number | null;
    revenueGrowth: number | null;
    earningsGrowth: number | null;
    dividendYield: number | null;
    marketCap: number | null;
  };
  news: NewsItem[];
  model: string;
  generatedAt: number;
  cached: boolean;
};

const TTL = 60 * 60 * 6;
const CACHE_VERSION = "v7";

function computeFallbackScenarios(
  price: number | null,
  yearHigh: number | null,
  yearLow: number | null,
): AIBrief["scenarios"] {
  if (!price || price <= 0) {
    return {
      bull: { price: null, pct: null, rationale: "" },
      base: { price: null, pct: null, rationale: "" },
      bear: { price: null, pct: null, rationale: "" },
    };
  }
  // Volatility band derived from 52W range; fall back to ±15% / ±8% if range unknown.
  let upBand = 0.15;
  let downBand = 0.12;
  if (yearHigh && yearLow && yearHigh > yearLow && yearLow > 0) {
    const rangePct = (yearHigh - yearLow) / yearLow;
    upBand = Math.min(0.35, Math.max(0.10, rangePct * 0.45));
    downBand = Math.min(0.30, Math.max(0.08, rangePct * 0.35));
  }
  const bullP = Math.round(price * (1 + upBand));
  const baseP = Math.round(price * (1 + upBand * 0.20));
  const bearP = Math.round(price * (1 - downBand));
  const pct = (p: number) => ((p - price) / price) * 100;
  return {
    bull: { price: bullP, pct: pct(bullP), rationale: "Sector tailwinds + 52W high retest if earnings sustain." },
    base: { price: baseP, pct: pct(baseP), rationale: "Range-bound near current levels, in line with peers." },
    bear: { price: bearP, pct: pct(bearP), rationale: "Macro de-rating or margin compression risk re-prices stock." },
  };
}

function computeFallbackFit(sc: Scorecard | null): AIBrief["investorFit"] {
  if (!sc) return { value: 0, growth: 0, dividend: 0, momentum: 0 };
  const v = sc.pillars.valuation.score;
  const g = sc.pillars.growth.score;
  const q = sc.pillars.quality.score;
  const m = sc.pillars.momentum.score;
  return {
    value: Math.round(v * 0.7 + q * 0.3),
    growth: Math.round(g * 0.7 + m * 0.3),
    dividend: Math.round(v * 0.5 + q * 0.5),
    momentum: Math.round(m * 0.7 + g * 0.3),
  };
}

function computeFallbackRisk(f: Fundamentals | null): AIBrief["riskLevel"] {
  if (!f) return "Medium";
  const de = f.debtToEquity ?? 0;
  if (de > 150) return "High";
  if (de < 50) return "Low";
  return "Medium";
}

function computeFallbackHorizon(sc: Scorecard | null): AIBrief["horizon"] {
  if (!sc) return "Medium";
  const m = sc.pillars.momentum.score;
  const v = sc.pillars.valuation.score;
  if (m >= 70) return "Short";
  if (v >= 65) return "Long";
  return "Medium";
}

function fmtPct(n?: number): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "n/a";
  return `${(n * 100).toFixed(1)}%`;
}
function fmtNum(n?: number, digits = 2): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "n/a";
  return n.toFixed(digits);
}

function buildPrompt(
  symbol: string,
  companyName: string,
  sector: string,
  industry: string | undefined,
  quote: Awaited<ReturnType<typeof getQuote>>,
  f: Fundamentals | null,
  sc: Scorecard | null,
  signal: string | null,
  news: NewsItem[],
): string {
  const newsBlock = news.slice(0, 12).map((n, i) =>
    `${i + 1}. [${n.publisher}] ${n.title} (${new Date(n.publishedAt).toISOString().slice(0, 10)})`,
  ).join("\n") || "(no recent news available)";

  return `You are an equity analyst writing a concise brief for retail investors on the Indian stock ${symbol} (${companyName}).

COMPANY
- Sector: ${sector}${industry ? ` / ${industry}` : ""}
- Symbol: ${symbol} (NSE)

PRICE
- Last: INR ${quote?.lastPrice?.toFixed(2) ?? "n/a"}
- Today: ${quote ? `${quote.changePct.toFixed(2)}%` : "n/a"}
- 52W: INR ${quote?.yearLow?.toFixed(0) ?? f?.yearLow?.toFixed(0) ?? "n/a"} - INR ${quote?.yearHigh?.toFixed(0) ?? f?.yearHigh?.toFixed(0) ?? "n/a"}

FUNDAMENTALS
- Market Cap: ${f?.marketCap ? "INR " + (f.marketCap / 1e7).toFixed(0) + " Cr" : "n/a"}
- P/E (TTM): ${fmtNum(f?.trailingPE, 1)}, P/B: ${fmtNum(f?.priceToBook, 2)}
- ROE: ${fmtPct(f?.returnOnEquity)}, ROA: ${fmtPct(f?.returnOnAssets)}
- Profit Margin: ${fmtPct(f?.profitMargin)}, Debt/Equity: ${fmtNum(f?.debtToEquity, 0)}
- Revenue Growth (YoY): ${fmtPct(f?.revenueGrowth)}, Earnings Growth: ${fmtPct(f?.earningsGrowth)}
- Dividend Yield: ${fmtPct(f?.dividendYield)}

STOCKSBREW SCORECARD (0-100)
- Composite: ${sc?.composite ?? "n/a"} -> Signal: ${signal ?? "n/a"}
- Valuation: ${sc?.pillars.valuation.score ?? "n/a"} | Growth: ${sc?.pillars.growth.score ?? "n/a"} | Quality: ${sc?.pillars.quality.score ?? "n/a"} | Momentum: ${sc?.pillars.momentum.score ?? "n/a"}

RECENT NEWS HEADLINES (multi-source, most recent first)
${newsBlock}

TASK
Return ONLY valid JSON (no markdown fences, no prose around it) with this exact shape:
{
  "summary": "2-3 sentences (max 60 words) that tell the CURRENT STORY of this stock — what's actually happening RIGHT NOW. Name a recent headline driver, a fresh number that just shifted, or the live sector dynamic. NO 'company operates in X sector' filler. NO generic platitudes. Make it feel like a senior friend explaining over chai why this stock matters today.",
  "bullPoints": ["3-4 specific bull points (<=18 words each); each names a concrete number, recent news theme, or upcoming catalyst — never a generic strength"],
  "bearPoints": ["3-4 specific bear points / risks (<=18 words each); cite specifics — D/E figure, margin trend, regulatory headline, sector overhang"],
  "takeaway": "1-2 sentences (max 40 words) on the FORWARD SETUP — the catalyst, level, sector cycle or risk vector to watch over the next 1-3 months. Forward-looking, never a price call.",
  "latestUpdate": "1-2 sentence synthesis of the freshest material news. If headlines have nothing concrete, say 'No material news in the last 24-48 hours.'",
  "riskLevel": "Low | Medium | High — based on debt, volatility, sector cyclicality.",
  "moat": "<=18 words on competitive position / what protects this business (brand, scale, regulation, network).",
  "horizon": "Short | Medium | Long — which holding period the current setup favors. Short=days-weeks, Medium=3-12 months, Long=2-5+ years.",
  "investorFit": {
    "value": 0-100 how attractive for VALUE investors (cheap multiples, asset backing),
    "growth": 0-100 for GROWTH investors (revenue/earnings acceleration),
    "dividend": 0-100 for INCOME investors (yield, payout consistency),
    "momentum": 0-100 for MOMENTUM/TREND traders (price trend, news flow)
  },
  "scenarios": {
    "bull": { "price": <number INR>, "rationale": "<=18 words on what gets us here" },
    "base": { "price": <number INR>, "rationale": "<=18 words" },
    "bear": { "price": <number INR>, "rationale": "<=18 words" }
  },
  "catalysts": ["2-3 short upcoming catalysts (earnings, policy, sector cycle)"]
}

Scenario PRICE GUIDANCE: anchor on current price and 52W range. Bull typically +10% to +30%, Base near current ±5%, Bear -10% to -25%. Numbers must be plain INR, no currency symbol, no commas.

RULES
- Each bullet <= 18 words and MUST cite a specific number, named headline, or concrete event. No "strong fundamentals" / "good company" / "well managed" generic phrasing.
- The summary and takeaway must feel CURRENT — tied to recent headlines or fresh data, not evergreen company description.
- If news headlines exist, at least one bull or bear point AND the latestUpdate must reflect their themes by name.
- NEVER use the words "buy", "sell", "target", or predict specific future prices outside the scenarios block. Frame as "watch for", "monitor", "if X then Y observation". This is SEBI-restricted territory.
- The latestUpdate field must reflect actual headlines above, not generic statements.
- Plain text only, no markdown inside strings.
- Output JSON only. No preamble, no explanation, no code fences.`;
}

function parseJSON(text: string, currentPrice: number | null): {
  summary: string; bullPoints: string[]; bearPoints: string[]; takeaway: string;
  latestUpdate: string; riskLevel: AIBrief["riskLevel"]; moat: string;
  horizon: AIBrief["horizon"]; investorFit: AIBrief["investorFit"];
  scenarios: AIBrief["scenarios"]; catalysts: string[];
} | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    const obj = JSON.parse(trimmed.slice(start, end + 1));
    const rl = String(obj.riskLevel ?? "");
    const riskLevel: AIBrief["riskLevel"] =
      rl === "Low" || rl === "Medium" || rl === "High" ? rl : "";
    const hz = String(obj.horizon ?? "");
    const horizon: AIBrief["horizon"] =
      hz === "Short" || hz === "Medium" || hz === "Long" ? hz : "";

    const clampScore = (n: any) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return 0;
      return Math.max(0, Math.min(100, Math.round(x)));
    };
    const fit = obj.investorFit ?? {};
    const investorFit = {
      value: clampScore(fit.value),
      growth: clampScore(fit.growth),
      dividend: clampScore(fit.dividend),
      momentum: clampScore(fit.momentum),
    };

    const parseScenario = (s: any): AIBrief["scenarios"]["base"] => {
      const p = Number(s?.price);
      const price = Number.isFinite(p) && p > 0 ? p : null;
      const pct = price !== null && currentPrice && currentPrice > 0
        ? ((price - currentPrice) / currentPrice) * 100
        : null;
      return { price, pct, rationale: String(s?.rationale ?? "") };
    };
    const sc = obj.scenarios ?? {};
    const scenarios = {
      bull: parseScenario(sc.bull),
      base: parseScenario(sc.base),
      bear: parseScenario(sc.bear),
    };

    return {
      summary: String(obj.summary ?? ""),
      bullPoints: Array.isArray(obj.bullPoints) ? obj.bullPoints.map(String) : [],
      bearPoints: Array.isArray(obj.bearPoints) ? obj.bearPoints.map(String) : [],
      takeaway: String(obj.takeaway ?? ""),
      latestUpdate: String(obj.latestUpdate ?? ""),
      riskLevel,
      moat: String(obj.moat ?? ""),
      horizon,
      investorFit,
      scenarios,
      catalysts: Array.isArray(obj.catalysts) ? obj.catalysts.map(String) : [],
    };
  } catch {
    return null;
  }
}

export async function getAIBrief(
  symbol: string,
  exchange: "NSE" | "BSE" = "NSE",
): Promise<AIBrief | null> {
  const key = `ai-brief:${exchange}:${symbol}:${CACHE_VERSION}`;
  const cached = await redis.get<AIBrief>(key).catch(() => null);
  if (cached) return { ...cached, cached: true };

  const meta = NSE_SYMBOLS.find((s) => s.symbol === symbol);
  if (!meta) return null;

  const [quote, fundamentals, news] = await Promise.all([
    getQuote(symbol, exchange),
    getFundamentals(symbol, exchange),
    getStockNews(symbol, exchange, 12),
  ]);
  const scorecard = fundamentals ? buildScorecard(fundamentals, quote) : null;
  const signal = scorecard ? deriveSignal(scorecard).signal : null;

  const analytics: AIBrief["analytics"] = {
    composite: scorecard?.composite ?? null,
    signal: signal ?? null,
    pillars: {
      valuation: scorecard?.pillars.valuation.score ?? null,
      growth: scorecard?.pillars.growth.score ?? null,
      quality: scorecard?.pillars.quality.score ?? null,
      momentum: scorecard?.pillars.momentum.score ?? null,
    },
    price: quote?.lastPrice ?? null,
    changePct: quote?.changePct ?? null,
    yearHigh: quote?.yearHigh ?? fundamentals?.yearHigh ?? null,
    yearLow: quote?.yearLow ?? fundamentals?.yearLow ?? null,
    pe: fundamentals?.trailingPE ?? null,
    pb: fundamentals?.priceToBook ?? null,
    roe: fundamentals?.returnOnEquity ?? null,
    debtToEquity: fundamentals?.debtToEquity ?? null,
    revenueGrowth: fundamentals?.revenueGrowth ?? null,
    earningsGrowth: fundamentals?.earningsGrowth ?? null,
    dividendYield: fundamentals?.dividendYield ?? null,
    marketCap: fundamentals?.marketCap ?? null,
  };

  if (!isNvidiaConfigured()) {
    return {
      symbol,
      summary: `${meta.name} — live data and a deterministic snapshot. Connect NVIDIA_API_KEY for narrative insights.`,
      bullPoints: [],
      bearPoints: [],
      takeaway: "",
      latestUpdate: "",
      riskLevel: computeFallbackRisk(fundamentals),
      moat: meta.sector ? `Operates in ${meta.sector}; competitive position depends on scale and brand within sector.` : "",
      horizon: computeFallbackHorizon(scorecard),
      investorFit: computeFallbackFit(scorecard),
      scenarios: computeFallbackScenarios(analytics.price, analytics.yearHigh, analytics.yearLow),
      catalysts: [],
      analytics,
      news,
      model: "none",
      generatedAt: Date.now(),
      cached: false,
    };
  }

  try {
    const prompt = buildPrompt(symbol, meta.name, meta.sector, meta.industry, quote, fundamentals, scorecard, signal, news);
    const text = await nvidiaChat(
      [
        {
          role: "system",
          content: "You are a senior Indian-equity analyst writing punchy, story-driven briefs for retail investors. You ALWAYS respond with strict JSON only — no markdown fences. You cite specific recent news and concrete numbers, never generic platitudes. SEBI rules forbid buy/sell calls and specific price predictions outside the explicit scenarios block.",
        },
        { role: "user", content: prompt },
      ],
      { maxTokens: 1100, temperature: 0.3 },
    );
    if (!text) return null;
    const parsed = parseJSON(text, analytics.price);
    if (!parsed) {
      console.warn("[ai-brief] failed to parse model output:", text.slice(0, 200));
      return null;
    }

    // Guarantee features the landing page promises: if AI omitted them, fill from data.
    const fbScenarios = computeFallbackScenarios(analytics.price, analytics.yearHigh, analytics.yearLow);
    const scenarios: AIBrief["scenarios"] = {
      bull: parsed.scenarios.bull.price !== null ? parsed.scenarios.bull : fbScenarios.bull,
      base: parsed.scenarios.base.price !== null ? parsed.scenarios.base : fbScenarios.base,
      bear: parsed.scenarios.bear.price !== null ? parsed.scenarios.bear : fbScenarios.bear,
    };
    const fitSum = parsed.investorFit.value + parsed.investorFit.growth + parsed.investorFit.dividend + parsed.investorFit.momentum;
    const investorFit = fitSum > 0 ? parsed.investorFit : computeFallbackFit(scorecard);
    const riskLevel = parsed.riskLevel || computeFallbackRisk(fundamentals);
    const horizon = parsed.horizon || computeFallbackHorizon(scorecard);

    const brief: AIBrief = {
      symbol,
      ...parsed,
      scenarios,
      investorFit,
      riskLevel,
      horizon,
      analytics,
      news,
      model: NVIDIA_MODEL,
      generatedAt: Date.now(),
      cached: false,
    };
    await redis.set(key, brief, { ex: TTL }).catch(() => {});
    return brief;
  } catch (e) {
    console.warn("[ai-brief] error", e);
    return {
      symbol,
      summary: "Could not generate AI brief right now.",
      bullPoints: [],
      bearPoints: [],
      takeaway: "",
      latestUpdate: "",
      riskLevel: computeFallbackRisk(fundamentals),
      moat: "",
      horizon: computeFallbackHorizon(scorecard),
      investorFit: computeFallbackFit(scorecard),
      scenarios: computeFallbackScenarios(analytics.price, analytics.yearHigh, analytics.yearLow),
      catalysts: [],
      analytics,
      news,
      model: NVIDIA_MODEL,
      generatedAt: Date.now(),
      cached: false,
    };
  }
}
