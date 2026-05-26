import { redis } from "./redis";

type CrumbBundle = { cookie: string; crumb: string };

const CRUMB_KEY = "yahoo:crumb";
const CRUMB_TTL = 60 * 60 * 12;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let inMemory: CrumbBundle | null = null;

async function fetchFreshCrumb(): Promise<CrumbBundle | null> {
  try {
    const consent = await fetch("https://fc.yahoo.com/", {
      headers: { "User-Agent": UA, Accept: "*/*" },
      redirect: "manual",
    });
    const setCookies = consent.headers.getSetCookie?.() ?? [];
    const cookie = setCookies
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");
    if (!cookie) return null;

    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, Cookie: cookie, Accept: "*/*" },
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.length > 64) return null;

    return { cookie, crumb };
  } catch (e) {
    console.warn("[yahoo-crumb] error", e);
    return null;
  }
}

export async function getYahooCrumb(): Promise<CrumbBundle | null> {
  if (inMemory) return inMemory;
  const cached = await redis.get<CrumbBundle>(CRUMB_KEY).catch(() => null);
  if (cached?.cookie && cached?.crumb) {
    inMemory = cached;
    return cached;
  }
  const fresh = await fetchFreshCrumb();
  if (fresh) {
    inMemory = fresh;
    await redis.set(CRUMB_KEY, fresh, { ex: CRUMB_TTL }).catch(() => {});
  }
  return fresh;
}

export async function invalidateYahooCrumb() {
  inMemory = null;
  await redis.del(CRUMB_KEY).catch(() => {});
}

export const YAHOO_UA = UA;
