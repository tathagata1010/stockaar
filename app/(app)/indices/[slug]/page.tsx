import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { findIndexBySlug, getIndex, getTopMovers, INDICES, type IndexQuote } from "@/lib/market";
import { formatPct, cn } from "@/lib/utils";
import { PriceChart } from "@/components/PriceChart";
import { RangeBar } from "@/components/RangeBar";
import { Disclaimer } from "@/components/Disclaimer";
import { StickyScrollLayout, StickySection, type StickySection as TS } from "@/components/StickyScrollLayout";
import { LazyMount } from "@/components/LazyMount";
import { NewsSection } from "@/components/NewsSection";
import {
  ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  LineChart, Activity, BarChart3, Newspaper, Sparkles,
} from "lucide-react";

export const revalidate = 60;

export async function generateStaticParams() {
  return INDICES.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const idx = findIndexBySlug(params.slug);
  if (!idx) return { title: "Index" };
  const title = `${idx.name} Live Index · Price, Chart, Movers`;
  const description = `Live ${idx.name} index price, intraday chart, 1D–5Y returns, top gainers and losers, and related news. Updated every minute during Indian market hours.`;
  const url = `/indices/${idx.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary_large_image", title, description },
    keywords: [
      `${idx.name} live`,
      `${idx.name} today`,
      `${idx.name} chart`,
      `${idx.name} index`,
      `${idx.name} movers`,
    ],
  };
}

export default async function IndexDetailPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const meta = findIndexBySlug(params.slug);
  if (!meta) notFound();

  const heroShell = (
    <>
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl ring-1 bg-brand/15 text-brand ring-brand/30",
        )}>
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-bold tracking-tight">{meta.name}</h1>
            <span className="chip chip-brand text-[10px]">Index</span>
          </div>
          <p className="truncate text-xs text-muted">{indexBlurb(meta.slug)}</p>
        </div>
      </div>

      <div className="divider-soft my-4" />

      <Suspense fallback={<HeroPriceSkeleton />}>
        <IndexHeroPrice slug={meta.slug} name={meta.name} yahooSymbol={meta.yahooSymbol} />
      </Suspense>

      <Link href="/dashboard" className="mt-4 inline-block text-[11px] text-muted hover:text-brand">
        ← Back to dashboard
      </Link>
    </>
  );

  const sections: TS[] = [
    { id: "overview", label: "Overview", icon: <LineChart className="h-3.5 w-3.5" /> },
    { id: "performance", label: "Performance", icon: <Activity className="h-3.5 w-3.5" /> },
    { id: "movers", label: "Movers", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: "news", label: "News", icon: <Newspaper className="h-3.5 w-3.5" /> },
  ];

  return (
    <main>
      <StickyScrollLayout hero={heroShell} sections={sections}>
        <StickySection id="overview">
          <SectionHeader title="Overview" subtitle="Live chart and day statistics" />
          <PriceChart
            symbol={meta.slug}
            exchange="NSE"
            historyPath={`/api/indices/${meta.slug}/history`}
          />
          <Suspense fallback={<SectionSkeleton h={140} />}>
            <DayStats slug={meta.slug} name={meta.name} yahooSymbol={meta.yahooSymbol} />
          </Suspense>
        </StickySection>

        <StickySection id="performance">
          <SectionHeader title="Performance" subtitle="Returns across multiple horizons" />
          <Suspense fallback={<SectionSkeleton h={180} />}>
            <IndexReturns slug={meta.slug} />
          </Suspense>
        </StickySection>

        <StickySection id="movers">
          <SectionHeader title="Market movers right now" subtitle="What's driving today's tape" />
          <Suspense fallback={<SectionSkeleton h={300} />}>
            <MoversSection />
          </Suspense>
        </StickySection>

        <StickySection id="news">
          <SectionHeader title="Related news" subtitle="Headlines tagged with this index" />
          <LazyMount minHeight={320}>
            <Suspense fallback={<SectionSkeleton h={300} />}>
              <NewsSection symbol={meta.name} exchange="NSE" limit={6} />
            </Suspense>
          </LazyMount>
        </StickySection>
      </StickyScrollLayout>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Disclaimer className="mt-10" />
      </div>
    </main>
  );
}

function indexBlurb(slug: string): string {
  if (slug === "nifty-50") return "NSE benchmark · 50 largest Indian stocks";
  if (slug === "sensex") return "BSE benchmark · 30 large-cap stocks";
  if (slug === "bank-nifty") return "NSE banking sector benchmark";
  return "Indian market index";
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold">{title}</h2>
      {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
    </div>
  );
}

function SectionSkeleton({ h }: { h: number }) {
  return <div className="shimmer rounded-2xl" style={{ height: h }} />;
}

function HeroPriceSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-9 w-32 shimmer rounded" />
      <div className="h-6 w-24 shimmer rounded" />
      <div className="h-12 w-full shimmer rounded" />
    </div>
  );
}

async function IndexHeroPrice({ slug, name, yahooSymbol }: { slug: string; name: string; yahooSymbol: string }) {
  const q = await getIndex(name, yahooSymbol);
  if (!q) return <p className="text-sm text-muted">Index data temporarily unavailable.</p>;
  const up = q.change >= 0;
  return (
    <div>
      <div className="num-display text-3xl font-extrabold tabular-nums sm:text-4xl">
        {q.lastPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </div>
      <div className={cn(
        "mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ring-1",
        up ? "bg-accent/10 text-accent ring-accent/25" : "bg-danger/10 text-danger ring-danger/25",
      )}>
        {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
        {q.change > 0 ? "+" : ""}{q.change.toFixed(2)} ({formatPct(q.changePct)})
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <MiniStat label="Day Low" value={fmt(q.dayLow)} />
        <MiniStat label="Day High" value={fmt(q.dayHigh)} />
        <MiniStat label="Prev Close" value={fmt(q.previousClose)} />
        <MiniStat label="52W High" value={fmt(q.fiftyTwoWeekHigh)} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-bg/40 px-2 py-1.5 ring-1 ring-border">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 font-semibold text-fg tabular-nums">{value}</div>
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

async function DayStats({ slug, name, yahooSymbol }: { slug: string; name: string; yahooSymbol: string }) {
  const q = await getIndex(name, yahooSymbol);
  if (!q) return null;
  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open / Prev Close" value={fmt(q.previousClose)} />
        <StatCard label="Day High" value={fmt(q.dayHigh)} accent="up" />
        <StatCard label="Day Low" value={fmt(q.dayLow)} accent="down" />
        <StatCard label="Change" value={`${q.change > 0 ? "+" : ""}${q.change.toFixed(2)}`} accent={q.change >= 0 ? "up" : "down"} />
      </div>
      <RangeBar low={q.dayLow} high={q.dayHigh} current={q.lastPrice} label="Day Range" />
      <RangeBar low={q.fiftyTwoWeekLow} high={q.fiftyTwoWeekHigh} current={q.lastPrice} label="52-Week Range" />
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: "up" | "down" }) {
  const color = accent === "up" ? "text-accent" : accent === "down" ? "text-danger" : "text-fg";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={cn("mt-1 text-xl font-bold tabular-nums", color)}>{value}</div>
    </div>
  );
}

const RETURN_PERIODS = [
  { key: "1d",  label: "1D",  range: "5d",  interval: "1d" },
  { key: "1w",  label: "1W",  range: "1mo", interval: "1d", lookback: 7 },
  { key: "1mo", label: "1M",  range: "3mo", interval: "1d", lookback: 30 },
  { key: "3mo", label: "3M",  range: "6mo", interval: "1d", lookback: 90 },
  { key: "1y",  label: "1Y",  range: "2y",  interval: "1wk", lookback: 365 },
  { key: "5y",  label: "5Y",  range: "5y",  interval: "1mo", lookback: 365 * 5 },
] as const;

async function IndexReturns({ slug }: { slug: string }) {
  const meta = findIndexBySlug(slug);
  if (!meta) return null;

  async function pctChange(range: string, interval: string, lookbackDays?: number): Promise<number | null> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(meta!.yahooSymbol)}?interval=${interval}&range=${range}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        next: { revalidate: 3600 },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const r = data.chart?.result?.[0];
      if (!r) return null;
      const closes: (number | null)[] = r.indicators?.quote?.[0]?.close ?? [];
      const ts: number[] = r.timestamp ?? [];
      const last = [...closes].reverse().find((c) => c != null) as number | undefined;
      if (last == null) return null;
      let baseIdx = 0;
      if (lookbackDays) {
        const cutoff = (Date.now() - lookbackDays * 86_400_000) / 1000;
        baseIdx = ts.findIndex((t) => t >= cutoff);
        if (baseIdx < 0) baseIdx = 0;
      }
      const base = closes[baseIdx];
      if (base == null) return null;
      return ((last - base) / base) * 100;
    } catch {
      return null;
    }
  }

  const results = await Promise.all(
    RETURN_PERIODS.map((p) =>
      pctChange(p.range, p.interval, (p as { lookback?: number }).lookback).then((v) => ({ ...p, value: v })),
    ),
  );

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {results.map((r) => {
        const up = (r.value ?? 0) >= 0;
        return (
          <div key={r.key} className="rounded-lg border border-border bg-card p-3 text-center">
            <div className="text-[11px] uppercase tracking-wide text-muted">{r.label}</div>
            <div className={cn(
              "mt-1 text-lg font-bold tabular-nums",
              r.value == null ? "text-muted" : up ? "text-accent" : "text-danger",
            )}>
              {r.value == null ? "—" : `${up ? "+" : ""}${r.value.toFixed(2)}%`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

async function MoversSection() {
  const movers = await getTopMovers(8);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MoversCard title="Top gainers" tone="accent" rows={movers.gainers} />
      <MoversCard title="Top losers" tone="danger" rows={movers.losers} />
    </div>
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
