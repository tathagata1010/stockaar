import { Suspense } from "react";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getQuotes, type Quote } from "@/lib/upstox";
import { PLANS } from "@/lib/constants";
import { WatchlistTable } from "@/components/WatchlistTable";
import { AddStockForm } from "@/components/AddStockForm";
import { AppShell } from "@/components/shell/AppShell";
import { PageRail, RailSection } from "@/components/shell/PageRail";
import { Star, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default function WatchlistPage() {
  const rail = (
    <PageRail>
      <RailSection label="Add to watchlist" icon={<Plus className="h-3 w-3" />}>
        <Suspense fallback={<div className="h-9 shimmer rounded-lg" />}>
          <AddStockSlot />
        </Suspense>
      </RailSection>
      <RailSection label="Plan" icon={<Star className="h-3 w-3" />}>
        <Suspense fallback={<div className="h-12 shimmer rounded-lg" />}>
          <WatchlistPlanCard />
        </Suspense>
      </RailSection>
    </PageRail>
  );

  return (
    <AppShell rail={rail} railLabel="Watchlist tools">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Watchlist</h1>
          <Suspense fallback={<p className="mt-1 text-sm text-muted">Loading…</p>}>
            <WatchlistMeta />
          </Suspense>
        </div>
      </div>

      <div className="mt-6">
        <Suspense fallback={<div className="h-64 shimmer rounded-2xl" />}>
          <WatchlistData />
        </Suspense>
      </div>
    </AppShell>
  );
}

const loadCore = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { items: [], plan: "free" as keyof typeof PLANS, maxItems: PLANS.free.maxWatchlistItems, used: 0 };
  }
  const [{ data: items }, { data: profile }] = await Promise.all([
    supabase.from("watchlist_items").select("*").order("added_at", { ascending: false }),
    supabase.from("profiles").select("plan").eq("user_id", user.id).single(),
  ]);
  const plan = (profile?.plan ?? "free") as keyof typeof PLANS;
  const maxItems = PLANS[plan].maxWatchlistItems;
  const used = items?.length ?? 0;
  return { items: items ?? [], plan, maxItems, used };
});

async function WatchlistMeta() {
  const { maxItems, used } = await loadCore();
  return (
    <p className="mt-1 text-sm text-muted">
      {used} of {maxItems === Infinity ? "\u221e" : maxItems} stocks tracked
    </p>
  );
}

async function WatchlistPlanCard() {
  const { plan, used, maxItems } = await loadCore();
  const planName = PLANS[plan].name;
  const limitLabel = Number.isFinite(maxItems) ? `${used}/${maxItems}` : `${used}`;
  return (
    <div className="rounded-lg border border-border bg-bg/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted">{planName} plan</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{limitLabel}</div>
    </div>
  );
}

async function AddStockSlot() {
  const { used, maxItems } = await loadCore();
  return <AddStockForm disabled={used >= maxItems} />;
}

async function WatchlistData() {
  const { items } = await loadCore();
  const quotes: Record<string, Quote> = {};
  if (items.length) {
    const fetched = await getQuotes(items.map((i) => ({ symbol: i.symbol, exchange: i.exchange })));
    for (const q of fetched) quotes[`${q.exchange}:${q.symbol}`] = q;
  }
  return <WatchlistTable items={items} quotes={quotes} />;
}
