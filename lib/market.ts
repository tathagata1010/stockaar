import { redis } from "./redis";
import { type Quote } from "./upstox";
import { getUniverse } from "./universe";
import { yahooFetch } from "./yahoo/client";
import { cache } from "react";

export type IndexQuote = {
  name: string;
  yahooSymbol: string;
  lastPrice: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  previousClose: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  updatedAt: number;
};

export const INDICES = [
  { name: "Nifty 50", yahooSymbol: "^NSEI", slug: "nifty-50" },
  { name: "Sensex", yahooSymbol: "^BSESN", slug: "sensex" },
  { name: "Bank Nifty", yahooSymbol: "^NSEBANK", slug: "bank-nifty" },
] as const;

export type IndexSlug = (typeof INDICES)[number]["slug"];

export function findIndexBySlug(slug: string) {
  return INDICES.find((i) => i.slug === slug) ?? null;
}

const INDEX_TTL = 600;
const INDEX_SOFT_TTL_MS = 30_000;
const MOVERS_TTL = 300;

type IndexEnvelope = { quote: IndexQuote; builtAt: number };
const indexInflight = new Map<string, Promise<IndexQuote | null>>();

async function fetchIndex(name: string, yahooSymbol: string): Promise<IndexQuote | null> {
  try {
    const res = await yahooFetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=2d`,
      { withAuth: false },
    );
    if (!res || !res.ok) return null;
    const data = await res.json();
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const lastPrice = meta.regularMarketPrice;
    const close = meta.chartPreviousClose ?? meta.previousClose ?? lastPrice;
    const change = lastPrice - close;
    const quote: IndexQuote = {
      name,
      yahooSymbol,
      lastPrice,
      change,
      changePct: close ? (change / close) * 100 : 0,
      dayHigh: meta.regularMarketDayHigh ?? lastPrice,
      dayLow: meta.regularMarketDayLow ?? lastPrice,
      previousClose: close,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? lastPrice,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? lastPrice,
      updatedAt: Date.now(),
    };
    const envelope: IndexEnvelope = { quote, builtAt: Date.now() };
    await redis.set(`index:${yahooSymbol}`, envelope, { ex: INDEX_TTL }).catch(() => {});
    return quote;
  } catch {
    return null;
  }
}

export async function getIndex(name: string, yahooSymbol: string): Promise<IndexQuote | null> {
  const key = `index:${yahooSymbol}`;
  const cached = await redis.get<IndexEnvelope | IndexQuote>(key).catch(() => null);
  // Back-compat: old plain IndexQuote entries get treated as cold envelopes once.
  const envelope: IndexEnvelope | null =
    cached && typeof cached === "object" && "quote" in cached ? cached
    : cached && typeof cached === "object" && "lastPrice" in cached
      ? { quote: cached as IndexQuote, builtAt: (cached as IndexQuote).updatedAt ?? 0 }
      : null;
  if (envelope) {
    if (Date.now() - envelope.builtAt > INDEX_SOFT_TTL_MS) {
      if (!indexInflight.has(key)) {
        const p = fetchIndex(name, yahooSymbol).finally(() => indexInflight.delete(key));
        indexInflight.set(key, p);
      }
    }
    return envelope.quote;
  }
  if (!indexInflight.has(key)) {
    const p = fetchIndex(name, yahooSymbol).finally(() => indexInflight.delete(key));
    indexInflight.set(key, p);
  }
  return indexInflight.get(key)!;
}

export const getAllIndices = cache(async (): Promise<IndexQuote[]> => {
  const results = await Promise.all(INDICES.map((i) => getIndex(i.name, i.yahooSymbol)));
  return results.filter((q): q is IndexQuote => q !== null);
});

export type Movers = { gainers: Quote[]; losers: Quote[]; updatedAt: number };

export async function getTopMovers(limit = 5): Promise<Movers> {
  const cacheKey = `movers:top:${limit}`;
  const cached = await redis.get<Movers>(cacheKey).catch(() => null);
  if (cached && (cached.gainers?.length || cached.losers?.length)) return cached;

  // Derive from the warm universe (full ~593 symbols) instead of a 40-symbol slice.
  const rows = await getUniverse().catch(() => []);
  const quotes = rows
    .map((r) => r.quote)
    .filter((q): q is Quote => !!q && Number.isFinite(q.changePct));

  const sorted = [...quotes].sort((a, b) => b.changePct - a.changePct);
  const movers: Movers = {
    gainers: sorted.slice(0, limit),
    losers: sorted.slice(-limit).reverse(),
    updatedAt: Date.now(),
  };

  if (movers.gainers.length || movers.losers.length) {
    await redis.set(cacheKey, movers, { ex: MOVERS_TTL }).catch(() => {});
  }
  return movers;
}
