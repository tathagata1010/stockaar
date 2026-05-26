import { Suspense } from "react";
import Link from "next/link";
import { getUniverse } from "@/lib/universe";
import { deriveSignal } from "@/lib/scorecard";
import { cn } from "@/lib/utils";
import { Disclaimer } from "@/components/Disclaimer";
import { CallsGridLazy } from "@/components/CallsGridLazy";
import { AppShell } from "@/components/shell/AppShell";

export const revalidate = 300;

export default function CallsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = (searchParams.tab ?? "ALL").toUpperCase();
  return (
    <AppShell>
      <h1 className="text-3xl font-bold">Stock Calls</h1>
      <p className="mt-2 text-muted">Algorithmic Buy / Hold / Sell signals derived from the 4-pillar Scorecard.</p>

      <Disclaimer variant="bold" className="mt-4" />

      <Suspense fallback={<CallsShell />}>
        <CallsInner tab={tab} />
      </Suspense>
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
    BUY: all.filter((c) => c.signal === "BUY").length,
    HOLD: all.filter((c) => c.signal === "HOLD").length,
    SELL: all.filter((c) => c.signal === "SELL").length,
  };

  return (
    <>
      <div className="mt-6 flex gap-2 text-sm">
        {(["ALL", "BUY", "HOLD", "SELL"] as const).map((t) => (
          <Link
            key={t}
            href={`/calls?tab=${t}`}
            className={cn(
              "rounded-md border px-3 py-1.5",
              tab === t ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-fg",
            )}
          >
            {t} <span className="ml-1 text-xs opacity-70">({counts[t]})</span>
          </Link>
        ))}
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
        <p className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted">
          No calls in this category right now.
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
