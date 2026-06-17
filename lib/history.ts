// Yahoo Finance v8 chart fetcher, shared by the /api/stocks/.../history
// route (client charts) and the stock detail page (server-rendered bars).

import { cache } from "react";
import { redis } from "./redis";
import { writeStale, readStale } from "./stale-cache";
import { yahooFetch } from "./yahoo/client";

export type HistoryPoint = { t: number; p: number; v?: number };
export type HistoryRange = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "5y";
export type HistoryResult = {
  range: HistoryRange;
  points: HistoryPoint[];
  previousClose: number | null;
  currency: string;
};

const RANGE_MAP: Record<HistoryRange, { range: string; interval: string }> = {
  "1d":  { range: "1d",  interval: "5m"  },
  "5d":  { range: "5d",  interval: "15m" },
  "1mo": { range: "1mo", interval: "1d"  },
  "3mo": { range: "3mo", interval: "1d"  },
  "6mo": { range: "6mo", interval: "1d"  },
  "1y":  { range: "1y",  interval: "1d"  },
  "5y":  { range: "5y",  interval: "1wk" },
};

// Intraday changes minute-to-minute; daily/weekly are stable until next close.
const TTL_S: Record<HistoryRange, number> = {
  "1d":  60,
  "5d":  300,
  "1mo": 3600,
  "3mo": 3600,
  "6mo": 3600,
  "1y":  3600 * 6,
  "5y":  3600 * 24,
};

function historyKey(symbol: string, exchange: "NSE" | "BSE", range: HistoryRange) {
  return `history:${exchange}:${symbol}:${range}`;
}

export const fetchYahooHistory = cache(async (
  symbol: string,
  exchange: "NSE" | "BSE",
  range: HistoryRange = "1mo",
): Promise<HistoryResult | null> => {
  const key = historyKey(symbol, exchange, range);
  const cached = await redis.get<HistoryResult>(key).catch(() => null);
  if (cached) return cached;

  const fresh = await fetchYahooHistoryUncached(symbol, exchange, range);
  if (fresh) {
    await redis.set(key, fresh, { ex: TTL_S[range] }).catch(() => {});
    await writeStale(key, fresh);
    return fresh;
  }
  return readStale<HistoryResult>(key);
});

async function fetchYahooHistoryUncached(
  symbol: string,
  exchange: "NSE" | "BSE",
  range: HistoryRange,
): Promise<HistoryResult | null> {
  const cfg = RANGE_MAP[range] ?? RANGE_MAP["1mo"];
  const suffix = exchange === "BSE" ? ".BO" : ".NS";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + suffix)}?interval=${cfg.interval}&range=${cfg.range}`;
  try {
    const res = await yahooFetch(url, { withAuth: false });
    if (!res || !res.ok) return null;
    const data = await res.json();
    const r = data.chart?.result?.[0];
    if (!r) return null;
    const ts: number[] = r.timestamp ?? [];
    const close: (number | null)[] = r.indicators?.quote?.[0]?.close ?? [];
    const volume: (number | null)[] = r.indicators?.quote?.[0]?.volume ?? [];
    const points: HistoryPoint[] = [];
    for (let i = 0; i < ts.length; i++) {
      const p = close[i];
      if (typeof p !== "number") continue;
      const v = volume[i];
      const point: HistoryPoint = { t: ts[i] * 1000, p };
      if (typeof v === "number") point.v = v;
      points.push(point);
    }
    return {
      range,
      points,
      previousClose: r.meta?.chartPreviousClose ?? r.meta?.previousClose ?? null,
      currency: r.meta?.currency ?? "INR",
    };
  } catch {
    return null;
  }
}
