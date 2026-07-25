"use client";

import { useEffect, useState } from "react";
import { Activity, TrendingUp, TrendingDown } from "lucide-react";
import { StockLogo } from "@/components/StockLogo";
import { formatINR } from "@/lib/utils";
import { FlashNumber } from "@/components/anim/FlashNumber";

export type TickerItem = {
  symbol: string;
  last: number;
  changePct: number;
  isIndex: boolean;
  href?: string;
};

const POLL_MS = 90_000;

export function MarketTickerStripClient({ initial }: { initial: TickerItem[] }) {
  const [items, setItems] = useState<TickerItem[]>(initial);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (document.visibilityState !== "visible") {
        timer = setTimeout(tick, POLL_MS);
        return;
      }
      try {
        const res = await fetch("/api/market/ticker", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && Array.isArray(json?.data)) setItems(json.data as TickerItem[]);
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
  }, []);

  if (!items.length) return null;
  const loop = [...items, ...items];

  return (
    <section className="surface-glass sticky top-0 z-50 border-b border-hairline">
      <div className="group relative flex items-center gap-3 overflow-hidden py-1.5">
        <span className="ml-3 chip chip--muted">
          <Activity className="h-3 w-3 text-accent animate-pulse-soft" /> Live
        </span>
        <div className="pointer-events-none absolute left-[72px] top-0 z-10 h-full w-12 bg-gradient-to-r from-bg to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-gradient-to-l from-bg to-transparent" />
        <div
          className="animate-ticker flex w-max items-center gap-2 pr-3"
          style={{ animationDuration: "90s" }}
        >
          {loop.map((s, i) => {
            const up = (s.changePct ?? 0) >= 0;
            const inner = (
              <>
                {!s.isIndex && (
                  <StockLogo symbol={s.symbol} size="xs" animated={false} />
                )}
                <span className="font-semibold">{s.symbol}</span>
                <span className="t-mid t-num">
                  {Number.isFinite(s.last) ? (
                    <FlashNumber value={s.last} format={(n) => formatINR(n)} />
                  ) : (
                    "—"
                  )}
                </span>
                <span
                  className={`inline-flex items-center gap-0.5 t-num ${
                    up ? "text-accent" : "text-danger"
                  }`}
                >
                  {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                  {`${up ? "+" : ""}${s.changePct.toFixed(2)}%`}
                </span>
              </>
            );
            const className =
              "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-hairline/60 bg-surface-1/60 px-2 py-1 text-[11px] transition-colors duration-fast ease-out hover:border-brand/40 hover:bg-surface-1";
            return s.href ? (
              <a key={`${s.symbol}-${i}`} href={s.href} className={className}>
                {inner}
              </a>
            ) : (
              <span key={`${s.symbol}-${i}`} className={className}>{inner}</span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
