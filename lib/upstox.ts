import { cache } from "react";
import { redis } from "./redis";

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
  source: "upstox" | "yahoo";
  updatedAt: number;
};

const CACHE_TTL_SECONDS = 60;
const UPSTOX_BATCH_SIZE = 100;
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

  // 2. Bulk upstream for misses
  if (misses.length > 0) {
    let fresh = await fetchManyFromUpstox(misses);

    // Anything Upstox didn't return → try Yahoo
    const upstoxKeys = new Set(fresh.map((q) => `${q.exchange}:${q.symbol}`));
    const remaining = misses.filter((m) => !upstoxKeys.has(`${m.exchange}:${m.symbol}`));
    if (remaining.length > 0) {
      const yahoo = await fetchManyFromYahoo(remaining);
      fresh = fresh.concat(yahoo);
    }

    // 3. Pipeline writes
    if (fresh.length > 0) {
      try {
        const pipe = redis.pipeline();
        for (const q of fresh) {
          pipe.set(cacheKey(q.symbol, q.exchange), q, { ex: CACHE_TTL_SECONDS });
        }
        await pipe.exec();
      } catch {}
    }
    for (const q of fresh) found.set(`${q.exchange}:${q.symbol}`, q);
  }

  // 4. Preserve caller order
  return unique
    .map((it) => found.get(`${it.exchange}:${it.symbol}`))
    .filter((q): q is Quote => q != null);
}

async function fetchManyFromUpstox(
  items: { symbol: string; exchange: "NSE" | "BSE" }[],
): Promise<Quote[]> {
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) return [];

  const result: Quote[] = [];
  const batches = chunk(items, UPSTOX_BATCH_SIZE);
  await Promise.all(
    batches.map(async (batch) => {
      try {
        const instrumentKeys = batch.map((b) => `${b.exchange}_EQ|${b.symbol}`).join(",");
        const res = await fetch(
          `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(instrumentKeys)}`,
          {
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
            next: { revalidate: 0 },
          },
        );
        if (!res.ok) {
          console.warn(`[upstox] ${res.status} for batch of ${batch.length}`);
          return;
        }
        const data = await res.json();
        const entries = (data?.data ?? {}) as Record<string, any>;
        for (const [k, entry] of Object.entries(entries)) {
          if (!entry) continue;
          // Upstox response keys can be "NSE_EQ:SYMBOL" or "NSE_EQ|SYMBOL".
          // Also fall back to entry.symbol / entry.trading_symbol.
          const parts = k.split(/[:|]/);
          const sym = (parts[1] ?? entry.symbol ?? entry.trading_symbol ?? "").toUpperCase();
          const exchange = (k.startsWith("BSE") ? "BSE" : "NSE") as "NSE" | "BSE";
          if (!sym) continue;
          const lastPrice = Number(entry.last_price);
          if (!Number.isFinite(lastPrice) || lastPrice <= 0) continue;
          // Upstox uses "ohlc.close" for previous day's close intraday.
          // Some payloads expose "net_change" / "previous_close" directly — prefer those when present.
          const prevClose = Number(
            entry.previous_close ?? entry.ohlc?.close ?? (lastPrice - Number(entry.net_change ?? 0)),
          );
          const change = Number.isFinite(entry.net_change)
            ? Number(entry.net_change)
            : lastPrice - prevClose;
          const changePct = prevClose ? (change / prevClose) * 100 : 0;
          result.push({
            symbol: sym,
            exchange,
            lastPrice,
            change,
            changePct,
            dayHigh: Number(entry.ohlc?.high ?? lastPrice),
            dayLow: Number(entry.ohlc?.low ?? lastPrice),
            source: "upstox",
            updatedAt: Date.now(),
          });
        }
      } catch (e) {
        console.warn("[upstox] bulk error", e);
      }
    }),
  );
  return result;
}

async function fetchManyFromYahoo(
  items: { symbol: string; exchange: "NSE" | "BSE" }[],
): Promise<Quote[]> {
  // Preferred path: Yahoo v7 bulk (80/call) with crumb + cookie auth.
  // Fallback: v8 chart endpoint per-symbol (unauthenticated) if crumb fetch fails.
  const auth = await getYahooAuth().catch(() => null);
  if (auth) {
    const bulk = await fetchYahooV7Bulk(items, auth);
    // If bulk returned nothing (crumb may have expired between fetch and use), force-refresh once.
    if (bulk.length === 0 && items.length > 0) {
      const fresh = await getYahooAuth(true).catch(() => null);
      if (fresh) return fetchYahooV7Bulk(items, fresh);
    }
    return bulk;
  }
  return fetchYahooChartFallback(items);
}

// --- Yahoo crumb/cookie auth (cached in Redis ~50min) ---
const YAHOO_AUTH_KEY = "yahoo:auth:v1";
const YAHOO_AUTH_TTL = 50 * 60;
type YahooAuth = { crumb: string; cookie: string };

async function getYahooAuth(forceRefresh = false): Promise<YahooAuth | null> {
  if (!forceRefresh) {
    const cached = await redis.get<YahooAuth>(YAHOO_AUTH_KEY).catch(() => null);
    if (cached?.crumb && cached?.cookie) return cached;
  }
  try {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
    // Step 1: warm a Yahoo domain to obtain A1/A3 cookies.
    const warm = await fetch("https://fc.yahoo.com/", {
      headers: { "User-Agent": ua, Accept: "*/*" },
      redirect: "manual",
    });
    const setCookies = warm.headers.getSetCookie?.() ?? [warm.headers.get("set-cookie") ?? ""];
    const cookie = setCookies
      .filter(Boolean)
      .map((c) => c.split(";")[0])
      .join("; ");
    if (!cookie) return null;
    // Step 2: ask for crumb using the cookie.
    const cr = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": ua, Accept: "*/*", Cookie: cookie },
    });
    if (!cr.ok) return null;
    const crumb = (await cr.text()).trim();
    if (!crumb) return null;
    const auth: YahooAuth = { crumb, cookie };
    await redis.set(YAHOO_AUTH_KEY, auth, { ex: YAHOO_AUTH_TTL }).catch(() => {});
    return auth;
  } catch {
    return null;
  }
}

async function fetchYahooV7Bulk(
  items: { symbol: string; exchange: "NSE" | "BSE" }[],
  auth: YahooAuth,
): Promise<Quote[]> {
  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
  const result: Quote[] = [];
  const batches = chunk(items, YAHOO_BATCH_SIZE);

  await Promise.all(
    batches.map(async (batch) => {
      try {
        const symbols = batch
          .map((b) => `${b.symbol}${b.exchange === "NSE" ? ".NS" : ".BO"}`)
          .join(",");
        const url =
          `https://query1.finance.yahoo.com/v7/finance/quote` +
          `?symbols=${encodeURIComponent(symbols)}` +
          `&crumb=${encodeURIComponent(auth.crumb)}`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": ua,
            Accept: "application/json",
            Cookie: auth.cookie,
          },
          next: { revalidate: 0 },
        });
        if (!res.ok) return;
        const data = await res.json();
        const rows = (data?.quoteResponse?.result ?? []) as any[];
        for (const r of rows) {
          const fullSym = String(r.symbol ?? "");
          const exchange: "NSE" | "BSE" = fullSym.endsWith(".BO") ? "BSE" : "NSE";
          const sym = fullSym.replace(/\.(NS|BO)$/i, "").toUpperCase();
          const lastPrice = Number(r.regularMarketPrice);
          if (!Number.isFinite(lastPrice) || lastPrice <= 0) continue;
          const close = Number(r.regularMarketPreviousClose ?? lastPrice);
          const change = Number.isFinite(r.regularMarketChange) ? r.regularMarketChange : lastPrice - close;
          const changePct = Number.isFinite(r.regularMarketChangePercent)
            ? r.regularMarketChangePercent
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
            source: "yahoo",
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
        try {
          const ySym = `${it.symbol}${it.exchange === "NSE" ? ".NS" : ".BO"}`;
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=1d&range=1d`,
            {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                Accept: "application/json",
              },
              next: { revalidate: 0 },
            },
          );
          if (!res.ok) return null;
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
            source: "yahoo",
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
