// Adaptive tool routing: given a natural-language question and (optionally) a
// context symbol, decide which preflight blocks to fetch. Kills the "same 8
// tools every time" waste while keeping the "empty tool → hallucinate template"
// safety net for open-ended questions.

export type PreflightKind =
  | "quote"
  | "fundamentals"
  | "scorecard"
  | "news"
  | "history"
  | "technicals"
  | "flows"
  | "peers"
  | "guidance";

export const ALL_KINDS: PreflightKind[] = [
  "quote",
  "fundamentals",
  "scorecard",
  "news",
  "history",
  "technicals",
  "flows",
  "peers",
  "guidance",
];

// Which read tool a preflight kind makes redundant. When preflight already
// injected the block into the SystemMessage, the agent doesn't need the tool
// schema — dropping saves ~50-100 TPM tokens per tool, which is the difference
// between under-budget and 413 on Groq's free tier.
export const PREFLIGHT_KIND_TOOL: Record<PreflightKind, string> = {
  quote: "get_quote",
  fundamentals: "get_fundamentals",
  scorecard: "get_scorecard",
  news: "get_news",
  history: "get_history_stats",
  technicals: "get_technicals",
  flows: "get_inst_flows",
  peers: "get_peers",
  guidance: "get_guidance",
};

const RULES: Array<{ pattern: RegExp; kinds: PreflightKind[] }> = [
  // Price / momentum
  { pattern: /\b(price|ltp|quote|trading at|current price)\b/i, kinds: ["quote"] },
  // Technicals / trend
  {
    pattern: /\b(rsi|sma|moving average|technical|trend|overbought|oversold|momentum|breakout|support|resistance)\b/i,
    kinds: ["quote", "technicals", "history"],
  },
  // Volatility / return
  {
    pattern: /\b(volatility|drawdown|1y return|52.?week|ytd|return.*year|return.*month)\b/i,
    kinds: ["quote", "history"],
  },
  // Fundamentals / valuation
  {
    pattern: /\b(p\/?e|p\/?b|roe|debt|margin|dividend|valuation|fundamental|market cap|financial)\b/i,
    kinds: ["quote", "fundamentals", "scorecard"],
  },
  // Peers
  {
    pattern: /\b(peer|compare|comparison|vs\.?|versus|sector|competitor)\b/i,
    kinds: ["fundamentals", "peers", "scorecard"],
  },
  // Flows / smart money
  {
    pattern: /\b(fii|dii|institutional|smart.?money|bulk|block deal|inst flow|flows)\b/i,
    kinds: ["flows", "guidance"],
  },
  // Guidance / management commentary
  {
    pattern: /\b(guidance|management|commentary|filing|concall|earnings call|outlook)\b/i,
    kinds: ["guidance", "fundamentals"],
  },
  // Growth / plans / capex / strategy — questions about the future. These
  // don't live in fundamentals; they live in concalls, presentations, and
  // fresh filings. Trigger the full bundle so the LLM has fundamentals as
  // anchors AND is forced to reach for web_search(concall|presentation).
  {
    pattern: /\b(plan|plans|strategy|strategies|growth|capex|capacity|expansion|roadmap|guidance|upcoming|future|outlook|pipeline|target|goal|vision)\b/i,
    kinds: ALL_KINDS,
  },
  // News / material updates
  {
    pattern: /\b(news|material|update|announcement|filing|corporate action|dividend|split|bonus)\b/i,
    kinds: ["news", "guidance"],
  },
  // Scorecard / signal
  {
    pattern: /\b(score|scorecard|signal|rating|health)\b/i,
    kinds: ["scorecard", "fundamentals", "quote"],
  },
  // Bull/bear / thesis / open-ended → full bundle (this is the "give me the
  // whole picture" case where the LLM benefits from every signal).
  {
    pattern: /\b(bull|bear|thesis|case|why|should|analyze|analysis|overview|deep dive|tell me|explain|view on)\b/i,
    kinds: ALL_KINDS,
  },
];

export function pickPreflightKinds(question: string): PreflightKind[] {
  const picked = new Set<PreflightKind>();
  for (const rule of RULES) {
    if (rule.pattern.test(question)) {
      for (const k of rule.kinds) picked.add(k);
    }
  }
  // If nothing matched, this is likely an open-ended question — fall back to
  // the full bundle so we don't leave the LLM data-starved. Better to over-fetch
  // than to hallucinate the template.
  if (picked.size === 0) return ALL_KINDS;
  // Always include quote — it's cheap, gives the answer a fresh anchor price,
  // and every answer's Snapshot section needs it.
  picked.add("quote");
  return ALL_KINDS.filter((k) => picked.has(k));
}
