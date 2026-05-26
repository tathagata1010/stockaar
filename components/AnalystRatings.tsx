import { cn } from "@/lib/utils";
import type { Fundamentals } from "@/lib/fundamentals";

const ROWS: { key: keyof NonNullable<Fundamentals["analystCounts"]>; label: string; color: string }[] = [
  { key: "strongBuy", label: "Strong Buy", color: "bg-accent" },
  { key: "buy", label: "Buy", color: "bg-accent/60" },
  { key: "hold", label: "Hold", color: "bg-muted/60" },
  { key: "sell", label: "Sell", color: "bg-danger/60" },
  { key: "strongSell", label: "Strong Sell", color: "bg-danger" },
];

function consensusLabel(mean?: number): string {
  if (!mean) return "—";
  if (mean < 1.5) return "Strong Buy";
  if (mean < 2.5) return "Buy";
  if (mean < 3.5) return "Hold";
  if (mean < 4.5) return "Sell";
  return "Strong Sell";
}

export function AnalystRatings({ f }: { f: Fundamentals }) {
  const counts = f.analystCounts;
  if (!counts) return null;
  const total = counts.strongBuy + counts.buy + counts.hold + counts.sell + counts.strongSell;
  if (total === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Analyst Ratings</h3>
        <span className="text-xs text-muted">
          Consensus: <span className="font-medium text-fg">{consensusLabel(f.analystRecommendation)}</span>
          {" "}· {total} analyst{total === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {ROWS.map((row) => {
          const c = counts[row.key];
          const pct = total > 0 ? (c / total) * 100 : 0;
          return (
            <div key={row.key} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs text-muted sm:w-24">{row.label}</span>
              <div className="flex-1 h-2 rounded-full bg-border">
                <div className={cn("h-full rounded-full", row.color)} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 text-right text-xs font-medium tabular-nums">{c}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
