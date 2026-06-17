"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SymbolEntry } from "@/lib/nse-symbols";
import { SymbolPicker } from "@/components/SymbolPicker";
import { toast } from "@/lib/toast";

export function AddStockForm({ disabled }: { disabled?: boolean }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  async function add(entry: SymbolEntry) {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: entry.symbol, exchange: entry.exchange }),
      });
      const text = await res.text();
      let body: { error?: string } = {};
      try { body = JSON.parse(text); } catch {}
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}: ${text.slice(0, 200)}`);
        return;
      }
      setSuccess(`${entry.symbol} added to watchlist`);
      toast.success(`${entry.symbol} added`, "Now tracking on your watchlist.");
      router.refresh();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <SymbolPicker
        placeholder={disabled ? "Watchlist full (15 stocks)" : "Add a stock — search NSE…"}
        size="sm"
        disabled={disabled || submitting}
        onSelect={add}
        clearOnSelect
        recentKey="stockaar:watchlist:recents"
      />
      {submitting && <p className="mt-2 text-xs text-muted">Saving…</p>}
      {error && (
        <div className="mt-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
          ✓ {success}
        </div>
      )}
    </div>
  );
}
