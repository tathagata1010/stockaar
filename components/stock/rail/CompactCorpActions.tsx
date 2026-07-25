import { fetchCorporateActions } from "@/lib/events";
import { formatINR } from "@/lib/utils";
import { Calendar, IndianRupee, Scissors } from "lucide-react";

export async function CompactCorpActions({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const actions = await fetchCorporateActions(symbol, exchange).catch(() => null);
  if (!actions) return null;

  const oneYearAgo = Date.now() - 365 * 86_400_000;
  const lastYearDivs = actions.dividends.filter((d) => d.date >= oneYearAgo);
  const yearDivTotal = lastYearDivs.reduce((s, d) => s + d.amount, 0);
  const latest = [
    ...actions.dividends.map((d) => ({ kind: "dividend" as const, date: d.date, amount: d.amount })),
    ...actions.splits.map((s) => ({ kind: "split" as const, date: s.date, numerator: s.numerator, denominator: s.denominator })),
  ].sort((a, b) => b.date - a.date)[0];

  return (
    <a
      href="#corporate-actions"
      className="block rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:border-brand/40"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand/15 text-brand">
          <Calendar className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Corporate actions
          </div>
          <div className="text-[10px] text-muted">Last 12 months</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-bg/40 px-2.5 py-2 ring-1 ring-border">
          <div className="text-[9px] uppercase tracking-wide text-muted">Dividends 12M</div>
          <div className="mt-0.5 text-sm font-bold tabular-nums">
            {yearDivTotal > 0 ? formatINR(yearDivTotal) : "—"}
          </div>
          <div className="text-[10px] text-muted">{lastYearDivs.length} payouts</div>
        </div>
        <div className="rounded-xl bg-bg/40 px-2.5 py-2 ring-1 ring-border">
          <div className="text-[9px] uppercase tracking-wide text-muted">Splits 5Y</div>
          <div className="mt-0.5 text-sm font-bold tabular-nums">
            {actions.splits.length || "—"}
          </div>
          <div className="text-[10px] text-muted">{actions.splits.length ? "events" : "none"}</div>
        </div>
      </div>

      {latest && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-bg/40 px-2.5 py-2 ring-1 ring-border">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${latest.kind === "dividend" ? "bg-accent/15 text-accent" : "bg-warning/15 text-warning"}`}>
            {latest.kind === "dividend" ? <IndianRupee className="h-3 w-3" /> : <Scissors className="h-3 w-3" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold">
              {latest.kind === "dividend"
                ? `Dividend · ${formatINR(latest.amount)}`
                : `Split · ${latest.numerator}:${latest.denominator}`}
            </div>
            <div className="text-[10px] text-muted">{formatRelative(latest.date)}</div>
          </div>
        </div>
      )}

      <div className="mt-2 text-right text-[10px] font-medium text-brand">View all →</div>
    </a>
  );
}

function formatRelative(t: number): string {
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
