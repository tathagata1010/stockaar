// NSE Corporate Announcements fetcher.
//
// Endpoint: https://www.nseindia.com/api/corporate-announcements
// Requires a cookie warmup against nseindia.com (NSE blocks bot-shaped clients).
// Returns a flat array; each row already includes the NSE symbol, attachment URL,
// timestamp, and a `desc` field we map to our internal category enum.

const NSE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/companies-listing/corporate-filings-announcements",
};

export type GuidanceCategory =
  | "concall_transcript"
  | "investor_presentation"
  | "business_update"
  | "press_release";

export type NseFiling = {
  sourceId: string;
  symbol: string;
  companyName: string;
  category: GuidanceCategory;
  headline: string;
  body: string;
  pdfUrl: string | null;
  filedAt: string; // ISO
};

type NseRow = {
  an_dt?: string;
  sort_date?: string;
  attchmntFile?: string;
  attchmntText?: string;
  desc?: string;
  seq_id?: string;
  sm_name?: string;
  symbol?: string;
};

// NSE `desc` → our category. Order matters: prefer most-specific match.
const CATEGORY_RULES: { match: RegExp; cat: GuidanceCategory }[] = [
  { match: /\b(earnings\s*call|conference\s*call|concall|analyst.*meet|investor.*meet|transcript|audio\s*recording)\b/i, cat: "concall_transcript" },
  { match: /\binvestor\s*presentation\b/i, cat: "investor_presentation" },
  { match: /\b(press\s*release|media\s*release)\b/i, cat: "press_release" },
  { match: /\b(business\s*update|operational\s*update|updates?)\b/i, cat: "business_update" },
];

// Drop obvious noise BEFORE we burn LLM tokens. These announcements share the
// "Analyst/Investor Meet" category but carry no business signal — only the
// schedule, dial-in code, tax-deduction notice, or buyback intimation.
const HEADLINE_NOISE = /\b(schedule of|intimation of|deduction of tax|shareholders?\s*communication|record date|loss of share|duplicate share|board meeting|postal ballot|notice of|disclosure under|sast|insider trading|reg(\.|ulation)?\s*30|certificate under|compliance certificate)\b/i;

const BODY_NOISE = /\b(intimation of schedule|schedule of (analyst|institutional|investor)|loss of share certificate|duplicate share|deduction of tax|under the sebi \(listing obligations|sebi listing obligations|prohibition of insider trading)\b/i;

export function isLikelyNoise(headline: string, body: string): boolean {
  const h = headline || "";
  const b = body || "";
  if (HEADLINE_NOISE.test(h)) return true;
  if (BODY_NOISE.test(b)) return true;
  return false;
}

function mapCategory(desc: string): GuidanceCategory | null {
  if (!desc) return null;
  for (const r of CATEGORY_RULES) if (r.match.test(desc)) return r.cat;
  return null;
}

// NSE date "03-Jun-2026 12:38:57" (IST, no offset). Treat as IST.
function parseNseDate(s: string | undefined): string | null {
  if (!s) return null;
  // The `sort_date` field is "YYYY-MM-DD HH:MM:SS" — easier to parse.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(`${s.replace(" ", "T")}+05:30`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  // Fallback: "03-Jun-2026 12:38:57"
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const mm = months[m[2]];
  if (!mm) return null;
  const d = new Date(`${m[3]}-${mm}-${m[1]}T${m[4]}:${m[5]}:${m[6]}+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// dd-mm-yyyy for NSE's from_date / to_date params.
export function ddmmyyyy(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}-${mon}-${d.getUTCFullYear()}`;
}

async function getCookieHeader(): Promise<string> {
  try {
    const r = await fetch(
      "https://www.nseindia.com/companies-listing/corporate-filings-announcements",
      { headers: NSE_HEADERS, cache: "no-store" },
    );
    const raw = r.headers.get("set-cookie") ?? "";
    return raw
      .split(/,(?=[^ ]+=)/)
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");
  } catch {
    return "";
  }
}

export async function fetchNseFilings({
  fromDate,
  toDate,
}: {
  fromDate: string; // dd-mm-yyyy
  toDate: string;
}): Promise<NseFiling[]> {
  const cookie = await getCookieHeader();
  const url = `https://www.nseindia.com/api/corporate-announcements?index=equities&from_date=${fromDate}&to_date=${toDate}`;
  let rows: NseRow[] = [];
  try {
    const res = await fetch(url, {
      headers: { ...NSE_HEADERS, Cookie: cookie },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[nse-ann] ${res.status}`);
      return [];
    }
    const json = (await res.json()) as NseRow[] | { data?: NseRow[] };
    rows = Array.isArray(json) ? json : json.data ?? [];
  } catch (e) {
    console.warn("[nse-ann] fetch error", e);
    return [];
  }

  const out: NseFiling[] = [];
  for (const r of rows) {
    const cat = mapCategory(r.desc || "");
    if (!cat) continue;
    const filedAt = parseNseDate(r.sort_date || r.an_dt);
    if (!filedAt) continue;
    const seq = String(r.seq_id ?? "").trim();
    const sym = (r.symbol ?? "").trim();
    if (!seq || !sym) continue;
    out.push({
      sourceId: seq,
      symbol: sym,
      companyName: (r.sm_name ?? "").trim(),
      category: cat,
      headline: (r.desc ?? "").trim(),
      body: (r.attchmntText ?? "").trim(),
      pdfUrl: (r.attchmntFile ?? "").trim() || null,
      filedAt,
    });
  }
  return out;
}
