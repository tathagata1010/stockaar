import { Suspense } from "react";
import { getUniverse, type UniverseRow } from "@/lib/universe";
import { getInstFlows, type FlowAgg } from "@/lib/inst-flows";
import { Disclaimer } from "@/components/Disclaimer";
import { ScreenerResults } from "@/components/ScreenerResults";
import { ScreenerControls } from "@/components/ScreenerControls";
import { allIndustries, type Sector } from "@/lib/nse-symbols";
import { Sparkles, Crosshair } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";

export const revalidate = 300;

export const metadata = {
  title: "Stock Screener — Filter NSE & BSE Stocks",
  description: "Free Indian stock screener: filter by P/E, market cap, dividend yield, sector, RSI, and 200+ stocks across NSE and BSE.",
  alternates: { canonical: "/screener" },
  keywords: ["stock screener India", "NSE screener", "BSE screener", "screen stocks India", "PE filter stocks"],
};

type SP = Record<string, string | undefined>;

function num(v?: string): number | undefined {
  if (!v || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const CAP_BUCKETS: { value: string; label: string; min: number; max?: number }[] = [
  { value: "all",   label: "All caps",                 min: 0 },
  { value: "mega",  label: "Mega (>₹2 lakh Cr)",       min: 200_000 * 1e7 },
  { value: "large", label: "Large (₹50K–2L Cr)",       min: 50_000  * 1e7, max: 200_000 * 1e7 },
  { value: "mid",   label: "Mid (₹10K–50K Cr)",        min: 10_000  * 1e7, max: 50_000  * 1e7 },
  { value: "small", label: "Small (<₹10K Cr)",         min: 0,             max: 10_000  * 1e7 },
];

export default function ScreenerPage({ searchParams }: { searchParams: SP }) {
  const industries = allIndustries();
  const sector = (searchParams.sector ?? "all") as Sector | "all";
  const industry = searchParams.industry ?? "all";
  const signal = searchParams.signal ?? "all";
  const capBucket = CAP_BUCKETS.find((b) => b.value === (searchParams.cap ?? "all")) ?? CAP_BUCKETS[0];
  const sort = (searchParams.sort ?? "score") as SortKey;
  const dir = (searchParams.dir ?? "desc") as "asc" | "desc";

  return (
    <AppShell>
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-4 shadow-glow sm:p-6 md:p-8 lg:p-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="chip chip-brand mb-3">
              <Crosshair className="h-3 w-3" />
              Live scan · {industries.length}+ industries
            </div>
            <h1 className="num-display text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
              Smart <span className="text-gradient-animate">Screener</span>
            </h1>
            <p className="mt-3 max-w-xl text-xs text-muted sm:text-sm md:text-base">
              Drag the sliders. Click a preset. Watch hundreds of NSE/BSE stocks narrow down to your edge in real time.
            </p>
          </div>
          <Suspense fallback={<MatchCountSkeleton />}>
            <MatchCount
              searchParams={searchParams}
              sector={sector}
              industry={industry}
              signal={signal}
              capBucket={capBucket}
            />
          </Suspense>
        </div>
      </section>

      <ScreenerControls industries={industries} searchParams={searchParams}>
        <Suspense fallback={<div className="h-[60vh] shimmer rounded-2xl" />}>
          <ScreenerData
            searchParams={searchParams}
            sector={sector}
            industry={industry}
            signal={signal}
            capBucket={capBucket}
            sort={sort}
            dir={dir}
          />
        </Suspense>
      </ScreenerControls>

      <Disclaimer className="mt-10" />
    </AppShell>
  );
}

type FilterCtx = {
  searchParams: SP;
  sector: Sector | "all";
  industry: string;
  signal: string;
  capBucket: (typeof CAP_BUCKETS)[number];
  flows: Record<string, FlowAgg>;
};

// Sliders express ₹ Cr; convert to raw rupees for comparison (1 Cr = 1e7).
const CR = 1e7;

function filterUniverse(universe: UniverseRow[], ctx: FilterCtx): UniverseRow[] {
  const { sector, industry, signal, capBucket, searchParams, flows } = ctx;
  const f = {
    peMin: num(searchParams.peMin), peMax: num(searchParams.peMax),
    pbMax: num(searchParams.pbMax), divMin: num(searchParams.divMin),
    betaMax: num(searchParams.betaMax), roeMin: num(searchParams.roeMin),
    roaMin: num(searchParams.roaMin), pmMin: num(searchParams.pmMin),
    deMax: num(searchParams.deMax), revGrowMin: num(searchParams.revGrowMin),
    earnGrowMin: num(searchParams.earnGrowMin), chgMin: num(searchParams.chgMin),
    chgMax: num(searchParams.chgMax), posMin: num(searchParams.posMin),
    posMax: num(searchParams.posMax), scoreMin: num(searchParams.scoreMin),
    valMin: num(searchParams.valMin), grwMin: num(searchParams.grwMin),
    qulMin: num(searchParams.qulMin), momMin: num(searchParams.momMin),
    fiiNetMin: num(searchParams.fiiNetMin), diiNetMin: num(searchParams.diiNetMin),
    instNetMin: num(searchParams.instNetMin),
  };
  return universe.filter((r) => {
    if (sector !== "all" && r.entry.sector !== sector) return false;
    if (industry !== "all" && r.entry.industry !== industry) return false;
    if (signal !== "all" && r.signal !== signal) return false;
    const fu = r.fundamentals; const q = r.quote; const sc = r.scorecard;
    if (capBucket.value !== "all") {
      const mc = fu?.marketCap ?? 0;
      if (mc < capBucket.min) return false;
      if (capBucket.max !== undefined && mc >= capBucket.max) return false;
    }
    if (f.peMin !== undefined && (!fu?.trailingPE || fu.trailingPE < f.peMin)) return false;
    if (f.peMax !== undefined && (!fu?.trailingPE || fu.trailingPE > f.peMax)) return false;
    if (f.pbMax !== undefined && (!fu?.priceToBook || fu.priceToBook > f.pbMax)) return false;
    if (f.divMin !== undefined && ((fu?.dividendYield ?? 0) * 100) < f.divMin) return false;
    if (f.betaMax !== undefined && (fu?.beta ?? 99) > f.betaMax) return false;
    if (f.roeMin !== undefined && ((fu?.returnOnEquity ?? -1) * 100) < f.roeMin) return false;
    if (f.roaMin !== undefined && ((fu?.returnOnAssets ?? -1) * 100) < f.roaMin) return false;
    if (f.pmMin !== undefined && ((fu?.profitMargin ?? -1) * 100) < f.pmMin) return false;
    if (f.deMax !== undefined && (fu?.debtToEquity ?? 999) > f.deMax) return false;
    if (f.revGrowMin !== undefined && ((fu?.revenueGrowth ?? -1) * 100) < f.revGrowMin) return false;
    if (f.earnGrowMin !== undefined && ((fu?.earningsGrowth ?? -1) * 100) < f.earnGrowMin) return false;
    if (f.chgMin !== undefined && (q?.changePct ?? -999) < f.chgMin) return false;
    if (f.chgMax !== undefined && (q?.changePct ?? 999) > f.chgMax) return false;
    if (f.posMin !== undefined && (r.rangePosition ?? -1) < f.posMin) return false;
    if (f.posMax !== undefined && (r.rangePosition ?? 101) > f.posMax) return false;
    if (f.scoreMin !== undefined && (sc?.composite ?? -1) < f.scoreMin) return false;
    if (f.valMin !== undefined && (sc?.pillars.valuation.score ?? -1) < f.valMin) return false;
    if (f.grwMin !== undefined && (sc?.pillars.growth.score ?? -1) < f.grwMin) return false;
    if (f.qulMin !== undefined && (sc?.pillars.quality.score ?? -1) < f.qulMin) return false;
    if (f.momMin !== undefined && (sc?.pillars.momentum.score ?? -1) < f.momMin) return false;
    if (f.fiiNetMin !== undefined || f.diiNetMin !== undefined || f.instNetMin !== undefined) {
      const fl = flows[r.entry.symbol];
      if (!fl) return false;
      if (f.fiiNetMin !== undefined && fl.fiiNet < f.fiiNetMin * CR) return false;
      if (f.diiNetMin !== undefined && fl.diiNet < f.diiNetMin * CR) return false;
      if (f.instNetMin !== undefined && fl.instNet < f.instNetMin * CR) return false;
    }
    return true;
  });
}

async function MatchCount(ctx: Omit<FilterCtx, "flows">) {
  const [universe, flows] = await Promise.all([getUniverse(), getInstFlows()]);
  const matches = filterUniverse(universe, { ...ctx, flows: flows?.bySymbol ?? {} });
  const pct = universe.length ? (matches.length / universe.length) * 100 : 0;
  const tone =
    matches.length === 0 ? "from-danger via-danger/70 to-warning"
    : pct < 5 ? "from-warning via-accent/70 to-accent"
    : "from-brand via-brand-2 to-accent";
  return (
    <div className="surface relative overflow-hidden px-5 py-3.5">
      <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${tone}`} />
      <div className="relative flex items-baseline gap-3">
        <Sparkles className="h-4 w-4 text-brand" />
        <div className="flex items-baseline gap-2">
          <span className="num-display text-4xl font-bold tabular-nums text-gradient-static">{matches.length}</span>
          <span className="text-xs text-muted">/ {universe.length} pass</span>
        </div>
      </div>
      <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-bg-2">
        <div className={`h-full rounded-full bg-gradient-to-r ${tone} transition-all`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

function MatchCountSkeleton() {
  return <div className="h-[78px] w-[220px] shimmer rounded-2xl" />;
}

async function ScreenerData(ctx: Omit<FilterCtx, "flows"> & { sort: SortKey; dir: "asc" | "desc" }) {
  const [universe, flows] = await Promise.all([getUniverse(), getInstFlows()]);
  const flowMap = flows?.bySymbol ?? {};
  const results = filterUniverse(universe, { ...ctx, flows: flowMap });
  const sorted = sortRows(results, ctx.sort, ctx.dir, flowMap);
  return <ScreenerResults rows={sorted} sort={ctx.sort} dir={ctx.dir} searchParams={ctx.searchParams} />;
}

export type SortKey =
  | "symbol" | "price" | "change" | "marketCap" | "pe" | "pb" | "divY"
  | "roe" | "pm" | "revGrow" | "earnGrow" | "pos" | "score"
  | "valuation" | "growth" | "quality" | "momentum"
  | "fiiNet" | "diiNet" | "instNet";

function sortRows(rows: UniverseRow[], key: SortKey, dir: "asc" | "desc", flows: Record<string, FlowAgg>): UniverseRow[] {
  const mult = dir === "asc" ? 1 : -1;
  const get = (r: UniverseRow): number | string => {
    switch (key) {
      case "symbol": return r.entry.symbol;
      case "price": return r.quote?.lastPrice ?? -Infinity;
      case "change": return r.quote?.changePct ?? -Infinity;
      case "marketCap": return r.fundamentals?.marketCap ?? -Infinity;
      case "pe": return r.fundamentals?.trailingPE ?? Infinity;
      case "pb": return r.fundamentals?.priceToBook ?? Infinity;
      case "divY": return r.fundamentals?.dividendYield ?? -Infinity;
      case "roe": return r.fundamentals?.returnOnEquity ?? -Infinity;
      case "pm": return r.fundamentals?.profitMargin ?? -Infinity;
      case "revGrow": return r.fundamentals?.revenueGrowth ?? -Infinity;
      case "earnGrow": return r.fundamentals?.earningsGrowth ?? -Infinity;
      case "pos": return r.rangePosition ?? -Infinity;
      case "score": return r.scorecard?.composite ?? -Infinity;
      case "valuation": return r.scorecard?.pillars.valuation.score ?? -Infinity;
      case "growth": return r.scorecard?.pillars.growth.score ?? -Infinity;
      case "quality": return r.scorecard?.pillars.quality.score ?? -Infinity;
      case "momentum": return r.scorecard?.pillars.momentum.score ?? -Infinity;
      case "fiiNet": return flows[r.entry.symbol]?.fiiNet ?? -Infinity;
      case "diiNet": return flows[r.entry.symbol]?.diiNet ?? -Infinity;
      case "instNet": return flows[r.entry.symbol]?.instNet ?? -Infinity;
    }
  };
  return [...rows].sort((a, b) => {
    const av = get(a), bv = get(b);
    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * mult;
    return ((av as number) - (bv as number)) * mult;
  });
}
