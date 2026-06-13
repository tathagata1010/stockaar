import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getSector } from "@/lib/sectors";
import { ALL_SECTORS, type Sector } from "@/lib/nse-symbols";
import { StockTable } from "@/components/StockTable";
import { Disclaimer } from "@/components/Disclaimer";
import { cn, formatCompactINR, formatPct } from "@/lib/utils";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function generateStaticParams() {
  return ALL_SECTORS.map((s) => ({ sector: s }));
}

export default async function SectorDetailPage(
  props: {
    params: Promise<{ sector: string }>;
  }
) {
  const params = await props.params;
  const decoded = decodeURIComponent(params.sector) as Sector;
  if (!ALL_SECTORS.includes(decoded)) notFound();

  return (
    <main>
      <Link href="/sectors" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-brand">
        <ArrowLeft className="h-3.5 w-3.5" />
        All sectors
      </Link>

      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-6 shadow-glow md:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="chip chip-brand mb-3">Sector deep-dive · live</div>
            <h1 className="num-display text-4xl font-bold tracking-tight md:text-5xl">
              {decoded} <span className="text-gradient-animate">Sector</span>
            </h1>
            <Suspense fallback={<div className="mt-3 h-4 w-64 shimmer rounded" />}>
              <HeroSubtitle sector={decoded} />
            </Suspense>
          </div>
          <Suspense fallback={<HeroStatsSkeleton />}>
            <HeroStats sector={decoded} />
          </Suspense>
        </div>

        <Suspense fallback={<div className="mt-5 grid gap-3 sm:grid-cols-2"><SectionSkeleton h={80} /><SectionSkeleton h={80} /></div>}>
          <HeroPicks sector={decoded} />
        </Suspense>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">All {decoded} stocks</h2>
        <Suspense fallback={<SectionSkeleton h={400} />}>
          <SectorTable sector={decoded} />
        </Suspense>
      </section>

      <Disclaimer className="mt-10" />
    </main>
  );
}

async function HeroSubtitle({ sector }: { sector: Sector }) {
  const data = await getSector(sector);
  if (!data) return null;
  return (
    <p className="mt-3 text-sm text-muted md:text-base">
      {formatCompactINR(data.totalMarketCap)} total market cap · {data.count} listed stocks
    </p>
  );
}

async function HeroStats({ sector }: { sector: Sector }) {
  const data = await getSector(sector);
  if (!data) return null;
  const up = data.avgChangePct >= 0;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat
        label="Avg % Chg"
        value={formatPct(data.avgChangePct)}
        icon={up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        tone={up ? "accent" : "danger"}
      />
      <Stat
        label="Avg Score"
        value={data.avgScore != null ? `${data.avgScore.toFixed(0)}/100` : "—"}
        icon={<span className="text-xs font-bold">S</span>}
        tone="brand"
      />
    </div>
  );
}

function HeroStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <SectionSkeleton h={68} w={140} />
      <SectionSkeleton h={68} w={140} />
    </div>
  );
}

async function HeroPicks({ sector }: { sector: Sector }) {
  const data = await getSector(sector);
  if (!data) return null;
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {data.topGainer && <Pick label="Top Gainer" row={data.topGainer} positive />}
      {data.topLoser && <Pick label="Top Loser" row={data.topLoser} />}
    </div>
  );
}

async function SectorTable({ sector }: { sector: Sector }) {
  const data = await getSector(sector);
  if (!data) notFound();
  return <StockTable rows={data.rows} showScore showSignal />;
}

function Stat({ label, value, icon, tone }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "accent" | "danger" | "brand";
}) {
  const color = tone === "accent" ? "bg-accent/15 text-accent ring-accent/30"
    : tone === "danger" ? "bg-danger/15 text-danger ring-danger/30"
    : "bg-brand/15 text-brand ring-brand/30";
  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg ring-1", color)}>{icon}</span>
        <div>
          <div className="text-[10px] uppercase text-muted">{label}</div>
          <div className="num-display text-lg font-bold tabular-nums">{value}</div>
        </div>
      </div>
    </div>
  );
}

function Pick({ label, row, positive = false }: { label: string; row: NonNullable<Awaited<ReturnType<typeof getSector>>>["topGainer"]; positive?: boolean }) {
  if (!row) return null;
  const chg = row.quote?.changePct ?? 0;
  return (
    <Link
      href={`/stock/${row.entry.symbol}`}
      className="surface flex items-center justify-between rounded-2xl p-3 hover-lift"
    >
      <div className="min-w-0">
        <div className="text-[10px] uppercase text-muted">{label}</div>
        <div className="mt-0.5 font-semibold">{row.entry.symbol}</div>
        <div className="text-xs text-muted line-clamp-1">{row.entry.name}</div>
      </div>
      <span className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ring-1",
        positive ? "bg-accent/10 text-accent ring-accent/25" : "bg-danger/10 text-danger ring-danger/25",
      )}>
        {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {formatPct(chg)}
      </span>
    </Link>
  );
}

function SectionSkeleton({ h = 256, w }: { h?: number; w?: number }) {
  return <div className="shimmer rounded-2xl" style={{ height: h, width: w }} />;
}
