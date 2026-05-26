import { formatCompactINR, formatNumber } from "@/lib/utils";
import type { Fundamentals } from "@/lib/fundamentals";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function KeyStats({ f }: { f: Fundamentals }) {
  const dash = "—";
  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <h3 className="text-sm font-semibold">Key Statistics</h3>
      <div className="mt-3 grid gap-x-8 md:grid-cols-2">
        <div>
          <Row label="Market Cap" value={f.marketCap ? formatCompactINR(f.marketCap) : dash} />
          <Row label="P/E (Trailing)" value={f.trailingPE ? formatNumber(f.trailingPE) : dash} />
          <Row label="P/E (Forward)" value={f.forwardPE ? formatNumber(f.forwardPE) : dash} />
          <Row label="EPS (TTM)" value={f.trailingEps ? formatNumber(f.trailingEps) : dash} />
          <Row label="Price / Book" value={f.priceToBook ? formatNumber(f.priceToBook) : dash} />
        </div>
        <div>
          <Row
            label="Dividend Yield"
            value={f.dividendYield ? `${(f.dividendYield * 100).toFixed(2)}%` : dash}
          />
          <Row label="Beta" value={f.beta ? formatNumber(f.beta) : dash} />
          <Row label="52W High" value={f.yearHigh ? formatCompactINR(f.yearHigh) : dash} />
          <Row label="52W Low" value={f.yearLow ? formatCompactINR(f.yearLow) : dash} />
          <Row
            label="ROE"
            value={f.returnOnEquity ? `${(f.returnOnEquity * 100).toFixed(2)}%` : dash}
          />
        </div>
      </div>
    </section>
  );
}
