import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { Disclaimer } from "@/components/Disclaimer";
import { PriceChart } from "@/components/PriceChart";
import { findIndexBySlug, getIndex, getTopMovers, INDICES } from "@/lib/market";
import { formatPct, cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from "lucide-react";

export const revalidate = 60;

export async function generateStaticParams() {
  return INDICES.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const idx = findIndexBySlug(params.slug);
  return { title: idx ? `${idx.name} · Stocksbrew` : "Index" };
}

export default async function IndexDetailPage({ params }: { params: { slug: string } }) {
  const meta = findIndexBySlug(params.slug);
  if (!meta) notFound();

  const [quote, movers] = await Promise.all([
    getIndex(meta.name, meta.yahooSymbol),
    getTopMovers(8),
  ]);

  const up = (quote?.change ?? 0) >= 0;

  return (
    <AppShell>
      <Link href="/dashboard" className="text-sm text-muted hover:text-fg">← Dashboard</Link>

      <header className="mt-4 surface relative overflow-hidden p-6">
        <div className={cn(
          "absolute inset-y-0 left-0 w-1 bg-gradient-to-b",
          up ? "from-accent via-accent/70 to-brand" : "from-danger via-danger/70 to-warning",
        )} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Index</div>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{meta.name}</h1>
            <div className="num-display mt-2 text-3xl font-extrabold tabular-nums sm:text-4xl">
              {quote ? quote.lastPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
            </div>
            {quote && (
              <div className={cn(
                "mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ring-1",
                up ? "bg-accent/10 text-accent ring-accent/25" : "bg-danger/10 text-danger ring-danger/25",
              )}>
                {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {quote.change > 0 ? "+" : ""}{quote.change.toFixed(2)} ({formatPct(quote.changePct)})
              </div>
            )}
          </div>
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl ring-1",
            up ? "bg-accent/15 text-accent ring-accent/30" : "bg-danger/15 text-danger ring-danger/30",
          )}>
            {up ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
          </div>
        </div>
      </header>

      <section className="mt-6">
        <PriceChart
          symbol={meta.slug}
          exchange="NSE"
          historyPath={`/api/indices/${meta.slug}/history`}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Market movers right now</h2>
        <p className="text-xs text-muted">Top gainers and losers across NSE — useful context for how this index is being driven today.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <MoversCard title="Top gainers" tone="accent" rows={movers.gainers} />
          <MoversCard title="Top losers" tone="danger" rows={movers.losers} />
        </div>
      </section>

      <Disclaimer className="mt-10" />
    </AppShell>
  );
}

function MoversCard({ title, tone, rows }: { title: string; tone: "accent" | "danger"; rows: { symbol: string; lastPrice: number; changePct: number }[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className={cn("text-[11px] font-semibold uppercase tracking-wide", tone === "accent" ? "text-accent" : "text-danger")}>{title}</div>
      <ul className="mt-3 divide-y divide-border">
        {rows.length === 0 && <li className="py-3 text-sm text-muted">No data right now.</li>}
        {rows.map((r) => (
          <li key={r.symbol} className="flex items-center justify-between py-2 text-sm">
            <Link href={`/stock/${r.symbol}`} className="font-medium hover:text-accent">{r.symbol}</Link>
            <div className="flex items-center gap-3 tabular-nums">
              <span className="text-muted">₹{r.lastPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
              <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", tone === "accent" ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger")}>
                {formatPct(r.changePct)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
