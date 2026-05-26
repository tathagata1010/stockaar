"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import type { SymbolEntry } from "@/lib/nse-symbols";
import { SymbolPicker } from "@/components/SymbolPicker";

export function AlertForm({ disabled, defaultSymbol }: { disabled?: boolean; defaultSymbol?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [symbol, setSymbol] = useState(defaultSymbol ?? "");
  const [exchange, setExchange] = useState<"NSE" | "BSE">("NSE");
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onPick(entry: SymbolEntry) {
    setSymbol(entry.symbol);
    setExchange(entry.exchange);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const t = parseFloat(target);
    if (!symbol || !Number.isFinite(t) || t <= 0) {
      setError("Pick a symbol and enter a valid target price.");
      return;
    }
    start(async () => {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, exchange, condition, target_price: t }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not create alert");
        return;
      }
      setSymbol(defaultSymbol ?? "");
      setTarget("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <Bell className="h-4 w-4 text-brand" /> Create a price alert
      </div>
      <div className="grid gap-3 md:grid-cols-[1.6fr_0.7fr_1fr_1fr_auto]">
        <SymbolPicker
          size="sm"
          placeholder="Symbol (e.g. TCS)"
          defaultSymbol={symbol}
          disabled={disabled || pending}
          onSelect={onPick}
          recentKey="stockaar:alerts:recents"
        />
        <select
          value={exchange}
          onChange={(e) => setExchange(e.target.value as "NSE" | "BSE")}
          disabled={disabled || pending}
          className="rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm"
        >
          <option>NSE</option>
          <option>BSE</option>
        </select>
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value as "above" | "below")}
          disabled={disabled || pending}
          className="rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm"
        >
          <option value="above">Goes above</option>
          <option value="below">Goes below</option>
        </select>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Target ₹"
          inputMode="decimal"
          disabled={disabled || pending}
          className="rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm tabular-nums"
        />
        <button
          type="submit"
          disabled={disabled || pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg shadow-pop transition hover:-translate-y-0.5 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add alert"}
        </button>
      </div>
      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
      {disabled && (
        <p className="mt-3 text-xs text-muted">
          You&apos;ve hit the 15-alert limit. Remove an existing alert to add a new one.
        </p>
      )}
    </form>
  );
}
