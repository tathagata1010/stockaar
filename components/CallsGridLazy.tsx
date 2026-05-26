"use client";

import Link from "next/link";
import { cn, formatINR, formatPct } from "@/lib/utils";
import { LazyChunks } from "@/components/LazyMount";
import { StockLogo } from "@/components/StockLogo";
import type { Sector } from "@/lib/nse-symbols";
import { TrendingUp, TrendingDown, Target, ArrowRight, Sparkles, ShieldAlert, Activity } from "lucide-react";

export type CallCard = {
  symbol: string;
  name: string;
  sector?: Sector;
  signal: "BUY" | "HOLD" | "SELL";
  price: number;
  changePct: number;
  score: number;
  reasons: string[];
};

const SIGNAL_META = {
  BUY: {
    label: "Buy",
    chip: "bg-accent/15 text-accent ring-accent/30",
    bar: "from-accent via-accent/70 to-brand",
    icon: TrendingUp,
    accentText: "text-accent",
    targetMultiplier: 1.10,
    targetLabel: "Bull target",
  },
  HOLD: {
    label: "Hold",
    chip: "bg-brand/15 text-brand ring-brand/30",
    bar: "from-brand via-brand-2 to-accent",
    icon: Activity,
    accentText: "text-brand",
    targetMultiplier: 1.02,
    targetLabel: "Base target",
  },
  SELL: {
    label: "Sell",
    chip: "bg-danger/15 text-danger ring-danger/30",
    bar: "from-danger via-danger/70 to-warning",
    icon: TrendingDown,
    accentText: "text-danger",
    targetMultiplier: 0.95,
    targetLabel: "Bear target",
  },
} as const;

export function CallsGridLazy({ calls }: { calls: CallCard[] }) {
  return (
    <LazyChunks
      items={calls}
      pageSize={24}
      render={(chunk) => (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {chunk.map((c) => (
            <CallCardView key={c.symbol} call={c} />
          ))}
        </div>
      )}
      empty={
        <div className="surface flex flex-col items-center justify-center gap-2 p-12 text-center">
          <ShieldAlert className="h-6 w-6 text-muted" />
          <p className="text-sm text-muted">No calls match this filter.</p>
        </div>
      }
    />
  );
}

function CallCardView({ call: c }: { call: CallCard }) {
  const meta = SIGNAL_META[c.signal];
  const Icon = meta.icon;
  const target = Math.round(c.price * meta.targetMultiplier);
  const upside = ((target - c.price) / c.price) * 100;
  const up = c.changePct >= 0;
  const scorePct = Math.max(0, Math.min(100, c.score));

  return (
    <Link
      href={`/stock/${c.symbol}`}
      className="surface group relative overflow-hidden p-5 hover-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {/* signal accent bar */}
      <div className={cn("absolute inset-y-0 left-0 w-1 bg-gradient-to-b", meta.bar)} />

      {/* shine on hover */}
      <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

      <div className="relative">
        {/* Header: logo + symbol + signal chip */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <StockLogo symbol={c.symbol} name={c.name} sector={c.sector} size="md" animated={false} />
            <div className="min-w-0">
              <div className="text-sm font-bold leading-tight">{c.symbol}</div>
              <div className="truncate text-[11px] text-muted">{c.name}</div>
            </div>
          </div>
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1",
            meta.chip,
          )}>
            <Icon className="h-3 w-3" />
            {meta.label}
          </span>
        </div>

        {/* Price + % change */}
        <div className="mt-4 flex items-baseline gap-2">
          <span className="num-display text-2xl font-bold tabular-nums">{formatINR(c.price)}</span>
          <span className={cn(
            "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1",
            up ? "bg-accent/10 text-accent ring-accent/20" : "bg-danger/10 text-danger ring-danger/20",
          )}>
            {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {formatPct(c.changePct)}
          </span>
        </div>

        {/* Target scenario */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-border/60 bg-bg/40 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg",
              c.signal === "BUY" ? "bg-accent/15 text-accent"
              : c.signal === "SELL" ? "bg-danger/15 text-danger"
              : "bg-brand/15 text-brand",
            )}>
              <Target className="h-3.5 w-3.5" />
            </span>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted">{meta.targetLabel}</div>
              <div className="num-display text-sm font-bold tabular-nums">{formatINR(target)}</div>
            </div>
          </div>
          <span className={cn(
            "num-display text-xs font-bold tabular-nums",
            upside >= 0 ? "text-accent" : "text-danger",
          )}>
            {upside >= 0 ? "+" : ""}{upside.toFixed(1)}%
          </span>
        </div>

        {/* Scorecard bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted">
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-brand" />
              Scorecard
            </span>
            <span className="num-display font-bold text-fg tabular-nums">{c.score}<span className="text-muted">/100</span></span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-2 ring-1 ring-border">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand via-brand-2 to-accent transition-all"
              style={{ width: `${scorePct}%` }}
            />
          </div>
        </div>

        {/* Reasons */}
        {c.reasons.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
            {c.reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] leading-relaxed text-fg/80">
                <span className={cn("mt-0.5 inline-block h-1 w-1 shrink-0 rounded-full", meta.accentText, "bg-current")} />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        )}

        {/* CTA hint */}
        <div className="mt-4 flex items-center justify-end gap-1 text-[11px] font-semibold text-muted transition group-hover:text-brand">
          Open analysis <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
