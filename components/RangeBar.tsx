import { formatINR } from "@/lib/utils";

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

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{label ?? "52-Week Range"}</h3>
        <span className="text-xs text-muted">{pct.toFixed(0)}% from low</span>
      </div>

      <div className="mt-5 pb-2">
        <div className="relative h-2 rounded-full bg-gradient-to-r from-danger/70 via-muted/60 to-accent/80">
          <div
            className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${pct}%` }}
          >
            <div className="h-4 w-4 rounded-full border-2 border-bg bg-fg shadow-lg ring-2 ring-fg/20" />
            <div className="mt-1 whitespace-nowrap rounded bg-card px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-fg shadow ring-1 ring-border">
              {formatINR(current)}
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs">
          <div>
            <div className="text-muted">Low</div>
            <div className="font-medium tabular-nums">{formatINR(low)}</div>
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
