"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Sparkles } from "lucide-react";
import type { SymbolEntry } from "@/lib/nse-symbols";
import { SymbolPicker } from "@/components/SymbolPicker";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";

type TriggerState = {
  price: { enabled: boolean; condition: "above" | "below"; target: string };
  move: { enabled: boolean; pctAbs: string };
  volume: { enabled: boolean; multiple: string };
  news: { enabled: boolean };
};

const INITIAL: TriggerState = {
  price: { enabled: true, condition: "above", target: "" },
  move: { enabled: false, pctAbs: "5" },
  volume: { enabled: false, multiple: "2" },
  news: { enabled: true },
};

export function AlertForm({ disabled, defaultSymbol }: { disabled?: boolean; defaultSymbol?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [symbol, setSymbol] = useState(defaultSymbol ?? "");
  const [exchange, setExchange] = useState<"NSE" | "BSE">("NSE");
  const [label, setLabel] = useState("");
  const [t, setT] = useState<TriggerState>(INITIAL);
  const [error, setError] = useState<string | null>(null);

  const anyEnabled = t.price.enabled || t.move.enabled || t.volume.enabled || t.news.enabled;

  function onPick(entry: SymbolEntry) {
    setSymbol(entry.symbol);
    setExchange(entry.exchange);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!symbol) return setError("Pick a symbol first.");
    if (!anyEnabled) return setError("Enable at least one trigger.");

    const triggers: Record<string, unknown> = {};
    if (t.price.enabled) {
      const target = parseFloat(t.price.target);
      if (!Number.isFinite(target) || target <= 0) return setError("Enter a valid price target.");
      triggers.price = { condition: t.price.condition, target };
    }
    if (t.move.enabled) {
      const pctAbs = parseFloat(t.move.pctAbs);
      if (!Number.isFinite(pctAbs) || pctAbs <= 0 || pctAbs > 50) return setError("Move % must be between 0 and 50.");
      triggers.move = { pctAbs };
    }
    if (t.volume.enabled) {
      const multiple = parseFloat(t.volume.multiple);
      if (!Number.isFinite(multiple) || multiple < 1.1) return setError("Volume multiple must be ≥ 1.1.");
      triggers.volume = { multiple };
    }
    if (t.news.enabled) triggers.news = { enabled: true };

    start(async () => {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, exchange, label: label || undefined, triggers }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setError(json.error ?? "Could not create alert");
      setSymbol(defaultSymbol ?? "");
      setLabel("");
      setT(INITIAL);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <Bell className="h-4 w-4 text-brand" />
        Set a Smart Alert
        <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
          <Sparkles className="h-3 w-3" /> AI brief
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.4fr_0.7fr_1.4fr]">
        <SymbolPicker
          size="sm"
          placeholder="Symbol (e.g. TCS)"
          defaultSymbol={symbol}
          disabled={disabled || pending}
          onSelect={onPick}
          recentKey="stockaar:alerts:recents"
        />
        <Select
          value={exchange}
          onChange={(v) => setExchange(v)}
          disabled={disabled || pending}
          ariaLabel="Exchange"
          options={[
            { value: "NSE", label: "NSE" },
            { value: "BSE", label: "BSE" },
          ]}
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Optional label (e.g. Earnings watch)"
          disabled={disabled || pending}
          className="rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-4 space-y-2.5">
        <TriggerRow
          checked={t.price.enabled}
          onToggle={(v) => setT({ ...t, price: { ...t.price, enabled: v } })}
          title="Price target"
          desc="Trigger when price crosses a level you set."
          disabled={disabled || pending}
        >
          <Select
            value={t.price.condition}
            onChange={(v) => setT({ ...t, price: { ...t.price, condition: v } })}
            ariaLabel="Price condition"
            options={[
              { value: "above", label: "Goes above" },
              { value: "below", label: "Goes below" },
            ]}
          />
          <input
            value={t.price.target}
            onChange={(e) => setT({ ...t, price: { ...t.price, target: e.target.value } })}
            placeholder="Target ₹"
            inputMode="decimal"
            className="w-32 rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm tabular-nums"
          />
        </TriggerRow>

        <TriggerRow
          checked={t.move.enabled}
          onToggle={(v) => setT({ ...t, move: { ...t.move, enabled: v } })}
          title="Big day move"
          desc="Trigger when the stock moves ± more than your threshold."
          disabled={disabled || pending}
        >
          <span className="text-sm text-muted">±</span>
          <input
            value={t.move.pctAbs}
            onChange={(e) => setT({ ...t, move: { ...t.move, pctAbs: e.target.value } })}
            placeholder="5"
            inputMode="decimal"
            className="w-20 rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm tabular-nums"
          />
          <span className="text-sm text-muted">%</span>
        </TriggerRow>

        <TriggerRow
          checked={t.volume.enabled}
          onToggle={(v) => setT({ ...t, volume: { ...t.volume, enabled: v } })}
          title="Volume spike"
          desc="Trigger when day volume crosses N× the 20-day average."
          disabled={disabled || pending}
        >
          <input
            value={t.volume.multiple}
            onChange={(e) => setT({ ...t, volume: { ...t.volume, multiple: e.target.value } })}
            placeholder="2"
            inputMode="decimal"
            className="w-20 rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm tabular-nums"
          />
          <span className="text-sm text-muted">× 20-day avg</span>
        </TriggerRow>

        <TriggerRow
          checked={t.news.enabled}
          onToggle={(v) => setT({ ...t, news: { enabled: v } })}
          title="Material news"
          desc="AI filters fluff and only emails when a headline is likely to move the stock."
          disabled={disabled || pending}
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Every email arrives with a 2–3 sentence AI brief — what just happened and what to watch next.
        </p>
        <button
          type="submit"
          disabled={disabled || pending || !anyEnabled}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg shadow-pop transition hover:-translate-y-0.5 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save alert"}
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
      {disabled && (
        <p className="mt-3 text-xs text-muted">
          You&apos;ve hit your alert limit. Remove an existing alert to add a new one.
        </p>
      )}
    </form>
  );
}

function TriggerRow({
  checked,
  onToggle,
  title,
  desc,
  disabled,
  children,
}: {
  checked: boolean;
  onToggle: (v: boolean) => void;
  title: string;
  desc: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition",
        checked ? "border-brand/40 bg-brand/5" : "border-border bg-bg/30",
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-brand"
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted">{desc}</div>
          {checked && children && (
            <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>
          )}
        </div>
      </label>
    </div>
  );
}
