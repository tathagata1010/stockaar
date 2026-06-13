"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { SHAREHOLDER_PALETTE, type ShareholderCategory } from "@/lib/chart-theme";
import type { ShareholdingBreakdown } from "@/lib/xbrl-shp";

type Slice = { name: ShareholderCategory; value: number; color: string };

function toSlices(b: ShareholdingBreakdown): Slice[] {
  const raw: { name: ShareholderCategory; value: number }[] = [
    { name: "Promoter", value: b.promoter },
    { name: "FII",      value: b.fii },
    { name: "DII",      value: b.dii },
    { name: "Retail",   value: b.retail },
    { name: "Others",   value: b.bodies + b.others },
  ];
  return raw
    .filter((s) => s.value > 0.01)
    .map((s) => ({ ...s, color: SHAREHOLDER_PALETTE[s.name] }));
}

function formatDate(s: string) {
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return s;
  return new Date(t).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function ShareholdingPie({ breakdown }: { breakdown: ShareholdingBreakdown }) {
  const slices = toSlices(breakdown);
  if (slices.length === 0) return null;
  const top = [...slices].sort((a, b) => b.value - a.value)[0];

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius="68%"
            outerRadius="100%"
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          >
            {slices.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted">Largest</span>
        <span className="text-xl font-bold tabular-nums leading-tight" style={{ color: top.color }}>
          {top.value.toFixed(1)}%
        </span>
        <span className="text-[11px] text-fg/80">{top.name}</span>
        <span className="mt-0.5 text-[9px] text-muted">{formatDate(breakdown.asOnDate)}</span>
      </div>
    </div>
  );
}
