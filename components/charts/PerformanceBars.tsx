"use client";

import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";
import { useChartTheme } from "@/lib/hooks/useChartTheme";
import { formatPct } from "@/lib/utils";

export type PerfPoint = { label: string; pct: number | null };

export function PerformanceBars({ data }: { data: PerfPoint[] }) {
  const { colors, tooltipStyle, itemStyle, labelStyle, cursorFill } = useChartTheme();
  const rows = data.map((d) => ({ label: d.label, pct: d.pct ?? 0, missing: d.pct === null }));

  return (
    <div className="h-32 w-full sm:h-36">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 10, right: 8, left: -16, bottom: 0 }} barCategoryGap="35%">
          <CartesianGrid stroke={colors.border} strokeOpacity={0.35} vertical={false} />
          <XAxis
            dataKey="label"
            stroke={colors.axis}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            dy={2}
          />
          <YAxis
            stroke={colors.axis}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
            width={36}
            tickCount={4}
          />
          <ReferenceLine y={0} stroke={colors.muted} strokeOpacity={0.5} />
          <Tooltip
            contentStyle={tooltipStyle}
            itemStyle={itemStyle}
            labelStyle={labelStyle}
            cursor={{ fill: cursorFill }}
            formatter={(_v: number, _n: string, ctx: { payload?: { pct: number; missing: boolean } }) => {
              if (ctx.payload?.missing) return ["—", "Return"];
              return [formatPct(ctx.payload?.pct ?? 0), "Return"];
            }}
          />
          <Bar dataKey="pct" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false}>
            {rows.map((r, i) => (
              <Cell
                key={i}
                fill={r.missing ? colors.muted : r.pct >= 0 ? colors.accent : colors.danger}
                fillOpacity={r.missing ? 0.25 : 0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
