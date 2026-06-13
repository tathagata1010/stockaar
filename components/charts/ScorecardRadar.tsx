"use client";

import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import { useChartTheme } from "@/lib/hooks/useChartTheme";

type Pillar = { name: string; score: number };

export function ScorecardRadar({ pillars }: { pillars: Pillar[] }) {
  const { colors, tooltipStyle, itemStyle } = useChartTheme();
  const data = pillars.map((p) => ({ name: p.name, score: p.score }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="78%">
          <PolarGrid stroke={colors.border} />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fill: colors.muted, fontSize: 11 }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={false}
            axisLine={false}
            tickCount={5}
          />
          <Radar
            dataKey="score"
            stroke={colors.brand}
            fill={colors.brand}
            fillOpacity={0.3}
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            itemStyle={itemStyle}
            formatter={(v: number) => [`${v} / 100`, "Score"]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
