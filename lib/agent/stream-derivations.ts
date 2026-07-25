import { NSE_SYMBOLS_LITE } from "@/lib/nse-symbols-lite";
import type { Source } from "@/components/ui/SourceBadge";

export type ToolEventLike = {
  name: string;
  args?: unknown;
  preview?: string;
  doneAt?: number;
  status: "running" | "done";
};

// Map raw tool names to attribution source badges.
const TOOL_SOURCE_MAP: Record<string, Source> = {
  get_quote: "yahoo",
  get_quotes_batch: "yahoo",
  get_fundamentals: "yahoo",
  get_history_stats: "yahoo",
  get_technicals: "yahoo",
  get_news: "web",
  get_news_pulse: "web",
  get_reddit_buzz: "reddit",
  get_guidance: "guidance",
  get_corporate_actions: "filing",
  get_shareholding: "filing",
  get_scorecard: "ai",
  get_ai_brief: "ai",
  compare_community_sentiment: "reddit",
  web_search: "web",
  read_url: "web",
};

export function mapToolToSource(name: string): Source | null {
  return TOOL_SOURCE_MAP[name] ?? null;
}

const SOURCE_TOOLS = new Set([
  "get_news",
  "get_news_pulse",
  "get_guidance",
  "get_corporate_actions",
  "get_shareholding",
  "web_search",
  "read_url",
  "get_reddit_buzz",
  "compare_community_sentiment",
]);

export type SourceCard = {
  name: string;
  preview: string;
  source: Source;
  doneAt?: number;
};

export function deriveSourcesFromTools(tools: ToolEventLike[]): SourceCard[] {
  const cards: SourceCard[] = [];
  for (const t of tools) {
    if (t.status !== "done" || !SOURCE_TOOLS.has(t.name)) continue;
    const source = mapToolToSource(t.name);
    if (!source) continue;
    cards.push({
      name: t.name,
      preview: t.preview ?? "",
      source,
      doneAt: t.doneAt,
    });
  }
  return cards;
}

// Cross-check against NSE symbol master so we drop "SEBI"/"RBI"/"IPO"/"FII" —
// these look like tickers but aren't listed and would confuse the user if
// linked to a stock page.
const SYMBOL_SET = new Set(NSE_SYMBOLS_LITE.map((s) => s.symbol));
const SYMBOL_NAME_MAP = new Map(NSE_SYMBOLS_LITE.map((s) => [s.symbol, s.name]));

// Tokens that look like tickers but aren't — regulators, acronyms, indices.
const DENYLIST = new Set([
  "SEBI", "RBI", "IPO", "FII", "DII", "NSE", "BSE", "GST", "TDS", "PAN",
  "IST", "USD", "INR", "EUR", "GBP", "PE", "PB", "EPS", "ROE", "ROA",
  "EBITDA", "TTM", "YOY", "QOQ", "AGM", "EGM", "CEO", "CFO", "COO",
  "NIFTY", "SENSEX", "AI", "IT", "FMCG", "M&A",
]);

export type SymbolMention = {
  symbol: string;
  name: string;
};

// Common noise tokens in company names — stripped when building name matchers.
const NAME_STOP = new Set([
  "the", "of", "and", "for", "india", "limited", "ltd", "co", "company",
  "corporation", "corp", "industries", "industry", "enterprises", "group",
  "holdings", "international", "global", "national",
]);

type NameMatcher = { symbol: string; needle: string };
let NAME_MATCHERS_CACHE: NameMatcher[] | null = null;

function nameMatchers(): NameMatcher[] {
  if (NAME_MATCHERS_CACHE) return NAME_MATCHERS_CACHE;
  const out: NameMatcher[] = [];
  for (const s of NSE_SYMBOLS_LITE) {
    // The full name (case-insensitive) — e.g. "Cochin Shipyard".
    const full = s.name.toLowerCase().trim();
    if (full.length >= 4) out.push({ symbol: s.symbol, needle: full });
    // A "core" needle: strip stopwords, keep first 2 meaningful tokens.
    // "Reliance Industries" → "reliance", "Tata Consultancy Services" → "tata consultancy".
    const tokens = full.split(/\s+/).filter((t) => !NAME_STOP.has(t) && t.length > 2);
    if (tokens.length >= 1) {
      const core = tokens.slice(0, 2).join(" ");
      if (core !== full && core.length >= 4) out.push({ symbol: s.symbol, needle: core });
    }
  }
  // Longer needles first — more specific.
  out.sort((a, b) => b.needle.length - a.needle.length);
  NAME_MATCHERS_CACHE = out;
  return out;
}

export function deriveSymbolsFromText(text: string): SymbolMention[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: SymbolMention[] = [];
  // Pass 1: uppercase symbol tokens (RELIANCE, TCS, M&M).
  const tokens = text.match(/\b[A-Z][A-Z0-9&]{2,14}\b/g) ?? [];
  for (const tok of tokens) {
    if (DENYLIST.has(tok)) continue;
    if (!SYMBOL_SET.has(tok)) continue;
    if (seen.has(tok)) continue;
    seen.add(tok);
    out.push({ symbol: tok, name: SYMBOL_NAME_MAP.get(tok) ?? tok });
  }
  // Pass 2: company-name substrings (case-insensitive).
  // Match on word boundaries so "reliance" catches "Reliance Industries" but
  // not "reliancesomeword".
  const lower = ` ${text.toLowerCase()} `;
  for (const m of nameMatchers()) {
    if (seen.has(m.symbol)) continue;
    const idx = lower.indexOf(m.needle);
    if (idx < 0) continue;
    const before = lower.charCodeAt(idx - 1);
    const after = lower.charCodeAt(idx + m.needle.length);
    const isWordBoundary = (c: number) => !((c >= 97 && c <= 122) || (c >= 48 && c <= 57));
    if (!isWordBoundary(before) || !isWordBoundary(after)) continue;
    seen.add(m.symbol);
    out.push({ symbol: m.symbol, name: SYMBOL_NAME_MAP.get(m.symbol) ?? m.symbol });
  }
  return out;
}
