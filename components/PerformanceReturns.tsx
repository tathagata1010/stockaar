"use client";

import { useEffect, useState } from "react";
import { cn, formatPct } from "@/lib/utils";

type Point = { t: number; p: number };

const WINDOWS = [
  { key: "1w", label: "1 Week",   days: 7 },
  { key: "1m", label: "1 Month",  days: 30 },
  { key: "3m", label: "3 Months", days: 90 },
  { key: "6m", label: "6 Months", days: 180 },
  { key: "1y", label: "1 Year",   days: 365 },
] as const;

export function PerformanceReturns({
  symbol, exchange,
}: {
  symbol: string;
  exchange: "NSE" | "BSE";
}) {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/stocks/${symbol}/history?range=1y&exchange=${exchange}`)
      .then((r) => r.json())
      .then((d) => { if (d.data?.points) setPoints(d.data.points); })
      .finally(() => setLoading(false));
  }, [symbol, exchange]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold">Returns</h3>
        <div className="mt-4 text-sm text-muted">Loading…</div>
      </div>
    );
  }
  if (points.length < 2) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold">Returns</h3>
        <div className="mt-4 text-sm text-muted">No data.</div>
      </div>
    );
  }

  const last = points[points.length - 1].p;
  const now = points[points.length - 1].t;

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <h3 className="text-sm font-semibold">Returns</h3>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
        {WINDOWS.map((w) => {
          const target = now - w.days * 86400 * 1000;
          const past = closestPriceAt(points, target);
          const pct = past ? ((last - past) / past) * 100 : null;
          return (
            <div key={w.key}>
              <div className="text-xs text-muted">{w.label}</div>
              <div className={cn(
                "mt-1 font-semibold tabular-nums",
                pct === null && "text-muted",
                pct !== null && pct > 0 && "text-accent",
                pct !== null && pct < 0 && "text-danger",
              )}>
                {pct === null ? "—" : formatPct(pct)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function closestPriceAt(points: Point[], targetTs: number): number | null {
  if (points.length === 0) return null;
  if (targetTs <= points[0].t) return null;
  let best = points[0];
  let bestDiff = Math.abs(points[0].t - targetTs);
  for (const p of points) {
    const d = Math.abs(p.t - targetTs);
    if (d < bestDiff) { best = p; bestDiff = d; }
  }
  return best.p;
}
