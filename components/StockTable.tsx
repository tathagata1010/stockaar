import Link from "next/link";
import { cn, formatINR, formatPct } from "@/lib/utils";
import type { UniverseRow } from "@/lib/universe";
import { StockLogo } from "./StockLogo";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const SIGNAL_STYLES: Record<string, string> = {
  BUY: "bg-accent/15 text-accent ring-1 ring-accent/40",
  HOLD: "bg-muted/15 text-muted ring-1 ring-muted/30",
  SELL: "bg-danger/15 text-danger ring-1 ring-danger/40",
};

function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 70 ? "from-accent/30 to-accent/10 text-accent ring-accent/30"
    : score >= 50 ? "from-brand/30 to-brand/10 text-brand ring-brand/30"
    : "from-danger/30 to-danger/10 text-danger ring-danger/30";
  return (
    <span className={cn(
      "inline-flex min-w-[44px] items-center justify-center rounded-md bg-gradient-to-b px-2 py-0.5 text-xs font-bold tabular-nums ring-1",
      tone,
    )}>
      {score}
    </span>
  );
}

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
    return <p className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted">{emptyText}</p>;
  }
  return (
    <div className="surface overflow-hidden rounded-2xl shadow-soft">
      <div className="overflow-x-auto sticky-thead max-h-[640px]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-[10px] uppercase tracking-[0.12em] text-muted">
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
              const up = q && q.changePct >= 0;
              return (
                <tr key={r.entry.symbol} className="row-hover border-t border-border/50">
                  <td className="px-4 py-3">
                    <Link href={`/stock/${r.entry.symbol}`} className="flex items-center gap-3">
                      <StockLogo symbol={r.entry.symbol} sector={r.entry.sector} size="sm" />
                      <div className="min-w-0">
                        <div className="font-semibold tracking-tight">{r.entry.symbol}</div>
                        <div className="text-xs text-muted line-clamp-1">{r.entry.name}</div>
                      </div>
                    </Link>
                  </td>
                  {showSector && (
                    <td className="px-4 py-3 text-xs text-muted">{r.entry.sector}</td>
                  )}
                  <td className="px-4 py-3 text-right tabular-nums num-display">
                    {q ? formatINR(q.lastPrice) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {q ? (
                      <span className={cn(
                        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ring-1",
                        up
                          ? "bg-accent/10 text-accent ring-accent/25"
                          : "bg-danger/10 text-danger ring-danger/25",
                      )}>
                        {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {formatPct(q.changePct)}
                      </span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  {showScore && (
                    <td className="px-4 py-3 text-right">
                      {r.scorecard ? <ScorePill score={r.scorecard.composite} /> : <span className="text-muted">—</span>}
                    </td>
                  )}
                  {showSignal && (
                    <td className="px-4 py-3 text-right">
                      {r.signal ? (
                        <span className={cn(
                          "rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide",
                          SIGNAL_STYLES[r.signal],
                        )}>
                          {r.signal}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
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
