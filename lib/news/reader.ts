import { redis } from "@/lib/redis";
import { createHash } from "node:crypto";

export type ReaderArticle = {
  url: string;
  title?: string;
  byline?: string;
  siteName?: string;
  publishedAt?: number;
  contentHtml: string;
  textPreview: string;
  wordCount: number;
  extractedAt: number;
};

const TTL_SEC = 60 * 60 * 24;
const NEG_TTL_SEC = 5 * 60;
const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 1024 * 1024;

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function urlHash(u: string): string {
  return createHash("sha1").update(u).digest("hex").slice(0, 24);
}

async function fetchHtml(u: string): Promise<{ html: string | null; reason?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(u, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "user-agent": BROWSER_UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-IN,en;q=0.9",
        "cache-control": "no-cache",
      },
    });
    if (!res.ok) return { html: null, reason: `http_${res.status}` };
    const reader = res.body?.getReader();
    if (!reader) return { html: await res.text() };
    const chunks: Uint8Array[] = [];
    let total = 0;
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
    return {
      html: new TextDecoder("utf-8", { fatal: false }).decode(
        Buffer.concat(chunks.map((c) => Buffer.from(c))),
      ),
    };
  } catch (err) {
    return { html: null, reason: err instanceof Error ? err.name : "fetch_error" };
  } finally {
    clearTimeout(t);
  }
}

export async function readArticle(url: string): Promise<ReaderArticle | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol)) return null;
  if (BLOCKED_HOSTS.has(parsed.hostname)) return null;

  const key = `read:v3:${urlHash(url)}`;
  try {
    const cached = await redis.get<ReaderArticle | { miss: true }>(key);
    if (cached && "miss" in cached) return null;
    if (cached) return cached as ReaderArticle;
  } catch { /* noop */ }

  const { html, reason } = await fetchHtml(url);
  if (!html) {
    console.warn("[reader] fetch failed", { url, reason });
    try { await redis.set(key, { miss: true }, { ex: NEG_TTL_SEC }); } catch { /* noop */ }
    return null;
  }

  let article: ReaderArticle | null = null;
  try {
    const [{ JSDOM }, { Readability }, dompurifyMod] = await Promise.all([
      import("jsdom"),
      import("@mozilla/readability"),
      import("dompurify"),
    ]);
    const createDOMPurify = (dompurifyMod as unknown as { default: (win: unknown) => { sanitize: (dirty: string, cfg?: unknown) => string } }).default;
    const dom = new JSDOM(html, { url });
    const DOMPurify = createDOMPurify(dom.window as unknown as Window);
    const doc = dom.window.document;
    const reader = new Readability(doc);
    const parsedArt = reader.parse();
    if (parsedArt && parsedArt.content && parsedArt.textContent) {
      const clean = DOMPurify.sanitize(parsedArt.content, {
        FORBID_TAGS: ["script", "style", "iframe", "form", "input", "button", "svg"],
        FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
        ALLOW_DATA_ATTR: false,
      });
      const words = parsedArt.textContent.trim().split(/\s+/).filter(Boolean);
      const publishedAt = extractDatePublished(html);
      article = {
        url,
        title: parsedArt.title?.slice(0, 240) || undefined,
        byline: parsedArt.byline?.slice(0, 120) || undefined,
        siteName: parsedArt.siteName?.slice(0, 80) || parsed.hostname.replace(/^www\./, ""),
        publishedAt,
        contentHtml: clean,
        textPreview: parsedArt.textContent.trim().slice(0, 320),
        wordCount: words.length,
        extractedAt: Date.now(),
      };
    } else {
      console.warn("[reader] readability returned empty", { url, htmlLen: html.length });
    }
  } catch (err) {
    console.warn("[reader] parse failed", { url, err: err instanceof Error ? err.message : String(err) });
    article = null;
  }

  if (!article) {
    try { await redis.set(key, { miss: true }, { ex: NEG_TTL_SEC }); } catch { /* noop */ }
    return null;
  }

  try { await redis.set(key, article, { ex: TTL_SEC }); } catch { /* noop */ }
  return article;
}

function extractDatePublished(html: string): number | undefined {
  const patterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const t = Date.parse(m[1]);
      if (!Number.isNaN(t)) return t;
    }
  }
  return undefined;
}
