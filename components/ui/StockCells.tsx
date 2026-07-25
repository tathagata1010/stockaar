import { ArrowUpRight, ArrowDownRight } from "lucide-react";

import { cn, formatPct } from "@/lib/utils";

// Shared cell primitives for stock lists. StockTable, StockGrid, and any
// other tabular surface should import from here so the visual language of
// "% change", "score", and "signal" is identical everywhere.

export const SIGNAL_STYLES: Record<string, string> = {
  POSITIVE: "bg-accent/15 text-accent ring-1 ring-accent/40",
  NEUTRAL: "bg-muted/15 text-muted ring-1 ring-muted/30",
  CAUTION: "bg-danger/15 text-danger ring-1 ring-danger/40",
};

export function PctBadge({ pct, size = "sm" }: { pct: number | null | undefined; size?: "xs" | "sm" }) {
  if (pct == null || !Number.isFinite(pct)) return <span className="text-muted">—</span>;
  const up = pct >= 0;
  const iconSize = size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3";
  const padding = size === "xs" ? "px-1.5 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-xs";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md font-semibold tabular-nums ring-1",
        padding,
        up ? "bg-accent/10 text-accent ring-accent/25" : "bg-danger/10 text-danger ring-danger/25",
      )}
    >
      {up ? <ArrowUpRight className={iconSize} /> : <ArrowDownRight className={iconSize} />}
      {formatPct(pct)}
    </span>
  );
}

export function ScorePill({ score }: { score: number | null | undefined }) {
  if (score == null || !Number.isFinite(score)) return <span className="text-muted">—</span>;
  const tone =
    score >= 70
      ? "from-accent/30 to-accent/10 text-accent ring-accent/30"
      : score >= 50
        ? "from-brand/30 to-brand/10 text-brand ring-brand/30"
        : "from-danger/30 to-danger/10 text-danger ring-danger/30";
  return (
    <span
      className={cn(
        "inline-flex min-w-[44px] items-center justify-center rounded-md bg-gradient-to-b px-2 py-0.5 text-xs font-bold tabular-nums ring-1",
        tone,
      )}
    >
      {score}
    </span>
  );
}

export function SignalChip({ signal }: { signal: string | null | undefined }) {
  if (!signal) return <span className="text-xs text-muted">—</span>;
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide", SIGNAL_STYLES[signal])}>
      {signal}
    </span>
  );
}
