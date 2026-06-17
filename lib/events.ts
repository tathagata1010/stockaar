import { cache } from "react";
import { redis } from "./redis";
import { yahooFetch } from "./yahoo/client";

export type Dividend = { date: number; amount: number };
export type Split = { date: number; numerator: number; denominator: number };
export type CorporateActions = {
  dividends: Dividend[];
  splits: Split[];
  updatedAt: number;
};

const CACHE_TTL_SECONDS = 60 * 60 * 24;

function actionsKey(symbol: string, exchange: string) {
  return `corp-actions:${exchange}:${symbol}:v1`;
}

export const fetchCorporateActions = cache(async (
  symbol: string,
  exchange: "NSE" | "BSE" = "NSE",
): Promise<CorporateActions> => {
  const key = actionsKey(symbol, exchange);
  const cached = await redis.get<CorporateActions>(key).catch(() => null);
  if (cached) return cached;

  const suffix = exchange === "BSE" ? ".BO" : ".NS";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + suffix)}?interval=1mo&range=5y&events=div,split`;

  const empty: CorporateActions = { dividends: [], splits: [], updatedAt: Date.now() };

  try {
    const res = await yahooFetch(url, { withAuth: false });
    if (!res || !res.ok) return empty;
    const data = await res.json();
    const r = data.chart?.result?.[0];
    const events = r?.events;
    const divs: Dividend[] = events?.dividends
      ? Object.values(events.dividends as Record<string, { date: number; amount: number }>)
          .filter((d) => typeof d?.date === "number" && typeof d?.amount === "number")
          .map((d) => ({ date: d.date * 1000, amount: d.amount }))
          .sort((a, b) => b.date - a.date)
      : [];
    const splits: Split[] = events?.splits
      ? Object.values(events.splits as Record<string, { date: number; numerator: number; denominator: number }>)
          .filter((s) => typeof s?.date === "number" && typeof s?.numerator === "number" && typeof s?.denominator === "number")
          .map((s) => ({ date: s.date * 1000, numerator: s.numerator, denominator: s.denominator }))
          .sort((a, b) => b.date - a.date)
      : [];
    const out: CorporateActions = { dividends: divs, splits, updatedAt: Date.now() };
    await redis.set(key, out, { ex: CACHE_TTL_SECONDS }).catch(() => {});
    return out;
  } catch {
    return empty;
  }
});
