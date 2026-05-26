import Link from "next/link";
import { Suspense } from "react";
import { getUniverse, type UniverseRow } from "@/lib/universe";
import { getIpos } from "@/lib/ipo-calendar";
import { StickyScrollLayout, StickySection, type StickySection as TS } from "@/components/StickyScrollLayout";
import { Disclaimer } from "@/components/Disclaimer";
import { StockLogo } from "@/components/StockLogo";
import { cn } from "@/lib/utils";
import { Calendar, Rocket, Clock } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";

export const revalidate = 600;

type EarningsRow = UniverseRow & { earningsDate: number };

function startOfWeekIST(d: Date): Date {
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  ist.setUTCHours(0, 0, 0, 0);
  const dow = ist.getUTCDay();
  const back = (dow + 6) % 7;
  ist.setUTCDate(ist.getUTCDate() - back);
  return new Date(ist.getTime() - 5.5 * 60 * 60 * 1000);
}

function daysUntil(ts: number): number {
  return Math.round((ts - Date.now()) / (24 * 60 * 60 * 1000));
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateStr(s: string): string {
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

type Window = "this-week" | "next-week" | "later";

function bucket(earningsAll: EarningsRow[]) {
  const nowDate = new Date();
  const thisWeekStart = startOfWeekIST(nowDate);
  const nextWeekStart = new Date(thisWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekAfter = new Date(thisWeekStart.getTime() + 14 * 24 * 60 * 60 * 1000);
  return {
    thisWeek: earningsAll.filter((r) => r.earningsDate >= thisWeekStart.getTime() && r.earningsDate < nextWeekStart.getTime()),
    nextWeek: earningsAll.filter((r) => r.earningsDate >= nextWeekStart.getTime() && r.earningsDate < weekAfter.getTime()),
    later: earningsAll.filter((r) => r.earningsDate >= weekAfter.getTime()),
  };
}

async function getEarnings(): Promise<EarningsRow[]> {
  const universe = await getUniverse();
  return universe
    .filter((r): r is EarningsRow => !!r.fundamentals?.earningsDate)
    .map((r) => ({ ...r, earningsDate: r.fundamentals!.earningsDate! }))
    .filter((r) => r.earningsDate > Date.now() - 24 * 60 * 60 * 1000)
    .sort((a, b) => a.earningsDate - b.earningsDate);
}

export default function CalendarPage() {
  const sections: TS[] = [
    { id: "this-week", label: "This week", icon: <Calendar className="h-3.5 w-3.5" /> },
    { id: "next-week", label: "Next week", icon: <Calendar className="h-3.5 w-3.5" /> },
    { id: "later", label: "Later", icon: <Clock className="h-3.5 w-3.5" /> },
    { id: "ipos", label: "Upcoming IPOs", icon: <Rocket className="h-3.5 w-3.5" /> },
  ];

  const hero = (
    <>
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-pop float-slow">
          <Calendar className="h-5 w-5" />
        </span>
        <h1 className="text-xl font-bold">Calendar</h1>
      </div>
      <p className="mt-3 text-xs text-muted">Upcoming earnings & IPOs across NSE/BSE — live from NSE.</p>
      <div className="mt-4">
        <Suspense fallback={<HeroStatsSkeleton />}>
          <HeroStats />
        </Suspense>
      </div>
    </>
  );

  return (
    <AppShell>
      <StickyScrollLayout hero={hero} sections={sections}>
        <StickySection id="this-week">
          <SectionHeading title="Earnings — This Week" />
          <Suspense fallback={<SectionSkeleton h={220} />}>
            <EarningsBucket which="this-week" empty="No earnings reports this week." />
          </Suspense>
        </StickySection>
        <StickySection id="next-week">
          <SectionHeading title="Earnings — Next Week" />
          <Suspense fallback={<SectionSkeleton h={220} />}>
            <EarningsBucket which="next-week" empty="No earnings reports next week." />
          </Suspense>
        </StickySection>
        <StickySection id="later">
          <SectionHeading title="Earnings — Later" />
          <Suspense fallback={<SectionSkeleton h={220} />}>
            <EarningsBucket which="later" empty="No upcoming earnings further out." />
          </Suspense>
        </StickySection>
        <StickySection id="ipos">
          <Suspense fallback={<><h2 className="mb-3 text-lg font-semibold">Upcoming IPOs</h2><SectionSkeleton h={260} /></>}>
            <IpoSection />
          </Suspense>
        </StickySection>
      </StickyScrollLayout>
      <Disclaimer className="mt-10" />
    </AppShell>
  );
}

async function HeroStats() {
  const [earnings, { ipos }] = await Promise.all([getEarnings(), getIpos()]);
  const openIpos = ipos.filter((i) => i.status !== "Closed");
  const { thisWeek, nextWeek, later } = bucket(earnings);
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <Stat label="Earnings this week" value={thisWeek.length} tone="brand" />
      <Stat label="Next week" value={nextWeek.length} />
      <Stat label="Later" value={later.length} />
      <Stat label="IPOs" value={openIpos.length} tone="accent" />
    </div>
  );
}

function HeroStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <Stat label="Earnings this week" value={0} tone="brand" />
      <Stat label="Next week" value={0} />
      <Stat label="Later" value={0} />
      <Stat label="IPOs" value={0} tone="accent" />
    </div>
  );
}

async function EarningsBucket({ which, empty }: { which: Window; empty: string }) {
  const earnings = await getEarnings();
  const buckets = bucket(earnings);
  const rows = which === "this-week" ? buckets.thisWeek : which === "next-week" ? buckets.nextWeek : buckets.later;
  return <EarningsList rows={rows} empty={empty} />;
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="mb-3 text-lg font-semibold">{title}</h2>;
}

function EarningsList({ rows, empty }: { rows: EarningsRow[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="surface rounded-2xl p-6 text-sm text-muted">{empty}</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => {
        const d = daysUntil(r.earningsDate);
        const dayChip = d <= 0 ? "Today" : d === 1 ? "Tomorrow" : `in ${d}d`;
        const tone = d <= 2 ? "chip-warning" : d <= 7 ? "chip-brand" : "chip-accent";
        return (
          <Link
            key={r.entry.symbol}
            href={`/stock/${r.entry.symbol}`}
            className="surface-strong hover-lift rounded-2xl border border-border p-4 shadow-soft"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <StockLogo symbol={r.entry.symbol} sector={r.entry.sector} size="sm" />
                <div className="min-w-0">
                  <div className="font-semibold">{r.entry.symbol}</div>
                  <div className="text-xs text-muted line-clamp-1">{r.entry.name}</div>
                </div>
              </div>
              <span className={cn("chip shrink-0", tone)}>{dayChip}</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted">
              <span className="uppercase tracking-wide">Reports</span>
              <span className="num-display tabular-nums text-fg">{fmtDate(r.earningsDate)}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function IpoSection() {
  return <IpoSectionInner />;
}

async function IpoSectionInner() {
  const { ipos: all, source } = await getIpos();
  const ipos = all
    .filter((i) => i.status !== "Closed")
    .sort((a, b) => new Date(a.openDate).getTime() - new Date(b.openDate).getTime());
  return (
    <>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        Upcoming IPOs
        <span className="text-xs text-muted tabular-nums">({ipos.length})</span>
        {source !== "nse" && (
          <span className="rounded-full bg-bg-2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted ring-1 ring-border">
            {source === "snapshot" ? "cached" : "fallback"}
          </span>
        )}
      </h2>
      {ipos.length === 0 ? (
        <p className="surface rounded-2xl p-6 text-sm text-muted">No IPOs upcoming.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {ipos.map((ipo) => {
            const open = ipo.status === "Open";
            return (
              <div
                key={`${ipo.name}-${ipo.openDate}`}
                className="surface-strong hover-lift relative overflow-hidden rounded-2xl border border-border p-5 shadow-soft"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-brand-fg shadow-pop">
                        <Rocket className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="font-bold tracking-tight">{ipo.name}</div>
                        <div className="text-[11px] text-muted">{ipo.sector}</div>
                      </div>
                    </div>
                  </div>
                  <span className={cn("chip", open ? "chip-accent" : "chip-brand")}>{ipo.status}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <Cell
                    label="Price band"
                    value={ipo.priceBandMin > 0 ? `₹${ipo.priceBandMin}–${ipo.priceBandMax}` : "TBA"}
                  />
                  <Cell label="Lot size" value={ipo.lotSize ? String(ipo.lotSize) : "TBA"} />
                  <Cell label="Open" value={fmtDateStr(ipo.openDate)} />
                  <Cell label="Close" value={fmtDateStr(ipo.closeDate)} />
                </div>
                <div className="mt-3 text-[11px] text-muted">
                  Issue size · <span className="font-semibold text-fg">{ipo.issueSize}</span>
                  {ipo.listingDate && <> · Lists {fmtDateStr(ipo.listingDate)}</>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-2.5">
      <div className="text-[10px] uppercase text-muted">{label}</div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "accent" | "brand" }) {
  const color = tone === "accent" ? "text-accent" : tone === "brand" ? "text-brand" : "text-fg";
  return (
    <div className="rounded-lg border border-border bg-card/60 p-2.5">
      <div className="text-[10px] uppercase text-muted">{label}</div>
      <div className={cn("mt-0.5 text-lg font-bold tabular-nums", color)}>{value}</div>
    </div>
  );
}

function SectionSkeleton({ h = 256 }: { h?: number }) {
  return <div className="shimmer rounded-2xl" style={{ height: h }} />;
}
