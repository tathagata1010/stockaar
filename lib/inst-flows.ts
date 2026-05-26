import { cache } from "react";
import { redis } from "./redis";

/**
 * Aggregates NSE bulk + block deals over a rolling window (default 30 days),
 * classifies each deal's client name as FII / DII / OTHER, and exposes per-symbol
 * net flow in INR (positive = net buy, negative = net sell).
 *
 * Data source: NSE public archive CSVs (no cookies required):
 *   https://archives.nseindia.com/content/equities/bulk.csv
 *   https://archives.nseindia.com/content/equities/block.csv
 *
 * These archives expose the most recent day's deals. The cron snapshots them
 * into a rolling per-day Redis store; downstream we aggregate to per-symbol totals.
 */

export type DealSide = "BUY" | "SELL";
export type DealCategory = "FII" | "DII" | "OTHER";
export type DealType = "BULK" | "BLOCK";

export type Deal = {
  date: string;          // YYYY-MM-DD (trade date as reported)
  symbol: string;
  client: string;
  side: DealSide;
  qty: number;
  price: number;
  value: number;         // qty * price (₹)
  category: DealCategory;
  type: DealType;
};

export type FlowAgg = {
  symbol: string;
  fiiBuy: number;
  fiiSell: number;
  fiiNet: number;
  diiBuy: number;
  diiSell: number;
  diiNet: number;
  instNet: number;       // fiiNet + diiNet
  dealCount: number;
  lastDealDate: string;
};

export type FlowsPayload = {
  builtAt: number;
  windowDays: number;
  daysCovered: number;
  totalDeals: number;
  bySymbol: Record<string, FlowAgg>;
};

const DAYS_KEY = "inst:flows:days:v1";
const AGG_KEY = "inst:flows:agg:v1";
const WINDOW_DAYS = 30;
const HARD_TTL_SEC = 90 * 24 * 60 * 60;
const UA = "stocksbrew/1.0 (+https://stocksbrew.in)";

const SOURCES = [
  { url: "https://archives.nseindia.com/content/equities/bulk.csv", type: "BULK" as DealType },
  { url: "https://archives.nseindia.com/content/equities/block.csv", type: "BLOCK" as DealType },
];

// Order matters: most-specific first so "FOREIGN INSTITUTIONAL" hits FII before
// a generic "INSTITUTIONAL" token could accidentally hit DII.
const FII_PATTERNS = [
  /\bFPI\b/, /FOREIGN\s+PORTFOLIO/, /FOREIGN\s+INSTITUTIONAL/, /\bFII\b/,
  /MAURITIUS/, /MORGAN\s+STANLEY/, /GOLDMAN\s+SACHS/, /CITIGROUP/,
  /SOCIETE\s+GENERALE/, /BNP\s+PARIBAS/, /\bUBS\b/, /DEUTSCHE/,
  /NORGES\s+BANK/, /VANGUARD/, /BLACKROCK/, /FIDELITY/, /SCHRODER/,
  /ABU\s+DHABI/, /GOVERNMENT\s+OF\s+SINGAPORE/, /\bGIC\b/,
];

const DII_PATTERNS = [
  /MUTUAL\s+FUND/, /\bMF\b/, /INSURANCE\s+COMPANY/, /LIFE\s+INSURANCE/,
  /LIC\s+OF\s+INDIA/, /DOMESTIC\s+INSTITUTIONAL/, /\bDII\b/,
  /PENSION\s+FUND/, /PROVIDENT\s+FUND/, /\bEPFO\b/, /\bNPS\b/,
  /\bSBI\s+FUNDS?/, /\bHDFC\s+MUTUAL/, /ICICI\s+PRUDENTIAL/, /KOTAK\s+MAHINDRA/,
  /AXIS\s+MUTUAL/, /NIPPON\s+(LIFE\s+)?INDIA/, /\bDSP\b/, /\bUTI\b/,
  /\bIDFC\s+(MUTUAL|ASSET)/, /\bTATA\s+(MUTUAL|ASSET)/, /MIRAE\s+ASSET/,
  /FRANKLIN\s+TEMPLETON/, /ADITYA\s+BIRLA/, /MOTILAL\s+OSWAL/,
];

export function classifyClient(rawName: string): DealCategory {
  const name = rawName.toUpperCase();
  for (const re of FII_PATTERNS) if (re.test(name)) return "FII";
  for (const re of DII_PATTERNS) if (re.test(name)) return "DII";
  return "OTHER";
}

// Minimal CSV parser that handles quoted fields containing commas/quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") {
        if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
        row = []; cur = "";
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else cur += c;
    }
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// NSE archive CSVs use DD-MMM-YYYY (e.g. "26-May-2026"). Returns YYYY-MM-DD.
function parseNseDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const mm = months[m[2].toLowerCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
}

function normalizeSide(raw: string): DealSide | null {
  const s = raw.trim().toUpperCase();
  if (s === "BUY" || s === "B") return "BUY";
  if (s === "SELL" || s === "S") return "SELL";
  return null;
}

function parseCsvDeals(text: string, type: DealType): Deal[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) =>
    header.findIndex((h) => names.some((n) => h.includes(n)));
  const iDate = col("date");
  const iSym = col("symbol");
  const iClient = col("client");
  const iSide = col("buy", "sell", "buy/sell");
  const iQty = col("quantity");
  const iPrice = col("price", "wght", "avg");
  if (iDate < 0 || iSym < 0 || iClient < 0 || iSide < 0 || iQty < 0 || iPrice < 0) return [];

  const out: Deal[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 5) continue;
    const date = parseNseDate(r[iDate] ?? "");
    const symbol = (r[iSym] ?? "").trim().toUpperCase();
    const client = (r[iClient] ?? "").trim();
    const side = normalizeSide(r[iSide] ?? "");
    const qty = Number(String(r[iQty] ?? "").replace(/,/g, ""));
    const price = Number(String(r[iPrice] ?? "").replace(/,/g, ""));
    if (!date || !symbol || !client || !side || !Number.isFinite(qty) || !Number.isFinite(price)) continue;
    if (qty <= 0 || price <= 0) continue;
    out.push({
      date, symbol, client, side, qty, price,
      value: qty * price,
      category: classifyClient(client),
      type,
    });
  }
  return out;
}

async function fetchOne(url: string, type: DealType): Promise<Deal[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/csv,text/plain,*/*" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const text = await res.text();
    return parseCsvDeals(text, type);
  } catch {
    return [];
  }
}

type DayBucket = { date: string; deals: Deal[] };

function aggregate(days: DayBucket[]): FlowsPayload {
  const bySymbol = new Map<string, FlowAgg>();
  let total = 0;
  const dateSet = new Set<string>();
  for (const day of days) {
    dateSet.add(day.date);
    for (const d of day.deals) {
      total++;
      if (d.category === "OTHER") continue;
      let agg = bySymbol.get(d.symbol);
      if (!agg) {
        agg = {
          symbol: d.symbol,
          fiiBuy: 0, fiiSell: 0, fiiNet: 0,
          diiBuy: 0, diiSell: 0, diiNet: 0,
          instNet: 0, dealCount: 0,
          lastDealDate: d.date,
        };
        bySymbol.set(d.symbol, agg);
      }
      const v = d.value;
      if (d.category === "FII") {
        if (d.side === "BUY") agg.fiiBuy += v; else agg.fiiSell += v;
      } else {
        if (d.side === "BUY") agg.diiBuy += v; else agg.diiSell += v;
      }
      agg.dealCount++;
      if (d.date > agg.lastDealDate) agg.lastDealDate = d.date;
    }
  }
  for (const agg of bySymbol.values()) {
    agg.fiiNet = agg.fiiBuy - agg.fiiSell;
    agg.diiNet = agg.diiBuy - agg.diiSell;
    agg.instNet = agg.fiiNet + agg.diiNet;
  }
  const out: Record<string, FlowAgg> = {};
  for (const [k, v] of bySymbol) out[k] = v;
  return {
    builtAt: Date.now(),
    windowDays: WINDOW_DAYS,
    daysCovered: dateSet.size,
    totalDeals: total,
    bySymbol: out,
  };
}

export async function refreshInstFlows(): Promise<FlowsPayload> {
  const fresh = (await Promise.all(SOURCES.map((s) => fetchOne(s.url, s.type)))).flat();

  // Group today's incoming deals by date (the archive may carry multiple dates if NSE backfills).
  const incomingByDate = new Map<string, Deal[]>();
  for (const d of fresh) {
    const arr = incomingByDate.get(d.date) ?? [];
    arr.push(d);
    incomingByDate.set(d.date, arr);
  }

  // Load existing window, overwrite matching dates, prepend new ones, trim to WINDOW_DAYS.
  const prev = (await redis.get<DayBucket[]>(DAYS_KEY).catch(() => null)) ?? [];
  const merged = new Map<string, Deal[]>();
  for (const day of prev) merged.set(day.date, day.deals);
  for (const [date, deals] of incomingByDate) merged.set(date, deals);

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const days: DayBucket[] = [...merged.entries()]
    .filter(([date]) => date >= cutoff)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, deals]) => ({ date, deals }));

  const payload = aggregate(days);

  await Promise.all([
    redis.set(DAYS_KEY, days, { ex: HARD_TTL_SEC }).catch(() => {}),
    redis.set(AGG_KEY, payload, { ex: HARD_TTL_SEC }).catch(() => {}),
  ]);
  return payload;
}

export const getInstFlows = cache(async (): Promise<FlowsPayload | null> => {
  const cached = await redis.get<FlowsPayload>(AGG_KEY).catch(() => null);
  return cached ?? null;
});
