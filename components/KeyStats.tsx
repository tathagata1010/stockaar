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
  const num = (v: number | undefined | null) => (Number.isFinite(v) ? (v as number) : null);
  const marketCap = num(f.marketCap);
  const trailingPE = num(f.trailingPE);
  const forwardPE = num(f.forwardPE);
  const trailingEps = num(f.trailingEps);
  const priceToBook = num(f.priceToBook);
  const dividendYield = num(f.dividendYield);
  const beta = num(f.beta);
  const yearHigh = num(f.yearHigh);
  const yearLow = num(f.yearLow);
  const roe = num(f.returnOnEquity);
  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <h3 className="text-sm font-semibold">Key Statistics</h3>
      <div className="mt-3 grid gap-x-8 md:grid-cols-2">
        <div>
          <Row label="Market Cap" value={marketCap != null ? formatCompactINR(marketCap) : dash} />
          <Row label="P/E (Trailing)" value={trailingPE != null ? formatNumber(trailingPE) : dash} />
          <Row label="P/E (Forward)" value={forwardPE != null ? formatNumber(forwardPE) : dash} />
          <Row label="EPS (TTM)" value={trailingEps != null ? formatNumber(trailingEps) : dash} />
          <Row label="Price / Book" value={priceToBook != null ? formatNumber(priceToBook) : dash} />
        </div>
        <div>
          <Row
            label="Dividend Yield"
            value={dividendYield != null ? `${(dividendYield * 100).toFixed(2)}%` : dash}
          />
          <Row label="Beta" value={beta != null ? formatNumber(beta) : dash} />
          <Row label="52W High" value={yearHigh != null ? formatCompactINR(yearHigh) : dash} />
          <Row label="52W Low" value={yearLow != null ? formatCompactINR(yearLow) : dash} />
          <Row
            label="ROE"
            value={roe != null ? `${(roe * 100).toFixed(2)}%` : dash}
          />
        </div>
      </div>
    </section>
  );
}
