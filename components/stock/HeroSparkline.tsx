"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import { CHART_COLORS } from "@/lib/chart-theme";

type Point = { t: number; p: number };

export function HeroSparkline({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const [points, setPoints] = useState<Point[] | null>(null);
  const reactId = useId();
  const gradId = `hero-spark-${reactId}`;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stocks/${encodeURIComponent(symbol)}/history?range=1mo&exchange=${exchange}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const pts: Point[] = d?.data?.points ?? [];
        setPoints(pts.length > 1 ? pts : []);
      })
      .catch(() => { if (!cancelled) setPoints([]); });
    return () => { cancelled = true; };
  }, [symbol, exchange]);

  const { stroke } = useMemo(() => {
    if (!points || points.length < 2) return { stroke: CHART_COLORS.muted };
    const up = points[points.length - 1].p >= points[0].p;
    return { stroke: up ? CHART_COLORS.accent : CHART_COLORS.danger };
  }, [points]);

  if (points === null) return <div className="h-10 shimmer rounded" />;
  if (points.length === 0) return null;

  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area
            type="monotone"
            dataKey="p"
            stroke={stroke}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
