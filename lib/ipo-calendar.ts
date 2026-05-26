import { redis } from "@/lib/redis";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export type IpoStatus = "Upcoming" | "Open" | "Closed";

export type Ipo = {
  name: string;
  symbol?: string;
  sector: string;
  priceBandMin: number;
  priceBandMax: number;
  lotSize: number;
  issueSize: string;
  openDate: string;
  closeDate: string;
  listingDate?: string;
  status: IpoStatus;
};

const CACHE_KEY = "ipos:nse:v1";
const CACHE_TTL_SECONDS = 60 * 30;

// Static fallback — only used if NSE and Supabase snapshot both fail.
export const UPCOMING_IPOS: Ipo[] = [
  {
    name: "Tata Capital",
    symbol: "TATACAP",
    sector: "NBFC",
    priceBandMin: 285,
    priceBandMax: 310,
    lotSize: 48,
    issueSize: "₹15,500 Cr",
    openDate: "2026-05-26",
    closeDate: "2026-05-28",
    listingDate: "2026-06-04",
    status: "Upcoming",
  },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function deriveStatus(open: string, close: string): IpoStatus {
  const t = todayISO();
  if (t < open) return "Upcoming";
  if (t > close) return "Closed";
  return "Open";
}

function inrCrore(amount: unknown): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(0)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(0)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function parsePriceBand(value: unknown): { min: number; max: number } {
  if (typeof value !== "string") return { min: 0, max: 0 };
  const cleaned = value.replace(/[^0-9.\-]/g, " ");
  const parts = cleaned.split(/\s+/).map((p) => Number(p)).filter((n) => Number.isFinite(n) && n > 0);
  if (parts.length === 0) return { min: 0, max: 0 };
  if (parts.length === 1) return { min: parts[0], max: parts[0] };
  const sorted = parts.sort((a, b) => a - b);
  return { min: sorted[0], max: sorted[sorted.length - 1] };
}

function parseDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const d = new Date(value);
  if (Number.isFinite(d.getTime())) return d.toISOString().slice(0, 10);
  const m = value.match(/(\d{1,2})[-\s\/]?([A-Za-z]{3,})[-\s\/]?(\d{2,4})/);
  if (m) {
    const day = Number(m[1]);
    const month = m[2];
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    const parsed = new Date(`${day} ${month} ${year}`);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return "";
}

type NseUpcoming = {
  companyName?: string;
  symbol?: string;
  series?: string;
  issueStartDate?: string;
  issueEndDate?: string;
  status?: string;
  issuePrice?: string;
  lotSize?: number | string;
  issueSize?: number | string;
  sector?: string;
};

function normalizeNseRow(r: NseUpcoming): Ipo | null {
  const name = r.companyName?.trim();
  if (!name) return null;
  const openDate = parseDate(r.issueStartDate);
  const closeDate = parseDate(r.issueEndDate);
  if (!openDate || !closeDate) return null;
  const { min, max } = parsePriceBand(r.issuePrice);
  return {
    name,
    symbol: r.symbol?.trim() || undefined,
    sector: r.sector?.trim() || "—",
    priceBandMin: min,
    priceBandMax: max,
    lotSize: Number(r.lotSize) || 0,
    issueSize: inrCrore(r.issueSize),
    openDate,
    closeDate,
    status: deriveStatus(openDate, closeDate),
  };
}

const NSE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/market-data/all-upcoming-issues-ipo",
};

async function fetchFromNSE(): Promise<Ipo[] | null> {
  try {
    const warmup = await fetch("https://www.nseindia.com/market-data/all-upcoming-issues-ipo", {
      headers: NSE_HEADERS,
      cache: "no-store",
    });
    const cookies = warmup.headers.get("set-cookie") ?? "";
    const cookieHeader = cookies
      .split(/,(?=[^ ]+=)/)
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");

    const res = await fetch(
      "https://www.nseindia.com/api/all-upcoming-issues?category=ipo",
      {
        headers: {
          ...NSE_HEADERS,
          Cookie: cookieHeader,
        },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      console.warn(`[ipo] NSE ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { data?: NseUpcoming[] } | NseUpcoming[];
    const rows: NseUpcoming[] = Array.isArray(json) ? json : json.data ?? [];
    const ipos = rows
      .map(normalizeNseRow)
      .filter((x): x is Ipo => x !== null);
    return ipos.length > 0 ? ipos : null;
  } catch (e) {
    console.warn("[ipo] NSE fetch error", e);
    return null;
  }
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

async function readSnapshot(): Promise<Ipo[] | null> {
  const admin = adminClient();
  if (!admin) return null;
  try {
    const { data } = await admin
      .from("ipo_snapshot")
      .select("data")
      .eq("id", 1)
      .maybeSingle();
    const rows = (data?.data as Ipo[] | undefined) ?? null;
    return rows && rows.length > 0 ? rows : null;
  } catch {
    return null;
  }
}

async function writeSnapshot(rows: Ipo[], source: string): Promise<void> {
  const admin = adminClient();
  if (!admin) return;
  try {
    await admin
      .from("ipo_snapshot")
      .upsert({ id: 1, data: rows, source, fetched_at: new Date().toISOString() });
  } catch {}
}

export async function getIpos(opts?: { force?: boolean }): Promise<{ ipos: Ipo[]; source: string }> {
  if (!opts?.force) {
    const cached = await redis.get<{ ipos: Ipo[]; source: string }>(CACHE_KEY).catch(() => null);
    if (cached) return cached;
  }

  const fresh = await fetchFromNSE();
  if (fresh && fresh.length > 0) {
    const payload = { ipos: fresh, source: "nse" };
    await redis.set(CACHE_KEY, payload, { ex: CACHE_TTL_SECONDS }).catch(() => {});
    await writeSnapshot(fresh, "nse");
    return payload;
  }

  const snapshot = await readSnapshot();
  if (snapshot) {
    const payload = { ipos: snapshot, source: "snapshot" };
    await redis.set(CACHE_KEY, payload, { ex: 60 * 5 }).catch(() => {});
    return payload;
  }

  return { ipos: UPCOMING_IPOS, source: "static" };
}
