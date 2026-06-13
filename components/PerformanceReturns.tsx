import { PerformanceBars, type PerfPoint } from "@/components/charts/PerformanceBars";
import type { HistoryPoint } from "@/lib/history";

const WINDOWS = [
  { key: "1w", label: "1W", days: 7 },
  { key: "1m", label: "1M", days: 30 },
  { key: "3m", label: "3M", days: 90 },
  { key: "6m", label: "6M", days: 180 },
  { key: "1y", label: "1Y", days: 365 },
] as const;

export function PerformanceReturns({ points }: { points: HistoryPoint[] }) {
  const series = buildSeries(points);
  const hasData = points.length >= 2;

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Returns</h3>
        <span className="text-xs text-muted">Trailing windows</span>
      </div>
      {hasData ? (
        <div className="mt-4">
          <PerformanceBars data={series} />
        </div>
      ) : (
        <div className="mt-4 text-sm text-muted">No data.</div>
      )}
    </div>
  );
}

function buildSeries(points: HistoryPoint[]): PerfPoint[] {
  if (points.length < 2) return WINDOWS.map((w) => ({ label: w.label, pct: null }));
  const last = points[points.length - 1].p;
  const now = points[points.length - 1].t;
  return WINDOWS.map((w) => {
    const target = now - w.days * 86400 * 1000;
    const past = closestPriceAt(points, target);
    const pct = past ? ((last - past) / past) * 100 : null;
    return { label: w.label, pct };
  });
}

function closestPriceAt(points: HistoryPoint[], targetTs: number): number | null {
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
