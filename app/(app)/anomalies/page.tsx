import { Suspense } from "react";
import Link from "next/link";
import { getUniverse, type UniverseRow } from "@/lib/universe";
import { getRecentBlockDeals } from "@/lib/inst-flows";
import type { Deal } from "@/lib/inst-flows";
import { StockGrid } from "@/components/StockGrid";
import { Disclaimer } from "@/components/Disclaimer";
import { InPageSearch } from "@/components/InPageSearch";
import { StickyScrollLayout, StickySection, type StickySection as TS } from "@/components/StickyScrollLayout";
import { LazyMount } from "@/components/LazyMount";
import { LiveDot } from "@/components/anim/LiveDot";
import { formatCompactINR } from "@/lib/utils";
import { Zap, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Calendar, Layers } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export const metadata = {
  title: "Market Anomalies — Volume Spikes & 52W Highs",
  description: "Unusual moves on NSE and BSE today: volume spikes, gap-ups, gap-downs, 52-week highs and lows. Catch market anomalies in real time.",
  alternates: { canonical: "/anomalies" },
  keywords: ["volume spike stocks", "52 week high NSE", "stock anomalies India", "unusual stock activity"],
};

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

function matchAnomaly(r: AnomalyRow, q: string): boolean {
  if (!q) return true;
  const n = q.toLowerCase();
  return (
    r.entry.symbol.toLowerCase().includes(n) ||
    r.entry.name.toLowerCase().includes(n) ||
    (r.entry.sector?.toLowerCase().includes(n) ?? false)
  );
}

function matchDeal(d: Deal, q: string): boolean {
  if (!q) return true;
  const n = q.toLowerCase();
  return (
    d.symbol.toLowerCase().includes(n) ||
    d.client.toLowerCase().includes(n) ||
    d.category.toLowerCase().includes(n)
  );
}

export default function AnomaliesPage(props: { searchParams: Promise<{ q?: string }> }) {
  return (
    <Suspense fallback={<AnomaliesShell />}>
      <AnomaliesInner searchParamsPromise={props.searchParams} />
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

async function AnomaliesInner({ searchParamsPromise }: { searchParamsPromise: Promise<{ q?: string }> }) {
  const [universe, blockDeals, sp] = await Promise.all([
    getUniverse(),
    getRecentBlockDeals(50).catch(() => []),
    searchParamsPromise,
  ]);
  const query = (sp.q ?? "").trim();
  const anomalies = detect(universe);

  const filteredAnomalies = anomalies.filter((r) => matchAnomaly(r, query));
  const filteredDeals = blockDeals.filter((d) => matchDeal(d, query));

  const gapUps = filteredAnomalies.filter((r) => r.kinds.includes("gap-up"));
  const gapDowns = filteredAnomalies.filter((r) => r.kinds.includes("gap-down"));
  const newHighs = filteredAnomalies.filter((r) => r.kinds.includes("new-high"));
  const newLows = filteredAnomalies.filter((r) => r.kinds.includes("new-low"));
  const earnings = filteredAnomalies.filter((r) => r.kinds.includes("earnings-soon"));

  const sections: TS[] = [
    { id: "gap-up", label: "Gap Up", icon: <ArrowUp className="h-3.5 w-3.5" />, badge: gapUps.length },
    { id: "gap-down", label: "Gap Down", icon: <ArrowDown className="h-3.5 w-3.5" />, badge: gapDowns.length },
    { id: "new-high", label: "New 52W Highs", icon: <TrendingUp className="h-3.5 w-3.5" />, badge: newHighs.length },
    { id: "new-low", label: "New 52W Lows", icon: <TrendingDown className="h-3.5 w-3.5" />, badge: newLows.length },
    { id: "earnings", label: "Earnings Soon", icon: <Calendar className="h-3.5 w-3.5" />, badge: earnings.length },
    { id: "block-deals", label: "Block Deals", icon: <Layers className="h-3.5 w-3.5" />, badge: filteredDeals.length },
  ];

  const hero = (
    <>
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-pop float-slow">
          <Zap className="h-5 w-5" />
        </span>
        <h1 className="text-xl font-bold">Anomalies</h1>
        <LiveDot label className="ml-auto" />
      </div>
      <p className="mt-3 text-xs text-muted">Unusual moves and upcoming events across {universe.length} NSE/BSE stocks.</p>
      <div className="mt-4">
        <InPageSearch placeholder="Filter by symbol, name, sector or client…" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Stat label="Flagged" value={filteredAnomalies.length} />
        <Stat label="Gap Ups" value={gapUps.length} tone="accent" />
        <Stat label="Gap Downs" value={gapDowns.length} tone="danger" />
        <Stat label="Block Deals" value={filteredDeals.length} tone="brand" />
      </div>
      {query && (
        <p className="mt-3 text-[11px] text-muted">
          Filtering by <span className="font-semibold text-fg">&ldquo;{query}&rdquo;</span>
        </p>
      )}
    </>
  );

  return (
    <main>
      <StickyScrollLayout hero={hero} sections={sections}>
        <Section id="gap-up" title="Gap Up (>3% intraday)" rows={gapUps} empty={query ? `No gap-ups matching “${query}”.` : "No gap-ups today."} />
        <Section id="gap-down" title="Gap Down (>3% intraday)" rows={gapDowns} empty={query ? `No gap-downs matching “${query}”.` : "No gap-downs today."} />
        <Section id="new-high" title="New 52-Week Highs" rows={newHighs} empty={query ? `No 52W highs matching “${query}”.` : "No new 52-week highs today."} />
        <Section id="new-low" title="New 52-Week Lows" rows={newLows} empty={query ? `No 52W lows matching “${query}”.` : "No new 52-week lows today."} />
        <Section id="earnings" title="Earnings Within 7 Days" rows={earnings} empty={query ? `No upcoming earnings matching “${query}”.` : "No earnings announcements in the next 7 days."} />
        <BlockDealsSection deals={filteredDeals} query={query} />
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

const CAT_TONE: Record<Deal["category"], string> = {
  FII: "bg-brand/15 text-brand ring-brand/30",
  DII: "bg-accent/15 text-accent ring-accent/30",
  OTHER: "bg-bg-2 text-muted ring-border",
};

function BlockDealsSection({ deals, query }: { deals: Deal[]; query: string }) {
  return (
    <StickySection id="block-deals">
      <h2 className="mb-3 text-lg font-semibold">
        Block Deals <span className="ml-1 text-xs text-muted tabular-nums">({deals.length})</span>
      </h2>
      {deals.length === 0 ? (
        <p className="text-sm text-muted">
          {query ? `No block deals matching “${query}”.` : "No block deals reported in the most recent NSE archive."}
        </p>
      ) : (
        <div className="surface overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-bg/40 text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Symbol</th>
                  <th className="px-3 py-2.5">Client</th>
                  <th className="px-3 py-2.5">Side</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5 text-right">Price</th>
                  <th className="px-3 py-2.5 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d, i) => (
                  <tr key={`${d.date}-${d.symbol}-${d.client}-${d.side}-${i}`} className="border-b border-border last:border-0 hover:bg-bg/40">
                    <td className="px-3 py-2 text-xs text-muted tabular-nums">{d.date}</td>
                    <td className="px-3 py-2">
                      <Link href={`/stock/${d.symbol}`} className="font-semibold text-fg hover:text-brand">
                        {d.symbol}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[280px] text-xs text-fg">{d.client}</span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${CAT_TONE[d.category]}`}>
                          {d.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        d.side === "BUY" ? "bg-accent/15 text-accent" : "bg-danger/15 text-danger"
                      }`}>
                        {d.side}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{d.qty.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{d.price.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">{formatCompactINR(d.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
