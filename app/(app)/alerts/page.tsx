import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId, isMarketOpen } from "@/lib/constants";
import { AlertForm } from "@/components/AlertForm";
import { AlertsList } from "@/components/AlertsList";
import { Bell, Circle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/shell/AppShell";
import { PageRail, RailSection } from "@/components/shell/PageRail";

export const dynamic = "force-dynamic";

type ActivityRow = {
  id: string;
  kind: "price" | "move" | "volume" | "news";
  brief: string | null;
  suppressed: boolean | null;
  sent_at: string;
  alerts: { symbol: string; exchange: "NSE" | "BSE" } | null;
};

function timeAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const KIND_LABEL: Record<ActivityRow["kind"], string> = {
  price: "🎯 Price",
  move: "📈 Move",
  volume: "🔊 Volume",
  news: "📰 News",
};

export default async function AlertsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: profile }, { data: alerts }, { data: activity }, { count: emailed7d }] = await Promise.all([
    supabase.from("profiles").select("plan").eq("user_id", user.id).single(),
    supabase
      .from("alerts")
      .select("id, symbol, exchange, label, triggers, status, last_notified_at, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("alert_notifications")
      .select("id, kind, brief, suppressed, sent_at, alerts!inner(symbol, exchange, user_id)")
      .eq("alerts.user_id", user.id)
      .eq("suppressed", false)
      .order("sent_at", { ascending: false })
      .limit(10),
    supabase
      .from("alert_notifications")
      .select("id, alerts!inner(user_id)", { count: "exact", head: true })
      .eq("alerts.user_id", user.id)
      .eq("suppressed", false)
      .gte("sent_at", sevenDaysAgo),
  ]);

  const plan = (profile?.plan ?? "free") as PlanId;
  const max = PLANS[plan].maxAlerts;
  const active = (alerts ?? []).filter((a) => a.status === "active").length;
  const atLimit = active >= max;
  const open = isMarketOpen();
  const recent = (activity ?? []) as unknown as ActivityRow[];

  const rail = (
    <PageRail>
      <RailSection label="Status" icon={<Bell className="h-3 w-3" />}>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between rounded-lg border border-border bg-bg/40 px-3 py-2 text-xs">
            <span className="text-muted">Active</span>
            <span className="font-semibold tabular-nums">{active}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-bg/40 px-3 py-2 text-xs">
            <span className="text-muted">Emailed (7d)</span>
            <span className="font-semibold tabular-nums">{emailed7d ?? 0}</span>
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
          {open ? "Running" : "News-only"}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Price/move/volume checks run during NSE hours. Material news is monitored 24×7.
        </p>
      </RailSection>
    </PageRail>
  );

  return (
    <AppShell rail={rail} railLabel="Alerts filters">
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-4 shadow-glow sm:p-6 md:p-8 lg:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="chip chip-accent mb-3">
              <Sparkles className="h-3 w-3" /> Smart Alerts — tracking guide, not just a ping
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
              Smart <span className="text-gradient-animate">Alerts</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Watch each stock for price targets, big day moves, volume spikes, and material news — every email arrives with a 2–3 sentence AI brief on what just happened and what to watch next.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card/60 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4 text-brand" /> Plan: {PLANS[plan].name}</div>
            <div className="mt-1 text-xs text-muted">{Number.isFinite(max) ? `${active}/${max} active` : `${active} active · unlimited`}</div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <AlertForm disabled={atLimit} />
      </section>

      {recent.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-accent" />
            Latest from your alerts
          </div>
          <div className="space-y-2">
            {recent.map((n) => (
              <div key={n.id} className="rounded-xl border border-border bg-card p-3 shadow-soft">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{KIND_LABEL[n.kind]}</span>
                    {n.alerts && (
                      <Link href={`/stock/${n.alerts.symbol}`} className="font-semibold hover:text-brand">
                        {n.alerts.symbol}
                      </Link>
                    )}
                    <span className="text-muted">{n.alerts?.exchange}</span>
                  </div>
                  <span className="text-[11px] text-muted">{timeAgo(n.sent_at)}</span>
                </div>
                {n.brief && (
                  <p className="mt-1.5 text-xs italic text-muted">{n.brief}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-3 text-sm font-semibold">Your alerts</div>
        <AlertsList alerts={(alerts ?? []) as never} />
      </section>

      <p className="mt-10 text-center text-xs text-muted">
        Checks run every 10 minutes. Limit of 1 email per stock per 6 hours. For informational purposes only.
      </p>
    </AppShell>
  );
}
