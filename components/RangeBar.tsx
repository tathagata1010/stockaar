import { formatINR, cn } from "@/lib/utils";

export function RangeBar({
  low, high, current, label,
}: {
  low: number;
  high: number;
  current: number;
  label?: string;
}) {
  const span = Math.max(high - low, 1);
  const pct = Math.min(100, Math.max(0, ((current - low) / span) * 100));
  const fromLowPct = ((current - low) / span) * 100;

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{label ?? "52-Week Range"}</h3>
        <span className="text-xs text-muted">
          {fromLowPct.toFixed(0)}% from low
        </span>
      </div>
      <div className="mt-4">
        <div className="relative h-2 rounded-full bg-border">
          <div
            className={cn(
              "absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg",
              "bg-accent shadow-lg",
            )}
            style={{ left: `${pct}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <div>
            <div className="text-muted">Low</div>
            <div className="font-medium tabular-nums">{formatINR(low)}</div>
          </div>
          <div className="text-center">
            <div className="text-muted">Current</div>
            <div className="font-medium tabular-nums">{formatINR(current)}</div>
          </div>
          <div className="text-right">
            <div className="text-muted">High</div>
            <div className="font-medium tabular-nums">{formatINR(high)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
