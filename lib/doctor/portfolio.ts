import type { Holding } from "./schema";

export type Quote = { symbol: string; lastPrice: number; changePct: number };

export type AnalyzedRow = Holding & {
  currentPrice: number | undefined;
  currentValue: number;
  invested: number;
  pl: number;
  plPct: number;
  conc: number;
  sector: string;
  priceMissing: boolean;
};

export type SectorSlice = { sector: string; value: number; pct: number };

export type PortfolioAnalysis = {
  rows: AnalyzedRow[];
  invested: number;
  current: number;
  pl: number;
  plPct: number;
  sectorBreakdown: SectorSlice[];
  warnings: string[];
};

export type AnalysisSummary = Pick<
  PortfolioAnalysis,
  "invested" | "current" | "pl" | "plPct" | "rows" | "sectorBreakdown"
>;

export type CsvParseResult = {
  holdings: Holding[];
  errors: string[];
  warnings: string[];
  detected: {
    delimiter: Delimiter;
    hasHeader: boolean;
    columns?: { symbol: string; qty: string; avg: string };
    skippedRows: number;
  };
};

const DELIMITERS = [",", ";", "\t", "|"] as const;
type Delimiter = (typeof DELIMITERS)[number];

// Common Indian broker column names (Zerodha Console, Groww, Upstox, Angel One, ICICI Direct, HDFC Securities, Kotak).
// Normalized: lowercased + non-alphanumerics stripped before matching.
const HEADER_ALIASES: Record<"symbol" | "qty" | "avg", readonly string[]> = {
  symbol: [
    "symbol", "tradingsymbol", "trdngsymbol", "instrument", "stock", "stockname", "stocksymbol",
    "scrip", "scripname", "ticker", "tickersymbol", "name", "companyname", "security", "securityname",
  ],
  qty: [
    "qty", "quantity", "shares", "units", "noofshares", "sharesheld", "heldquantity",
    "holdingqty", "holdingquantity", "totalqty", "totalquantity", "netquantity",
    "quantityavailable", "qtyavailable", "availableqty", "availablequantity",
  ],
  avg: [
    "avg", "avgprice", "averageprice", "avgcost", "averagecost",
    "buyavg", "buyavgprice", "avgbuyprice", "averagebuyprice", "avgbuy",
    "costprice", "costbasis", "purchaseprice", "acquisitionprice", "buyprice",
  ],
};

const SUMMARY_ROW_SYMBOLS = new Set([
  "TOTAL", "GRAND TOTAL", "GRANDTOTAL", "SUBTOTAL", "SUB TOTAL", "SUMMARY",
  "NET TOTAL", "PORTFOLIO TOTAL", "PORTFOLIO", "HOLDINGS",
]);

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function detectDelimiter(lines: string[]): Delimiter {
  const sample = lines.slice(0, 5).join("\n");
  let best: Delimiter = ",";
  let bestCount = 0;
  for (const c of DELIMITERS) {
    const count = sample.split(c).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return best;
}

function parseNumber(raw: string | undefined): number {
  if (!raw) return NaN;
  let s = raw.trim();
  if (!s) return NaN;
  // Strip currency markers and brackets used for negatives in some exports
  s = s.replace(/[₹$]/g, "").replace(/(?:rs\.?|inr)\s*/gi, "");
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  // Drop thousand separators if the cell still parses cleanly as a number
  if (/^-?[\d,]+(?:\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -n : n) : NaN;
}

type ColumnMap = { symbolIdx: number; qtyIdx: number; avgIdx: number };

function detectHeader(rows: string[][]): { rowIdx: number; map: ColumnMap; raw: string[] } | null {
  const probe = Math.min(rows.length, 6);
  for (let i = 0; i < probe; i++) {
    const row = rows[i];
    const normed = row.map((c) => norm(c));
    const find = (aliases: readonly string[]): number => {
      // Prefer exact match
      for (let j = 0; j < normed.length; j++) {
        if (aliases.includes(normed[j])) return j;
      }
      // Fallback: alias appears as a substring (handles "qtyavailable" → "qty")
      for (let j = 0; j < normed.length; j++) {
        const cell = normed[j];
        if (cell && aliases.some((a) => cell.includes(a))) return j;
      }
      return -1;
    };
    const symbolIdx = find(HEADER_ALIASES.symbol);
    const qtyIdx = find(HEADER_ALIASES.qty);
    const avgIdx = find(HEADER_ALIASES.avg);
    if (symbolIdx >= 0 && qtyIdx >= 0 && avgIdx >= 0) {
      return { rowIdx: i, map: { symbolIdx, qtyIdx, avgIdx }, raw: row };
    }
  }
  return null;
}

function looksLikeIsin(s: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(s);
}

function extractHolding(row: string[], map: ColumnMap): Holding | null {
  const symbolRaw = (row[map.symbolIdx] ?? "").trim().toUpperCase();
  if (!symbolRaw) return null;
  if (SUMMARY_ROW_SYMBOLS.has(symbolRaw)) return null;
  // ISIN-only cell: try to find a friendlier symbol in another cell (most brokers ship both)
  let symbol = symbolRaw;
  if (looksLikeIsin(symbolRaw)) {
    const friendlier = row.find(
      (c, i) => i !== map.symbolIdx && /^[A-Z][A-Z0-9&-]{1,19}$/i.test(c.trim()) && !looksLikeIsin(c.trim().toUpperCase()),
    );
    if (friendlier) symbol = friendlier.trim().toUpperCase();
  }
  // Strip exchange suffix some exports add (RELIANCE.NS, RELIANCE-EQ)
  symbol = symbol.replace(/\.(NS|BO|NSE|BSE)$/i, "").replace(/-EQ$/i, "");
  const qty = parseNumber(row[map.qtyIdx]);
  const avg = parseNumber(row[map.avgIdx]);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  if (!Number.isFinite(avg) || avg <= 0) return null;
  return { symbol, qty, avg };
}

// Legacy wrapper — kept for backward compat with components/PortfolioAnalyzer.tsx.
// New callers should use parseHoldingsCsv for the richer result shape.
export function parseCsv(text: string): { holdings: Holding[]; errors: string[] } {
  const full = parseHoldingsCsv(text);
  return { holdings: full.holdings, errors: full.errors };
}

// Also accepts the legacy positional SYMBOL,QTY,AVG paste format when no header row is detected.
export function parseHoldingsCsv(text: string): CsvParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const stripped = text.replace(/^\uFEFF/, ""); // BOM only appears at file start
  const lines = stripped.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return {
      holdings: [],
      errors: ["File is empty."],
      warnings: [],
      detected: { delimiter: ",", hasHeader: false, skippedRows: 0 },
    };
  }

  const delimiter = detectDelimiter(lines);
  const rows = lines.map((l) => splitCsvLine(l, delimiter));
  const header = detectHeader(rows);

  const holdings: Holding[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  const ingest = (
    dataRows: string[][],
    map: ColumnMap,
    lineNumberOf: (i: number) => number,
    onShortRow?: (lineNum: number) => void,
  ) => {
    dataRows.forEach((r, i) => {
      const lineNum = lineNumberOf(i);
      if (onShortRow && r.length < 3) {
        onShortRow(lineNum);
        skipped++;
        return;
      }
      const h = extractHolding(r, map);
      if (!h) {
        skipped++;
        return;
      }
      if (seen.has(h.symbol)) {
        warnings.push(`Line ${lineNum}: ${h.symbol} appears more than once — kept first.`);
        return;
      }
      seen.add(h.symbol);
      holdings.push(h);
    });
  };

  if (header) {
    ingest(rows.slice(header.rowIdx + 1), header.map, (i) => header.rowIdx + 2 + i);
    if (holdings.length === 0) {
      errors.push("Found a header row but no valid holdings beneath it.");
    }
    return {
      holdings,
      errors,
      warnings,
      detected: {
        delimiter,
        hasHeader: true,
        columns: {
          symbol: header.raw[header.map.symbolIdx] ?? "",
          qty: header.raw[header.map.qtyIdx] ?? "",
          avg: header.raw[header.map.avgIdx] ?? "",
        },
        skippedRows: skipped,
      },
    };
  }

  ingest(
    rows,
    { symbolIdx: 0, qtyIdx: 1, avgIdx: 2 },
    (i) => i + 1,
    (lineNum) => errors.push(`Line ${lineNum}: expected at least 3 columns (SYMBOL,QTY,AVG).`),
  );

  return {
    holdings,
    errors,
    warnings,
    detected: { delimiter, hasHeader: false, skippedRows: skipped },
  };
}

export function analyze(
  holdings: Holding[],
  quotes: Record<string, Quote>,
  sectorBySymbol: Record<string, string>,
): PortfolioAnalysis {
  let invested = 0;
  let current = 0;
  const baseRows = holdings.map((h) => {
    const q = quotes[h.symbol];
    const priceMissing = !q;
    const inv = h.avg * h.qty;
    const cur = q ? q.lastPrice * h.qty : 0;
    // Unpriced holdings are excluded from totals so we don't render "-100% loss" for
    // BSE-only / illiquid stocks Yahoo can't resolve. They still show in the table.
    if (!priceMissing) {
      invested += inv;
      current += cur;
    }
    const pl = priceMissing ? 0 : cur - inv;
    const plPct = priceMissing || inv <= 0 ? 0 : (pl / inv) * 100;
    return {
      ...h,
      currentPrice: q?.lastPrice,
      currentValue: cur,
      invested: priceMissing ? 0 : inv,
      pl,
      plPct,
      sector: sectorBySymbol[h.symbol] ?? "Unknown",
      priceMissing,
    };
  });
  const rows: AnalyzedRow[] = baseRows.map((r) => ({
    ...r,
    conc: !r.priceMissing && current > 0 ? (r.currentValue / current) * 100 : 0,
  }));
  const pl = current - invested;
  const plPct = invested > 0 ? (pl / invested) * 100 : 0;

  const bySector: Record<string, number> = {};
  for (const r of rows) {
    if (r.priceMissing) continue;
    bySector[r.sector] = (bySector[r.sector] ?? 0) + r.currentValue;
  }
  const sectorBreakdown = Object.entries(bySector)
    .map(([sector, value]) => ({
      sector,
      value,
      pct: current > 0 ? (value / current) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const warnings: string[] = [];
  for (const r of rows) {
    if (r.priceMissing) continue;
    if (r.conc > 25) {
      warnings.push(
        `${r.symbol} is ${r.conc.toFixed(1)}% of portfolio — consider trimming below 25%.`,
      );
    }
  }
  for (const s of sectorBreakdown) {
    if (s.sector === "Unknown") continue;
    if (s.pct > 40) {
      warnings.push(
        `${s.sector} sector is ${s.pct.toFixed(1)}% of portfolio — consider diversifying below 40%.`,
      );
    }
  }
  return { rows, invested, current, pl, plPct, sectorBreakdown, warnings };
}
