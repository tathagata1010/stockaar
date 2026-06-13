"use client";

import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { SHAREHOLDING_CATEGORIES } from "@/lib/chart-theme";
import type { ShareholdingBreakdown } from "@/lib/xbrl-shp";
import { cn } from "@/lib/utils";

function quarterLabel(asOnDate: string): string {
  const t = Date.parse(asOnDate);
  if (!Number.isFinite(t)) return asOnDate;
  return new Date(t).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

export function ShareholdingTimeline({ quarters }: { quarters: ShareholdingBreakdown[] }) {
  if (quarters.length < 2) return null;
  const first = quarters[0];
  const last = quarters[quarters.length - 1];
  const firstLabel = quarterLabel(first.asOnDate);
  const lastLabel = quarterLabel(last.asOnDate);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {SHAREHOLDING_CATEGORIES.map((c) => {
        const values = quarters.map((q) => c.pick(q));
        const start = values[0];
        const end = values[values.length - 1];
        if (start < 0.05 && end < 0.05) return null;
        const delta = end - start;
        const data = quarters.map((q) => ({ v: c.pick(q) }));
        const min = Math.min(...values);
        const max = Math.max(...values);
        const span = Math.max(max - min, 0.5);
        const yMin = Math.max(0, min - span * 0.25);
        const yMax = max + span * 0.25;

        return (
          <div
            key={c.key}
            className="relative overflow-hidden rounded-xl border border-border/60 bg-bg/40 p-3 transition hover:border-border hover:bg-bg/60"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{c.label}</span>
              </div>
              <DeltaTag delta={delta} />
            </div>

            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-lg font-bold tabular-nums leading-none">
                {end.toFixed(2)}<span className="ml-0.5 text-xs font-medium text-muted">%</span>
              </span>
              <span className="text-[11px] text-muted">
                from <span className="tabular-nums text-fg/70">{start.toFixed(2)}%</span>
              </span>
            </div>

            <div className="mt-2 h-14 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`spark-${c.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={c.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={[yMin, yMax]} />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={c.color}
                    strokeWidth={1.75}
                    fill={`url(#spark-${c.key})`}
                    isAnimationActive={false}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-1 flex justify-between text-[10px] text-muted">
              <span>{firstLabel}</span>
              <span>{lastLabel}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DeltaTag({ delta }: { delta: number }) {
  const rounded = Math.round(delta * 100) / 100;
  if (rounded === 0) {
    return <span className="text-[10px] text-muted">flat</span>;
  }
  const up = rounded > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ring-1",
        up ? "bg-accent/10 text-accent ring-accent/20" : "bg-danger/10 text-danger ring-danger/20",
      )}
    >
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {Math.abs(rounded).toFixed(2)}pp
    </span>
  );
}
