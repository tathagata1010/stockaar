"use client";

import Link from "next/link";
import { cn, formatINR, formatPct } from "@/lib/utils";
import type { UniverseRow } from "@/lib/universe";
import { StockLogo } from "@/components/StockLogo";
import { LazyChunks } from "@/components/LazyMount";
import { TrendingUp, TrendingDown, Activity, ArrowRight, Sparkles, ShieldAlert } from "lucide-react";

const SIGNAL_META = {
  BUY:  { label: "Buy",  chip: "bg-accent/15 text-accent ring-accent/30", bar: "from-accent via-accent/70 to-brand",   icon: TrendingUp,   accent: "text-accent" },
  HOLD: { label: "Hold", chip: "bg-brand/15 text-brand ring-brand/30",     bar: "from-brand via-brand-2 to-accent",     icon: Activity,     accent: "text-brand"  },
  SELL: { label: "Sell", chip: "bg-danger/15 text-danger ring-danger/30",  bar: "from-danger via-danger/70 to-warning", icon: TrendingDown, accent: "text-danger" },
} as const;

export function StockGrid({
  rows,
  showSignal = false,
  showScore = true,
  emptyText = "No stocks match.",
}: {
  rows: UniverseRow[];
  showSignal?: boolean;
  showScore?: boolean;
  emptyText?: string;
}) {
  return (
    <LazyChunks
      items={rows}
      pageSize={24}
      render={(chunk) => (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {chunk.map((r) => (
            <StockGridCard
              key={r.entry.symbol}
              row={r}
              showSignal={showSignal}
              showScore={showScore}
            />
          ))}
        </div>
      )}
      empty={
        <div className="surface flex flex-col items-center justify-center gap-2 p-12 text-center">
          <ShieldAlert className="h-6 w-6 text-muted" />
          <p className="text-sm text-muted">{emptyText}</p>
        </div>
      }
    />
  );
}

function StockGridCard({
  row,
  showSignal,
  showScore,
}: {
  row: UniverseRow;
  showSignal: boolean;
  showScore: boolean;
}) {
  const q = row.quote;
  const sig = row.signal ?? "HOLD";
  const meta = SIGNAL_META[sig];
  const up = (q?.changePct ?? 0) >= 0;
  const score = row.scorecard?.composite ?? null;
  const scorePct = score != null ? Math.max(0, Math.min(100, score)) : 0;

  return (
    <Link
      href={`/stock/${row.entry.symbol}`}
      className="surface group relative overflow-hidden p-5 hover-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className={cn("absolute inset-y-0 left-0 w-1 bg-gradient-to-b", meta.bar)} />
      <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <StockLogo symbol={row.entry.symbol} name={row.entry.name} sector={row.entry.sector} size="md" animated={false} />
            <div className="min-w-0">
              <div className="text-sm font-bold leading-tight">{row.entry.symbol}</div>
              <div className="truncate text-[11px] text-muted">{row.entry.name}</div>
            </div>
          </div>
          {showSignal && row.signal && (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1",
              meta.chip,
            )}>
              <meta.icon className="h-3 w-3" />
              {meta.label}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="num-display text-2xl font-bold tabular-nums">{q ? formatINR(q.lastPrice) : "—"}</span>
          {q && (
            <span className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1",
              up ? "bg-accent/10 text-accent ring-accent/20" : "bg-danger/10 text-danger ring-danger/20",
            )}>
              {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {formatPct(q.changePct)}
            </span>
          )}
        </div>

        {row.rangePosition != null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted">
              <span>52W range</span>
              <span className="num-display font-bold tabular-nums text-fg">{row.rangePosition.toFixed(0)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-2 ring-1 ring-border">
              <div
                className={cn("h-full rounded-full transition-all", up ? "bg-accent" : "bg-danger")}
                style={{ width: `${Math.max(0, Math.min(100, row.rangePosition))}%` }}
              />
            </div>
          </div>
        )}

        {showScore && score != null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-brand" />
                Scorecard
              </span>
              <span className="num-display font-bold tabular-nums text-fg">{score}<span className="text-muted">/100</span></span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-2 ring-1 ring-border">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand via-brand-2 to-accent transition-all"
                style={{ width: `${scorePct}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-[11px] text-muted">
          <span className="text-[10px] uppercase tracking-wider">{row.entry.sector}</span>
          <span className="inline-flex items-center gap-1 font-semibold transition group-hover:text-brand">
            Open analysis <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
