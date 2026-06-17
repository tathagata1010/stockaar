// NSE public quote endpoint — fallback for when Yahoo is down.
// Same shape as upstox.ts Quote so the orchestrator can swap sources.
//
// NSE requires a session cookie obtained by hitting any /get-quotes page first.
// Cookies live ~30min; we cache the jar in Redis to avoid warming on every call.

import { redis } from "../redis";
import type { Quote } from "../upstox";

const NSE_BASE = "https://www.nseindia.com";
const COOKIE_KEY = "nse:cookie:v1";
const COOKIE_TTL_S = 60 * 20; // 20 min, < NSE's 30min expiry

const NSE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: `${NSE_BASE}/get-quotes/equity`,
};

let cookieInflight: Promise<string | null> | null = null;

async function warmCookies(): Promise<string | null> {
  const warmup = await fetch(`${NSE_BASE}/get-quotes/equity?symbol=RELIANCE`, {
    headers: NSE_HEADERS,
    cache: "no-store",
  }).catch(() => null);
  if (!warmup) return null;
  const setCookie = warmup.headers.get("set-cookie") ?? "";
  const cookie = setCookie
    .split(/,(?=[^ ]+=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
  if (!cookie) return null;
  await redis.set(COOKIE_KEY, cookie, { ex: COOKIE_TTL_S }).catch(() => {});
  return cookie;
}

async function getCookies(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh) {
    const cached = await redis.get<string>(COOKIE_KEY).catch(() => null);
    if (cached) return cached;
  }
  if (!cookieInflight) {
    cookieInflight = warmCookies().finally(() => {
      cookieInflight = null;
    });
  }
  return cookieInflight;
}

type NseQuoteResponse = {
  info?: { symbol?: string };
  priceInfo?: {
    lastPrice?: number;
    change?: number;
    pChange?: number;
    previousClose?: number;
    intraDayHighLow?: { min?: number; max?: number };
    weekHighLow?: { min?: number; max?: number };
  };
};

async function fetchNseQuoteRaw(symbol: string, cookie: string): Promise<NseQuoteResponse | null> {
  const url = `${NSE_BASE}/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, {
    headers: { ...NSE_HEADERS, Cookie: cookie },
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok) return null;
  try {
    return (await res.json()) as NseQuoteResponse;
  } catch {
    return null;
  }
}

export async function fetchNseQuote(
  symbol: string,
  exchange: "NSE" | "BSE",
): Promise<Quote | null> {
  if (exchange !== "NSE") return null; // BSE not supported by this endpoint
  if (process.env.NSE_DISABLE === "1") return null;

  let cookie = await getCookies();
  if (!cookie) return null;

  let raw = await fetchNseQuoteRaw(symbol, cookie);
  if (!raw) {
    cookie = await getCookies(true);
    if (!cookie) return null;
    raw = await fetchNseQuoteRaw(symbol, cookie);
    if (!raw) return null;
  }

  const pi = raw.priceInfo;
  const lastPrice = Number(pi?.lastPrice);
  if (!Number.isFinite(lastPrice) || lastPrice <= 0) return null;
  const previousClose = Number(pi?.previousClose ?? lastPrice);
  const change = Number.isFinite(pi?.change as number)
    ? (pi!.change as number)
    : lastPrice - previousClose;
  const changePct = Number.isFinite(pi?.pChange as number)
    ? (pi!.pChange as number)
    : previousClose
      ? (change / previousClose) * 100
      : 0;

  return {
    symbol: String(raw.info?.symbol ?? symbol).toUpperCase(),
    exchange: "NSE",
    lastPrice,
    change,
    changePct,
    dayHigh: Number(pi?.intraDayHighLow?.max ?? lastPrice),
    dayLow: Number(pi?.intraDayHighLow?.min ?? lastPrice),
    yearHigh: Number(pi?.weekHighLow?.max) || undefined,
    yearLow: Number(pi?.weekHighLow?.min) || undefined,
    updatedAt: Date.now(),
  };
}

export async function fetchNseQuotes(
  items: { symbol: string; exchange: "NSE" | "BSE" }[],
): Promise<Quote[]> {
  if (items.length === 0) return [];
  // NSE has no bulk endpoint — sequential with low concurrency to be polite.
  const CONCURRENCY = 4;
  const out: Quote[] = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((it) => fetchNseQuote(it.symbol, it.exchange)));
    for (const q of results) if (q) out.push(q);
  }
  return out;
}
