"use client";

import { useEffect, useState } from "react";
import { cn, formatINR, formatPct } from "@/lib/utils";
import type { Quote } from "@/lib/upstox";

export function LivePriceHeader({
  symbol, exchange, initial,
}: {
  symbol: string;
  exchange: "NSE" | "BSE";
  initial: Quote;
}) {
  const [quote, setQuote] = useState<Quote>(initial);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/stocks/quote?symbol=${symbol}&exchange=${exchange}`);
        const body = await res.json();
        if (body.data) {
          setQuote(body.data);
          setPulsing(true);
          setTimeout(() => setPulsing(false), 700);
        }
      } catch {}
    }, 60_000);
    return () => clearInterval(id);
  }, [symbol, exchange]);

  const up = quote.change >= 0;

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <div className={cn(
          "text-4xl font-bold tabular-nums transition-colors",
          pulsing && (up ? "text-accent" : "text-danger"),
        )}>
          {formatINR(quote.lastPrice)}
        </div>
        <div className={cn(
          "text-lg font-semibold tabular-nums",
          up ? "text-accent" : "text-danger",
        )}>
          {up ? "+" : ""}{quote.change.toFixed(2)} ({formatPct(quote.changePct)})
        </div>
      </div>
      <div className="mt-1 text-xs text-muted">
        Delayed ~15 min · Updated {new Date(quote.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · Auto-refreshes
      </div>
    </div>
  );
}
