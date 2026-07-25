import { getShareholdingTimeline } from "@/lib/xbrl-shp";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus, Users } from "lucide-react";

export async function CompactShareholding({ symbol }: { symbol: string }) {
  const timeline = await getShareholdingTimeline(symbol).catch(() => null);
  const latest = timeline?.latest ?? null;
  if (!latest) return null;

  const quarters = timeline?.quarters ?? [];
  const prev = quarters.length >= 2 ? quarters[quarters.length - 2] : null;

  const slices = [
    { key: "promoter", label: "Promoter", value: latest.promoter, prev: prev?.promoter ?? null, color: "bg-brand" },
    { key: "fii", label: "FII", value: latest.fii, prev: prev?.fii ?? null, color: "bg-accent" },
    { key: "dii", label: "DII", value: latest.dii, prev: prev?.dii ?? null, color: "bg-warning" },
  ] as const;

  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;

  return (
    <a
      href="#shareholding"
      className="block rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:border-brand/40"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand/15 text-brand">
          <Users className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Shareholding
          </div>
          <div className="text-[10px] text-muted">Latest quarter</div>
        </div>
      </div>

      <div className="flex h-2 overflow-hidden rounded-full bg-bg-2">
        {slices.map((s) => {
          const w = (Math.max(0, s.value) / total) * 100;
          if (w < 1) return null;
          return <span key={s.key} className={cn("h-full", s.color)} style={{ width: `${w}%` }} />;
        })}
      </div>

      <ul className="mt-3 space-y-1.5">
        {slices.map((s) => {
          const delta = s.prev != null ? s.value - s.prev : null;
          const dirIcon =
            delta == null ? null
              : delta > 0.05 ? <ArrowUpRight className="h-3 w-3 text-accent" />
              : delta < -0.05 ? <ArrowDownRight className="h-3 w-3 text-danger" />
              : <Minus className="h-3 w-3 text-muted" />;
          return (
            <li key={s.key} className="flex items-center gap-2 text-[11px]">
              <span className={cn("h-2 w-2 rounded-sm", s.color)} />
              <span className="w-14 text-muted">{s.label}</span>
              <span className="flex-1 text-right font-semibold tabular-nums">{s.value.toFixed(1)}%</span>
              <span className="flex w-12 items-center justify-end gap-0.5 text-[10px] tabular-nums text-muted">
                {dirIcon}
                {delta != null && Math.abs(delta) >= 0.05 ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}` : "—"}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-2 text-right text-[10px] font-medium text-brand">View all →</div>
    </a>
  );
}
