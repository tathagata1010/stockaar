import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { getQuote, getQuotes, type Quote } from "@/lib/upstox";
import { getFundamentals } from "@/lib/fundamentals";
import { getStockNews } from "@/lib/news";
import { getInstFlows } from "@/lib/inst-flows";
import { getPeers } from "@/lib/peers";
import { buildScorecard, deriveSignal } from "@/lib/scorecard";
import { getRecentGuidance } from "@/lib/guidance";
import { scoreHeadlines } from "@/lib/alerts/materiality";
import { searchSymbols, SYMBOL_META_BY_SYMBOL, type Sector } from "@/lib/nse-symbols";
import { fetchYahooHistory, type HistoryRange } from "@/lib/history";
import { getAIBrief } from "@/lib/ai-brief";
import { getRedditBuzz } from "@/lib/reddit-buzz";
import { fetchCorporateActions } from "@/lib/events";
import { getShareholdingPattern } from "@/lib/shareholding";
import { computeSMA, computeRsiSeries } from "@/lib/technicals";
import { PLANS, type PlanId } from "@/lib/constants";
import { getServiceClient } from "@/lib/supabase/service";
import { parseHoldingsCsv } from "@/lib/doctor/portfolio";
import { runDoctorPipeline } from "@/lib/doctor/pipeline";
import { webSearch, readUrl, type SearchSource } from "./search";

// Risk metadata parallel to the LangChain tool registry. Higher-risk tools
// require human-in-the-loop confirmation before execution.
export const TOOL_META: Record<string, { risk: "read" | "low_write" | "high_write" }> = {};

const SymbolField = z
  .string()
  .min(1)
  .max(20)
  .transform((s) => s.trim().toUpperCase());

const ExchangeField = z.enum(["NSE", "BSE"]).default("NSE");

const getQuoteTool = tool(
  async ({ symbol, exchange }): Promise<Quote | { error: string }> => {
    const q = await getQuote(symbol, exchange);
    return q ?? { error: `no quote for ${symbol} on ${exchange}` };
  },
  {
    name: "get_quote",
    description:
      "Live quote (lastPrice, changePct, day/year high-low, volume) for one NSE/BSE symbol. Use for price/momentum questions.",
    schema: z.object({ symbol: SymbolField, exchange: ExchangeField }),
  },
);
TOOL_META.get_quote = { risk: "read" };

const getQuotesBatchTool = tool(
  async ({ symbols, exchange }) => {
    const rows = await getQuotes(symbols.map((s) => ({ symbol: s, exchange })));
    return { count: rows.length, quotes: rows };
  },
  {
    name: "get_quotes_batch",
    description:
      "Bulk live quotes for many symbols on the same exchange. Use when comparing multiple stocks or when scanning a watchlist.",
    schema: z.object({
      symbols: z.array(SymbolField).min(1).max(20),
      exchange: ExchangeField,
    }),
  },
);
TOOL_META.get_quotes_batch = { risk: "read" };

const getFundamentalsTool = tool(
  async ({ symbol }) => {
    const f = await getFundamentals(symbol);
    return f ?? { error: `no fundamentals for ${symbol}` };
  },
  {
    name: "get_fundamentals",
    description:
      "Fundamentals for one NSE symbol: P/E, P/B, ROE, market cap, debt/equity, margins, dividend yield. Use for valuation and quality questions.",
    schema: z.object({ symbol: SymbolField }),
  },
);
TOOL_META.get_fundamentals = { risk: "read" };

const getScorecardTool = tool(
  async ({ symbol }) => {
    const [f, q] = await Promise.all([getFundamentals(symbol), getQuote(symbol)]);
    if (!f) return { error: `no fundamentals for ${symbol}` };
    const scorecard = buildScorecard(f, q ?? null);
    const derived = deriveSignal(scorecard);
    // Map SEBI-safe internal signal keys to prompt-friendly tilt labels.
    const tilt = derived.signal === "POSITIVE" ? "positive tilt" : derived.signal === "CAUTION" ? "caution" : "neutral";
    return { scorecard, signal: { tilt, reasons: derived.reasons } };
  },
  {
    name: "get_scorecard",
    description:
      "4-pillar scorecard (valuation / growth / quality / momentum) + composite score 0-100 + signal reasons for a symbol.",
    schema: z.object({ symbol: SymbolField }),
  },
);
TOOL_META.get_scorecard = { risk: "read" };

const getNewsTool = tool(
  async ({ symbol, exchange, limit, materialOnly }) => {
    const items = await getStockNews(symbol, exchange, limit);
    if (items.length === 0) {
      return { items: [], note: "no news items returned by upstream sources in the last window" };
    }
    if (!materialOnly) return { items };
    const scored = await scoreHeadlines(symbol, items);
    const enriched = items.map((n) => ({ ...n, materiality: scored.get(n.url)?.score ?? 0 }));
    const material = enriched.filter((n) => n.materiality >= 7);
    if (material.length > 0) {
      return { items: material, filteredCount: items.length - material.length };
    }
    // Nothing scored ≥7. Never leave the agent empty-handed — surface top raw
    // headlines with scores so it can still reason about what IS in the news
    // (or explicitly state that nothing looked material).
    const topRaw = enriched
      .sort((a, b) => b.materiality - a.materiality)
      .slice(0, 5);
    return {
      items: topRaw,
      note: "no headlines scored ≥7/10 for materiality — showing top raw items (with scores) so you can characterize the news flow honestly",
      allBelowThreshold: true,
    };
  },
  {
    name: "get_news",
    description:
      "Recent news items for a stock. Set materialOnly=true to prefer LLM-material headlines (≥7/10); if none clear the bar, top raw items are still returned with scores so you can characterize the flow instead of saying 'no news'.",
    schema: z.object({
      symbol: SymbolField,
      exchange: ExchangeField,
      limit: z.number().int().min(1).max(20).default(10),
      materialOnly: z.boolean().default(true),
    }),
  },
);
TOOL_META.get_news = { risk: "read" };

const getInstFlowsTool = tool(
  async ({ symbol }) => {
    const flows = await getInstFlows();
    if (!flows) return { error: "institutional flows data not yet warm — try again shortly." };
    const agg = flows.bySymbol[symbol];
    if (!agg) return { symbol, note: "no reported FII/DII bulk/block deals in the last 30 days" };
    return {
      symbol,
      windowDays: flows.windowDays,
      fiiNet: agg.fiiNet,
      diiNet: agg.diiNet,
      instNet: agg.instNet,
      dealCount: agg.dealCount,
      lastDealDate: agg.lastDealDate,
    };
  },
  {
    name: "get_inst_flows",
    description:
      "Net INR (30 days) from large FII/DII bulk & block deals on NSE for one symbol. Proxy for smart-money positioning — presence of activity matters as much as sign.",
    schema: z.object({ symbol: SymbolField }),
  },
);
TOOL_META.get_inst_flows = { risk: "read" };

const getGuidanceTool = tool(
  async ({ symbol, quarters }) => {
    const items = await getRecentGuidance({ symbol, limit: quarters });
    return { items, count: items.length };
  },
  {
    name: "get_guidance",
    description:
      "Management guidance snippets extracted from recent BSE/NSE filings for a symbol. Real filings, not press coverage.",
    schema: z.object({
      symbol: SymbolField,
      quarters: z.number().int().min(1).max(8).default(4),
    }),
  },
);
TOOL_META.get_guidance = { risk: "read" };

const getPeersTool = tool(
  async ({ symbol }) => {
    const meta = SYMBOL_META_BY_SYMBOL[symbol];
    if (!meta) return { error: `symbol ${symbol} not in NSE universe` };
    const peers = await getPeers(symbol, meta.sector as Sector, 5);
    return {
      symbol,
      sector: meta.sector,
      peers: peers.map((p) => ({
        symbol: p.entry.symbol,
        name: p.entry.name,
        marketCap: p.fundamentals?.marketCap,
        pe: p.fundamentals?.trailingPE,
        roe: p.fundamentals?.returnOnEquity,
      })),
    };
  },
  {
    name: "get_peers",
    description:
      "Top-5 sector peers for a symbol by market cap, with their P/E and ROE. Use for relative valuation comparisons.",
    schema: z.object({ symbol: SymbolField }),
  },
);
TOOL_META.get_peers = { risk: "read" };

const searchSymbolsTool = tool(
  async ({ query }) => {
    const hits = searchSymbols(query, 8);
    return { hits: hits.map((h) => ({ symbol: h.symbol, name: h.name, sector: h.sector })) };
  },
  {
    name: "search_symbols",
    description:
      "Resolve a company name or partial symbol to canonical NSE symbols. Use when the user names a company by full name.",
    schema: z.object({ query: z.string().min(1).max(40) }),
  },
);
TOOL_META.search_symbols = { risk: "read" };

const HistoryRangeSchema = z.enum(["1mo", "3mo", "6mo", "1y", "5y"]).default("1y");

function pctReturn(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / a) * 100;
}

const getHistoryStatsTool = tool(
  async ({ symbol, exchange, range }) => {
    const h = await fetchYahooHistory(symbol, exchange, range as HistoryRange);
    if (!h || h.points.length < 5) return { error: `no history data for ${symbol}` };
    const closes = h.points.map((p) => p.p);
    const first = closes[0];
    const last = closes[closes.length - 1];
    const wantVol = range !== "1mo" || closes.length > 20;

    let high = first;
    let low = first;
    let sumRet = 0;
    let retCount = 0;
    const rets: number[] = wantVol ? [] : [];
    for (let i = 0; i < closes.length; i++) {
      const c = closes[i];
      if (c > high) high = c;
      if (c < low) low = c;
      if (wantVol && i > 0) {
        const r = pctReturn(closes[i - 1], c);
        if (r !== null) {
          rets.push(r);
          sumRet += r;
          retCount++;
        }
      }
    }
    let stdev: number | null = null;
    if (wantVol && retCount > 0) {
      const mean = sumRet / retCount;
      let variance = 0;
      for (const r of rets) variance += (r - mean) ** 2;
      variance /= retCount;
      stdev = Math.sqrt(variance);
    }
    return {
      symbol,
      range,
      startClose: Number(first.toFixed(2)),
      endClose: Number(last.toFixed(2)),
      returnPct: Number(pctReturn(first, last)?.toFixed(2) ?? 0),
      periodHigh: Number(high.toFixed(2)),
      periodLow: Number(low.toFixed(2)),
      drawdownFromHighPct: Number(pctReturn(high, last)?.toFixed(2) ?? 0),
      dailyVolPct: stdev !== null ? Number(stdev.toFixed(2)) : null,
      previousClose: h.previousClose,
    };
  },
  {
    name: "get_history_stats",
    description:
      "Summarised price history for one symbol: return %, period high/low, drawdown from high, daily volatility. Ranges: 1mo/3mo/6mo/1y/5y. Use for momentum/volatility questions.",
    schema: z.object({
      symbol: SymbolField,
      exchange: ExchangeField,
      range: HistoryRangeSchema,
    }),
  },
);
TOOL_META.get_history_stats = { risk: "read" };

const getTechnicalsTool = tool(
  async ({ symbol, exchange }) => {
    const h = await fetchYahooHistory(symbol, exchange, "1y");
    if (!h || h.points.length < 20) return { error: `not enough history for ${symbol}` };
    const closes = h.points.map((p) => p.p);
    const last = closes[closes.length - 1];
    const sma20 = computeSMA(closes, 20).at(-1) ?? null;
    const sma50 = computeSMA(closes, 50).at(-1) ?? null;
    const sma200 = computeSMA(closes, 200).at(-1) ?? null;
    const rsi14 = computeRsiSeries(closes, 14).at(-1) ?? null;
    return {
      symbol,
      lastClose: Number(last.toFixed(2)),
      sma20: sma20 !== null ? Number(sma20.toFixed(2)) : null,
      sma50: sma50 !== null ? Number(sma50.toFixed(2)) : null,
      sma200: sma200 !== null ? Number(sma200.toFixed(2)) : null,
      rsi14: rsi14 !== null ? Number(rsi14.toFixed(1)) : null,
      priceVsSma50Pct: sma50 !== null ? Number((((last - sma50) / sma50) * 100).toFixed(2)) : null,
      priceVsSma200Pct: sma200 !== null ? Number((((last - sma200) / sma200) * 100).toFixed(2)) : null,
    };
  },
  {
    name: "get_technicals",
    description:
      "Technical snapshot for one symbol: SMA20/50/200, RSI(14), price vs long-term moving averages. Use for trend/overbought-oversold questions.",
    schema: z.object({ symbol: SymbolField, exchange: ExchangeField }),
  },
);
TOOL_META.get_technicals = { risk: "read" };

const getAIBriefTool = tool(
  async ({ symbol, exchange }) => {
    const brief = await getAIBrief(symbol, exchange);
    if (!brief) return { error: `no AI brief available for ${symbol}` };
    // Trim heavy analytics block — the LLM already has scorecard/fundamentals tools
    return {
      symbol: brief.symbol,
      summary: brief.summary,
      bullPoints: brief.bullPoints,
      bearPoints: brief.bearPoints,
      takeaway: brief.takeaway,
      latestUpdate: brief.latestUpdate,
      riskLevel: brief.riskLevel,
      moat: brief.moat,
      horizon: brief.horizon,
      catalysts: brief.catalysts,
      investorFit: brief.investorFit,
    };
  },
  {
    name: "get_ai_brief",
    description:
      "Pre-baked narrative brief for a symbol: summary, bull/bear points, moat, catalysts, risk level, horizon. Cached — reuse this instead of composing a bull/bear list from scratch.",
    schema: z.object({ symbol: SymbolField, exchange: ExchangeField }),
  },
);
TOOL_META.get_ai_brief = { risk: "read" };

const getRedditBuzzTool = tool(
  async ({ symbol }) => {
    const payload = await getRedditBuzz();
    const hit = payload.items.find((it) => it.entry.symbol === symbol);
    if (!hit) {
      return {
        symbol,
        note: "no significant Indian-Reddit chatter picked up in the current window",
        windowSampleSize: payload.sampleSize,
      };
    }
    return {
      symbol,
      score: hit.score,
      mentions: hit.mentions,
      upvotes: hit.upvotes,
      comments: hit.comments,
      newsCount: hit.newsCount,
      topPosts: hit.posts.slice(0, 3).map((p) => ({
        title: p.title,
        subreddit: p.subreddit,
        ups: p.ups,
        url: p.url,
      })),
      topNews: hit.news.slice(0, 3).map((n) => ({ title: n.title, publisher: n.publisher, url: n.url })),
    };
  },
  {
    name: "get_reddit_buzz",
    description:
      "Indian-Reddit buzz for one symbol (IndianStockMarket, IndiaInvestments, DalalStreetTalks, StockMarketIndia): mentions, top posts, sentiment proxy via score.",
    schema: z.object({ symbol: SymbolField }),
  },
);
TOOL_META.get_reddit_buzz = { risk: "read" };

const getCorporateActionsTool = tool(
  async ({ symbol, exchange }) => {
    const a = await fetchCorporateActions(symbol, exchange);
    return {
      symbol,
      dividends: a.dividends.slice(0, 6).map((d) => ({
        date: new Date(d.date).toISOString().slice(0, 10),
        amount: d.amount,
      })),
      splits: a.splits.slice(0, 4).map((s) => ({
        date: new Date(s.date).toISOString().slice(0, 10),
        ratio: `${s.numerator}:${s.denominator}`,
      })),
    };
  },
  {
    name: "get_corporate_actions",
    description:
      "Recent dividends and stock splits for a symbol. Use for dividend-history / capital-action questions.",
    schema: z.object({ symbol: SymbolField, exchange: ExchangeField }),
  },
);
TOOL_META.get_corporate_actions = { risk: "read" };

const getShareholdingTool = tool(
  async ({ symbol }) => {
    const s = await getShareholdingPattern(symbol);
    if (!s) return { error: `no shareholding pattern available for ${symbol}` };
    return {
      symbol,
      asOnDate: s.asOnDate,
      promoterPct: s.promoterPct,
      publicPct: s.publicPct,
      employeeTrustsPct: s.employeeTrustsPct,
    };
  },
  {
    name: "get_shareholding",
    description:
      "Quarterly shareholding pattern for a symbol (from NSE filings): promoter / public / employee-trust split. Use for ownership questions.",
    schema: z.object({ symbol: SymbolField }),
  },
);
TOOL_META.get_shareholding = { risk: "read" };

const SearchSourceSchema = z
  .enum(["general", "news", "x", "valuepickr", "concall", "presentation"])
  .default("general");

const webSearchTool = tool(
  async ({ query, source }) => {
    const { hits, note } = await webSearch(query, source as SearchSource, 8);
    if (hits.length === 0) return { items: [], note: note ?? "no results" };
    return {
      source,
      items: hits.map((h) => ({
        title: h.title,
        url: h.url,
        snippet: h.snippet,
        date: h.date,
        publisher: h.source,
      })),
    };
  },
  {
    name: "web_search",
    description:
      "Live web search for anything the built-in tools don't cover. Set source= to filter: 'concall' = earnings call transcripts (Trendlyne/screener.in/researchbytes), 'presentation' = investor-presentation PDFs, 'x' = X (Twitter) posts on cashtag/handle, 'valuepickr' = ValuePickr forum threads (highest-signal Indian value-investor community), 'news' = fresh news, 'general' = everything else. USE THIS whenever the user asks about 'what did management say', 'latest concall', 'community view', 'what's the vibe on X', or any macro/sector/general question outside a specific NSE company. Returns snippets + URLs — follow up with read_url to actually READ the top result.",
    schema: z.object({
      query: z.string().min(2).max(200),
      source: SearchSourceSchema,
    }),
  },
);
TOOL_META.web_search = { risk: "read" };

const readUrlTool = tool(
  async ({ url }) => {
    if (!/^https?:\/\//i.test(url)) return { error: "url must start with http(s)://" };
    const doc = await readUrl(url);
    return {
      title: doc.title,
      url: doc.url,
      content: doc.content,
      note: doc.note,
    };
  },
  {
    name: "read_url",
    description:
      "Fetch a URL and return its readable text (up to 8000 chars). Works on HTML pages AND PDFs (investor presentations, concall transcripts). Use AFTER web_search to actually read the top result — then quote the specific management line / analyst view in your answer with the URL citation. Do not read more than 2 URLs per turn (budget).",
    schema: z.object({ url: z.string().url() }),
  },
);
TOOL_META.read_url = { risk: "read" };

const compareCommunitySentimentTool = tool(
  async ({ symbol }) => {
    // The wedge vs raw ChatGPT — parallel Reddit + X + ValuePickr snapshot with
    // divergence detection. "Divergent" is where the alpha lives: X hype but
    // ValuePickr fundamental skepticism = classic Indian retail trap.
    const [redditPayload, xRes, vpRes] = await Promise.all([
      getRedditBuzz().catch(() => null),
      webSearch(`$${symbol} OR #${symbol}`, "x", 6),
      webSearch(symbol, "valuepickr", 4),
    ]);
    const redditHit = redditPayload?.items.find((it) => it.entry.symbol === symbol) ?? null;
    const reddit = redditHit
      ? {
          score: redditHit.score,
          mentions: redditHit.mentions,
          upvotes: redditHit.upvotes,
          topPosts: redditHit.posts.slice(0, 2).map((p) => ({ title: p.title, url: p.url })),
        }
      : { score: 0, mentions: 0, upvotes: 0, topPosts: [] as Array<{ title: string; url: string }> };
    const x = {
      hitCount: xRes.hits.length,
      posts: xRes.hits.slice(0, 4).map((h) => ({ title: h.title, url: h.url, snippet: h.snippet })),
      note: xRes.note,
    };
    const valuepickr = {
      hitCount: vpRes.hits.length,
      threads: vpRes.hits.slice(0, 3).map((h) => ({ title: h.title, url: h.url, snippet: h.snippet })),
      note: vpRes.note,
    };
    // Crude verdict — lets the agent see "the shape" without overselling.
    let verdict: "bullish_hint" | "bearish_hint" | "divergent" | "quiet" = "quiet";
    let divergenceNote: string | undefined;
    const redditActive = reddit.mentions >= 3;
    const xActive = x.hitCount >= 3;
    const vpActive = valuepickr.hitCount >= 1;
    if (!redditActive && !xActive && !vpActive) {
      verdict = "quiet";
    } else if (xActive && vpActive) {
      verdict = "divergent";
      divergenceNote =
        "X cashtag active AND ValuePickr thread has recent posts — read both to see if retail hype aligns with the value-investor bull/bear thesis.";
    } else if (xActive && !vpActive) {
      verdict = "bullish_hint";
      divergenceNote =
        "X cashtag active but no ValuePickr signal — could be retail-only momentum without fundamental backing. Verify with fundamentals + guidance.";
    } else if (vpActive && !xActive) {
      verdict = "bearish_hint";
      divergenceNote =
        "ValuePickr thread active but X quiet — often means the value community is discussing structural concerns retail hasn't priced in yet.";
    }
    return { symbol, verdict, divergenceNote, reddit, x, valuepickr };
  },
  {
    name: "compare_community_sentiment",
    description:
      "Parallel snapshot of Reddit + X + ValuePickr chatter on one symbol with a divergence verdict ('divergent' / 'bullish_hint' / 'bearish_hint' / 'quiet'). Use for 'what's the vibe on X?', 'what do serious retail investors think?', 'is the community bullish or bearish?'. Follow up with read_url on the highest-signal thread if the verdict is 'divergent'.",
    schema: z.object({ symbol: SymbolField }),
  },
);
TOOL_META.compare_community_sentiment = { risk: "read" };

const getNewsPulseTool = tool(
  async ({ symbol, exchange }) => {
    // One-shot fetch that gives the LLM everything it needs to characterize
    // "the flow" — news + guidance + institutional positioning — without
    // needing to chain 4 separate tool calls.
    const [news, guidance, flows, buzz] = await Promise.all([
      getStockNews(symbol, exchange, 15).catch(() => []),
      getRecentGuidance({ symbol, limit: 4 }).catch(() => []),
      getInstFlows().catch(() => null),
      getRedditBuzz().catch(() => null),
    ]);

    const scored = news.length > 0
      ? await scoreHeadlines(symbol, news).catch(() => new Map<string, { score: number; reason: string }>())
      : new Map<string, { score: number; reason: string }>();

    // Cheap keyword-based tilt classifier so we don't need a second LLM pass.
    // Anchored to Indian-equity vocabulary observed in headlines.
    const POS_RE = /\b(beat|beats|record|highest|surge|surges|jump|jumps|upgrade|upgraded|order win|bags order|expansion|launches|approval|approved|profit|profits|q\d rise|guidance raised|raises guidance|acquires|acquisition|majority stake|multi[- ]year high|52[- ]week high|dividend|bonus)\b/i;
    const NEG_RE = /\b(miss|misses|downgrade|downgraded|probe|probed|raid|investigation|penalty|fine|fraud|scam|resigns|resignation|exit|steps down|guidance cut|cuts guidance|loss|losses|fall|falls|plunge|plunges|decline|declines|weak|weakens|52[- ]week low|multi[- ]year low|default|writeoff|write[- ]off|impairment|dispute|lawsuit|sued|recall)\b/i;
    function tiltOf(title: string): "POSITIVE" | "NEUTRAL" | "CAUTION" {
      if (NEG_RE.test(title)) return "CAUTION";
      if (POS_RE.test(title)) return "POSITIVE";
      return "NEUTRAL";
    }

    const enriched = news.map((n) => ({
      title: n.title,
      publisher: n.publisher,
      url: n.url,
      publishedAt: new Date(n.publishedAt).toISOString(),
      materiality: scored.get(n.url)?.score ?? 0,
      reason: scored.get(n.url)?.reason ?? null,
      tilt: tiltOf(n.title),
    }));
    enriched.sort((a, b) => (b.materiality - a.materiality) || (b.publishedAt > a.publishedAt ? 1 : -1));

    const material = enriched.filter((n) => n.materiality >= 7);
    const posCount = enriched.filter((n) => n.tilt === "POSITIVE").length;
    const cautionCount = enriched.filter((n) => n.tilt === "CAUTION").length;
    const neutralCount = enriched.length - posCount - cautionCount;
    let newsFlowTilt: "POSITIVE" | "NEUTRAL" | "CAUTION" = "NEUTRAL";
    if (posCount >= 2 && posCount > cautionCount * 2) newsFlowTilt = "POSITIVE";
    else if (cautionCount >= 2 && cautionCount > posCount * 2) newsFlowTilt = "CAUTION";

    const flow = flows?.bySymbol?.[symbol] ?? null;
    const instSummary = flow
      ? {
          windowDays: flows?.windowDays ?? null,
          fiiNet: flow.fiiNet,
          diiNet: flow.diiNet,
          instNet: flow.instNet,
          dealCount: flow.dealCount,
          lastDealDate: flow.lastDealDate,
        }
      : null;

    // Map GuidanceFeedRow → LLM-friendly timeline; derive sentiment from
    // direction since the row itself has no sentiment field.
    const dirToSentiment = (d: "up" | "down" | "flat" | "mixed"): "POSITIVE" | "NEUTRAL" | "CAUTION" =>
      d === "up" ? "POSITIVE" : d === "down" ? "CAUTION" : "NEUTRAL";
    const guidanceTimeline = guidance.map((g) => ({
      date: g.filed_at,
      metric: g.metric,
      direction: g.direction,
      timeframe: g.timeframe,
      value: g.value_text,
      quote: g.quote?.slice(0, 240),
      sentiment: dirToSentiment(g.direction),
      source: g.filing?.pdf_url ?? null,
    }));

    const redditHit = buzz?.items.find((it) => it.entry.symbol === symbol) ?? null;
    const chatter = redditHit
      ? { score: redditHit.score, mentions: redditHit.mentions, upvotes: redditHit.upvotes }
      : { score: 0, mentions: 0, upvotes: 0 };

    // Compact "pulse verdict" the LLM can echo directly. Deliberately
    // conservative — anchors the answer to observed evidence and never
    // implies a recommendation.
    const drivers: string[] = [];
    if (newsFlowTilt !== "NEUTRAL") drivers.push(`news flow ${newsFlowTilt.toLowerCase()}`);
    if (material.length >= 2) drivers.push(`${material.length} material headlines`);
    if (guidanceTimeline.some((g) => g.sentiment === "POSITIVE")) drivers.push("recent positive guidance");
    if (guidanceTimeline.some((g) => g.sentiment === "CAUTION")) drivers.push("cautious guidance");
    if (instSummary && Math.abs(instSummary.instNet ?? 0) > 0) drivers.push(`inst net ₹${Math.round((instSummary.instNet ?? 0) / 1e7)}Cr`);
    if (chatter.mentions >= 3) drivers.push("Reddit chatter");

    return {
      symbol,
      windowDays: 14,
      newsFlow: {
        tilt: newsFlowTilt,
        totals: { positive: posCount, neutral: neutralCount, caution: cautionCount },
        materialHeadlines: material.slice(0, 5),
        topHeadlines: enriched.slice(0, 8),
      },
      guidanceTimeline,
      institutional: instSummary,
      chatter,
      drivers,
      note:
        "Pulse is descriptive, not prescriptive: characterize what the flow LOOKS like using drivers[] and headline titles. Do not recommend buy/sell.",
    };
  },
  {
    name: "get_news_pulse",
    description:
      "One-shot 'pulse' for a stock: recent news flow with materiality + POSITIVE/NEUTRAL/CAUTION tilt, guidance timeline (last 4 quarters), institutional flow summary (30d), and Reddit chatter — combined into a compact JSON. Use this INSTEAD of chaining get_news+get_guidance+get_inst_flows when the user asks 'what's the news flow', 'what's happening at X', 'summarize signal on X', 'news + guidance summary'. Purely descriptive — never emit buy/sell.",
    schema: z.object({ symbol: SymbolField, exchange: ExchangeField }),
  },
);
TOOL_META.get_news_pulse = { risk: "read" };

export const AGENT_TOOLS = [
  getQuoteTool,
  getQuotesBatchTool,
  getFundamentalsTool,
  getScorecardTool,
  getNewsTool,
  getInstFlowsTool,
  getGuidanceTool,
  getPeersTool,
  searchSymbolsTool,
  getHistoryStatsTool,
  getTechnicalsTool,
  getAIBriefTool,
  getRedditBuzzTool,
  getCorporateActionsTool,
  getShareholdingTool,
  webSearchTool,
  readUrlTool,
  compareCommunitySentimentTool,
  getNewsPulseTool,
];

// Sentinel keys on tool return payloads. `stream.ts` sniffs for these to emit
// `action_executed` / `action_proposed` SSE events so the UI can render a toast
// or a Confirm card instead of just a raw tool chip.
export const ACTION_EXECUTED_KEY = "__actionExecuted";
export const ACTION_PROPOSED_KEY = "__actionProposed";

// Build tools with user context bound in. The read tools are always available;
// write tools only appear when we have a `userId` (so a signed-out visitor
// can research but can't accidentally mutate anything). This is the entry
// point for `graph.ts` — read-only `AGENT_TOOLS` stays exported for tests.
export function buildAgentTools(ctx: { userId: string | null }) {
  if (!ctx.userId) return AGENT_TOOLS;
  const userId = ctx.userId;

  const getMyWatchlistTool = tool(
    async () => {
      const admin = getServiceClient();
      if (!admin) return { error: "watchlist backend not configured" };
      const { data, error } = await admin
        .from("watchlist_items")
        .select("symbol, exchange, added_at")
        .eq("user_id", userId)
        .order("added_at", { ascending: false });
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, items: data ?? [] };
    },
    {
      name: "get_my_watchlist",
      description:
        "Fetch the current user's watchlist symbols. Call this whenever the user says 'my watchlist', 'my stocks', 'stocks I'm tracking'. No arguments — the user is already identified.",
      schema: z.object({}),
    },
  );
  TOOL_META.get_my_watchlist = { risk: "read" };

  const getMyAlertsTool = tool(
    async () => {
      const admin = getServiceClient();
      if (!admin) return { error: "alerts backend not configured" };
      const { data, error } = await admin
        .from("alerts")
        .select("id, symbol, exchange, triggers, status, label, last_notified_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, items: data ?? [] };
    },
    {
      name: "get_my_alerts",
      description:
        "Fetch the current user's alerts (id, symbol, triggers, status, last-notified). Call this for 'my alerts', 'what am I watching for', 'which alerts have fired recently'.",
      schema: z.object({}),
    },
  );
  TOOL_META.get_my_alerts = { risk: "read" };

  const getMyPortfolioHoldingsTool = tool(
    async () => {
      const admin = getServiceClient();
      if (!admin) return { error: "portfolio backend not configured" };
      const { data, error } = await admin
        .from("portfolio_imports")
        .select("id, holdings, source, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { note: "no portfolio imported yet — ask the user to paste holdings CSV and call run_portfolio_doctor" };
      return {
        importId: data.id,
        source: data.source,
        importedAt: data.created_at,
        holdings: data.holdings,
      };
    },
    {
      name: "get_my_portfolio_holdings",
      description:
        "Fetch the user's most recently imported portfolio holdings (from Portfolio Doctor). Use for 'my portfolio', 'my holdings', 'diagnose my portfolio' when no CSV is inline. If nothing imported, prompt the user to paste their holdings.",
      schema: z.object({}),
    },
  );
  TOOL_META.get_my_portfolio_holdings = { risk: "read" };

  const removeFromWatchlistTool = tool(
    async ({ symbol, exchange }) => {
      const admin = getServiceClient();
      if (!admin) return { error: "watchlist backend not configured" };
      const { data, error } = await admin
        .from("watchlist_items")
        .delete()
        .eq("user_id", userId)
        .eq("symbol", symbol)
        .eq("exchange", exchange)
        .select("id");
      if (error) return { error: error.message };
      if (!data || data.length === 0) return { error: `${symbol} not in watchlist` };
      return {
        ok: true,
        [ACTION_EXECUTED_KEY]: {
          kind: "watchlist_remove",
          symbol,
          exchange,
          message: `Removed ${symbol} from your watchlist`,
        },
      };
    },
    {
      name: "remove_from_watchlist",
      description:
        "Remove a symbol from the current user's watchlist. Auto-executes (reversible via re-add). Use when the user says 'remove X', 'stop watching X', 'take X off my list'.",
      schema: z.object({ symbol: SymbolField, exchange: ExchangeField }),
    },
  );
  TOOL_META.remove_from_watchlist = { risk: "low_write" };

  const pauseAlertTool = tool(
    async ({ alertId }) => {
      const admin = getServiceClient();
      if (!admin) return { error: "alerts backend not configured" };
      const { data, error } = await admin
        .from("alerts")
        .update({ status: "paused" })
        .eq("id", alertId)
        .eq("user_id", userId)
        .select("id, symbol")
        .maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { error: "alert not found or not owned by user" };
      return {
        ok: true,
        [ACTION_EXECUTED_KEY]: {
          kind: "alert_pause",
          alertId,
          symbol: data.symbol,
          message: `Paused alert on ${data.symbol}`,
        },
      };
    },
    {
      name: "pause_alert",
      description:
        "Pause (not delete) one of the user's alerts. Reversible — status returns to 'active' if user re-enables. Use for 'pause my RELIANCE alert', 'stop notifying me on X for now'.",
      schema: z.object({ alertId: z.string().uuid() }),
    },
  );
  TOOL_META.pause_alert = { risk: "low_write" };

  const deleteAlertTool = tool(
    async ({ alertId }) => {
      // High-risk / destructive — never auto-execute. Return a proposal envelope
      // for the UI to render a Confirm card. Actual DELETE happens client-side
      // via /api/alerts/[id] after user approval.
      const admin = getServiceClient();
      const label = await (async () => {
        if (!admin) return null;
        const { data } = await admin
          .from("alerts")
          .select("symbol, triggers")
          .eq("id", alertId)
          .eq("user_id", userId)
          .maybeSingle();
        return data;
      })();
      if (!label) return { error: "alert not found or not owned by user" };
      return {
        [ACTION_PROPOSED_KEY]: {
          kind: "alert_delete",
          alertId,
          symbol: label.symbol,
          message: `Delete alert on ${label.symbol}? This cannot be undone.`,
        },
      };
    },
    {
      name: "delete_alert",
      description:
        "Propose deleting an alert (destructive, non-reversible). Does NOT execute — returns a Confirm card. Use ONLY when the user explicitly says 'delete', 'remove permanently'. For temporary silence use pause_alert instead.",
      schema: z.object({ alertId: z.string().uuid() }),
    },
  );
  TOOL_META.delete_alert = { risk: "high_write" };

  const runPortfolioDoctorTool = tool(
    async ({ csv }) => {
      const parsed = parseHoldingsCsv(csv);
      if (parsed.holdings.length === 0) {
        return {
          error: "could not parse any holdings from CSV",
          parseErrors: parsed.errors.slice(0, 4),
          hint: "CSV should have columns like symbol/tradingsymbol, qty/quantity, avg/avgprice",
        };
      }
      const { importId, analysis, diagnosis, diagnosisSource } = await runDoctorPipeline({
        holdings: parsed.holdings,
        source: "csv",
        userId,
      });
      return {
        importId,
        source: diagnosisSource,
        holdingsCount: parsed.holdings.length,
        parseWarnings: parsed.warnings.slice(0, 3),
        totals: {
          invested: Number(analysis.invested.toFixed(2)),
          current: Number(analysis.current.toFixed(2)),
          pl: Number(analysis.pl.toFixed(2)),
          plPct: Number(analysis.plPct.toFixed(2)),
        },
        sectorBreakdown: analysis.sectorBreakdown.slice(0, 5),
        concentrationWarnings: analysis.warnings,
        diagnosis: {
          healthScore: diagnosis.health_score,
          doctorsNote: diagnosis.doctors_note,
          redFlags: diagnosis.red_flags,
          qualityIssues: diagnosis.quality_issues.slice(0, 8),
          rebalanceSuggestions: diagnosis.rebalance_suggestions.slice(0, 5),
          sectorTilt: diagnosis.sector_tilt ?? null,
        },
        [ACTION_EXECUTED_KEY]: {
          kind: "doctor_run",
          message: `Diagnosed portfolio · health ${diagnosis.health_score}/100`,
        },
      };
    },
    {
      name: "run_portfolio_doctor",
      description:
        "Analyse a portfolio CSV pasted by the user: parses holdings, fetches live quotes, computes P/L + sector breakdown + concentration warnings, generates an AI health diagnosis. Use whenever the user pastes CSV holdings or asks 'diagnose my portfolio' with inline data. For a previously-imported portfolio (no CSV), call get_my_portfolio_holdings first.",
      schema: z.object({
        csv: z
          .string()
          .min(10)
          .max(20000)
          .describe("CSV text with columns like symbol,qty,avg — one holding per row"),
      }),
    },
  );
  TOOL_META.run_portfolio_doctor = { risk: "read" };

  const addToWatchlistTool = tool(
    async ({ symbol, exchange }) => {
      const admin = getServiceClient();
      if (!admin) return { error: "watchlist backend not configured" };
      const [{ data: profile }, { count }] = await Promise.all([
        admin.from("profiles").select("plan").eq("user_id", userId).single(),
        admin
          .from("watchlist_items")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);
      const plan = (profile?.plan ?? "free") as PlanId;
      const max = PLANS[plan].maxWatchlistItems;
      if ((count ?? 0) >= max) {
        return { error: `watchlist full (${max}); user must remove one first` };
      }
      const { error } = await admin
        .from("watchlist_items")
        .insert({ user_id: userId, symbol, exchange });
      if (error) {
        if (error.code === "23505") return { error: "already in watchlist" };
        return { error: error.message };
      }
      return {
        ok: true,
        [ACTION_EXECUTED_KEY]: {
          kind: "watchlist_add",
          symbol,
          exchange,
          message: `Added ${symbol} to your watchlist`,
        },
      };
    },
    {
      name: "add_to_watchlist",
      description:
        "Add a stock to the current user's watchlist. Auto-executes — use whenever the user asks to 'add', 'watch', or 'track' a symbol. Respects plan cap (free=3, pro=unlimited).",
      schema: z.object({ symbol: SymbolField, exchange: ExchangeField }),
    },
  );
  TOOL_META.add_to_watchlist = { risk: "low_write" };

  const proposeAlertTool = tool(
    async ({ symbol, exchange, condition, targetPrice, note }) => {
      // Never writes. Returns a proposal envelope — the UI renders a Confirm
      // card and POSTs directly to /api/alerts on approval. This sidesteps
      // LangGraph's interrupt/resume complexity for v1.
      return {
        [ACTION_PROPOSED_KEY]: {
          kind: "alert_create",
          symbol,
          exchange,
          triggers: { price: { condition, target: targetPrice } },
          note: note ?? null,
          message: `Set alert on ${symbol} ${condition} ₹${targetPrice}?`,
        },
      };
    },
    {
      name: "propose_alert",
      description:
        "Propose a price alert for the current user. Does NOT create it — the user must click Confirm on the UI card. Use when the user asks to 'alert me if X hits Y' or 'notify me when Z'. Never invent thresholds; ask the user for the target price if they didn't specify.",
      schema: z.object({
        symbol: SymbolField,
        exchange: ExchangeField,
        condition: z.enum(["above", "below"]),
        targetPrice: z.number().positive().max(1_000_000),
        note: z.string().max(120).optional(),
      }),
    },
  );
  TOOL_META.propose_alert = { risk: "high_write" };

  return [
    ...AGENT_TOOLS,
    getMyWatchlistTool,
    getMyAlertsTool,
    getMyPortfolioHoldingsTool,
    addToWatchlistTool,
    removeFromWatchlistTool,
    pauseAlertTool,
    deleteAlertTool,
    runPortfolioDoctorTool,
    proposeAlertTool,
  ];
}
