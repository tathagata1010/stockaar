"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatINR, formatPct, cn } from "@/lib/utils";
import type { Quote } from "@/lib/upstox";
import { StockLogo } from "./StockLogo";
import { NSE_SYMBOLS_LITE as NSE_SYMBOLS } from "@/lib/nse-symbols-lite";
import { isMarketOpen } from "@/lib/constants";
import { Trash2 } from "lucide-react";
import { FlashNumber } from "@/components/anim/FlashNumber";
import { FreshBadge } from "@/components/FreshBadge";
import { markSnapshot } from "@/lib/visit-local";
import { EmptyWatchlist } from "@/components/empty/EmptyWatchlist";

type Item = { id: string; symbol: string; exchange: "NSE" | "BSE"; added_at: string };

const POLL_MS = 60_000;

export function WatchlistTable({
  items, quotes: initialQuotes,
}: {
  items: Item[];
  quotes: Record<string, Quote>;
}) {
  const router = useRouter();
  const [quotes, setQuotes] = useState(initialQuotes);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuotes(initialQuotes);
  }, [initialQuotes]);

  useEffect(() => {
    const rows = Object.values(quotes)
      .filter((q) => Number.isFinite(q.lastPrice) && q.lastPrice > 0)
      .map((q) => ({ symbol: `${q.exchange}:${q.symbol}`, price: q.lastPrice }));
    if (rows.length > 0) markSnapshot(rows);
  }, [quotes]);

  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "visible" && isMarketOpen()) {
        try {
          const tokens = items.map((it) => `${it.exchange}:${it.symbol}`).join(",");
          const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(tokens)}`);
          if (res.ok) {
            const { data } = (await res.json()) as { data: Quote[] };
            if (!cancelled && Array.isArray(data)) {
              setQuotes((prev) => {
                const next = { ...prev };
                for (const q of data) next[`${q.exchange}:${q.symbol}`] = q;
                return next;
              });
            }
          }
        } catch {
          // swallow — next tick will retry
        }
      }
      if (!cancelled) timer.current = setTimeout(tick, POLL_MS);
    }

    timer.current = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [items]);

  if (items.length === 0) {
    return <EmptyWatchlist />;
  }

  async function remove(id: string) {
    const res = await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase text-muted">
          <tr>
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3 text-right">Last Price</th>
            <th className="px-4 py-3 text-right">Change</th>
            <th className="px-4 py-3 text-right">Day Range</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const q = quotes[`${item.exchange}:${item.symbol}`];
            const meta = NSE_SYMBOLS.find((s) => s.symbol === item.symbol);
            return (
              <tr key={item.id} className="border-b border-border last:border-0 transition-colors hover:bg-bg/50">
                <td className="px-4 py-3">
                  <Link href={`/stock/${item.symbol}`} className="flex items-center gap-3">
                    <StockLogo symbol={item.symbol} sector={meta?.sector} size="sm" />
                    <div>
                      <div className="font-semibold">{item.symbol}</div>
                      <div className="text-xs text-muted">{meta?.name ?? item.exchange}</div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {q ? (
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <FlashNumber value={q.lastPrice} format={(n) => formatINR(n)} />
                      <FreshBadge symbol={q.symbol} exchange={q.exchange} price={q.lastPrice} />
                    </span>
                  ) : <span className="text-muted">—</span>}
                </td>
                <td className={cn(
                  "px-4 py-3 text-right",
                )}>
                  {q ? (
                    <span className={cn(
                      "inline-block rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                      q.change >= 0 ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger",
                    )}>
                      <FlashNumber value={q.changePct} format={(n) => formatPct(n)} flashOn="sign" />
                    </span>
                  ) : <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-3 text-right text-muted tabular-nums text-xs">
                  {q ? `${formatINR(q.dayLow)} – ${formatINR(q.dayHigh)}` : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => remove(item.id)}
                    className="inline-flex items-center gap-1 rounded-md p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
