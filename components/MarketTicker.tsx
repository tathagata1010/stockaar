"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn, formatPct } from "@/lib/utils";

type TickerItem = {
  symbol: string;
  last: number;
  changePct: number;
  isIndex: boolean;
  href?: string;
};

export function MarketTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/market/ticker");
        const json = await res.json();
        if (alive && json.data) setItems(json.data);
      } catch {}
    };
    load();
    const id = setInterval(load, 90_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (items.length === 0) {
    return <div className="h-9 border-b border-hairline bg-card/50" />;
  }

  const loop = [...items, ...items];

  return (
    <div className="group relative h-9 overflow-hidden border-b border-hairline bg-card/60">
      <div className="ticker-track flex h-full items-center whitespace-nowrap will-change-transform">
        {loop.map((it, i) => {
          const up = it.changePct >= 0;
          const content = (
            <span className="mx-4 inline-flex items-center gap-2 text-xs">
              <span className={cn("font-semibold", it.isIndex ? "text-brand" : "text-fg")}>{it.symbol}</span>
              <span className="t-num text-fg/80">{it.last.toFixed(2)}</span>
              <span className={cn("t-num font-medium", up ? "text-accent" : "text-danger")}>
                {up ? "▲" : "▼"} {formatPct(it.changePct).replace("+", "")}
              </span>
            </span>
          );
          return it.href ? (
            <Link key={i} href={it.href} className="hover:bg-hairline">{content}</Link>
          ) : (
            <span key={i}>{content}</span>
          );
        })}
      </div>
      <style jsx>{`
        .ticker-track {
          animation: ticker 90s linear infinite;
        }
        .group:hover .ticker-track {
          animation-play-state: paused;
        }
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
