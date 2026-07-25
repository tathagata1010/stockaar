import { redis } from "./redis";
import { YAHOO_UA } from "./yahoo-auth";
import { yahooFetch } from "./yahoo/client";
import { NSE_SYMBOLS } from "./nse-symbols";
import { unfurlBatch } from "./news/unfurl";
import { getServiceClient } from "./supabase/service";

export type NewsItem = {
  title: string;
  publisher: string;
  publisherDomain?: string;
  url: string;
  publishedAt: number;
  source?: "yahoo" | "web";
  imageUrl?: string;
  publisherIcon?: string;
  description?: string;
};

const UNFURL_TOP_N = 8;

async function enrich(items: NewsItem[]): Promise<NewsItem[]> {
  if (items.length === 0) return items;
  const needed = items.slice(0, UNFURL_TOP_N).filter((n) => !n.imageUrl || !n.publisherIcon || !n.description);
  if (needed.length === 0) return items;
  const map = await unfurlBatch(needed.map((n) => n.url)).catch(() => new Map());
  return items.map((n) => {
    const meta = map.get(n.url);
    if (!meta) return n;
    return {
      ...n,
      imageUrl: n.imageUrl ?? meta.imageUrl,
      publisherIcon: n.publisherIcon ?? meta.favicon,
      description: n.description ?? meta.description,
    };
  });
}

const STOCK_TTL = 60 * 30;
const MARKET_TTL = 60 * 15;

// ---------- Source: Supabase news_articles (populated by /api/cron/crawl-news) ----------
type NewsArticleRow = {
  url: string;
  title: string;
  publisher: string;
  publisher_domain: string | null;
  published_at: string;
  image_url: string | null;
  description: string | null;
  tickers: string[] | null;
};

function rowToNewsItem(r: NewsArticleRow): NewsItem {
  const host = (r.publisher_domain ?? "").toLowerCase();
  return {
    title: r.title,
    publisher: r.publisher,
    publisherDomain: host || undefined,
    url: r.url,
    publishedAt: new Date(r.published_at).getTime(),
    source: "web",
    imageUrl: r.image_url ?? undefined,
    publisherIcon: host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64` : undefined,
    description: r.description ?? undefined,
  };
}

async function fromCrawlerMarket(limit: number): Promise<NewsItem[]> {
  const supa = getServiceClient();
  if (!supa) return [];
  const cutoff = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supa
    .from("news_articles")
    .select("url,title,publisher,publisher_domain,published_at,image_url,description,tickers")
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as NewsArticleRow[]).map(rowToNewsItem);
}

async function fromCrawlerTicker(symbol: string, limit: number): Promise<NewsItem[]> {
  const supa = getServiceClient();
  if (!supa) return [];
  const cutoff = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

  // Primary: rows tagged with this ticker during crawl.
  const { data: tagged, error: e1 } = await supa
    .from("news_articles")
    .select("url,title,publisher,publisher_domain,published_at,image_url,description,tickers")
    .contains("tickers", [symbol])
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false })
    .limit(limit);

  const rows: NewsArticleRow[] = e1 || !tagged ? [] : (tagged as NewsArticleRow[]);

  // Fallback: text-search title+description for the symbol OR company-name
  // needles. Catches articles the crawler couldn't tag (older rows, mixed
  // casing in headlines, etc.).
  const meta = NSE_SYMBOLS.find((s) => s.symbol === symbol);
  const needles: string[] = [symbol];
  if (meta?.name) {
    const cleaned = meta.name.replace(/[^\w\s]/g, " ").trim();
    if (cleaned) needles.push(cleaned);
    const tokens = cleaned.toLowerCase().split(/\s+/).filter((t) => t.length > 3 && !["india", "limited", "ltd", "company"].includes(t));
    if (tokens.length >= 1) needles.push(tokens[0]);
  }
  const seen = new Set(rows.map((r) => r.url));
  const escapeIlike = (s: string) => s.replace(/[%,]/g, " ").trim();
  const orClauses = needles
    .map(escapeIlike)
    .filter((s) => s.length >= 3)
    .flatMap((s) => [`title.ilike.%${s}%`, `description.ilike.%${s}%`])
    .join(",");
  if (orClauses) {
    const { data: text, error: e2 } = await supa
      .from("news_articles")
      .select("url,title,publisher,publisher_domain,published_at,image_url,description,tickers")
      .or(orClauses)
      .gte("published_at", cutoff)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (!e2 && text) {
      for (const r of text as NewsArticleRow[]) {
        if (seen.has(r.url)) continue;
        seen.add(r.url);
        rows.push(r);
      }
    }
  }

  rows.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  return rows.slice(0, limit).map(rowToNewsItem);
}

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
// Yahoo is the only remaining external source. Bing and Google News were removed
// because their RSS wraps every URL in a search redirect — the reader page ends
// up rendering the redirect page instead of the real article. All real news now
// flows through the crawler (/api/cron/crawl-news) into public.news_articles.
async function fromYahoo(symbol: string, exchange: "NSE" | "BSE"): Promise<NewsItem[]> {
  const suffix = exchange === "NSE" ? ".NS" : ".BO";
  const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
  url.searchParams.set("q", symbol + suffix);
  url.searchParams.set("newsCount", "20");
  url.searchParams.set("quotesCount", "0");
  url.searchParams.set("enableFuzzyQuery", "false");
  try {
    const res = await yahooFetch(url.toString());
    if (!res || !res.ok) return [];
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

// ---------- Bing News RSS was removed here ----------
// Reason: Bing's RSS returns bing.com/apiclick redirect URLs that don't decode
// cleanly and end up rendering Bing's own redirect page in the reader.
// The crawler + Yahoo cover market and per-stock coverage.

/** Multi-source news strictly about ONE stock. Filtered to entries mentioning the symbol or company name. */
export async function getStockNews(
  symbol: string,
  exchange: "NSE" | "BSE" = "NSE",
  limit = 12,
): Promise<NewsItem[]> {
  const key = `stock-news:${exchange}:${symbol}:v10`;
  const cached = await redis.get<NewsItem[]>(key).catch(() => null);
  if (cached) return enrich(cached.slice(0, limit));

  // Crawler-first: continuous publisher RSS ingest is the primary source.
  const fromCrawler = await fromCrawlerTicker(symbol, Math.max(limit * 2, 24)).catch((): NewsItem[] => []);

  const meta = NSE_SYMBOLS.find((s) => s.symbol === symbol);
  const companyName = meta?.name ?? symbol;
  const aliases = buildAliases(symbol, companyName);

  // Yahoo is a supplemental source. It often returns global market noise for
  // small-caps that have no dedicated Yahoo news feed — never show that noise.
  // Only include Yahoo items whose title actually mentions the symbol or a
  // company-name token. Better to show fewer stories than off-topic ones.
  const external = await fromYahoo(symbol, exchange).catch((): NewsItem[] => []);
  const relevantExternal = external.filter((n) => isAboutStock(n.title, aliases));

  const final: NewsItem[] = [...fromCrawler, ...relevantExternal];
  const deduped = dedupe(final).sort((a, b) => b.publishedAt - a.publishedAt);

  await redis.set(key, deduped, { ex: STOCK_TTL }).catch(() => {});
  return enrich(deduped.slice(0, limit));
}

/** General Indian market news (not tied to one stock). For the /news page. */
export async function getMarketNews(limit = 40): Promise<NewsItem[]> {
  const key = `market-news:v7`;
  const cached = await redis.get<NewsItem[]>(key).catch(() => null);
  if (cached) return enrich(cached.slice(0, limit));

  // Crawler-first: continuous publisher ingest is the primary source.
  const fromCrawler = await fromCrawlerMarket(Math.max(limit * 2, 80)).catch((): NewsItem[] => []);

  const deduped = dedupe(fromCrawler).sort((a, b) => b.publishedAt - a.publishedAt);

  await redis.set(key, deduped, { ex: MARKET_TTL }).catch(() => {});
  return enrich(deduped.slice(0, limit));
}
