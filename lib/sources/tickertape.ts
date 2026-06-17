// Tickertape public JSON — fundamentals fallback when Yahoo's quoteSummary is down.
// Endpoints we use:
//   https://api.tickertape.in/stocks/info/{slug}              — search/info for slug resolution
//   https://api.tickertape.in/stocks/financials/income/{sid}  — TTM income statement
//   https://api.tickertape.in/stocks/check-screener/{sid}     — PE, PB, mkt cap, div yield, etc
//
// Cache aggressively (24h) — this is polite-use only.

import { redis } from "../redis";
import type { Fundamentals } from "../fundamentals";

const TT_BASE = "https://api.tickertape.in";
const SID_KEY = (sym: string) => `tt:sid:${sym}`;
const SID_TTL_S = 60 * 60 * 24 * 30;

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
  Origin: "https://www.tickertape.in",
  Referer: "https://www.tickertape.in/",
};

type TtSearchHit = { sid?: string; slug?: string; ticker?: string };
type TtSearchResponse = { success?: boolean; data?: { stocks?: TtSearchHit[] } };

async function resolveSid(symbol: string): Promise<string | null> {
  const cached = await redis.get<string>(SID_KEY(symbol)).catch(() => null);
  if (cached) return cached;
  const url = `${TT_BASE}/stocks/search?text=${encodeURIComponent(symbol)}&types=stock&pageNumber=0`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return null;
  try {
    const json = (await res.json()) as TtSearchResponse;
    const hits = json.data?.stocks ?? [];
    const hit = hits.find((h) => h.ticker?.toUpperCase() === symbol.toUpperCase()) ?? hits[0];
    const sid = hit?.sid;
    if (!sid) return null;
    await redis.set(SID_KEY(symbol), sid, { ex: SID_TTL_S }).catch(() => {});
    return sid;
  } catch {
    return null;
  }
}

type TtScreenerResponse = {
  data?: {
    ratios?: Record<string, number | undefined> & {
      marketCap?: number;
      pe?: number;
      pb?: number;
      divYield?: number;
      eps?: number;
      roe?: number;
      roa?: number;
      debtToEquity?: number;
      "52wHigh"?: number;
      "52wLow"?: number;
      beta?: number;
    };
  };
};

export async function fetchTickertapeFundamentals(
  symbol: string,
  exchange: "NSE" | "BSE",
): Promise<Partial<Fundamentals> | null> {
  if (exchange !== "NSE") return null;
  if (process.env.TICKERTAPE_DISABLE === "1") return null;

  const sid = await resolveSid(symbol);
  if (!sid) return null;

  const url = `${TT_BASE}/stocks/check-screener/${encodeURIComponent(sid)}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return null;
  let json: TtScreenerResponse;
  try {
    json = (await res.json()) as TtScreenerResponse;
  } catch {
    return null;
  }
  const r = json.data?.ratios;
  if (!r) return null;

  return {
    marketCap: r.marketCap !== undefined ? r.marketCap * 1e7 : undefined, // crores → rupees
    trailingPE: r.pe,
    priceToBook: r.pb,
    dividendYield: r.divYield !== undefined ? r.divYield / 100 : undefined,
    trailingEps: r.eps,
    returnOnEquity: r.roe !== undefined ? r.roe / 100 : undefined,
    returnOnAssets: r.roa !== undefined ? r.roa / 100 : undefined,
    debtToEquity: r.debtToEquity,
    yearHigh: r["52wHigh"],
    yearLow: r["52wLow"],
    beta: r.beta,
  };
}
