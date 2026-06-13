// Screener.in scrape for quarterly shareholding pattern.
//
// Primary source — works from Vercel/AWS data-center IPs that NSE blocks.
// Screener publishes the SEBI quarterly SHP table as plain HTML at
// /company/<SYMBOL>/ with category rows: Promoters / FIIs / DIIs / Government
// / Public / Others. This gives us less granularity than the raw XBRL (no
// MF / Insurance / Banks split) but covers what the UI shows by default.

import { redis } from "./redis";
import { NSE_UA } from "./shareholding";
import type { ShareholdingBreakdown, ShareholdingTimeline } from "./xbrl-shp";

const TTL_SECONDS = 60 * 60 * 24;
const NEG_TTL_SECONDS = 60 * 10;

function key(symbol: string) {
  return `screener-shp:${symbol}:v1`;
}

// "Jun 2025" → "2025-06-30" (quarter-end day)
function parseQuarterHeader(raw: string): string | null {
  const m = raw.trim().match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/);
  if (!m) return null;
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const month = months[m[1]];
  const year = Number(m[2]);
  // Last day of month
  const d = new Date(Date.UTC(year, month + 1, 0));
  return d.toISOString().slice(0, 10);
}

function parsePct(raw: string): number {
  const cleaned = raw.replace(/[%,\s]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// Extract the #quarterly-shp <table> body and parse each labeled row.
function parseScreenerHtml(html: string): ShareholdingTimeline {
  const empty: ShareholdingTimeline = { quarters: [], latest: null, latestXbrlUrl: null };

  const sectionMatch = html.match(/id="quarterly-shp"[\s\S]*?<\/table>/);
  if (!sectionMatch) return empty;
  const section = sectionMatch[0];

  const headerMatch = section.match(/<thead>[\s\S]*?<\/thead>/);
  if (!headerMatch) return empty;
  const headerCells = [...headerMatch[0].matchAll(/<th[^>]*>([^<]*)<\/th>/g)]
    .map((m) => m[1].trim());
  // First <th> is the row-label column (usually empty)
  const dateHeaders = headerCells.slice(1).map(parseQuarterHeader);
  const validQuarters = dateHeaders.filter((d): d is string => d != null);
  if (validQuarters.length === 0) return empty;

  const tbodyMatch = section.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return empty;
  const tbody = tbodyMatch[1];

  const rows = [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);

  const buckets: Record<string, number[]> = {
    promoter: [],
    fii: [],
    dii: [],
    public: [],
    others: [],
  };

  for (const row of rows) {
    const labelMatch = row.match(/<td[^>]*class="text"[^>]*>([\s\S]*?)<\/td>/);
    if (!labelMatch) continue;
    const labelText = labelMatch[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim().toLowerCase();

    let bucket: keyof typeof buckets | null = null;
    if (labelText.startsWith("promoter")) bucket = "promoter";
    else if (labelText.startsWith("fii")) bucket = "fii";
    else if (labelText.startsWith("dii")) bucket = "dii";
    else if (labelText.startsWith("public")) bucket = "public";
    else if (labelText.startsWith("government") || labelText.startsWith("other")) bucket = "others";

    if (!bucket) continue;

    const cells = [...row.matchAll(/<td(?![^>]*class="text")[^>]*>([\s\S]*?)<\/td>/g)]
      .map((m) => parsePct(m[1].replace(/<[^>]+>/g, "")));

    for (let i = 0; i < dateHeaders.length; i++) {
      if (dateHeaders[i] == null) continue;
      const v = cells[i] ?? 0;
      buckets[bucket].push(v);
    }
  }

  // For categories with multiple rows mapped (government + others), sum positionally.
  const perQuarter = (key: keyof typeof buckets): number[] => {
    const arr = buckets[key];
    const n = validQuarters.length;
    if (arr.length === 0) return new Array(n).fill(0);
    if (arr.length === n) return arr;
    // Sum aligned chunks of length n
    const out = new Array(n).fill(0);
    for (let i = 0; i < arr.length; i++) out[i % n] += arr[i];
    return out;
  };

  const promoter = perQuarter("promoter");
  const fii = perQuarter("fii");
  const dii = perQuarter("dii");
  const publicRetail = perQuarter("public");
  const others = perQuarter("others");

  const quarters: ShareholdingBreakdown[] = validQuarters.map((asOn, i) => ({
    asOnDate: asOn,
    promoter: promoter[i] ?? 0,
    fii: fii[i] ?? 0,
    dii: dii[i] ?? 0,
    mf: 0,
    insurance: 0,
    banksFi: 0,
    retail: publicRetail[i] ?? 0,
    bodies: 0,
    others: others[i] ?? 0,
  }));

  // Drop quarters where everything is zero (table cell missing for new listings).
  const nonEmpty = quarters.filter(
    (q) => q.promoter + q.fii + q.dii + q.retail + q.others > 0,
  );
  if (nonEmpty.length === 0) return empty;

  // Already oldest → newest (screener prints earliest column first).
  return {
    quarters: nonEmpty,
    latest: nonEmpty[nonEmpty.length - 1],
    latestXbrlUrl: null,
  };
}

export async function fetchScreenerShareholding(
  symbol: string,
): Promise<ShareholdingTimeline> {
  const k = key(symbol);
  const cached = await redis.get<ShareholdingTimeline>(k).catch(() => null);
  if (cached) return cached;

  const empty: ShareholdingTimeline = { quarters: [], latest: null, latestXbrlUrl: null };
  try {
    const res = await fetch(`https://www.screener.in/company/${encodeURIComponent(symbol)}/`, {
      headers: { "User-Agent": NSE_UA, Accept: "text/html,*/*" },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      redis.set(k, empty, { ex: NEG_TTL_SECONDS }).catch(() => {});
      return empty;
    }
    const html = await res.text();
    const parsed = parseScreenerHtml(html);
    const ttl = parsed.quarters.length > 0 ? TTL_SECONDS : NEG_TTL_SECONDS;
    redis.set(k, parsed, { ex: ttl }).catch(() => {});
    return parsed;
  } catch (e) {
    console.warn("[screener-shp] fetch error for " + symbol, e);
    redis.set(k, empty, { ex: NEG_TTL_SECONDS }).catch(() => {});
    return empty;
  }
}
