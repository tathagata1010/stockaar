// Quote wrapper — Yahoo Finance v7 bulk (crumb/cookie) + v8 chart fallback.
// Filename kept for import stability — Upstox source itself was removed.

import { cache } from "react";
import { redis } from "./redis";
import { STALE_TTL_SECONDS, readStaleMany, staleKey } from "./stale-cache";
import { fetchQuotesFallback } from "./sources";
import { yahooFetch } from "./yahoo/client";

export type Quote = {
  symbol: string;
  exchange: "NSE" | "BSE";
  lastPrice: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  yearHigh?: number;
  yearLow?: number;
  volume?: number;
  updatedAt: number;
};

const CACHE_TTL_SECONDS = 60;
const YAHOO_BATCH_SIZE = 80;

function cacheKey(symbol: string, exchange: string) {
  return `quote:${exchange}:${symbol}`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const getQuote = cache(
  async (symbol: string, exchange: "NSE" | "BSE" = "NSE"): Promise<Quote | null> => {
    const [q] = await getQuotes([{ symbol, exchange }]);
    return q ?? null;
  },
);

export async function getQuotes(
  items: { symbol: string; exchange: "NSE" | "BSE" }[],
): Promise<Quote[]> {
  if (items.length === 0) return [];

  // Dedupe (callers may pass duplicates)
  const seen = new Set<string>();
  const unique: { symbol: string; exchange: "NSE" | "BSE" }[] = [];
  for (const it of items) {
    const k = `${it.exchange}:${it.symbol}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(it);
  }

  // 1. Batched cache read
  const keys = unique.map((i) => cacheKey(i.symbol, i.exchange));
  const cached = (await redis.mget<(Quote | null)[]>(...keys).catch(() => keys.map(() => null))) as (Quote | null)[];

  const found = new Map<string, Quote>();
  const misses: { symbol: string; exchange: "NSE" | "BSE" }[] = [];
  unique.forEach((it, i) => {
    const q = cached[i];
    if (q) found.set(`${it.exchange}:${it.symbol}`, q);
    else misses.push(it);
  });

  if (misses.length > 0) {
    const fresh = await fetchManyFromYahoo(misses);
    for (const q of fresh) found.set(`${q.exchange}:${q.symbol}`, q);

    // Yahoo miss → try NSE public endpoint for any still-missing NSE symbols.
    let nseFresh: Quote[] = [];
    const afterYahooMissing = unique.filter(
      (it) => !found.has(`${it.exchange}:${it.symbol}`),
    );
    if (afterYahooMissing.length > 0) {
      nseFresh = await fetchQuotesFallback(afterYahooMissing);
      for (const q of nseFresh) found.set(`${q.exchange}:${q.symbol}`, q);
    }

    const allFresh = [...fresh, ...nseFresh];
    if (allFresh.length > 0) {
      try {
        const pipe = redis.pipeline();
        for (const q of allFresh) {
          const k = cacheKey(q.symbol, q.exchange);
          pipe.set(k, q, { ex: CACHE_TTL_SECONDS });
          pipe.set(staleKey(k), q, { ex: STALE_TTL_SECONDS });
        }
        await pipe.exec();
      } catch {}
    }

    const stillMissing = unique.filter((it) => !found.has(`${it.exchange}:${it.symbol}`));
    if (stillMissing.length > 0) {
      const stale = await readStaleMany<Quote>(
        stillMissing.map((it) => cacheKey(it.symbol, it.exchange)),
      );
      stillMissing.forEach((it, i) => {
        const s = stale[i];
        if (s) found.set(`${it.exchange}:${it.symbol}`, s);
      });
    }
  }

  return unique
    .map((it) => found.get(`${it.exchange}:${it.symbol}`))
    .filter((q): q is Quote => q != null);
}

async function fetchManyFromYahoo(
  items: { symbol: string; exchange: "NSE" | "BSE" }[],
): Promise<Quote[]> {
  // Preferred: Yahoo v7 bulk (80/call) with crumb. Auth handled by yahooFetch.
  // Fallback: v8 chart per-symbol if v7 returns empty.
  const bulk = await fetchYahooV7Bulk(items);
  if (bulk.length === 0 && items.length > 0) return fetchYahooChartFallback(items);
  return bulk;
}

async function fetchYahooV7Bulk(
  items: { symbol: string; exchange: "NSE" | "BSE" }[],
): Promise<Quote[]> {
  const result: Quote[] = [];
  const batches = chunk(items, YAHOO_BATCH_SIZE);

  await Promise.all(
    batches.map(async (batch) => {
      const symbols = batch
        .map((b) => `${b.symbol}${b.exchange === "NSE" ? ".NS" : ".BO"}`)
        .join(",");
      const url =
        `https://query1.finance.yahoo.com/v7/finance/quote` +
        `?symbols=${encodeURIComponent(symbols)}`;
      const res = await yahooFetch(url);
      if (!res || !res.ok) return;
      try {
        const data = await res.json();
        const rows = (data?.quoteResponse?.result ?? []) as Array<Record<string, unknown>>;
        for (const r of rows) {
          const fullSym = String(r.symbol ?? "");
          const exchange: "NSE" | "BSE" = fullSym.endsWith(".BO") ? "BSE" : "NSE";
          const sym = fullSym.replace(/\.(NS|BO)$/i, "").toUpperCase();
          const lastPrice = Number(r.regularMarketPrice);
          if (!Number.isFinite(lastPrice) || lastPrice <= 0) continue;
          const close = Number(r.regularMarketPreviousClose ?? lastPrice);
          const change = Number.isFinite(r.regularMarketChange as number)
            ? (r.regularMarketChange as number)
            : lastPrice - close;
          const changePct = Number.isFinite(r.regularMarketChangePercent as number)
            ? (r.regularMarketChangePercent as number)
            : close
              ? (change / close) * 100
              : 0;
          result.push({
            symbol: sym,
            exchange,
            lastPrice,
            change,
            changePct,
            dayHigh: Number(r.regularMarketDayHigh ?? lastPrice),
            dayLow: Number(r.regularMarketDayLow ?? lastPrice),
            yearHigh: Number(r.fiftyTwoWeekHigh) || undefined,
            yearLow: Number(r.fiftyTwoWeekLow) || undefined,
            volume: Number(r.regularMarketVolume) || undefined,
            updatedAt: Date.now(),
          });
        }
      } catch {}
    }),
  );
  return result;
}

async function fetchYahooChartFallback(
  items: { symbol: string; exchange: "NSE" | "BSE" }[],
): Promise<Quote[]> {
  const YAHOO_CONCURRENCY = 24;
  const result: Quote[] = [];

  for (let i = 0; i < items.length; i += YAHOO_CONCURRENCY) {
    const batch = items.slice(i, i + YAHOO_CONCURRENCY);
    const out = await Promise.all(
      batch.map(async (it) => {
        const ySym = `${it.symbol}${it.exchange === "NSE" ? ".NS" : ".BO"}`;
        const res = await yahooFetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=1d&range=1d`,
          { withAuth: false },
        );
        if (!res || !res.ok) return null;
        try {
          const data = await res.json();
          const meta = data?.chart?.result?.[0]?.meta;
          if (!meta) return null;
          const lastPrice = Number(meta.regularMarketPrice);
          if (!Number.isFinite(lastPrice) || lastPrice <= 0) return null;
          const prevClose = Number(meta.chartPreviousClose ?? meta.previousClose ?? lastPrice);
          const change = lastPrice - prevClose;
          const changePct = prevClose ? (change / prevClose) * 100 : 0;
          const q: Quote = {
            symbol: it.symbol,
            exchange: it.exchange,
            lastPrice,
            change,
            changePct,
            dayHigh: Number(meta.regularMarketDayHigh ?? lastPrice),
            dayLow: Number(meta.regularMarketDayLow ?? lastPrice),
            yearHigh: Number(meta.fiftyTwoWeekHigh) || undefined,
            yearLow: Number(meta.fiftyTwoWeekLow) || undefined,
            volume: Number(meta.regularMarketVolume) || undefined,
            updatedAt: Date.now(),
          };
          return q;
        } catch {
          return null;
        }
      }),
    );
    for (const q of out) if (q) result.push(q);
  }
  return result;
}
