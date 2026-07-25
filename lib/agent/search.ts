import { redis } from "@/lib/redis";
import { extractPdfText } from "@/lib/guidance/pdf";

// Live web-search + URL-read primitives for the research agent. Serper.dev is
// a Google-results API — cheap ($50/50k after free tier), fast, and returns a
// clean JSON we can hand to the LLM. Every result is Redis-cached so the free
// tier lasts longer and repeated tool calls don't burn quota.

const SERPER_URL = "https://google.serper.dev/search";

export type SearchSource =
  | "general"
  | "news"
  | "x"
  | "valuepickr"
  | "concall"
  | "presentation";

export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  date?: string;
  source?: string;
};

function shapeQuery(query: string, source: SearchSource): string {
  switch (source) {
    case "x":
      return `${query} (site:x.com OR site:twitter.com OR site:nitter.net)`;
    case "valuepickr":
      return `${query} site:forum.valuepickr.com`;
    case "concall":
      // Trendlyne + screener.in + researchbytes host most Indian concall
      // transcripts; the "concall transcript" phrase filters IR-page hits too.
      return `${query} concall transcript OR "earnings call" (site:trendlyne.com OR site:screener.in OR site:researchbytes.com OR site:bseindia.com OR site:nseindia.com)`;
    case "presentation":
      return `${query} investor presentation filetype:pdf`;
    case "news":
    case "general":
    default:
      return query;
  }
}

function cacheKey(prefix: string, s: string): string {
  // Simple, stable, safe key. Base64 to avoid Redis key-charset issues.
  const b = Buffer.from(s).toString("base64").replace(/[+/=]/g, "").slice(0, 180);
  return `${prefix}:${b}`;
}

export async function webSearch(
  query: string,
  source: SearchSource = "general",
  num = 8,
): Promise<{ hits: SearchHit[]; note?: string }> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return { hits: [], note: "web search not configured (SERPER_API_KEY missing)" };

  const q = shapeQuery(query, source);
  const ck = cacheKey(`agent:websearch:${source}`, q);
  const cached = await redis.get<{ hits: SearchHit[] }>(ck).catch(() => null);
  if (cached) return cached;

  try {
    const body: Record<string, unknown> = { q, num };
    if (source === "news") body.type = "news";
    const res = await fetch(SERPER_URL, {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { hits: [], note: `serper ${res.status}` };
    const data = (await res.json()) as {
      organic?: Array<{ title: string; link: string; snippet?: string; date?: string; source?: string }>;
      news?: Array<{ title: string; link: string; snippet?: string; date?: string; source?: string }>;
    };
    const raw = source === "news" ? data.news ?? [] : data.organic ?? [];
    const hits: SearchHit[] = raw.slice(0, num).map((h) => ({
      title: h.title,
      url: h.link,
      snippet: h.snippet ?? "",
      date: h.date,
      source: h.source,
    }));
    const payload = { hits };
    await redis.set(ck, payload, { ex: 60 * 30 }).catch(() => {});
    return payload;
  } catch (e) {
    return { hits: [], note: e instanceof Error ? e.message : "search failed" };
  }
}

export type UrlDoc = {
  title: string;
  url: string;
  content: string;
  note?: string;
};

const READ_MAX_CHARS = 8000;

export async function readUrl(url: string): Promise<UrlDoc> {
  const ck = cacheKey("agent:readurl", url);
  const cached = await redis.get<UrlDoc>(ck).catch(() => null);
  if (cached) return cached;

  try {
    const res = await fetch(url, {
      headers: {
        // Identify ourselves + look like a normal browser enough that most CDNs
        // don't 403 us. Not attempting to evade any bot-block.
        "User-Agent":
          "Mozilla/5.0 (compatible; StocksbrewResearchBot/1.0; +https://stocksbrew.in)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
    });
    if (!res.ok) {
      return { title: "", url, content: "", note: `HTTP ${res.status}` };
    }
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (contentType.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
      const doc = await extractPdf(res, url);
      await redis.set(ck, doc, { ex: 60 * 60 * 24 }).catch(() => {});
      return doc;
    }
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return { title: "", url, content: "", note: `unsupported content-type: ${contentType || "unknown"}` };
    }
    const html = await res.text();
    const { title, content } = extractReadable(html);
    const truncated = content.length > READ_MAX_CHARS;
    const doc: UrlDoc = {
      title,
      url,
      content: content.slice(0, READ_MAX_CHARS),
      note: truncated ? `truncated at ${READ_MAX_CHARS} chars — page had ${content.length} chars` : undefined,
    };
    await redis.set(ck, doc, { ex: 60 * 60 * 24 }).catch(() => {});
    return doc;
  } catch (e) {
    return { title: "", url, content: "", note: e instanceof Error ? e.message : "fetch failed" };
  }
}

// Deliberately lightweight — pulls readable text out of arbitrary HTML without
// pulling in a 200KB Readability library. Good enough for news, forum posts,
// and IR pages. If it misses on some site, the LLM still gets the Serper
// snippet + URL and can decide.
function extractReadable(html: string): { title: string; content: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";

  const entities: Record<string, string> = {
    nbsp: " ",
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    "#39": "'",
    "#x27": "'",
  };

  const stripped = html
    .replace(/<(script|style|noscript|nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|#39|#x27);/gi, (_, e: string) => entities[e.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ")
    .trim();

  return { title, content: stripped };
}

// PDF extraction reuses the same pdf-parse pipeline as filings ingest. Caps
// output at READ_MAX_CHARS just like HTML, and hard-limits input to 8MB so a
// hostile URL can't OOM the server.
const PDF_MAX_BYTES = 8 * 1024 * 1024;
async function extractPdf(res: Response, url: string): Promise<UrlDoc> {
  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > PDF_MAX_BYTES) {
    return { title: "", url, content: "", note: `PDF too large (${(contentLength / 1e6).toFixed(1)} MB) — cite URL directly` };
  }
  const ab = await res.arrayBuffer();
  if (ab.byteLength > PDF_MAX_BYTES) {
    return { title: "", url, content: "", note: `PDF too large (${(ab.byteLength / 1e6).toFixed(1)} MB) — cite URL directly` };
  }
  const text = await extractPdfText(ab);
  if (text === null) {
    return { title: "", url, content: "", note: "PDF parse failed — cite URL directly" };
  }
  const cleaned = text.replace(/\s+/g, " ").trim();
  const truncated = cleaned.length > READ_MAX_CHARS;
  return {
    title: "",
    url,
    content: cleaned.slice(0, READ_MAX_CHARS),
    note: truncated ? `truncated at ${READ_MAX_CHARS} chars — PDF had ${cleaned.length} chars` : undefined,
  };
}
