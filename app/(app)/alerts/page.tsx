import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId, isMarketOpen } from "@/lib/constants";
import { AlertForm } from "@/components/AlertForm";
import { AlertsList } from "@/components/AlertsList";
import { Bell, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/shell/AppShell";
import { PageRail, RailSection } from "@/components/shell/PageRail";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: profile }, { data: alerts }] = await Promise.all([
    supabase.from("profiles").select("plan").eq("user_id", user.id).single(),
    supabase
      .from("alerts")
      .select("id, symbol, exchange, condition, target_price, status, created_at, triggered_at")
      .order("created_at", { ascending: false }),
  ]);

  const plan = (profile?.plan ?? "free") as PlanId;
  const max = PLANS[plan].maxAlerts;
  const active = (alerts ?? []).filter((a) => a.status === "active").length;
  const triggered = (alerts ?? []).filter((a) => a.status === "triggered").length;
  const atLimit = active >= max;
  const open = isMarketOpen();

  const rail = (
    <PageRail>
      <RailSection label="Status" icon={<Bell className="h-3 w-3" />}>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between rounded-lg border border-border bg-bg/40 px-3 py-2 text-xs">
            <span className="text-muted">Active</span>
            <span className="font-semibold tabular-nums">{active}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-bg/40 px-3 py-2 text-xs">
            <span className="text-muted">Triggered</span>
            <span className="font-semibold tabular-nums">{triggered}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-bg/40 px-3 py-2 text-xs">
            <span className="text-muted">Limit</span>
            <span className="font-semibold tabular-nums">{Number.isFinite(max) ? max : "∞"}</span>
          </div>
        </div>
      </RailSection>
      <RailSection label="Engine">
        <div className={cn("chip", open ? "chip-accent" : "chip-warning")}>
          <Circle className={cn("h-2 w-2 fill-current", open && "animate-pulse-soft")} />
          {open ? "Running" : "Paused"}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Checks every 5 min during NSE hours (9:15–15:30 IST).
        </p>
      </RailSection>
    </PageRail>
  );

  return (
    <AppShell rail={rail} railLabel="Alerts filters">
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-4 shadow-glow sm:p-6 md:p-8 lg:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className={cn("chip mb-3", open ? "chip-accent" : "chip-warning")}>
              <Circle className={cn("h-2 w-2 fill-current", open && "animate-pulse-soft")} />
              {open ? "Engine running — checks every 5 min" : "Alerts pause outside market hours"}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
              Price <span className="text-gradient-animate">Alerts</span>
            </h1>
            <p className="mt-2 text-sm text-muted">
              We&apos;ll email you the moment a stock crosses your target. {Number.isFinite(max) ? `${active}/${max}` : `${active}`} active on your {PLANS[plan].name} plan.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card/60 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4 text-brand" /> Plan: {PLANS[plan].name}</div>
            <div className="mt-1 text-xs text-muted">Max alerts: {Number.isFinite(max) ? max : "Unlimited"}</div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <AlertForm disabled={atLimit} />
      </section>

      <section className="mt-6">
        <AlertsList alerts={(alerts ?? []) as never} />
      </section>

      <p className="mt-10 text-center text-xs text-muted">
        Alert checks run every 5 minutes during NSE hours (9:15–15:30 IST, Mon–Fri). For informational purposes only.
      </p>
    </AppShell>
  );
}
