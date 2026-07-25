import { redis } from "@/lib/redis";
import { YAHOO_UA } from "@/lib/yahoo-auth";
import { createHash } from "node:crypto";

export type UnfurledMeta = {
  url: string;
  imageUrl?: string;
  title?: string;
  description?: string;
  favicon?: string;
  siteName?: string;
};

const TTL_SEC = 60 * 60 * 24 * 7;
const NEG_TTL_SEC = 60 * 60 * 6;
const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 256 * 1024;

const TRACKER_HOSTS = new Set([
  "google-analytics.com",
  "www.google-analytics.com",
  "ssl.google-analytics.com",
  "googletagmanager.com",
  "www.googletagmanager.com",
  "doubleclick.net",
  "www.doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "facebook.com",
  "connect.facebook.net",
  "scorecardresearch.com",
  "quantserve.com",
  "adnxs.com",
  "adsystem.com",
]);

export function isTrackerHost(host: string | undefined): boolean {
  if (!host) return false;
  const h = host.toLowerCase().replace(/^www\./, "");
  if (TRACKER_HOSTS.has(h) || TRACKER_HOSTS.has(host.toLowerCase())) return true;
  return /(?:^|\.)(google-analytics|googletagmanager|doubleclick|scorecardresearch|adsystem)\./.test(h);
}

function sanitizeSiteName(candidate: string | undefined, fallback: string): string {
  if (!candidate) return fallback;
  const trimmed = candidate.trim();
  if (!trimmed) return fallback;
  if (isTrackerHost(trimmed)) return fallback;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const h = new URL(trimmed).hostname.replace(/^www\./, "");
      return isTrackerHost(h) ? fallback : h;
    } catch {
      return fallback;
    }
  }
  return trimmed;
}

function extractMeta(html: string, prop: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${prop}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1].trim());
  }
  return undefined;
}

function extractIconHref(html: string): string | undefined {
  const re = /<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i;
  const m = html.match(re);
  if (m?.[1]) return m[1].trim();
  const re2 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["']/i;
  const m2 = html.match(re2);
  return m2?.[1]?.trim();
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1] ? decodeEntities(m[1].trim()) : undefined;
}

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

function absolutize(maybeUrl: string, base: URL): string | undefined {
  try {
    return new URL(maybeUrl, base).toString();
  } catch {
    return undefined;
  }
}

function urlHash(u: string): string {
  return createHash("sha256").update(u).digest("hex").slice(0, 24);
}

function googleFavicon(host: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

async function fetchHead(u: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(u, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "user-agent": YAHOO_UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-IN,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    let total = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
        if (total >= MAX_HTML_BYTES) {
          try { await reader.cancel(); } catch { /* noop */ }
          break;
        }
      }
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function unfurl(url: string): Promise<UnfurledMeta> {
  const key = `unfurl:v1:${urlHash(url)}`;
  try {
    const cached = await redis.get<UnfurledMeta>(key);
    if (cached) return cached;
  } catch { /* noop */ }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url };
  }

  const host = parsed.hostname.replace(/^www\./, "");
  const hostIsTracker = isTrackerHost(parsed.hostname);
  const meta: UnfurledMeta = {
    url,
    siteName: hostIsTracker ? "" : host,
    favicon: hostIsTracker ? undefined : googleFavicon(host),
  };

  const html = await fetchHead(url);
  if (html) {
    const ogImage = extractMeta(html, "og:image") ?? extractMeta(html, "twitter:image");
    const ogTitle = extractMeta(html, "og:title") ?? extractMeta(html, "twitter:title") ?? extractTitle(html);
    const desc = extractMeta(html, "og:description") ?? extractMeta(html, "twitter:description") ?? extractMeta(html, "description");
    const site = extractMeta(html, "og:site_name");
    const iconHref = extractIconHref(html);

    if (ogImage) meta.imageUrl = absolutize(ogImage, parsed);
    if (ogTitle) meta.title = ogTitle.slice(0, 240);
    if (desc) meta.description = desc.slice(0, 400);
    const sanitized = sanitizeSiteName(site, hostIsTracker ? "" : host);
    if (sanitized) meta.siteName = sanitized.slice(0, 80);
    if (iconHref) {
      const abs = absolutize(iconHref, parsed);
      if (abs && !isTrackerHost(new URL(abs, parsed).hostname)) meta.favicon = abs;
    }
  }

  try {
    await redis.set(key, meta, { ex: meta.imageUrl ? TTL_SEC : NEG_TTL_SEC });
  } catch { /* noop */ }

  return meta;
}

export async function unfurlBatch(urls: string[]): Promise<Map<string, UnfurledMeta>> {
  const uniq = [...new Set(urls)];
  const out = new Map<string, UnfurledMeta>();
  const results = await Promise.all(uniq.map((u) => unfurl(u).catch(() => ({ url: u } as UnfurledMeta))));
  for (const r of results) out.set(r.url, r);
  return out;
}
