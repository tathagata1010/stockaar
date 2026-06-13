import type { ShareholdingTimeline as TimelineData } from "@/lib/xbrl-shp";
import { ShareholdingPie } from "@/components/charts/ShareholdingPie";
import { ShareholdingTimeline } from "@/components/charts/ShareholdingTimeline";
import { SHAREHOLDING_CATEGORIES } from "@/lib/chart-theme";
import { cn } from "@/lib/utils";

function formatDate(s: string): string {
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return s;
  return new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function Shareholding({ timeline }: { timeline?: TimelineData | null }) {
  const latest = timeline?.latest ?? null;
  const quarters = timeline?.quarters ?? [];

  if (!latest) {
    return (
      <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Shareholding pattern</h3>
        </div>
        <p className="mt-4 text-sm text-muted">
          No shareholding data yet. SEBI publishes filings quarterly — newly-listed names take a quarter to appear.
        </p>
      </section>
    );
  }

  const prev = quarters.length >= 2 ? quarters[quarters.length - 2] : null;

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Shareholding pattern</h3>
        <span className="text-xs text-muted">
          As of <span className="font-medium text-fg">{formatDate(latest.asOnDate)}</span>
        </span>
      </div>

      <div className="mt-5 grid items-center gap-5 md:grid-cols-[220px_1fr] md:gap-6">
        <ShareholdingPie breakdown={latest} />
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SHAREHOLDING_CATEGORIES.map((c) => {
            const cur = c.pick(latest);
            if (cur < 0.05) return null;
            const before = prev ? c.pick(prev) : null;
            const delta = before != null ? cur - before : null;
            return (
              <li
                key={c.key}
                className="group relative overflow-hidden rounded-xl border border-border/60 bg-bg/40 p-3 transition hover:border-border hover:bg-bg/60"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1 rounded-l-xl"
                  style={{ background: c.color }}
                />
                <div className="flex items-start justify-between gap-3 pl-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
                      <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted">{c.label}</span>
                    </div>
                    <div className="mt-1 text-xl font-bold tabular-nums leading-none">
                      {cur.toFixed(2)}<span className="ml-0.5 text-sm font-medium text-muted">%</span>
                    </div>
                  </div>
                  <DeltaPill delta={delta} />
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/30">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, cur)}%`, background: c.color, opacity: 0.85 }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {quarters.length >= 2 && (
        <div className="mt-6 border-t border-border/60 pt-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Quarterly trend
            </h4>
            <span className="text-[11px] text-muted">Last {quarters.length} quarters</span>
          </div>
          <ShareholdingTimeline quarters={quarters} />
        </div>
      )}

      {timeline?.latestXbrlUrl && (
        <div className="mt-5 border-t border-border/60 pt-3 text-xs text-muted">
          <a href={timeline.latestXbrlUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand">
            View full SEBI filing (XBRL) →
          </a>
        </div>
      )}
    </section>
  );
}

function DeltaPill({ delta }: { delta: number | null }) {
  if (delta == null) {
    return <span className="text-[10px] text-muted">—</span>;
  }
  const rounded = Math.round(delta * 100) / 100;
  if (rounded === 0) {
    return <span className="text-[10px] text-muted">flat</span>;
  }
  const up = rounded > 0;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ring-1",
        up ? "bg-accent/10 text-accent ring-accent/20" : "bg-danger/10 text-danger ring-danger/20",
      )}
    >
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {Math.abs(rounded).toFixed(2)}
    </span>
  );
}
