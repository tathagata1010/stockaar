import { redis } from "./redis";
import { getYahooCrumb, YAHOO_UA } from "./yahoo-auth";
import { NSE_SYMBOLS } from "./nse-symbols";

export type NewsItem = {
  title: string;
  publisher: string;
  url: string;
  publishedAt: number;
  source?: "yahoo" | "google" | "bing" | "moneycontrol";
};

const STOCK_TTL = 60 * 30;
const MARKET_TTL = 60 * 15;

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&nbsp;/g, " ");
}

function stripCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function dedupe(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of items) {
    const k = (it.title || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 90);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function buildAliases(symbol: string, name: string): string[] {
  const stop = new Set(["india", "limited", "ltd", "ltd.", "the", "of", "and", "&", "company", "corp", "corporation", "industries", "industry"]);
  const tokens = name
    .split(/[\s.&]+/)
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length > 2 && !stop.has(t));
  const aliases = new Set<string>([symbol.toLowerCase(), name.toLowerCase()]);
  for (const t of tokens) aliases.add(t);
  return [...aliases];
}

/** Strict per-stock relevance: title must mention symbol OR a meaningful company-name token. */
function isAboutStock(title: string, aliases: string[]): boolean {
  const t = title.toLowerCase();
  for (const a of aliases) {
    if (a.length < 3) continue;
    if (t.includes(a)) return true;
  }
  return false;
}

// ---------- Source: Yahoo Finance search ----------
async function fromYahoo(symbol: string, exchange: "NSE" | "BSE"): Promise<NewsItem[]> {
  const suffix = exchange === "NSE" ? ".NS" : ".BO";
  const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
  url.searchParams.set("q", symbol + suffix);
  url.searchParams.set("newsCount", "20");
  url.searchParams.set("quotesCount", "0");
  url.searchParams.set("enableFuzzyQuery", "false");
  try {
    const crumb = await getYahooCrumb();
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": YAHOO_UA, Accept: "application/json", ...(crumb ? { Cookie: crumb.cookie } : {}) },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.news ?? [])
      .map((n: any): NewsItem => ({
        title: String(n.title ?? ""),
        publisher: String(n.publisher ?? "Yahoo Finance"),
        url: String(n.link ?? ""),
        publishedAt: typeof n.providerPublishTime === "number" ? n.providerPublishTime * 1000 : Date.now(),
        source: "yahoo",
      }))
      .filter((n: NewsItem) => n.title && n.url);
  } catch {
    return [];
  }
}

// ---------- Source: Google News RSS ----------
async function fromGoogleNews(query: string): Promise<NewsItem[]> {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-IN");
  url.searchParams.set("gl", "IN");
  url.searchParams.set("ceid", "IN:en");
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": YAHOO_UA, Accept: "application/rss+xml,application/xml,text/xml" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: NewsItem[] = [];
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const block = m[1];
      const titleM = /<title>([\s\S]*?)<\/title>/.exec(block);
      const linkM = /<link>([\s\S]*?)<\/link>/.exec(block);
      const pubM = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block);
      const srcM = /<source[^>]*>([\s\S]*?)<\/source>/.exec(block);
      if (!titleM || !linkM) continue;
      const title = decodeHtml(stripCdata(titleM[1]));
      const link = stripCdata(linkM[1]).trim();
      const ts = pubM ? Date.parse(pubM[1]) : Date.now();
      const publisher = srcM ? decodeHtml(stripCdata(srcM[1])) : "Google News";
      if (!title || !link) continue;
      items.push({
        title,
        publisher,
        url: link,
        publishedAt: Number.isFinite(ts) ? ts : Date.now(),
        source: "google",
      });
    }
    return items;
  } catch {
    return [];
  }
}

// ---------- Source: Bing News RSS ----------
async function fromBing(query: string): Promise<NewsItem[]> {
  const url = new URL("https://www.bing.com/news/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "rss");
  url.searchParams.set("cc", "in");
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": YAHOO_UA, Accept: "application/rss+xml,application/xml" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: NewsItem[] = [];
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const block = m[1];
      const titleM = /<title>([\s\S]*?)<\/title>/.exec(block);
      const linkM = /<link>([\s\S]*?)<\/link>/.exec(block);
      const pubM = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block);
      if (!titleM || !linkM) continue;
      const title = decodeHtml(stripCdata(titleM[1]));
      const link = stripCdata(linkM[1]).trim();
      const ts = pubM ? Date.parse(pubM[1]) : Date.now();
      if (!title || !link) continue;
      items.push({
        title,
        publisher: "Bing News",
        url: link,
        publishedAt: Number.isFinite(ts) ? ts : Date.now(),
        source: "bing",
      });
    }
    return items;
  } catch {
    return [];
  }
}

/** Multi-source news strictly about ONE stock. Filtered to entries mentioning the symbol or company name. */
export async function getStockNews(
  symbol: string,
  exchange: "NSE" | "BSE" = "NSE",
  limit = 12,
): Promise<NewsItem[]> {
  const key = `stock-news:${exchange}:${symbol}:v3`;
  const cached = await redis.get<NewsItem[]>(key).catch(() => null);
  if (cached) return cached.slice(0, limit);

  const meta = NSE_SYMBOLS.find((s) => s.symbol === symbol);
  const companyName = meta?.name ?? symbol;
  const aliases = buildAliases(symbol, companyName);

  const queries = [
    `"${companyName}" share price`,
    `${companyName} NSE`,
    `${symbol} stock`,
  ];

  const batches = await Promise.allSettled([
    fromYahoo(symbol, exchange),
    fromGoogleNews(queries[0]),
    fromGoogleNews(queries[1]),
    fromBing(queries[2]),
  ]);

  const all: NewsItem[] = [];
  for (const b of batches) if (b.status === "fulfilled") all.push(...b.value);

  // Strict relevance filter: keep only items that mention the stock
  const relevant = all.filter((n) => isAboutStock(n.title, aliases));

  // Fallback: if filter killed everything, keep Yahoo's results which are by-ticker
  const final = relevant.length >= 3 ? relevant : [...relevant, ...all.filter((n) => n.source === "yahoo")];

  const deduped = dedupe(final).sort((a, b) => b.publishedAt - a.publishedAt);

  await redis.set(key, deduped, { ex: STOCK_TTL }).catch(() => {});
  return deduped.slice(0, limit);
}

/** General Indian market news (not tied to one stock). For the /news page. */
export async function getMarketNews(limit = 40): Promise<NewsItem[]> {
  const key = `market-news:v2`;
  const cached = await redis.get<NewsItem[]>(key).catch(() => null);
  if (cached) return cached.slice(0, limit);

  const queries = [
    "Indian stock market",
    "NSE BSE Nifty Sensex",
    "Indian economy stocks",
    "Indian IPO",
  ];

  const batches = await Promise.allSettled(queries.map((q) => fromGoogleNews(q)));
  const all: NewsItem[] = [];
  for (const b of batches) if (b.status === "fulfilled") all.push(...b.value);

  const deduped = dedupe(all).sort((a, b) => b.publishedAt - a.publishedAt);

  await redis.set(key, deduped, { ex: MARKET_TTL }).catch(() => {});
  return deduped.slice(0, limit);
}
