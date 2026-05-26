import { cn } from "@/lib/utils";

/** Linear progress bar showing usage vs. limit. Pass Infinity for limit -> "Unlimited". */
export function UsageMeter({
  label,
  used,
  limit,
  icon,
  className,
}: {
  label: string;
  used: number;
  limit: number;
  icon?: React.ReactNode;
  className?: string;
}) {
  const unlimited = !Number.isFinite(limit);
  const pct = unlimited ? 100 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const nearLimit = !unlimited && pct >= 80;
  const atLimit = !unlimited && used >= limit;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-soft",
        atLimit && "border-danger/40 bg-danger/5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
          {icon}
          {label}
        </div>
        {atLimit && (
          <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger">
            Limit reached
          </span>
        )}
        {!atLimit && nearLimit && (
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning">
            Almost full
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="num-display text-2xl font-bold tabular-nums">{used}</span>
        <span className="text-sm text-muted">
          / {unlimited ? "Unlimited" : limit}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg-2 ring-1 ring-border">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            unlimited && "bg-gradient-to-r from-brand via-brand-2 to-accent",
            !unlimited && atLimit && "bg-danger",
            !unlimited && !atLimit && nearLimit && "bg-warning",
            !unlimited && !nearLimit && "bg-gradient-to-r from-brand to-brand-2",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
