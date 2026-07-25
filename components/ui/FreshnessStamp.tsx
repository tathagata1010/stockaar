import { cn } from "@/lib/utils";

function toIst(ts: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ts));
}

function relative(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function FreshnessStamp({
  ts,
  style = "relative",
  now,
  className,
}: {
  ts: number;
  style?: "relative" | "absolute";
  now?: number;
  className?: string;
}) {
  const nowMs = now ?? Date.now();
  const label = style === "absolute" ? `${toIst(ts)} IST` : relative(ts, nowMs);
  const title = new Date(ts).toISOString();
  return (
    <span
      title={title}
      className={cn(
        "font-mono text-[10px] tabular-nums text-muted",
        className,
      )}
    >
      {label}
    </span>
  );
}
