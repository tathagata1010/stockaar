import { redis } from "./redis";
import { type Quote } from "./upstox";
import { getUniverse } from "./universe";

export type IndexQuote = {
  name: string;
  yahooSymbol: string;
  lastPrice: number;
  change: number;
  changePct: number;
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

const INDEX_TTL = 60;
const MOVERS_TTL = 300;

export async function getIndex(name: string, yahooSymbol: string): Promise<IndexQuote | null> {
  const key = `index:${yahooSymbol}`;
  const cached = await redis.get<IndexQuote>(key).catch(() => null);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=2d`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; StocksbrewBot/1.0)", Accept: "application/json" },
        next: { revalidate: 0 },
      },
    );
    if (!res.ok) return null;
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
      updatedAt: Date.now(),
    };
    await redis.set(key, quote, { ex: INDEX_TTL }).catch(() => {});
    return quote;
  } catch {
    return null;
  }
}

export async function getAllIndices(): Promise<IndexQuote[]> {
  const results = await Promise.all(INDICES.map((i) => getIndex(i.name, i.yahooSymbol)));
  return results.filter((q): q is IndexQuote => q !== null);
}

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
