import { cache } from "react";
import { getUniverse, type UniverseRow } from "./universe";
import type { Sector } from "./nse-symbols";

export const getPeers = cache(async (
  symbol: string,
  sector: Sector,
  limit = 5,
): Promise<UniverseRow[]> => {
  const universe = await getUniverse();
  return universe
    .filter((r) =>
      r.entry.sector === sector &&
      r.entry.symbol !== symbol &&
      r.fundamentals?.marketCap
    )
    .sort((a, b) => (b.fundamentals?.marketCap ?? 0) - (a.fundamentals?.marketCap ?? 0))
    .slice(0, limit);
});
