// Trendlyne broker reports scraper. The page embeds reports as schema.org/Review
// JSON-LD — stable to extract and explicitly meant for machine consumption.
// Cached 24h because broker reports refresh slowly (≤1–2/day per stock).

import { redis } from "./redis";
import { YAHOO_UA } from "./yahoo-auth";

export type BrokerAction =
  | "Buy"
  | "Sell"
  | "Hold"
  | "Accumulate"
  | "Reduce"
  | "Neutral"
  | "Other";

export type BrokerReport = {
  firm: string;
  action: BrokerAction;
  target: number | null;
  date: number; // ms epoch
  url: string;
  title: string;
};

const BROKER_TTL_SECONDS = 60 * 60 * 24;
const NEG_TTL_SECONDS = 60 * 60 * 6;
const ERR_TTL_SECONDS = 60 * 5;

function cacheKey(symbol: string) {
  return `trendlyne-brokers:NSE:${symbol}:v1`;
}
function negKey(symbol: string) {
  return `trendlyne-brokers:404:${symbol}:v1`;
}

export async function fetchBrokerReports(
  symbol: string,
  limit = 12,
): Promise<BrokerReport[]> {
  const key = cacheKey(symbol);
  const cached = await redis.get<BrokerReport[]>(key).catch(() => null);
  if (cached) return cached.slice(0, limit);

  const neg = await redis.get<number>(negKey(symbol)).catch(() => null);
  if (neg) return [];

  try {
    const url = `https://trendlyne.com/research-reports/stock/${encodeURIComponent(symbol)}/`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": YAHOO_UA,
        Accept: "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      if (res.status === 404) {
        redis.set(negKey(symbol), Date.now(), { ex: NEG_TTL_SECONDS }).catch(() => {});
      }
      console.warn("[trendlyne-brokers] HTTP " + res.status + " for " + symbol);
      return [];
    }
    const html = await res.text();
    const reports = parseReports(html);
    if (reports.length === 0) {
      redis.set(negKey(symbol), Date.now(), { ex: NEG_TTL_SECONDS }).catch(() => {});
      return [];
    }
    redis.set(key, reports, { ex: BROKER_TTL_SECONDS }).catch(() => {});
    return reports.slice(0, limit);
  } catch (e) {
    console.warn("[trendlyne-brokers] fetch error", e);
    redis.set(negKey(symbol), Date.now(), { ex: ERR_TTL_SECONDS }).catch(() => {});
    return [];
  }
}

export function parseReports(html: string): BrokerReport[] {
  const blocks = extractLdJsonBlocks(html);
  const byUrl = new Map<string, BrokerReport>();
  for (const raw of blocks) {
    let obj: unknown;
    try { obj = JSON.parse(raw.trim()); } catch { continue; }
    const items = Array.isArray(obj) ? obj : [obj];
    for (const item of items) {
      const r = toReport(item);
      if (r && !byUrl.has(r.url)) byUrl.set(r.url, r);
    }
  }
  return [...byUrl.values()].sort((a, b) => b.date - a.date);
}

function extractLdJsonBlocks(html: string): string[] {
  // Trendlyne mixes type="..." and type = "..." (spaces around =).
  const parts = html.split(/<script[^>]*type\s*=\s*"application\/ld\+json"[^>]*>/);
  const blocks: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    const end = parts[i].indexOf("</script>");
    if (end > 0) blocks.push(parts[i].slice(0, end));
  }
  return blocks;
}

function toReport(o: unknown): BrokerReport | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  if (r["@type"] !== "Review") return null;

  const author = r.author as { name?: string } | undefined;
  const firm = (author?.name ?? "").trim();
  if (!firm) return null;

  const url = typeof r.url === "string" ? r.url : "";
  const datePublished = typeof r.datePublished === "string" ? r.datePublished : "";
  const description = typeof r.description === "string" ? r.description : "";
  const name = typeof r.name === "string" ? r.name : "";

  const date = parseDate(datePublished);
  if (!date) return null;

  const { action, target } = parseDescription(description, name);
  const title = pickTitle(description, name, firm);

  return { firm, action, target, date, url, title };
}

function parseDate(s: string): number {
  // e.g. "June 3, 2026, midnight" or "April 21, 2026, midnight"
  const cleaned = s.replace(/,\s*midnight$/i, "").trim();
  const t = Date.parse(cleaned);
  return Number.isFinite(t) && t > 0 ? t : 0;
}

const ACTION_WORDS: Record<string, BrokerAction> = {
  buy: "Buy",
  sell: "Sell",
  hold: "Hold",
  accumulate: "Accumulate",
  reduce: "Reduce",
  neutral: "Neutral",
  add: "Accumulate",
  outperform: "Buy",
  overweight: "Buy",
  underperform: "Sell",
  underweight: "Sell",
};

function normalizeAction(word: string | undefined): BrokerAction {
  if (!word) return "Other";
  return ACTION_WORDS[word.toLowerCase().trim()] ?? "Other";
}

function parseDescription(
  description: string,
  fallbackText: string,
): { action: BrokerAction; target: number | null } {
  // Pattern A: "<Firm> released a <Action> report ... with a price target of <NNN.NN> on ..."
  const a = description.match(
    /released a ([A-Za-z]+)(?:\s+report)?.*?(?:with a price target of ([\d.]+))?\s+on /i,
  );
  if (a) {
    return {
      action: normalizeAction(a[1]),
      target: a[2] ? parseFloat(a[2]) : null,
    };
  }
  // Pattern B: "<Firm> (increased|decreased) <Action> price target of ... to <NNN.NN> on ..."
  const b = description.match(
    /(?:increased|decreased)\s+([A-Za-z]+)\s+price target.*?to ([\d.]+)\s+on /i,
  );
  if (b) {
    return { action: normalizeAction(b[1]), target: parseFloat(b[2]) };
  }
  // Pattern C: free-form title — scan both description and report name for action keyword.
  const blob = (description + " " + fallbackText).toUpperCase();
  for (const word of Object.keys(ACTION_WORDS)) {
    const re = new RegExp(`\\b${word.toUpperCase()}\\b`);
    if (re.test(blob)) return { action: ACTION_WORDS[word], target: null };
  }
  return { action: "Other", target: null };
}

function pickTitle(description: string, name: string, firm: string): string {
  // Formal description ("Firm released a Buy report ... target of NNN on DATE")
  // is just a restatement of fields we've already extracted — no extra info.
  // Use the cleaned report name when available, else nothing.
  if (/released a \w+ report/i.test(description) || /price target.*?to [\d.]+/i.test(description)) {
    return cleanTitle(name, firm);
  }
  return description || cleanTitle(name, firm);
}

function cleanTitle(name: string, firm: string): string {
  return name
    .replace(/^Latest research reports of .+? authored by .+? and published by .*$/i, "")
    .replace(new RegExp(`^${firm}\\s*[:\\-]?\\s*`, "i"), "")
    .trim();
}
