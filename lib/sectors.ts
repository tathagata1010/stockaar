import { ALL_SECTORS, type Sector } from "./nse-symbols";
import { getUniverse, type UniverseRow } from "./universe";

export type SectorPerformance = {
  sector: Sector;
  count: number;
  avgChangePct: number;
  totalMarketCap: number;
  avgScore: number | null;
  topGainer: UniverseRow | null;
  topLoser: UniverseRow | null;
  rows: UniverseRow[];
};

export async function getSectorPerformance(): Promise<SectorPerformance[]> {
  const universe = await getUniverse();
  const out: SectorPerformance[] = [];

  for (const sector of ALL_SECTORS) {
    const rows = universe.filter((r) => r.entry.sector === sector);
    if (rows.length === 0) continue;

    const withQuote = rows.filter((r) => r.quote);
    const sumChg = withQuote.reduce((s, r) => s + (r.quote?.changePct ?? 0), 0);
    const avgChangePct = withQuote.length ? sumChg / withQuote.length : 0;

    const totalMarketCap = rows.reduce(
      (s, r) => s + (r.fundamentals?.marketCap ?? 0),
      0,
    );

    const withScore = rows.filter((r) => r.scorecard);
    const avgScore = withScore.length
      ? withScore.reduce((s, r) => s + (r.scorecard?.composite ?? 0), 0) / withScore.length
      : null;

    const sortedByChg = [...withQuote].sort(
      (a, b) => (b.quote?.changePct ?? 0) - (a.quote?.changePct ?? 0),
    );
    const topGainer = sortedByChg[0] ?? null;
    const topLoser = sortedByChg[sortedByChg.length - 1] ?? null;

    out.push({
      sector,
      count: rows.length,
      avgChangePct,
      totalMarketCap,
      avgScore,
      topGainer,
      topLoser,
      rows,
    });
  }

  return out.sort((a, b) => b.avgChangePct - a.avgChangePct);
}

export async function getSector(sector: Sector): Promise<SectorPerformance | null> {
  const all = await getSectorPerformance();
  return all.find((s) => s.sector === sector) ?? null;
}
