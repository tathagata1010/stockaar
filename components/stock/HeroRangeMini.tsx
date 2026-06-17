"use client";

import { useEffect, useState } from "react";
import type { Quote } from "@/lib/upstox";
import { formatINR, cn } from "@/lib/utils";
import { isMarketOpen } from "@/lib/constants";

export function HeroRangeMini({
  initial,
  symbol,
  exchange,
}: {
  initial: Quote;
  symbol: string;
  exchange: "NSE" | "BSE";
}) {
  const [quote, setQuote] = useState<Quote>(initial);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (document.visibilityState !== "visible" || !isMarketOpen()) {
        timer = setTimeout(tick, 30_000);
        return;
      }
      try {
        const res = await fetch(`/api/quote/${encodeURIComponent(symbol)}?exchange=${exchange}`);
        if (res.ok) {
          const json = await res.json();
          const next = json?.data as Quote | undefined;
          if (!cancelled && next?.lastPrice) {
            setQuote((prev) =>
              prev.dayHigh === next.dayHigh &&
              prev.dayLow === next.dayLow &&
              prev.lastPrice === next.lastPrice
                ? prev
                : next,
            );
          }
        }
      } catch {}
      if (!cancelled) timer = setTimeout(tick, 30_000);
    }

    timer = setTimeout(tick, 30_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [symbol, exchange]);

  const { dayLow, dayHigh, lastPrice } = quote;
  const span = dayHigh - dayLow;
  const pos = span > 0 ? ((lastPrice - dayLow) / span) * 100 : 50;
  const clamped = Math.max(0, Math.min(100, pos));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted">
        <span>Day Range</span>
        <span className="tabular-nums">{clamped.toFixed(0)}%</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-bg/60 ring-1 ring-border">
        <div
          className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-danger/40 via-warning/40 to-accent/40"
        />
        <div
          className={cn(
            "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card transition-all duration-500",
            "bg-fg shadow-pop",
          )}
          style={{ left: `${clamped}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] tabular-nums text-muted">
        <span>{formatINR(dayLow)}</span>
        <span>{formatINR(dayHigh)}</span>
      </div>
    </div>
  );
}
