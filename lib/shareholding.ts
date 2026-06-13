// NSE corporate shareholding pattern (quarterly filings).
//
// NSE's public endpoint at /api/corporate-share-holdings-master returns the
// top-level Promoter / Public / Employee-Trust split for a symbol. Requires
// browser-like cookies — we warm the homepage to seed them, then call the API.
// The full FII/DII/MF split lives inside the linked XBRL file (not parsed
// here; tracked separately). Filings are quarterly so a 24h cache is plenty.

import { redis } from "./redis";

export type ShareholdingPattern = {
  asOnDate: string;
  promoterPct?: number;
  publicPct?: number;
  employeeTrustsPct?: number;
  xbrlUrl?: string;
  source: "nse";
};

const CACHE_TTL_SECONDS = 60 * 60 * 24;
const NEG_TTL_SECONDS = 60 * 60 * 24;
const COOKIE_TTL_SECONDS = 60 * 60 * 2;
const COOKIE_KEY = "nse:cookie:v2";
export const NSE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function key(symbol: string) {
  return `shareholding:NSE:${symbol}:v4`;
}
function negKey(symbol: string) {
  return `shareholding:404:NSE:${symbol}:v4`;
}

export async function getNseCookie(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh) {
    const cached = await redis.get<string>(COOKIE_KEY).catch(() => null);
    if (cached) return cached;
  }
  try {
    const res = await fetch("https://www.nseindia.com/", {
      headers: { "User-Agent": NSE_UA, Accept: "text/html,*/*" },
      redirect: "manual",
    });
    const setCookies = res.headers.getSetCookie?.() ?? [];
    const cookie = setCookies
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");
    if (!cookie) {
      console.warn("[shareholding] cookie warm returned no Set-Cookie, status=" + res.status);
      return null;
    }
    await redis.set(COOKIE_KEY, cookie, { ex: COOKIE_TTL_SECONDS }).catch(() => {});
    return cookie;
  } catch (e) {
    console.warn("[shareholding] cookie warm threw", e);
    return null;
  }
}

function num(x: unknown): number | undefined {
  if (x == null || x === "") return undefined;
  const n = typeof x === "string" ? parseFloat(x) : Number(x);
  return Number.isFinite(n) ? n : undefined;
}

// NSE returns dates as "31-MAR-2026" — parse to a sortable epoch.
export function parseNseDate(s: unknown): number {
  if (typeof s !== "string") return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

export async function getShareholdingPattern(symbol: string): Promise<ShareholdingPattern | null> {
  const cached = await redis.get<ShareholdingPattern>(key(symbol)).catch(() => null);
  if (cached) return cached;

  const neg = await redis.get<number>(negKey(symbol)).catch(() => null);
  if (neg) {
    console.warn("[shareholding] " + symbol + " neg-cache hit (skipping fetch)");
    return null;
  }

  const result = await fetchFromNse(symbol);
  if (!result) {
    // Only neg-cache when the API definitively had nothing for this symbol —
    // not on cookie warm failures or 5xx, which are transient.
    return null;
  }
  redis.set(key(symbol), result, { ex: CACHE_TTL_SECONDS }).catch(() => {});
  return result;
}

async function fetchFromNse(symbol: string, refreshedCookie = false): Promise<ShareholdingPattern | null> {
  const cookie = await getNseCookie(refreshedCookie);
  if (!cookie) {
    console.warn("[shareholding] no cookie for " + symbol);
    return null;
  }

  try {
    const url = `https://www.nseindia.com/api/corporate-share-holdings-master?index=equities&symbol=${encodeURIComponent(symbol)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": NSE_UA,
        Accept: "application/json, text/plain, */*",
        Cookie: cookie,
        Referer: `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`,
      },
      next: { revalidate: 0 },
    });
    // Cookie expired mid-request — retry once with a fresh one.
    if ((res.status === 401 || res.status === 403) && !refreshedCookie) {
      console.warn("[shareholding] " + symbol + " auth " + res.status + ", retrying with fresh cookie");
      return fetchFromNse(symbol, true);
    }
    if (!res.ok) {
      console.warn("[shareholding] " + symbol + " HTTP " + res.status);
      // 404 means NSE has no filings for this symbol — safe to neg-cache.
      if (res.status === 404) {
        redis.set(negKey(symbol), Date.now(), { ex: NEG_TTL_SECONDS }).catch(() => {});
      }
      return null;
    }
    const data = await res.json();
    const rows = (Array.isArray(data) ? data : data?.data) as Record<string, unknown>[] | undefined;
    if (!Array.isArray(rows) || rows.length === 0) {
      console.warn("[shareholding] " + symbol + " empty response");
      redis.set(negKey(symbol), Date.now(), { ex: NEG_TTL_SECONDS }).catch(() => {});
      return null;
    }

    // Most recent filing first. NSE returns desc but we sort defensively.
    const sorted = [...rows]
      .filter((r) => num(r.pr_and_prgrp) != null || num(r.public_val) != null)
      .sort((a, b) => parseNseDate(b.date) - parseNseDate(a.date));
    const row = sorted[0];
    if (!row) {
      console.warn("[shareholding] " + symbol + " no valid rows after filter (had " + rows.length + " raw)");
      return null;
    }

    const asOnDate = String(row.date ?? "").trim();
    if (!asOnDate) {
      console.warn("[shareholding] " + symbol + " missing date");
      return null;
    }

    return {
      asOnDate,
      promoterPct: num(row.pr_and_prgrp),
      publicPct: num(row.public_val),
      employeeTrustsPct: num(row.employeeTrusts),
      xbrlUrl: typeof row.xbrl === "string" ? row.xbrl : undefined,
      source: "nse",
    };
  } catch (e) {
    console.warn("[shareholding] error for " + symbol, e);
    return null;
  }
}
