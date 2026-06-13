import type { Fundamentals } from "@/lib/fundamentals";
import type { BrokerReport, BrokerAction } from "@/lib/trendlyne-brokers";
import { AnalystRatingsDonut } from "@/components/charts/AnalystRatingsDonut";
import { cn, formatINR } from "@/lib/utils";

const BADGE_CLS: Record<BrokerAction, string> = {
  Buy:        "bg-accent/15 text-accent ring-accent/30",
  Accumulate: "bg-accent/15 text-accent ring-accent/30",
  Sell:       "bg-danger/15 text-danger ring-danger/30",
  Reduce:     "bg-danger/15 text-danger ring-danger/30",
  Hold:       "bg-muted/10 text-muted ring-border",
  Neutral:    "bg-muted/10 text-muted ring-border",
  Other:      "bg-muted/10 text-muted ring-border",
};

export function AnalystRatings({
  f,
  reports = [],
}: {
  f?: Fundamentals | null;
  reports?: BrokerReport[];
}) {
  const counts = f?.analystCounts;
  const total = counts ? counts.strongBuy + counts.buy + counts.hold + counts.sell + counts.strongSell : 0;
  if (total === 0 && reports.length === 0) return null;

  const buyish = reports.filter((r) => r.action === "Buy" || r.action === "Accumulate").length;
  const sellish = reports.filter((r) => r.action === "Sell" || r.action === "Reduce").length;
  const latestTarget = reports.find((r) => r.target != null)?.target;

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      {total > 0 && counts && (
        <AnalystRatingsDonut counts={counts} recommendation={f?.analystRecommendation} />
      )}

      {reports.length > 0 && (
        <details className={cn("group", total > 0 && "mt-5 border-t border-border/60 pt-4")}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md py-1 outline-none focus-visible:ring-2 focus-visible:ring-brand/50">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <h4 className="text-sm font-semibold text-fg">Broker reports</h4>
              <span className="rounded-full bg-muted/10 px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-border">
                {reports.length}
              </span>
              <div className="hidden flex-1 items-center gap-3 text-xs text-muted sm:flex">
                {buyish > 0 && <span><span className="font-medium text-accent">{buyish}</span> buy</span>}
                {sellish > 0 && <span><span className="font-medium text-danger">{sellish}</span> sell</span>}
                {latestTarget != null && (
                  <span>
                    Latest target <span className="font-medium tabular-nums text-fg">{formatINR(latestTarget)}</span>
                  </span>
                )}
              </div>
            </div>
            <span
              aria-hidden
              className="text-muted transition-transform group-open:rotate-180"
            >
              ▾
            </span>
          </summary>

          <ul className="mt-3 divide-y divide-border/60">
            {reports.map((r, i) => (
              <li
                key={`${r.url}-${i}`}
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-2.5 text-sm sm:grid-cols-[1fr_auto_auto_auto]"
              >
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 truncate font-medium hover:text-brand"
                  title={r.title || r.firm}
                >
                  {r.firm}
                </a>
                <span className={cn(
                  "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                  BADGE_CLS[r.action],
                )}>
                  {r.action}
                </span>
                <span className="tabular-nums text-xs text-muted sm:text-right">
                  {r.target != null ? formatINR(r.target) : "—"}
                </span>
                <span className="col-span-2 text-xs text-muted sm:col-span-1 sm:text-right tabular-nums">
                  {formatDate(r.date)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] text-muted">Source: Trendlyne broker reports</p>
        </details>
      )}
    </section>
  );
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const days = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}
