"use client";

import Link from "next/link";
import { Lock, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { cn, formatINR, formatPct, formatCompactINR } from "@/lib/utils";
import { StockLogo } from "@/components/StockLogo";
import type { Sector } from "@/lib/nse-symbols";
import type { Diagnosis } from "@/lib/doctor/schema";
import type { AnalysisSummary } from "@/lib/doctor/portfolio";
import { HealthScoreGauge } from "./HealthScoreGauge";
import { RedFlagCard } from "./RedFlagCard";

type Props = {
  diagnosis: Diagnosis;
  analysis: AnalysisSummary;
  isPro: boolean;
  source: "llm" | "cache" | "fallback";
};

export function DiagnosisReport({ diagnosis, analysis, isPro, source }: Props) {
  return (
    <div className="space-y-6">
      <section className="surface relative overflow-hidden rounded-2xl p-6 shadow-soft">
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand via-brand-2 to-accent" />
        <div className="grid gap-6 sm:grid-cols-[180px_1fr] sm:items-center">
          <HealthScoreGauge score={diagnosis.health_score} />
          <div>
            <div className="chip chip-brand mb-2 text-[11px]">
              <Sparkles className="h-3 w-3" />
              Doctor's note
            </div>
            <p className="text-base italic leading-relaxed text-fg/95 sm:text-lg">
              &ldquo;{diagnosis.doctors_note}&rdquo;
            </p>
            {source === "fallback" && (
              <p className="mt-3 text-[11px] text-warning">
                AI doctor unavailable — showing rule-based scan only.
              </p>
            )}
            {source === "cache" && (
              <p className="mt-3 text-[11px] text-muted">Cached diagnosis (same portfolio, &lt; 6h old).</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Invested" value={formatCompactINR(analysis.invested)} />
        <SummaryCard label="Current" value={formatCompactINR(analysis.current)} />
        <SummaryCard
          label="Profit / Loss"
          value={`${analysis.pl >= 0 ? "+" : ""}${formatCompactINR(analysis.pl)}`}
          sub={formatPct(analysis.plPct)}
          tone={analysis.pl >= 0 ? "accent" : "danger"}
          icon={analysis.pl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        />
      </section>

      {diagnosis.red_flags.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold">Red flags ({diagnosis.red_flags.length})</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {diagnosis.red_flags.map((f, i) => (
              <RedFlagCard key={i} flag={f} />
            ))}
          </div>
        </section>
      )}

      {diagnosis.sector_tilt && (
        <section className="surface rounded-2xl p-5 shadow-soft">
          <h3 className="text-sm font-semibold">Sector tilt vs Nifty 50</h3>
          <p className="mt-1 text-xs text-muted">
            <span className="font-semibold text-fg">{diagnosis.sector_tilt.dominant}</span> is your
            largest sector at {diagnosis.sector_tilt.pct.toFixed(1)}%
            {diagnosis.sector_tilt.vs_nifty_pct >= 0 ? (
              <>
                {" "}— <span className="text-warning">overweight</span> vs Nifty by{" "}
                {Math.abs(diagnosis.sector_tilt.vs_nifty_pct).toFixed(1)} pts.
              </>
            ) : (
              <>
                {" "}— <span className="text-accent">underweight</span> vs Nifty by{" "}
                {Math.abs(diagnosis.sector_tilt.vs_nifty_pct).toFixed(1)} pts.
              </>
            )}
          </p>
          <ul className="mt-4 space-y-2.5">
            {analysis.sectorBreakdown.map((s) => (
              <li key={s.sector}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{s.sector}</span>
                  <span className="tabular-nums text-muted">
                    {s.pct.toFixed(1)}% · {formatCompactINR(s.value)}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg/60">
                  <div
                    className={cn("h-full rounded-full", s.pct > 40 ? "bg-warning" : "bg-brand-gradient")}
                    style={{ width: `${Math.min(s.pct, 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="surface overflow-hidden rounded-2xl shadow-soft">
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[minmax(0,2.2fr)_60px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1.3fr)] items-center gap-x-3 border-b border-border bg-card/60 px-4 py-3 text-[10px] uppercase tracking-[0.12em] text-muted">
              <div>Symbol</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Avg</div>
              <div className="text-right">LTP</div>
              <div className="text-right">Value</div>
              <div className="text-right">P/L</div>
              <div className="text-right">% Port</div>
            </div>
            {analysis.rows.map((r) => {
              const up = r.pl >= 0;
              return (
                <div
                  key={r.symbol}
                  className="row-hover grid grid-cols-[minmax(0,2.2fr)_60px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1.3fr)] items-center gap-x-3 border-t border-border/50 px-4 py-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <StockLogo symbol={r.symbol} sector={r.sector as Sector} size="sm" animated={false} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold leading-tight">{r.symbol}</div>
                      <div className="truncate text-[11px] text-muted leading-tight">{r.sector}</div>
                    </div>
                  </div>
                  <div className="text-right tabular-nums">{r.qty}</div>
                  <div className="text-right tabular-nums text-muted">{formatINR(r.avg)}</div>
                  <div className="text-right tabular-nums">
                    {r.currentPrice ? formatINR(r.currentPrice) : <span className="text-muted">—</span>}
                  </div>
                  <div className="num-display text-right font-semibold tabular-nums">
                    {formatCompactINR(r.currentValue)}
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className={cn("tabular-nums font-semibold leading-tight", up ? "text-accent" : "text-danger")}>
                      {up ? "+" : ""}
                      {formatCompactINR(r.pl)}
                    </div>
                    <div className={cn("text-[11px] tabular-nums leading-tight", up ? "text-accent/80" : "text-danger/80")}>
                      {up ? "▲" : "▼"} {formatPct(r.plPct)}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-bg ring-1 ring-border">
                      <div
                        className={cn("h-full rounded-full", r.conc > 25 ? "bg-warning" : "bg-brand")}
                        style={{ width: `${Math.min(100, r.conc)}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-xs font-semibold">{r.conc.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <ProSection title="Per-stock quality issues" count={diagnosis.quality_issues.length} isPro={isPro}>
        <ul className="space-y-3">
          {diagnosis.quality_issues.map((q, i) => (
            <li key={i} className="rounded-lg border border-border bg-card/60 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="font-mono uppercase">{q.symbol}</span>
                <span className="text-muted">·</span>
                <span>{q.issue}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted">{q.evidence}</p>
            </li>
          ))}
        </ul>
      </ProSection>

      <ProSection
        title="Rebalance suggestions"
        count={diagnosis.rebalance_suggestions.length}
        isPro={isPro}
      >
        <ul className="space-y-3">
          {diagnosis.rebalance_suggestions.map((r, i) => (
            <li key={i} className="rounded-lg border border-brand/30 bg-brand/5 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand">
                {r.symbol && <span className="font-mono uppercase">{r.symbol}</span>}
                <span>{r.action}</span>
              </div>
              <p className="mt-1 text-[11px] text-fg/80">{r.rationale}</p>
            </li>
          ))}
        </ul>
      </ProSection>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "accent" | "danger";
  icon?: React.ReactNode;
}) {
  const color = tone === "accent" ? "text-accent" : tone === "danger" ? "text-danger" : "text-fg";
  return (
    <div className="surface-strong rounded-2xl p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase text-muted">{label}</div>
        {icon && (
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg ring-1",
              tone === "accent" ? "bg-accent/15 text-accent ring-accent/30" : "bg-danger/15 text-danger ring-danger/30",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className={cn("num-display mt-2 text-2xl font-bold tabular-nums", color)}>{value}</div>
      {sub && <div className={cn("text-xs font-semibold tabular-nums", color)}>{sub}</div>}
    </div>
  );
}

function ProSection({
  title,
  count,
  isPro,
  children,
}: {
  title: string;
  count: number;
  isPro: boolean;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  if (isPro) {
    return (
      <section className="surface rounded-2xl p-5 shadow-soft">
        <h3 className="mb-3 text-sm font-semibold">
          {title} <span className="text-muted">({count})</span>
        </h3>
        {children}
      </section>
    );
  }
  return (
    <section className="surface relative overflow-hidden rounded-2xl p-5 shadow-soft">
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-b from-bg/30 via-bg/70 to-bg/95 backdrop-blur-[3px]">
        <div className="text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand/15 text-brand ring-1 ring-brand/30">
            <Lock className="h-5 w-5" />
          </div>
          <p className="mt-2 text-sm font-semibold">
            {count} {title.toLowerCase()} — Pro only
          </p>
          <p className="mt-1 text-[11px] text-muted">Detailed per-stock issues + rebalance ideas.</p>
          <Link href="/pricing" className="btn-brand mt-3 inline-flex text-xs">
            Unlock with Pro
          </Link>
        </div>
      </div>
      <div className="opacity-40">
        <h3 className="mb-3 text-sm font-semibold">
          {title} <span className="text-muted">({count})</span>
        </h3>
        {children}
      </div>
    </section>
  );
}
