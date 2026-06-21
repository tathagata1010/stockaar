// Approximate Nifty 50 sector weights (free-float market cap, %).
// Source: NSE indices fact sheet, refreshed periodically. Used as a coarse
// reference for "your portfolio is X% Banks vs Nifty's Y%" — not for trading.
// Expressed in Stocksbrew's internal sector taxonomy (lib/nse-symbols.ts:Sector).
export const NIFTY_SECTOR_WEIGHTS: Record<string, number> = {
  Banks: 30.0,
  IT: 13.5,
  Energy: 12.0,
  FMCG: 8.0,
  Auto: 7.5,
  NBFC: 6.5,
  Pharma: 4.0,
  Telecom: 4.0,
  "Capital Goods": 3.5,
  Metals: 3.0,
  Cement: 2.0,
  Insurance: 2.0,
  Power: 2.0,
  Consumer: 1.5,
  Other: 0.5,
};

export function niftyWeightFor(sector: string): number {
  return NIFTY_SECTOR_WEIGHTS[sector] ?? 0;
}
