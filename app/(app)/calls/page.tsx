import { Suspense } from "react";
import { getUniverse } from "@/lib/universe";
import { deriveSignal } from "@/lib/scorecard";
import { Disclaimer } from "@/components/Disclaimer";
import { PageFooter } from "@/components/PageFooter";
import { CallsGridLazy } from "@/components/CallsGridLazy";
import { AppShell } from "@/components/shell/AppShell";
import { UrlTabs } from "@/components/ui/UrlTabs";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export const metadata = {
  title: "Signal Board — Data-Driven Stock Tilts",
  description: "Data-derived positive / neutral / caution tilts on Indian stocks with transparent reasoning. Educational — never prescriptive.",
  alternates: { canonical: "/calls" },
  keywords: ["stock scorecard India", "NSE data screener", "Indian equity analysis"],
};

export default async function CallsPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const searchParams = await props.searchParams;
  const tab = (searchParams.tab ?? "ALL").toUpperCase();
  return (
    <AppShell>
      <h1 className="text-3xl font-bold">Signal Board</h1>
      <p className="mt-2 t-muted">Data-derived tilts from the 4-pillar Scorecard. Educational context, not a recommendation.</p>

      <Disclaimer variant="bold" className="mt-4" />

      <Suspense fallback={<CallsShell />}>
        <CallsInner tab={tab} />
      </Suspense>

      <PageFooter kind="market" />
    </AppShell>
  );
}

async function CallsInner({ tab }: { tab: string }) {
  const universe = await getUniverse();
  const all = universe
    .filter((r) => r.scorecard && r.quote)
    .map((r) => ({ row: r, ...deriveSignal(r.scorecard!) }));

  const filtered = tab === "ALL" ? all : all.filter((c) => c.signal === tab);
  const sorted = [...filtered].sort((a, b) => b.row.scorecard!.composite - a.row.scorecard!.composite);

  const counts = {
    ALL: all.length,
    POSITIVE: all.filter((c) => c.signal === "POSITIVE").length,
    NEUTRAL: all.filter((c) => c.signal === "NEUTRAL").length,
    CAUTION: all.filter((c) => c.signal === "CAUTION").length,
  };

  const TAB_LABEL: Record<keyof typeof counts, string> = {
    ALL: "All",
    POSITIVE: "Positive",
    NEUTRAL: "Neutral",
    CAUTION: "Caution",
  };

  const tabs = (["ALL", "POSITIVE", "NEUTRAL", "CAUTION"] as const).map((t) => ({
    value: t,
    label: TAB_LABEL[t],
    count: counts[t],
  }));

  return (
    <>
      <div className="mt-6">
        <UrlTabs paramName="tab" tabs={tabs} defaultValue="ALL" />
      </div>

      <div className="mt-6">
        <CallsGridLazy
          calls={sorted.map((c) => ({
            symbol: c.row.entry.symbol,
            name: c.row.entry.name,
            sector: c.row.entry.sector,
            signal: c.signal,
            price: c.row.quote!.lastPrice,
            changePct: c.row.quote!.changePct,
            score: c.row.scorecard!.composite,
            reasons: c.reasons.slice(0, 3),
          }))}
        />
      </div>

      {sorted.length === 0 && (
        <p className="surface mt-6 p-6 t-body t-muted">
          Nothing matches this filter right now.
        </p>
      )}
    </>
  );
}

function CallsShell() {
  return (
    <>
      <div className="mt-6 flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-20 shimmer rounded-md" />
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-44 shimmer rounded-lg" />
        ))}
      </div>
    </>
  );
}
