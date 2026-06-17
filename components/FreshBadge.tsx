"use client";

import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { getSnapshot } from "@/lib/visit-local";
import { cn } from "@/lib/utils";

const THRESHOLD = 0.015;

export function FreshBadge({ symbol, exchange, price, className }: { symbol: string; exchange?: string; price: number; className?: string }) {
  const [pct, setPct] = useState<number | null>(null);

  useEffect(() => {
    const snap = getSnapshot();
    const key = exchange ? `${exchange}:${symbol}` : symbol;
    const prev = snap[key] ?? snap[symbol];
    if (!prev || !Number.isFinite(prev.price) || prev.price <= 0) return;
    const ageHrs = (Date.now() - prev.ts) / 3_600_000;
    if (ageHrs < 1) return;
    const diff = (price - prev.price) / prev.price;
    if (Math.abs(diff) < THRESHOLD) return;
    setPct(diff * 100);
  }, [symbol, exchange, price]);

  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1 py-px text-[9px] font-bold uppercase tabular-nums ring-1",
        up ? "bg-accent/15 text-accent ring-accent/30" : "bg-danger/15 text-danger ring-danger/30",
        className,
      )}
      title={`Moved ${pct.toFixed(2)}% since your last visit`}
    >
      {up ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
      Moved
    </span>
  );
}
