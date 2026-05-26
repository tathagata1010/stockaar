import type { Quote } from "@/lib/upstox";
import type { Fundamentals } from "@/lib/fundamentals";

function buildSignals(q: Quote, f: Fundamentals | null): string[] {
  const out: string[] = [];

  if (f?.yearHigh && f?.yearLow) {
    const range = f.yearHigh - f.yearLow;
    const pos = range > 0 ? ((q.lastPrice - f.yearLow) / range) * 100 : 50;
    if (pos > 90) out.push(`Trading near 52-week high (${pos.toFixed(0)}% of range)`);
    else if (pos < 15) out.push(`Trading near 52-week low (${pos.toFixed(0)}% of range)`);
    else out.push(`Sitting at ${pos.toFixed(0)}% of its 52-week range`);
  }

  if (Math.abs(q.changePct) > 3) {
    out.push(`${q.changePct > 0 ? "Big up" : "Big down"} move today: ${q.changePct.toFixed(2)}%`);
  }

  if (f?.earningsDate) {
    const days = Math.round((f.earningsDate - Date.now()) / (1000 * 60 * 60 * 24));
    if (days >= -1 && days <= 14) {
      out.push(days <= 0 ? "Earnings just reported" : `Earnings in ${days} day${days === 1 ? "" : "s"}`);
    }
  }

  if (f?.revenueGrowth !== undefined && f.revenueGrowth > 0.2) {
    out.push(`Revenue growing ${(f.revenueGrowth * 100).toFixed(1)}% YoY`);
  } else if (f?.revenueGrowth !== undefined && f.revenueGrowth < -0.05) {
    out.push(`Revenue contracting ${(f.revenueGrowth * 100).toFixed(1)}% YoY`);
  }

  if (f?.analystCounts) {
    const c = f.analystCounts;
    const total = c.strongBuy + c.buy + c.hold + c.sell + c.strongSell;
    if (total > 0) {
      const bullish = c.strongBuy + c.buy;
      if (bullish / total > 0.6) out.push(`${bullish} of ${total} analysts rate Buy`);
    }
  }

  return out.slice(0, 5);
}

export function WhyCareToday({ quote, fundamentals }: { quote: Quote; fundamentals: Fundamentals | null }) {
  const signals = buildSignals(quote, fundamentals);
  if (signals.length === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <h3 className="text-sm font-semibold">Why Care Today</h3>
      <ul className="mt-3 space-y-2">
        {signals.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
