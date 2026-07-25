import { getServiceClient } from "@/lib/supabase/service";
import { deriveSymbolsFromText } from "@/lib/agent/stream-derivations";
import { PUBLISHERS, type PublisherFeed } from "@/lib/news/publishers";

const FEED_TIMEOUT_MS = 8000;
const MAX_ITEMS_PER_FEED = 30;
const MAX_AGE_DAYS = 7;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export type CrawlerResult = {
  feedsHit: number;
  feedsOk: number;
  itemsSeen: number;
  itemsInserted: number;
  errors: Array<{ feed: string; reason: string }>;
};

type ParsedItem = {
  url: string;
  title: string;
  publishedAt: number;
  description?: string;
  imageUrl?: string;
};

function decodeEntities(s: string): string {
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
  return s.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "").trim();
}

function firstMatch(block: string, re: RegExp): string | undefined {
  const m = re.exec(block);
  return m?.[1] ? decodeEntities(stripCdata(m[1])).trim() : undefined;
}

function parseImageFromBlock(block: string): string | undefined {
  const media =
    /<media:content[^>]+url=["']([^"']+)["']/i.exec(block)?.[1] ??
    /<media:thumbnail[^>]+url=["']([^"']+)["']/i.exec(block)?.[1] ??
    /<enclosure[^>]+type=["']image\/[^"']+["'][^>]+url=["']([^"']+)["']/i.exec(block)?.[1] ??
    /<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\/[^"']+["']/i.exec(block)?.[1];
  if (media) return media;
  const descM = /<description>([\s\S]*?)<\/description>/i.exec(block);
  if (descM) {
    const inner = stripCdata(descM[1]);
    const img = /<img[^>]+src=["']([^"']+)["']/i.exec(inner);
    if (img?.[1]) return img[1];
  }
  return undefined;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRss(xml: string): ParsedItem[] {
  const out: ParsedItem[] = [];
  const itemRe = /<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[0];
    const title = firstMatch(block, /<title[^>]*>([\s\S]*?)<\/title>/i);
    // Atom uses <link href="..."/> or <link>text</link>; RSS uses <link>URL</link>
    let link = firstMatch(block, /<link[^>]*>([\s\S]*?)<\/link>/i);
    if (!link) {
      const atomLink = /<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i.exec(block);
      if (atomLink?.[1]) link = atomLink[1];
    }
    if (!title || !link) continue;

    const pubStr =
      firstMatch(block, /<pubDate>([\s\S]*?)<\/pubDate>/i) ??
      firstMatch(block, /<dc:date>([\s\S]*?)<\/dc:date>/i) ??
      firstMatch(block, /<published>([\s\S]*?)<\/published>/i) ??
      firstMatch(block, /<updated>([\s\S]*?)<\/updated>/i);
    const ts = pubStr ? Date.parse(pubStr) : NaN;
    if (!Number.isFinite(ts)) continue;

    const descRaw =
      firstMatch(block, /<description>([\s\S]*?)<\/description>/i) ??
      firstMatch(block, /<summary[^>]*>([\s\S]*?)<\/summary>/i);
    const description = descRaw ? stripTags(descRaw).slice(0, 400) : undefined;
    const imageUrl = parseImageFromBlock(block);

    out.push({
      url: link.trim(),
      title: title.trim(),
      publishedAt: ts,
      description,
      imageUrl,
    });
    if (out.length >= MAX_ITEMS_PER_FEED) break;
  }
  return out;
}

async function fetchFeed(feed: PublisherFeed): Promise<ParsedItem[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FEED_TIMEOUT_MS);
  try {
    const res = await fetch(feed.feedUrl, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "user-agent": BROWSER_UA,
        accept: "application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.5",
        "accept-language": "en-IN,en;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    const xml = await res.text();
    return parseRss(xml);
  } finally {
    clearTimeout(t);
  }
}

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    // strip common utm params to improve dedupe
    for (const k of Array.from(u.searchParams.keys())) {
      if (/^(?:utm_|fbclid|gclid|mc_cid|mc_eid|_ga)/i.test(k)) u.searchParams.delete(k);
    }
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

export async function crawlOnce(): Promise<CrawlerResult> {
  const supa = getServiceClient();
  if (!supa) {
    return { feedsHit: 0, feedsOk: 0, itemsSeen: 0, itemsInserted: 0, errors: [{ feed: "*", reason: "no_service_client" }] };
  }

  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 3600 * 1000;
  const errors: CrawlerResult["errors"] = [];

  const results = await Promise.allSettled(
    PUBLISHERS.map(async (feed) => ({ feed, items: await fetchFeed(feed) })),
  );

  type Row = {
    url: string;
    title: string;
    publisher: string;
    publisher_domain: string;
    published_at: string;
    image_url: string | null;
    description: string | null;
    tickers: string[];
    source_feed: string;
  };

  const rowMap = new Map<string, Row>();
  let itemsSeen = 0;
  let feedsOk = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const feed = PUBLISHERS[i];
    if (r.status === "rejected") {
      errors.push({ feed: feed.id, reason: r.reason instanceof Error ? r.reason.message : String(r.reason) });
      continue;
    }
    feedsOk++;
    for (const item of r.value.items) {
      itemsSeen++;
      if (item.publishedAt < cutoff) continue;
      const url = normalizeUrl(item.url);
      if (!url) continue;
      const tickers = deriveSymbolsFromText(`${item.title} ${item.description ?? ""}`).map((s) => s.symbol);
      const row: Row = {
        url,
        title: item.title.slice(0, 400),
        publisher: feed.name,
        publisher_domain: feed.domain,
        published_at: new Date(item.publishedAt).toISOString(),
        image_url: item.imageUrl ?? null,
        description: item.description ?? null,
        tickers,
        source_feed: feed.id,
      };
      // If we see the same URL across feeds, keep the row with the richest metadata (prefer one with image).
      const existing = rowMap.get(url);
      if (!existing || (!existing.image_url && row.image_url)) rowMap.set(url, row);
    }
  }

  const rows = Array.from(rowMap.values());
  let itemsInserted = 0;

  if (rows.length > 0) {
    // Batch to keep payload sizes reasonable.
    const BATCH = 200;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const { error, count } = await supa
        .from("news_articles")
        .upsert(chunk, { onConflict: "url", ignoreDuplicates: true, count: "exact" });
      if (error) {
        errors.push({ feed: "supabase", reason: error.message });
      } else {
        itemsInserted += count ?? 0;
      }
    }
  }

  return { feedsHit: PUBLISHERS.length, feedsOk, itemsSeen, itemsInserted, errors };
}
