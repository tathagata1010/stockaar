import Link from "next/link";
import { formatINR } from "@/lib/utils";
import type { UniverseRow } from "@/lib/universe";
import { StockLogo } from "./StockLogo";
import { PctBadge, ScorePill, SignalChip } from "./ui/StockCells";

export function StockTable({
  rows,
  showSignal = false,
  showScore = false,
  showSector = false,
  emptyText = "No stocks match.",
}: {
  rows: UniverseRow[];
  showSignal?: boolean;
  showScore?: boolean;
  showSector?: boolean;
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return <p className="surface p-6 t-body t-muted">{emptyText}</p>;
  }
  // Column ratios so headers sit visually over their cells. Symbol column
  // is greedy; numeric columns share the remainder equally.
  const numericCols = 2 + (showScore ? 1 : 0) + (showSignal ? 1 : 0);
  const numericWidth = Math.floor(60 / numericCols);
  const symbolWidth = showSector ? 40 : 40 + (60 - numericCols * numericWidth);
  const sectorWidth = showSector ? Math.max(0, 100 - symbolWidth - numericCols * numericWidth) : 0;
  return (
    <div className="surface overflow-hidden">
      <div className="overflow-x-auto sticky-thead max-h-[640px]">
        <table className="w-full min-w-[640px] table-fixed text-sm">
          <colgroup>
            <col style={{ width: `${symbolWidth}%` }} />
            {showSector && <col style={{ width: `${sectorWidth}%` }} />}
            <col style={{ width: `${numericWidth}%` }} />
            <col style={{ width: `${numericWidth}%` }} />
            {showScore && <col style={{ width: `${numericWidth}%` }} />}
            {showSignal && <col style={{ width: `${numericWidth}%` }} />}
          </colgroup>
          <thead className="text-left t-label">
            <tr>
              <th className="px-4 py-3 font-semibold">Symbol</th>
              {showSector && <th className="px-4 py-3 font-semibold">Sector</th>}
              <th className="px-4 py-3 text-right font-semibold">Price</th>
              <th className="px-4 py-3 text-right font-semibold">% Chg</th>
              {showScore && <th className="px-4 py-3 text-right font-semibold">Score</th>}
              {showSignal && <th className="px-4 py-3 text-right font-semibold">Signal</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const q = r.quote;
              return (
                <tr key={r.entry.symbol} className="row-hover border-t border-hairline">
                  <td className="px-4 py-3">
                    <Link href={`/stock/${r.entry.symbol}`} className="flex items-center gap-3">
                      <StockLogo symbol={r.entry.symbol} sector={r.entry.sector} size="sm" />
                      <div className="min-w-0">
                        <div className="font-semibold tracking-tight">{r.entry.symbol}</div>
                        <div className="t-caption t-muted line-clamp-1">{r.entry.name}</div>
                      </div>
                    </Link>
                  </td>
                  {showSector && (
                    <td className="px-4 py-3 t-caption t-muted">{r.entry.sector}</td>
                  )}
                  <td className="px-4 py-3 text-right t-num num-display">
                    {q ? formatINR(q.lastPrice) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PctBadge pct={q?.changePct} />
                  </td>
                  {showScore && (
                    <td className="px-4 py-3 text-right">
                      <ScorePill score={r.scorecard?.composite} />
                    </td>
                  )}
                  {showSignal && (
                    <td className="px-4 py-3 text-right">
                      <SignalChip signal={r.signal} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
