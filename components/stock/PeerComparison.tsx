import Link from "next/link";
import type { UniverseRow } from "@/lib/universe";
import { StockLogo } from "@/components/StockLogo";
import { cn, formatCompactINR, formatNumber, formatPct } from "@/lib/utils";

type PeerRow = UniverseRow;

export function PeerComparison({
  currentSymbol,
  peers,
}: {
  currentSymbol: string;
  peers: PeerRow[];
}) {
  if (!peers.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted">
        Not enough listed peers in this sector to compare.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-soft md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg/40 text-[10px] uppercase tracking-wide text-muted">
              <Th className="text-left">Stock</Th>
              <Th>52W Pos</Th>
              <Th>P/E</Th>
              <Th>ROE</Th>
              <Th>Mkt Cap</Th>
              <Th>Score</Th>
            </tr>
          </thead>
          <tbody>
            {peers.map((row) => (
              <PeerTableRow key={row.entry.symbol} row={row} isCurrent={row.entry.symbol === currentSymbol} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {peers.map((row) => (
          <PeerCard key={row.entry.symbol} row={row} isCurrent={row.entry.symbol === currentSymbol} />
        ))}
      </div>
    </div>
  );
}

function PeerTableRow({ row, isCurrent }: { row: PeerRow; isCurrent: boolean }) {
  const { entry, quote, fundamentals, scorecard, rangePosition } = row;
  const pe = fundamentals?.trailingPE;
  const roe = fundamentals?.returnOnEquity;
  const mcap = fundamentals?.marketCap;
  const score = scorecard?.composite ?? null;

  return (
    <tr
      className={cn(
        "border-b border-border/60 transition hover:bg-bg/30",
        isCurrent && "bg-brand/5 ring-1 ring-inset ring-brand/30",
      )}
    >
      <td className="px-3 py-2.5 text-left">
        <Link href={`/stock/${entry.symbol}`} className="flex items-center gap-2 hover:text-brand">
          <StockLogo symbol={entry.symbol} sector={entry.sector} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold">{entry.symbol}</span>
              {isCurrent && <span className="chip chip-brand text-[9px]">You</span>}
            </div>
            <div className="truncate text-[11px] text-muted">{entry.name}</div>
          </div>
        </Link>
      </td>
      <td className="px-3 py-2.5">
        <RangeBarMini value={rangePosition} />
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">{pe ? formatNumber(pe, 1) : "—"}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{roe != null ? formatPct(roe * 100) : "—"}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{mcap ? formatCompactINR(mcap) : "—"}</td>
      <td className="px-3 py-2.5 text-right"><ScoreDot score={score} /></td>
    </tr>
  );
}

function PeerCard({ row, isCurrent }: { row: PeerRow; isCurrent: boolean }) {
  const { entry, fundamentals, scorecard, rangePosition } = row;
  return (
    <Link
      href={`/stock/${entry.symbol}`}
      className={cn(
        "block rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:border-brand/40",
        isCurrent && "bg-brand/5 ring-1 ring-brand/30",
      )}
    >
      <div className="flex items-center gap-2.5">
        <StockLogo symbol={entry.symbol} sector={entry.sector} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">{entry.symbol}</span>
            {isCurrent && <span className="chip chip-brand text-[9px]">You</span>}
          </div>
          <div className="truncate text-[11px] text-muted">{entry.name}</div>
        </div>
        <ScoreDot score={scorecard?.composite ?? null} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-[11px]">
        <MiniStat label="P/E" value={fundamentals?.trailingPE ? formatNumber(fundamentals.trailingPE, 1) : "—"} />
        <MiniStat label="ROE" value={fundamentals?.returnOnEquity != null ? formatPct(fundamentals.returnOnEquity * 100) : "—"} />
        <MiniStat label="Mkt Cap" value={fundamentals?.marketCap ? formatCompactINR(fundamentals.marketCap) : "—"} />
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-wide text-muted">
          <span>52W Position</span>
          <span className="tabular-nums">{rangePosition != null ? `${rangePosition.toFixed(0)}%` : "—"}</span>
        </div>
        <RangeBarMini value={rangePosition} />
      </div>
    </Link>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2 text-right font-semibold", className)}>{children}</th>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-semibold tabular-nums text-fg">{value}</div>
    </div>
  );
}

function RangeBarMini({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted">—</span>;
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    clamped < 30 ? "bg-danger" :
    clamped > 70 ? "bg-accent" : "bg-warning";
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-bg/60 ring-1 ring-border">
      <div className={cn("absolute inset-y-0 left-0", color)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function ScoreDot({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted">—</span>;
  const color =
    score >= 70 ? "bg-accent text-bg" :
    score >= 50 ? "bg-warning text-bg" :
    "bg-danger text-bg";
  return (
    <span className={cn("inline-flex h-7 w-9 items-center justify-center rounded-full text-xs font-bold tabular-nums", color)}>
      {score}
    </span>
  );
}
