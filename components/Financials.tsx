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
  const num = (v: number | undefined | null) => (Number.isFinite(v) ? (v as number) : null);
  const revenue = num(f.revenueTTM);
  const ebitda = num(f.ebitdaTTM);
  const netIncome = num(f.netIncomeTTM);
  const profitMargin = num(f.profitMargin);
  const revenueGrowth = num(f.revenueGrowth);
  const earningsGrowth = num(f.earningsGrowth);
  if (revenue == null && ebitda == null && netIncome == null) return null;
  const dash = "—";
  const revGrowth = revenueGrowth != null
    ? `${revenueGrowth > 0 ? "+" : ""}${(revenueGrowth * 100).toFixed(1)}% YoY`
    : undefined;
  const earnGrowth = earningsGrowth != null
    ? `${earningsGrowth > 0 ? "+" : ""}${(earningsGrowth * 100).toFixed(1)}% YoY`
    : undefined;
  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Financials (TTM)</h3>
        <span className="text-xs text-muted">Trailing twelve months</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Cell label="Revenue" value={revenue != null ? formatCompactINR(revenue) : dash} sub={revGrowth} />
        <Cell label="EBITDA" value={ebitda != null ? formatCompactINR(ebitda) : dash} />
        <Cell label="Net Income" value={netIncome != null ? formatCompactINR(netIncome) : dash} sub={earnGrowth} />
        <Cell
          label="Profit Margin"
          value={profitMargin != null ? `${(profitMargin * 100).toFixed(1)}%` : dash}
        />
      </div>
    </section>
  );
}
