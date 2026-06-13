// Yahoo Finance v8 chart fetcher, shared by the /api/stocks/.../history
// route (client charts) and the stock detail page (server-rendered bars).

export type HistoryPoint = { t: number; p: number };
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

export async function fetchYahooHistory(
  symbol: string,
  exchange: "NSE" | "BSE",
  range: HistoryRange = "1mo",
): Promise<HistoryResult | null> {
  const cfg = RANGE_MAP[range] ?? RANGE_MAP["1mo"];
  const suffix = exchange === "BSE" ? ".BO" : ".NS";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + suffix)}?interval=${cfg.interval}&range=${cfg.range}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StocksbrewBot/1.0)",
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data.chart?.result?.[0];
    if (!r) return null;
    const ts: number[] = r.timestamp ?? [];
    const close: (number | null)[] = r.indicators?.quote?.[0]?.close ?? [];
    const points: HistoryPoint[] = ts
      .map((t, i) => ({ t: t * 1000, p: close[i] }))
      .filter((p): p is HistoryPoint => typeof p.p === "number");
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
