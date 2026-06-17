import { redis } from "./redis";

type CrumbBundle = { cookie: string; crumb: string };

const CRUMB_KEY = "yahoo:crumb";
const CRUMB_TTL = 60 * 60 * 12;
const CRUMB_NEG_KEY = "yahoo:crumb:fail";
const CRUMB_NEG_TTL = 60; // skip Yahoo entirely for 60s after a crumb failure
const CRUMB_FETCH_TIMEOUT_MS = 3000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let inMemory: CrumbBundle | null = null;
let inflight: Promise<CrumbBundle | null> | null = null;
let lastFailAt = 0;

async function fetchFreshCrumb(): Promise<CrumbBundle | null> {
  try {
    const consent = await fetch("https://fc.yahoo.com/", {
      headers: { "User-Agent": UA, Accept: "*/*" },
      redirect: "manual",
      signal: AbortSignal.timeout(CRUMB_FETCH_TIMEOUT_MS),
    });
    const setCookies = consent.headers.getSetCookie?.() ?? [];
    const cookie = setCookies
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");
    if (!cookie) return null;

    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, Cookie: cookie, Accept: "*/*" },
      signal: AbortSignal.timeout(CRUMB_FETCH_TIMEOUT_MS),
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.length > 64) return null;

    return { cookie, crumb };
  } catch (e) {
    console.warn("[yahoo-crumb] error", (e as Error)?.message ?? e);
    return null;
  }
}

export async function getYahooCrumb(): Promise<CrumbBundle | null> {
  if (inMemory) return inMemory;

  // Negative cache: if a recent crumb fetch timed out, skip Yahoo until the
  // window passes. Lets callers fall through to NSE/stale immediately.
  if (Date.now() - lastFailAt < CRUMB_NEG_TTL * 1000) return null;
  const negCached = await redis.get<number>(CRUMB_NEG_KEY).catch(() => null);
  if (negCached) return null;

  const cached = await redis.get<CrumbBundle>(CRUMB_KEY).catch(() => null);
  if (cached?.cookie && cached?.crumb) {
    inMemory = cached;
    return cached;
  }

  if (!inflight) {
    inflight = (async () => {
      const fresh = await fetchFreshCrumb();
      if (fresh) {
        inMemory = fresh;
        await redis.set(CRUMB_KEY, fresh, { ex: CRUMB_TTL }).catch(() => {});
      } else {
        lastFailAt = Date.now();
        await redis.set(CRUMB_NEG_KEY, Date.now(), { ex: CRUMB_NEG_TTL }).catch(() => {});
      }
      return fresh;
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export async function invalidateYahooCrumb() {
  inMemory = null;
  await redis.del(CRUMB_KEY).catch(() => {});
}

export const YAHOO_UA = UA;
