import Link from "next/link";
import { Suspense } from "react";
import { getSectorPerformance } from "@/lib/sectors";
import { PageFooter } from "@/components/PageFooter";
import { cn, formatCompactINR, formatPct } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Layers, TrendingUp, TrendingDown, Sparkles, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export const metadata = {
  title: "Sector Heatmap — NSE Industry Performance",
  description: "Live sector performance across the Indian market — IT, Banks, Pharma, Auto, FMCG, Energy and more. Heatmap view.",
  alternates: { canonical: "/sectors" },
  keywords: ["NSE sector performance", "Indian market sectors", "sector heatmap India"],
};

export default function SectorsPage() {
  return (
    <AppShell>
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-hairline-strong bg-card/40 p-4 shadow-e4 sm:p-6 md:p-8 lg:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="chip chip--brand mb-3">
              <Layers className="h-3 w-3" />
              Sector momentum · live
            </div>
            <h1 className="num-display text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
              Sector <span className="text-gradient-animate">Spotlights</span>
            </h1>
            <p className="mt-3 t-caption t-muted sm:text-sm md:text-base">
              Live performance across NSE sectors — where is the money flowing today?
            </p>
          </div>
          <Suspense fallback={<HeroStatsSkeleton />}>
            <HeroStats />
          </Suspense>
        </div>
      </section>

      <Suspense fallback={<SectorsGridSkeleton />}>
        <SectorsGrid />
      </Suspense>

      <PageFooter kind="market" />
    </AppShell>
  );
}

async function HeroStats() {
  const sectors = await getSectorPerformance();
  const upCount = sectors.filter((s) => s.avgChangePct >= 0).length;
  return (
    <div className="flex gap-3">
      <Stat label="Up" value={upCount} tone="accent" />
      <Stat label="Down" value={sectors.length - upCount} tone="danger" />
    </div>
  );
}

function HeroStatsSkeleton() {
  return (
    <div className="flex gap-3">
      <SectionSkeleton h={70} w={90} />
      <SectionSkeleton h={70} w={90} />
    </div>
  );
}

async function SectorsGrid() {
  const sectors = await getSectorPerformance();
  return (
    <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sectors.map((s, i) => {
        const up = s.avgChangePct >= 0;
        return (
          <Link
            key={s.sector}
            href={`/sectors/${encodeURIComponent(s.sector)}`}
            className={cn(
              "group surface relative overflow-hidden p-5 fade-up",
              `fade-up-${(i % 4) + 1}`,
            )}
          >
            <div className="bar-accent" data-tone={up ? "positive" : "negative"} />
            <div className="shine" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-md ring-1 shadow-e2",
                      up ? "bg-accent/15 text-accent ring-accent/30" : "bg-danger/15 text-danger ring-danger/30",
                    )}>
                      {up ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    </span>
                    <div>
                      <div className="text-lg font-bold tracking-tight">{s.sector}</div>
                      <div className="t-caption t-muted">{s.count} stocks · {formatCompactINR(s.totalMarketCap)}</div>
                    </div>
                  </div>
                </div>
                <span className={cn(
                  "inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-semibold t-num ring-1",
                  up ? "bg-accent/10 text-accent ring-accent/25" : "bg-danger/10 text-danger ring-danger/25",
                )}>
                  {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {formatPct(s.avgChangePct)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                {s.topGainer && (
                  <div className="rounded-lg border border-hairline/60 bg-bg/40 p-2.5">
                    <div className="t-label">Top gainer</div>
                    <div className="mt-0.5 font-semibold">{s.topGainer.entry.symbol}</div>
                    <div className="num-display text-accent t-num">
                      {formatPct(s.topGainer.quote?.changePct ?? 0)}
                    </div>
                  </div>
                )}
                {s.topLoser && (
                  <div className="rounded-lg border border-hairline/60 bg-bg/40 p-2.5">
                    <div className="t-label">Top loser</div>
                    <div className="mt-0.5 font-semibold">{s.topLoser.entry.symbol}</div>
                    <div className="num-display text-danger t-num">
                      {formatPct(s.topLoser.quote?.changePct ?? 0)}
                    </div>
                  </div>
                )}
              </div>

              {s.avgScore != null && (
                <div className="mt-3">
                  <div className="flex items-center justify-between t-label">
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-brand" />
                      Avg Score
                    </span>
                    <span className="num-display font-bold t-num text-fg">{s.avgScore.toFixed(0)}<span className="t-muted">/100</span></span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-2 ring-1 ring-hairline">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand via-brand-2 to-accent transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, s.avgScore))}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-1 t-caption font-semibold t-muted transition-colors duration-fast ease-out group-hover:text-brand">
                Open sector <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </Link>
        );
      })}
    </section>
  );
}

function SectorsGridSkeleton() {
  return (
    <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <SectionSkeleton key={i} h={180} />
      ))}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "accent" | "danger" }) {
  const color = tone === "accent" ? "text-accent" : tone === "danger" ? "text-danger" : "text-fg";
  return (
    <div className="rounded-md border border-hairline bg-card/60 px-4 py-2 backdrop-blur">
      <div className="t-label">{label}</div>
      <div className={cn("num-display text-2xl font-bold t-num", color)}>{value}</div>
    </div>
  );
}

function SectionSkeleton({ h = 256, w }: { h?: number; w?: number }) {
  return <div className="shimmer rounded-2xl" style={{ height: h, width: w }} />;
}
