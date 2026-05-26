"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddStockDetailButton({
  symbol, exchange, alreadyAdded,
}: {
  symbol: string;
  exchange: "NSE" | "BSE";
  alreadyAdded: boolean;
}) {
  const [added, setAdded] = useState(alreadyAdded);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function add() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, exchange }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error ?? `Failed (${res.status})`); return; }
      setAdded(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  if (added) {
    return (
      <span className="inline-flex w-full items-center justify-center rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent">
        ✓ In watchlist
      </span>
    );
  }
  return (
    <>
      <button
        onClick={add}
        disabled={busy}
        className="btn-brand w-full justify-center disabled:opacity-60"
      >
        {busy ? "Adding…" : "+ Add to watchlist"}
      </button>
      {error && <p className="mt-1 text-center text-xs text-danger">{error}</p>}
    </>
  );
}
