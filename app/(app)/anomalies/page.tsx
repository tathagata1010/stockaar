import { Suspense } from "react";
import { getUniverse, type UniverseRow } from "@/lib/universe";
import { StockGrid } from "@/components/StockGrid";
import { Disclaimer } from "@/components/Disclaimer";
import { StickyScrollLayout, StickySection, type StickySection as TS } from "@/components/StickyScrollLayout";
import { LazyMount } from "@/components/LazyMount";
import { Zap, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Calendar } from "lucide-react";

export const revalidate = 300;

type AnomalyKind = "gap-up" | "gap-down" | "new-high" | "new-low" | "earnings-soon";
type AnomalyRow = UniverseRow & { kinds: AnomalyKind[] };

function detect(rows: UniverseRow[]): AnomalyRow[] {
  const out: AnomalyRow[] = [];
  for (const r of rows) {
    const kinds: AnomalyKind[] = [];
    if (r.quote && r.quote.changePct > 3) kinds.push("gap-up");
    if (r.quote && r.quote.changePct < -3) kinds.push("gap-down");
    if (r.rangePosition !== null && r.rangePosition > 95) kinds.push("new-high");
    if (r.rangePosition !== null && r.rangePosition < 5) kinds.push("new-low");
    if (r.fundamentals?.earningsDate) {
      const days = (r.fundamentals.earningsDate - Date.now()) / (1000 * 60 * 60 * 24);
      if (days >= -1 && days <= 7) kinds.push("earnings-soon");
    }
    if (kinds.length > 0) out.push({ ...r, kinds });
  }
  return out;
}

export default function AnomaliesPage() {
  return (
    <Suspense fallback={<AnomaliesShell />}>
      <AnomaliesInner />
    </Suspense>
  );
}

function AnomaliesShell() {
  return (
    <main className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="h-64 shimmer rounded-2xl" />
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-72 shimmer rounded-2xl" />
        ))}
      </div>
    </main>
  );
}

async function AnomaliesInner() {
  const universe = await getUniverse();
  const anomalies = detect(universe);

  const gapUps = anomalies.filter((r) => r.kinds.includes("gap-up"));
  const gapDowns = anomalies.filter((r) => r.kinds.includes("gap-down"));
  const newHighs = anomalies.filter((r) => r.kinds.includes("new-high"));
  const newLows = anomalies.filter((r) => r.kinds.includes("new-low"));
  const earnings = anomalies.filter((r) => r.kinds.includes("earnings-soon"));

  const sections: TS[] = [
    { id: "gap-up", label: "Gap Up", icon: <ArrowUp className="h-3.5 w-3.5" />, badge: gapUps.length },
    { id: "gap-down", label: "Gap Down", icon: <ArrowDown className="h-3.5 w-3.5" />, badge: gapDowns.length },
    { id: "new-high", label: "New 52W Highs", icon: <TrendingUp className="h-3.5 w-3.5" />, badge: newHighs.length },
    { id: "new-low", label: "New 52W Lows", icon: <TrendingDown className="h-3.5 w-3.5" />, badge: newLows.length },
    { id: "earnings", label: "Earnings Soon", icon: <Calendar className="h-3.5 w-3.5" />, badge: earnings.length },
  ];

  const hero = (
    <>
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-pop float-slow">
          <Zap className="h-5 w-5" />
        </span>
        <h1 className="text-xl font-bold">Anomalies</h1>
      </div>
      <p className="mt-3 text-xs text-muted">Unusual moves and upcoming events across {universe.length} NSE/BSE stocks.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Stat label="Flagged" value={anomalies.length} />
        <Stat label="Gap Ups" value={gapUps.length} tone="accent" />
        <Stat label="Gap Downs" value={gapDowns.length} tone="danger" />
        <Stat label="Earnings" value={earnings.length} tone="brand" />
      </div>
    </>
  );

  return (
    <main>
      <StickyScrollLayout hero={hero} sections={sections}>
        <Section id="gap-up" title="Gap Up (>3% intraday)" rows={gapUps} empty="No gap-ups today." />
        <Section id="gap-down" title="Gap Down (>3% intraday)" rows={gapDowns} empty="No gap-downs today." />
        <Section id="new-high" title="New 52-Week Highs" rows={newHighs} empty="No new 52-week highs today." />
        <Section id="new-low" title="New 52-Week Lows" rows={newLows} empty="No new 52-week lows today." />
        <Section id="earnings" title="Earnings Within 7 Days" rows={earnings} empty="No earnings announcements in the next 7 days." />
      </StickyScrollLayout>
      <Disclaimer className="mt-10" />
    </main>
  );
}

function Section({ id, title, rows, empty }: { id: string; title: string; rows: AnomalyRow[]; empty: string }) {
  return (
    <StickySection id={id}>
      <h2 className="mb-3 text-lg font-semibold">{title} <span className="ml-1 text-xs text-muted tabular-nums">({rows.length})</span></h2>
      <LazyMount minHeight={300}>
        <StockGrid rows={rows} emptyText={empty} />
      </LazyMount>
    </StickySection>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "accent" | "danger" | "brand" }) {
  const color = tone === "accent" ? "text-accent" : tone === "danger" ? "text-danger" : tone === "brand" ? "text-brand" : "text-fg";
  return (
    <div className="rounded-lg border border-border bg-card/60 p-2.5">
      <div className="text-[10px] uppercase text-muted">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
