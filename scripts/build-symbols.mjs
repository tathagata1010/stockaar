// Build lib/nse-symbols.ts from NSE Nifty Total Market constituents.
//
// Preserves manual sector/industry classification for symbols already in the
// current file. New symbols get auto-mapped from NSE's industry classification
// to the internal Sector enum, with disambiguation via name keywords for
// Financial Services / Services / Construction Materials.
//
// Run: node scripts/build-symbols.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ""), "..");
const CSV_PATH = path.join(ROOT, "scripts", "nifty_total_market.csv");
const CURRENT_PATH = path.join(ROOT, "lib", "nse-symbols.ts");
const OUT_PATH = CURRENT_PATH;

const VALID_SECTORS = new Set([
  "IT", "Banks", "NBFC", "Auto", "Pharma", "FMCG", "Energy", "Metals",
  "Telecom", "Cement", "Power", "Insurance", "Consumer", "Realty",
  "Capital Goods", "Chemicals", "Infrastructure", "Media", "Logistics",
  "Textiles", "Agri", "Other",
]);

// --- Parse current file: capture sector+industry+name for each symbol so we
//     preserve any manual curation when the symbol still exists in NTM.
function parseCurrent(src) {
  const out = new Map();
  // Match: { symbol: "X", name: "Y", exchange: "NSE", sector: "Z", industry: "I" }
  const re = /\{\s*symbol:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*exchange:\s*"([^"]+)",\s*sector:\s*"([^"]+)"(?:,\s*industry:\s*"([^"]+)")?\s*\}/g;
  let m;
  while ((m = re.exec(src))) {
    out.set(m[1], { symbol: m[1], name: m[2], exchange: m[3], sector: m[4], industry: m[5] ?? undefined });
  }
  return out;
}

// --- Parse Nifty Total Market CSV (Company Name,Industry,Symbol,Series,ISIN)
function parseCsv(src) {
  const lines = src.trim().split(/\r?\n/);
  const out = [];
  // Cheap CSV — these fields contain no embedded commas in NSE's clean export.
  for (const line of lines.slice(1)) {
    const parts = line.split(",");
    if (parts.length < 3) continue;
    const [companyName, industry, symbol] = parts;
    if (!symbol) continue;
    const sym = symbol.trim();
    // NSE seeds placeholder tickers (DUMMY*, e.g. pre-listing index rebalances) that
    // Yahoo never resolves — exclude them so they don't poison the universe.
    if (/^DUMMY/i.test(sym)) continue;
    out.push({ symbol: sym, companyName: companyName.trim(), industry: industry.trim() });
  }
  return out;
}

// --- Map NSE industry + company name to internal Sector enum.
function mapSector(nseIndustry, companyName) {
  const n = (companyName || "").toLowerCase();
  switch (nseIndustry) {
    case "Automobile and Auto Components": return "Auto";
    case "Capital Goods": return "Capital Goods";
    case "Chemicals": return "Chemicals";
    case "Construction": return "Infrastructure";
    case "Construction Materials":
      if (/cement/.test(n)) return "Cement";
      if (/paint|tile|sanitar|ceram/.test(n)) return "Consumer";
      return "Cement";
    case "Consumer Durables": return "Consumer";
    case "Consumer Services": return "Consumer";
    case "Diversified": return "Other";
    case "Fast Moving Consumer Goods": return "FMCG";
    case "Financial Services":
      if (/\bbank\b/.test(n)) return "Banks";
      if (/insurance|\blife\b|general ins|gic\b/.test(n)) return "Insurance";
      return "NBFC";
    case "Forest Materials": return "Other";
    case "Healthcare": return "Pharma";
    case "Information Technology": return "IT";
    case "Media Entertainment & Publication": return "Media";
    case "Metals & Mining": return "Metals";
    case "Oil Gas & Consumable Fuels": return "Energy";
    case "Power": return "Power";
    case "Realty": return "Realty";
    case "Services":
      if (/logistic|port|shipping|transport|courier|express/.test(n)) return "Logistics";
      if (/retail|store|mart\b/.test(n)) return "Consumer";
      return "Other";
    case "Telecommunication": return "Telecom";
    case "Textiles": return "Textiles";
    case "Utilities": return "Power";
    default: return "Other";
  }
}

// Strip the "Ltd." / "Limited" suffix and similar from NSE names for cleaner display.
function cleanName(raw) {
  return raw
    .replace(/\s*\bLtd\.?$/i, "")
    .replace(/\s*\bLimited$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

const csvSrc = fs.readFileSync(CSV_PATH, "utf8");
const currentSrc = fs.readFileSync(CURRENT_PATH, "utf8");
const currentMap = parseCurrent(currentSrc);
const ntm = parseCsv(csvSrc);

const validSymbols = new Set(ntm.map((r) => r.symbol));

// Build the new entries array. Order: preserve NTM order (large→small cap).
const entries = [];
const stats = { preserved: 0, added: 0, dropped: 0, sectorAuto: 0 };

for (const row of ntm) {
  const existing = currentMap.get(row.symbol);
  const cleanedName = cleanName(row.companyName);
  if (existing && VALID_SECTORS.has(existing.sector)) {
    // Preserve user's manual sector + industry, but refresh name if NSE has changed it.
    entries.push({
      symbol: row.symbol,
      name: existing.name || cleanedName,
      exchange: "NSE",
      sector: existing.sector,
      industry: existing.industry,
    });
    stats.preserved++;
  } else {
    const sector = mapSector(row.industry, row.companyName);
    entries.push({
      symbol: row.symbol,
      name: cleanedName,
      exchange: "NSE",
      sector,
      industry: row.industry || undefined,
    });
    stats.added++;
    stats.sectorAuto++;
  }
}

// Symbols in current file that are NOT in NTM = stale/delisted/typo. Drop them.
for (const sym of currentMap.keys()) {
  if (!validSymbols.has(sym)) stats.dropped++;
}

const droppedList = [...currentMap.keys()].filter((s) => !validSymbols.has(s));

// --- Render new TS file
function escape(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
function renderEntry(e) {
  const industry = e.industry ? `, industry: "${escape(e.industry)}"` : "";
  return `  { symbol: "${escape(e.symbol)}", name: "${escape(e.name)}", exchange: "NSE", sector: "${e.sector}"${industry} },`;
}

const header = `export type Sector =
  | "IT" | "Banks" | "NBFC" | "Auto" | "Pharma" | "FMCG" | "Energy"
  | "Metals" | "Telecom" | "Cement" | "Power" | "Insurance" | "Consumer"
  | "Realty" | "Capital Goods" | "Chemicals" | "Infrastructure"
  | "Media" | "Logistics" | "Textiles" | "Agri" | "Other";

export type SymbolEntry = {
  symbol: string;
  name: string;
  exchange: "NSE" | "BSE";
  sector: Sector;
  industry?: string;
};

// Universe: Nifty Total Market (~750 active large/mid/small/micro-cap NSE equities).
// Regenerated from scripts/nifty_total_market.csv via scripts/build-symbols.mjs.
// Sectors are preserved from prior manual classification where the symbol existed;
// new entries get auto-mapped from NSE's industry classification.
export const NSE_SYMBOLS: SymbolEntry[] = [
`;

const footer = `
];

export const ALL_SECTORS: Sector[] = [
  "IT", "Banks", "NBFC", "Auto", "Pharma", "FMCG", "Energy", "Metals",
  "Telecom", "Cement", "Power", "Insurance", "Consumer", "Realty",
  "Capital Goods", "Chemicals", "Infrastructure", "Media", "Logistics",
  "Textiles", "Agri", "Other",
];

export function searchSymbols(query: string, limit = 10): SymbolEntry[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  return NSE_SYMBOLS.filter(
    (s) => s.symbol.startsWith(q) || s.name.toUpperCase().includes(q),
  ).slice(0, limit);
}

export function allIndustries(): string[] {
  const set = new Set<string>();
  for (const s of NSE_SYMBOLS) if (s.industry) set.add(s.industry);
  return [...set].sort();
}
`;

const body = entries.map(renderEntry).join("\n");
fs.writeFileSync(OUT_PATH, header + body + footer, "utf8");

console.log(`Wrote ${entries.length} entries to ${path.relative(ROOT, OUT_PATH)}`);
console.log(`  preserved manual classification: ${stats.preserved}`);
console.log(`  newly added (sector auto-mapped): ${stats.added}`);
console.log(`  dropped (not in NTM): ${stats.dropped}`);
if (droppedList.length) {
  console.log(`\nDropped symbols (first 30):`);
  console.log("  " + droppedList.slice(0, 30).join(", "));
  if (droppedList.length > 30) console.log(`  ... and ${droppedList.length - 30} more`);
}
