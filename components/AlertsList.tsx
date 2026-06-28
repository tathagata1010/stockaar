"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Pause, Play, Trash2, Target, TrendingUp, Volume2, Newspaper, Circle } from "lucide-react";
import { formatINR, cn } from "@/lib/utils";
import type { Triggers, TriggerKind } from "@/lib/alerts/schema";

type Alert = {
  id: string;
  symbol: string;
  exchange: "NSE" | "BSE";
  label: string | null;
  triggers: Triggers;
  status: "active" | "paused";
  last_notified_at: string | null;
  created_at: string;
};

const KIND_META: Record<TriggerKind, { icon: typeof Target; tone: string }> = {
  price: { icon: Target, tone: "bg-brand/10 text-brand" },
  move: { icon: TrendingUp, tone: "bg-sky-500/10 text-sky-500" },
  volume: { icon: Volume2, tone: "bg-violet-500/10 text-violet-500" },
  news: { icon: Newspaper, tone: "bg-teal-500/10 text-teal-500" },
};

function triggerLabel(kind: TriggerKind, t: Triggers): string {
  if (kind === "price" && t.price) return `${t.price.condition === "above" ? "≥" : "≤"} ${formatINR(t.price.target)}`;
  if (kind === "move" && t.move) return `±${t.move.pctAbs}%`;
  if (kind === "volume" && t.volume) return `${t.volume.multiple}× vol`;
  if (kind === "news") return "Material news";
  return "";
}

function timeAgo(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function AlertsList({ alerts }: { alerts: Alert[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function remove(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) startTransition(() => router.refresh());
  }

  async function toggleStatus(a: Alert) {
    setBusyId(a.id);
    const next = a.status === "active" ? "paused" : "active";
    const res = await fetch(`/api/alerts/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusyId(null);
    if (res.ok) startTransition(() => router.refresh());
  }

  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <Bell className="mx-auto mb-3 h-6 w-6 text-muted" />
        <p className="text-sm font-semibold">No Smart Alerts yet.</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted">
          Set one above and we&apos;ll email a 2–3 sentence AI brief the moment a price target, big move, volume spike, or material news fires.
        </p>
        <Link href="/stock/RELIANCE" className="mt-3 inline-flex text-xs font-semibold text-brand hover:underline">
          Try a Smart Alert on RELIANCE →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((a) => {
        const kinds = (Object.keys(a.triggers) as TriggerKind[]).filter((k) => a.triggers[k]);
        const lastFired = timeAgo(a.last_notified_at);
        const paused = a.status === "paused";
        const busy = busyId === a.id;

        return (
          <div
            key={a.id}
            className={cn(
              "rounded-2xl border bg-card p-4 shadow-soft transition",
              paused ? "border-border opacity-70" : "border-border hover:border-brand/40",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/stock/${a.symbol}`} className="font-semibold hover:text-brand">
                    {a.symbol}
                  </Link>
                  <span className="text-[10px] uppercase tracking-wide text-muted">{a.exchange}</span>
                  {paused && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-bg/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">
                      Paused
                    </span>
                  )}
                  {!paused && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-accent">
                      <Circle className="h-1.5 w-1.5 fill-current animate-pulse-soft" /> Watching
                    </span>
                  )}
                </div>
                {a.label && <div className="mt-0.5 text-xs text-muted">{a.label}</div>}

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {kinds.map((k) => {
                    const Icon = KIND_META[k].icon;
                    return (
                      <span
                        key={k}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                          KIND_META[k].tone,
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {triggerLabel(k, a.triggers)}
                      </span>
                    );
                  })}
                </div>

                {lastFired && (
                  <div className="mt-2 text-[11px] text-muted">
                    Last emailed <span className="font-semibold text-text">{lastFired}</span>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => toggleStatus(a)}
                  disabled={busy}
                  aria-label={paused ? "Resume alert" : "Pause alert"}
                  title={paused ? "Resume" : "Pause"}
                  className="rounded-md p-1.5 text-muted transition hover:bg-brand/10 hover:text-brand disabled:opacity-50"
                >
                  {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => remove(a.id)}
                  disabled={busy}
                  aria-label="Remove alert"
                  className="rounded-md p-1.5 text-muted transition hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
