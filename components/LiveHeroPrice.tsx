"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatINR, formatPct, cn } from "@/lib/utils";
import type { Quote } from "@/lib/upstox";
import { isMarketOpen } from "@/lib/constants";
import { FlashNumber } from "@/components/anim/FlashNumber";
import { CountUp } from "@/components/anim/CountUp";

const POLL_MS = 30_000;

export function LiveHeroPrice({
  initial,
  symbol,
  exchange,
}: {
  initial: Quote;
  symbol: string;
  exchange: "NSE" | "BSE";
}) {
  const [quote, setQuote] = useState<Quote>(initial);
  const [updatedAgo, setUpdatedAgo] = useState<number>(0);
  const updatedAtRef = useRef<number>(initial.updatedAt);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (document.visibilityState !== "visible" || !isMarketOpen()) {
        timer = setTimeout(tick, POLL_MS);
        return;
      }
      try {
        const res = await fetch(`/api/quote/${encodeURIComponent(symbol)}?exchange=${exchange}`);
        if (res.ok) {
          const json = await res.json();
          const next = json?.data as Quote | undefined;
          if (!cancelled && next?.lastPrice) {
            setQuote((prev) =>
              prev.lastPrice === next.lastPrice &&
              prev.change === next.change &&
              prev.dayHigh === next.dayHigh &&
              prev.dayLow === next.dayLow
                ? prev
                : next,
            );
            updatedAtRef.current = next.updatedAt;
          }
        }
      } catch {}
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    }

    timer = setTimeout(tick, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [symbol, exchange]);

  useEffect(() => {
    const id = setInterval(() => {
      setUpdatedAgo(Math.max(0, Math.floor((Date.now() - updatedAtRef.current) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const up = quote.change >= 0;
  const isInitial = quote.lastPrice === initial.lastPrice && updatedAtRef.current === initial.updatedAt;
  return (
    <div>
      <div className="num-display text-3xl font-extrabold tabular-nums sm:text-4xl">
        {isInitial ? (
          <CountUp to={quote.lastPrice} format={(n) => formatINR(n)} durationMs={900} from={quote.lastPrice * 0.95} />
        ) : (
          <FlashNumber value={quote.lastPrice} format={(n) => formatINR(n)} />
        )}
      </div>
      <div
        className={cn(
          "mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ring-1",
          up ? "bg-accent/10 text-accent ring-accent/25" : "bg-danger/10 text-danger ring-danger/25",
        )}
      >
        {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
        {quote.change > 0 ? "+" : ""}{quote.change.toFixed(2)} (<FlashNumber value={quote.changePct} format={(n) => formatPct(n)} flashOn="sign" />)
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md bg-bg/40 px-2 py-1.5 ring-1 ring-border">
          <div className="text-[10px] uppercase tracking-wide text-muted">Day Low</div>
          <div className="mt-0.5 font-semibold text-fg tabular-nums">
            <FlashNumber value={quote.dayLow} format={(n) => formatINR(n)} />
          </div>
        </div>
        <div className="rounded-md bg-bg/40 px-2 py-1.5 ring-1 ring-border">
          <div className="text-[10px] uppercase tracking-wide text-muted">Day High</div>
          <div className="mt-0.5 font-semibold text-fg tabular-nums">
            <FlashNumber value={quote.dayHigh} format={(n) => formatINR(n)} />
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted">
        <span className={cn("inline-block h-1.5 w-1.5 rounded-full", isMarketOpen() ? "bg-accent animate-pulse-soft" : "bg-muted")} />
        Updated {updatedAgo < 60 ? `${updatedAgo}s` : `${Math.floor(updatedAgo / 60)}m`} ago
      </div>
    </div>
  );
}
