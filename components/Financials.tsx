import { formatCompactINR } from "@/lib/utils";
import type { Fundamentals } from "@/lib/fundamentals";

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-bg/40 p-3">
      <div className="text-xs uppercase text-muted">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Financials({ f }: { f: Fundamentals }) {
  if (!f.revenueTTM && !f.netIncomeTTM && !f.ebitdaTTM) return null;
  const dash = "—";
  const revGrowth = f.revenueGrowth !== undefined
    ? `${f.revenueGrowth > 0 ? "+" : ""}${(f.revenueGrowth * 100).toFixed(1)}% YoY`
    : undefined;
  const earnGrowth = f.earningsGrowth !== undefined
    ? `${f.earningsGrowth > 0 ? "+" : ""}${(f.earningsGrowth * 100).toFixed(1)}% YoY`
    : undefined;
  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Financials (TTM)</h3>
        <span className="text-xs text-muted">Trailing twelve months</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Cell label="Revenue" value={f.revenueTTM ? formatCompactINR(f.revenueTTM) : dash} sub={revGrowth} />
        <Cell label="EBITDA" value={f.ebitdaTTM ? formatCompactINR(f.ebitdaTTM) : dash} />
        <Cell label="Net Income" value={f.netIncomeTTM ? formatCompactINR(f.netIncomeTTM) : dash} sub={earnGrowth} />
        <Cell
          label="Profit Margin"
          value={f.profitMargin !== undefined ? `${(f.profitMargin * 100).toFixed(1)}%` : dash}
        />
      </div>
    </section>
  );
}
