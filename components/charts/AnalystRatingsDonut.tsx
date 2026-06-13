"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useChartTheme } from "@/lib/hooks/useChartTheme";

type Counts = { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number };

const SLICE_KEYS = [
  { key: "strongBuy",  label: "Strong Buy",  tone: "brand2"  },
  { key: "buy",        label: "Buy",         tone: "accent"  },
  { key: "hold",       label: "Hold",        tone: "muted"   },
  { key: "sell",       label: "Sell",        tone: "warning" },
  { key: "strongSell", label: "Strong Sell", tone: "danger"  },
] as const;

function consensusLabel(mean?: number): string {
  if (!mean) return "—";
  if (mean < 1.5) return "Strong Buy";
  if (mean < 2.5) return "Buy";
  if (mean < 3.5) return "Hold";
  if (mean < 4.5) return "Sell";
  return "Strong Sell";
}

export function AnalystRatingsDonut({
  counts,
  recommendation,
}: {
  counts: Counts;
  recommendation?: number;
}) {
  const total = counts.strongBuy + counts.buy + counts.hold + counts.sell + counts.strongSell;
  const { colors, tooltipStyle, itemStyle } = useChartTheme();
  if (total === 0) return null;

  const sliceDefs = SLICE_KEYS.map((d) => ({ ...d, color: colors[d.tone] }));
  const slices = sliceDefs
    .map((d) => ({ ...d, value: counts[d.key] }))
    .filter((s) => s.value > 0);

  const label = consensusLabel(recommendation);
  const tone = !recommendation
    ? colors.muted
    : recommendation < 2.5
    ? colors.accent
    : recommendation < 3.5
    ? colors.fg
    : colors.danger;

  return (
    <div className="grid items-center gap-5 sm:grid-cols-[200px_1fr]">
      <div className="relative mx-auto h-[200px] w-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius={62}
              outerRadius={90}
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              isAnimationActive={false}
            >
              {slices.map((s) => <Cell key={s.key} fill={s.color} />)}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={itemStyle}
              formatter={(v: number, name: string) => [`${v} analyst${v === 1 ? "" : "s"}`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-wide text-muted">Consensus</span>
          <span className="text-base font-semibold" style={{ color: tone }}>{label}</span>
          <span className="mt-0.5 text-[10px] text-muted">
            {recommendation ? recommendation.toFixed(2) : "—"} · {total} analysts
          </span>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-2 text-sm">
        {sliceDefs.map((d) => {
          const c = counts[d.key];
          const pct = (c / total) * 100;
          return (
            <li key={d.key} className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="flex-1 truncate text-muted">{d.label}</span>
              <span className="text-xs tabular-nums text-muted">{pct.toFixed(0)}%</span>
              <span className="w-8 text-right font-medium tabular-nums">{c}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
