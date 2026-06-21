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

export function parseCsv(text: string): { holdings: Holding[]; errors: string[] } {
  const errors: string[] = [];
  const holdings: Holding[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = trimmed.split(",").map((p) => p.trim());
    if (parts.length < 3) {
      errors.push(`Line ${i + 1}: expected SYMBOL,QTY,AVG_PRICE`);
      return;
    }
    const [sym, qtyStr, avgStr] = parts;
    const qty = Number(qtyStr);
    const avg = Number(avgStr);
    if (!sym || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(avg) || avg <= 0) {
      errors.push(`Line ${i + 1}: invalid numbers`);
      return;
    }
    holdings.push({ symbol: sym.toUpperCase(), qty, avg });
  });
  return { holdings, errors };
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
    const cur = q ? q.lastPrice * h.qty : 0;
    const inv = h.avg * h.qty;
    invested += inv;
    current += cur;
    const pl = cur - inv;
    const plPct = inv > 0 ? (pl / inv) * 100 : 0;
    return {
      ...h,
      currentPrice: q?.lastPrice,
      currentValue: cur,
      invested: inv,
      pl,
      plPct,
      sector: sectorBySymbol[h.symbol] ?? "Unknown",
      priceMissing: !q,
    };
  });
  const rows: AnalyzedRow[] = baseRows.map((r) => ({
    ...r,
    conc: current > 0 ? (r.currentValue / current) * 100 : 0,
  }));
  const pl = current - invested;
  const plPct = invested > 0 ? (pl / invested) * 100 : 0;

  const bySector: Record<string, number> = {};
  for (const r of rows) bySector[r.sector] = (bySector[r.sector] ?? 0) + r.currentValue;
  const sectorBreakdown = Object.entries(bySector)
    .map(([sector, value]) => ({
      sector,
      value,
      pct: current > 0 ? (value / current) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const warnings: string[] = [];
  for (const r of rows) {
    if (r.conc > 25) {
      warnings.push(
        `${r.symbol} is ${r.conc.toFixed(1)}% of portfolio — consider trimming below 25%.`,
      );
    }
  }
  for (const s of sectorBreakdown) {
    if (s.pct > 40) {
      warnings.push(
        `${s.sector} sector is ${s.pct.toFixed(1)}% of portfolio — consider diversifying below 40%.`,
      );
    }
  }
  return { rows, invested, current, pl, plPct, sectorBreakdown, warnings };
}
