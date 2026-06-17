"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star, Plus, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "@/lib/toast";

type Pick = { symbol: string; name: string; exchange: "NSE" | "BSE" };

const POPULAR: Pick[] = [
  { symbol: "RELIANCE",  name: "Reliance Industries",        exchange: "NSE" },
  { symbol: "TCS",       name: "Tata Consultancy Services",  exchange: "NSE" },
  { symbol: "HDFCBANK",  name: "HDFC Bank",                  exchange: "NSE" },
  { symbol: "INFY",      name: "Infosys",                    exchange: "NSE" },
  { symbol: "ICICIBANK", name: "ICICI Bank",                 exchange: "NSE" },
  { symbol: "BHARTIARTL",name: "Bharti Airtel",              exchange: "NSE" },
];

export function EmptyWatchlist() {
  const [adding, setAdding] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function quickAdd(p: Pick) {
    setAdding(p.symbol);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: p.symbol, exchange: p.exchange }),
      });
      if (res.ok) {
        toast.success(`${p.symbol} added`, "Now tracking on your watchlist.");
        startTransition(() => router.refresh());
      } else {
        const body = await res.json().catch(() => ({ error: "Failed to add" }));
        toast.danger("Could not add", body.error ?? "Try again");
      }
    } catch {
      toast.danger("Network error", "Could not add. Try again.");
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="surface relative overflow-hidden p-6">
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand via-brand-2 to-accent" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/30">
            <Star className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Your watchlist is empty</h2>
            <p className="text-xs text-muted">Start tracking with a one-tap add — or search any NSE stock from the rail.</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
          <Sparkles className="h-3 w-3 text-brand" /> Popular with retail investors
        </div>

        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {POPULAR.map((p) => {
            const isAdding = adding === p.symbol;
            return (
              <li key={p.symbol} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 transition hover:border-brand/40">
                <Link href={`/stock/${p.symbol}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-fg hover:text-brand">
                    {p.symbol}
                    <ExternalLink className="h-3 w-3 text-muted" />
                  </div>
                  <div className="truncate text-[11px] text-muted">{p.name}</div>
                </Link>
                <button
                  type="button"
                  onClick={() => quickAdd(p)}
                  disabled={isAdding}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand/10 px-2 py-1 text-[11px] font-semibold text-brand ring-1 ring-brand/30 transition hover:bg-brand/20 disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" />
                  {isAdding ? "Adding…" : "Add"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
