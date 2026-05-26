import { Suspense } from "react";
import { getUniverse } from "@/lib/universe";
import { StockGrid } from "@/components/StockGrid";
import { Disclaimer } from "@/components/Disclaimer";
import { StickyScrollLayout, StickySection, type StickySection as TS } from "@/components/StickyScrollLayout";
import { LazyMount } from "@/components/LazyMount";
import { Flame, TrendingUp, TrendingDown, Target, Trophy, Award, Sparkles } from "lucide-react";

export const revalidate = 300;

export default function HotStocksPage() {
  return (
    <Suspense fallback={<HotShell loading />}>
      <HotInner />
    </Suspense>
  );
}

async function HotInner() {
  const universe = await getUniverse();

  const topGainers = [...universe]
    .filter((r) => r.quote)
    .sort((a, b) => b.quote!.changePct - a.quote!.changePct)
    .slice(0, 20);

  const topLosers = [...universe]
    .filter((r) => r.quote)
    .sort((a, b) => a.quote!.changePct - b.quote!.changePct)
    .slice(0, 20);

  const nearHigh = universe
    .filter((r) => r.rangePosition !== null && r.rangePosition > 85)
    .sort((a, b) => (b.rangePosition ?? 0) - (a.rangePosition ?? 0))
    .slice(0, 20);

  const nearLow = universe
    .filter((r) => r.rangePosition !== null && r.rangePosition < 15)
    .sort((a, b) => (a.rangePosition ?? 0) - (b.rangePosition ?? 0))
    .slice(0, 20);

  const highScores = universe
    .filter((r) => r.scorecard)
    .sort((a, b) => b.scorecard!.composite - a.scorecard!.composite)
    .slice(0, 20);

  const sections: TS[] = [
    { id: "gainers", label: "Top Movers ↑", icon: <TrendingUp className="h-3.5 w-3.5" />, badge: topGainers.length },
    { id: "losers", label: "Top Movers ↓", icon: <TrendingDown className="h-3.5 w-3.5" />, badge: topLosers.length },
    { id: "near-high", label: "Near 52W High", icon: <Target className="h-3.5 w-3.5" />, badge: nearHigh.length },
    { id: "near-low", label: "Near 52W Low", icon: <Target className="h-3.5 w-3.5" />, badge: nearLow.length },
    { id: "scores", label: "Top Scorecard", icon: <Trophy className="h-3.5 w-3.5" />, badge: highScores.length },
  ];

  const hero = (
    <>
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-pop float-slow">
          <Flame className="h-5 w-5" />
        </span>
        <h1 className="text-xl font-bold">Hot Stocks</h1>
      </div>
      <p className="mt-3 text-xs text-muted">
        Trending NSE/BSE picks computed from momentum, range position and composite score.
      </p>
      <div className="mt-4 rounded-xl border border-border bg-card/60 p-3 text-xs">
        <div className="flex items-center gap-1.5 font-semibold"><Sparkles className="h-3 w-3 text-brand" /> Universe</div>
        <div className="mt-1 text-muted">{universe.length} stocks scanned</div>
      </div>
      <div className="mt-2 rounded-xl border border-border bg-card/60 p-3 text-xs">
        <div className="font-semibold flex items-center gap-1.5"><Award className="h-3 w-3 text-accent" /> Avg Score</div>
        <div className="mt-1 text-muted tabular-nums">
          {(universe.filter(u => u.scorecard).reduce((a, r) => a + r.scorecard!.composite, 0) /
            Math.max(1, universe.filter(u => u.scorecard).length)).toFixed(0)} / 100
        </div>
      </div>
    </>
  );

  return (
    <main>
      <StickyScrollLayout hero={hero} sections={sections}>
        <StickySection id="gainers">
          <SH title="Top Movers (Up)" icon={<TrendingUp className="h-4 w-4 text-accent" />} />
          <LazyMount minHeight={400}><StockGrid rows={topGainers} /></LazyMount>
        </StickySection>
        <StickySection id="losers">
          <SH title="Top Movers (Down)" icon={<TrendingDown className="h-4 w-4 text-danger" />} />
          <LazyMount minHeight={400}><StockGrid rows={topLosers} /></LazyMount>
        </StickySection>
        <StickySection id="near-high">
          <SH title="Near 52-Week High" icon={<Target className="h-4 w-4 text-accent" />} />
          <LazyMount minHeight={400}><StockGrid rows={nearHigh} emptyText="No stocks near 52W high right now." /></LazyMount>
        </StickySection>
        <StickySection id="near-low">
          <SH title="Near 52-Week Low" icon={<Target className="h-4 w-4 text-danger" />} />
          <LazyMount minHeight={400}><StockGrid rows={nearLow} emptyText="No stocks near 52W low right now." /></LazyMount>
        </StickySection>
        <StickySection id="scores">
          <SH title="Top Scorecard" icon={<Trophy className="h-4 w-4 text-brand" />} />
          <LazyMount minHeight={400}><StockGrid rows={highScores} showSignal /></LazyMount>
        </StickySection>
      </StickyScrollLayout>
      <Disclaimer className="mt-10" />
    </main>
  );
}

function SH({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-card border border-border">{icon}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}

function HotShell({ loading }: { loading?: boolean }) {
  return (
    <main className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="h-64 shimmer rounded-2xl" />
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-72 shimmer rounded-2xl" />
        ))}
      </div>
      {loading && <span className="sr-only">Loading…</span>}
    </main>
  );
}
