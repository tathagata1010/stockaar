import Link from "next/link";
import { Suspense } from "react";
import { getAllIndices, getTopMovers, INDICES } from "@/lib/market";
import { formatINR, formatPct, cn } from "@/lib/utils";
import { isMarketOpen } from "@/lib/constants";
import { NSE_SYMBOLS } from "@/lib/nse-symbols";
import { StockLogo } from "@/components/StockLogo";
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Circle } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export const metadata = {
  title: "Dashboard — Nifty, Sensex, Bank Nifty Live",
  description: "Live Indian market dashboard: Nifty 50, Sensex, Bank Nifty prices with top gainers and losers across NSE and BSE.",
  alternates: { canonical: "/dashboard" },
};

export default function DashboardPage() {
  const open = isMarketOpen();

  return (
    <AppShell>
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-4 shadow-glow sm:p-6 md:p-8 lg:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className={cn(
              "chip mb-3",
              open ? "chip-accent" : "chip-warning",
            )}>
              <Circle className={cn("h-2 w-2 fill-current", open && "animate-pulse-soft")} />
              {open ? "Markets are LIVE" : "Markets closed"}
            </div>
            <h1 className="num-display text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
              Welcome back to <span className="text-gradient-animate">your markets</span>
            </h1>
            <p className="mt-3 text-xs text-muted sm:text-sm md:text-base">
              9:15–15:30 IST · Mon–Fri · Real-time signals across 220+ NSE/BSE stocks
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/screener" className="btn-ghost">
              Open Screener
            </Link>
            <Link href="/hot-stocks" className="btn-brand">
              Hot Stocks →
            </Link>
          </div>
        </div>
      </section>

      <Suspense fallback={<IndicesShell />}>
        <IndicesSection />
      </Suspense>

      <Suspense fallback={<MoversShell />}>
        <MoversSection />
      </Suspense>

      <p className="mt-10 text-center text-xs text-muted">
        Data may be delayed up to 15 minutes. For informational purposes only. Not investment advice.
      </p>
    </AppShell>
  );
}

async function IndicesSection() {
  const indices = await getAllIndices();
  return (
    <section className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
      {indices.length === 0 ? (
        <div className="md:col-span-3 rounded-lg border border-border bg-card p-6 text-sm text-muted">
          Index data temporarily unavailable.
        </div>
      ) : (
        indices.map((idx, i) => {
          const up = idx.change >= 0;
          const meta = INDICES.find((m) => m.yahooSymbol === idx.yahooSymbol);
          const href = meta ? `/indices/${meta.slug}` : null;
          const TileInner = (
            <>
              <div className={cn(
                "absolute inset-y-0 left-0 w-1 bg-gradient-to-b",
                up ? "from-accent via-accent/70 to-brand" : "from-danger via-danger/70 to-warning",
              )} />
              <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <div className="relative">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{idx.name}</div>
                    <div className="num-display mt-2 text-3xl font-bold tabular-nums md:text-4xl">
                      {idx.lastPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl ring-1",
                    up ? "bg-accent/15 text-accent ring-accent/30" : "bg-danger/15 text-danger ring-danger/30",
                  )}>
                    {up ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  </div>
                </div>
                <div className={cn(
                  "mt-3 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums",
                  up ? "bg-accent/10 text-accent ring-1 ring-accent/20" : "bg-danger/10 text-danger ring-1 ring-danger/20",
                )}>
                  {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {idx.change > 0 ? "+" : ""}{idx.change.toFixed(2)} ({formatPct(idx.changePct)})
                </div>
              </div>
            </>
          );
          const className = cn(
            "group surface relative overflow-hidden p-5 hover-lift fade-up block",
            `fade-up-${i + 1}`,
          );
          return href ? (
            <Link key={idx.yahooSymbol} href={href} className={className} aria-label={`View ${idx.name} details`}>
              {TileInner}
            </Link>
          ) : (
            <div key={idx.yahooSymbol} className={className}>{TileInner}</div>
          );
        })
      )}
    </section>
  );
}

async function MoversSection() {
  const movers = await getTopMovers(5);
  return (
    <section className="mt-8 grid gap-6 md:grid-cols-2">
      <MoversCard title="Top Gainers" items={movers.gainers} kind="gain" />
      <MoversCard title="Top Losers" items={movers.losers} kind="loss" />
    </section>
  );
}

function MoversShell() {
  return (
    <section className="mt-8 grid gap-6 md:grid-cols-2">
      <div className="h-96 shimmer rounded-2xl" />
      <div className="h-96 shimmer rounded-2xl" />
    </section>
  );
}

function IndicesShell() {
  return (
    <section className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-32 shimmer rounded-2xl" />
      ))}
    </section>
  );
}

function MoversCard({
  title, items, kind,
}: {
  title: string;
  items: Awaited<ReturnType<typeof getTopMovers>>["gainers"];
  kind: "gain" | "loss";
}) {
  const Icon = kind === "gain" ? TrendingUp : TrendingDown;
  const maxAbs = Math.max(1, ...items.map((q) => Math.abs(q.changePct)));
  return (
    <div className="surface group relative overflow-hidden">
      <div className={cn(
        "absolute inset-y-0 left-0 w-1 bg-gradient-to-b",
        kind === "gain" ? "from-accent via-accent/70 to-brand" : "from-danger via-danger/70 to-warning",
      )} />
      <div className="relative">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg",
              kind === "gain" ? "bg-accent/15 text-accent" : "bg-danger/15 text-danger",
            )}>
              <Icon className="h-4 w-4" />
            </span>
            {title}
          </div>
          <Link href="/hot-stocks" className="inline-flex items-center gap-1 text-xs font-semibold text-muted transition hover:text-brand">
            See all <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        {items.length === 0 ? (
          <div className="p-5 text-sm text-muted">No data.</div>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((q, idx) => {
              const meta = NSE_SYMBOLS.find((s) => s.symbol === q.symbol);
              const magnitude = Math.min(100, (Math.abs(q.changePct) / maxAbs) * 100);
              return (
              <li key={`${q.exchange}:${q.symbol}`} className={`relative fade-up-${(idx % 5) + 1}`}>
                <Link
                  href={`/stock/${q.symbol}`}
                  className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-bg/60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StockLogo symbol={q.symbol} sector={meta?.sector} size="sm" />
                    <div className="min-w-0">
                      <div className="font-semibold">{q.symbol}</div>
                      {meta && <div className="text-[11px] text-muted line-clamp-1">{meta.name}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="num-display tabular-nums text-sm text-muted">{formatINR(q.lastPrice)}</span>
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn(
                        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ring-1",
                        kind === "gain" ? "bg-accent/10 text-accent ring-accent/20" : "bg-danger/10 text-danger ring-danger/20",
                      )}>
                        {kind === "gain" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {formatPct(q.changePct)}
                      </span>
                      <div className="h-1 w-16 overflow-hidden rounded-full bg-bg-2">
                        <div
                          className={cn("h-full rounded-full", kind === "gain" ? "bg-accent" : "bg-danger")}
                          style={{ width: `${magnitude}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
