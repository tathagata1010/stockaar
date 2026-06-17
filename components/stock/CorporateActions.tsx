import type { CorporateActions as Actions, Dividend, Split } from "@/lib/events";
import { formatINR, cn } from "@/lib/utils";
import { IndianRupee, Scissors } from "lucide-react";

type TimelineItem =
  | { kind: "dividend"; date: number; amount: number }
  | { kind: "split"; date: number; numerator: number; denominator: number };

export function CorporateActions({ actions }: { actions: Actions }) {
  const { dividends, splits } = actions;
  if (!dividends.length && !splits.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted">
        No corporate actions in the last 5 years.
      </div>
    );
  }

  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const lastYearDivs = dividends.filter((d) => d.date >= oneYearAgo);
  const lastYearDivTotal = lastYearDivs.reduce((s, d) => s + d.amount, 0);

  const items: TimelineItem[] = [
    ...dividends.map((d): TimelineItem => ({ kind: "dividend", date: d.date, amount: d.amount })),
    ...splits.map((s): TimelineItem => ({ kind: "split", date: s.date, numerator: s.numerator, denominator: s.denominator })),
  ].sort((a, b) => b.date - a.date);

  const byYear = groupByYear(items);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Dividends (12M)" value={lastYearDivTotal > 0 ? formatINR(lastYearDivTotal) : "—"} sub={`${lastYearDivs.length} payouts`} />
        <SummaryCard label="Total Dividends (5Y)" value={dividends.length.toString()} sub="payouts" />
        <SummaryCard label="Splits (5Y)" value={splits.length.toString()} sub={splits.length ? "events" : "none"} />
        <SummaryCard label="Latest Action" value={items[0] ? formatRelative(items[0].date) : "—"} sub={items[0] ? labelFor(items[0]) : ""} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
        <div className="space-y-5">
          {Object.entries(byYear).map(([year, list]) => (
            <YearBlock key={year} year={year} items={list} />
          ))}
        </div>
      </div>
    </div>
  );
}

function YearBlock({ year, items }: { year: string; items: TimelineItem[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
        <span>{year}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={`${item.kind}-${item.date}-${i}`} className="flex items-center gap-3 rounded-xl bg-bg/40 px-3 py-2 ring-1 ring-border">
            <span className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              item.kind === "dividend" ? "bg-accent/15 text-accent" : "bg-warning/15 text-warning",
            )}>
              {item.kind === "dividend" ? <IndianRupee className="h-4 w-4" /> : <Scissors className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{labelFor(item)}</div>
              <div className="text-[11px] text-muted">{formatDate(item.date)}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-soft">
      <div className="text-[9px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-base font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-muted">{sub}</div>}
    </div>
  );
}

function labelFor(item: TimelineItem | Dividend | Split): string {
  if ("kind" in item) {
    if (item.kind === "dividend") return `Dividend · ${formatINR(item.amount)} per share`;
    return `Split · ${item.numerator}:${item.denominator}`;
  }
  if ("amount" in item) return `Dividend · ${formatINR(item.amount)} per share`;
  return `Split · ${item.numerator}:${item.denominator}`;
}

function formatDate(t: number): string {
  return new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatRelative(t: number): string {
  const days = Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function groupByYear(items: TimelineItem[]): Record<string, TimelineItem[]> {
  const out: Record<string, TimelineItem[]> = {};
  for (const item of items) {
    const year = new Date(item.date).getFullYear().toString();
    (out[year] ??= []).push(item);
  }
  return out;
}
