"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Stethoscope, Bell, Newspaper, Star, LineChart, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "solid" | "outline" | "bare";

type Props = {
  symbol: string;
  name?: string;
  variant?: Variant;
  size?: "xs" | "sm" | "md";
  className?: string;
  children?: React.ReactNode;
};

const SIZES: Record<NonNullable<Props["size"]>, string> = {
  xs: "text-[10px] px-1.5 py-0.5",
  sm: "text-[11px] px-2 py-0.5",
  md: "text-xs px-2.5 py-1",
};

const VARIANTS: Record<Variant, string> = {
  solid:
    "bg-brand/90 text-white font-bold tracking-wide hover:bg-brand shadow-sm ring-1 ring-brand/60",
  outline:
    "bg-brand/10 text-brand font-bold ring-1 ring-brand/30 hover:bg-brand/20",
  bare:
    "font-semibold text-brand hover:underline",
};

/**
 * Ticker pill with a hover popover offering quick actions.
 * Renders as a Link (the stock page is the destination); the popover
 * exposes secondary jumps — watchlist, alerts, doctor, should-i-buy.
 */
export function TickerChip({ symbol, name, variant = "outline", size = "sm", className, children }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<"bottom" | "top">("bottom");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popId = useId();

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const openNow = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    // Pick placement based on room below.
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom;
      setPos(below < 220 ? "top" : "bottom");
    }
    setOpen(true);
  };
  const closeLater = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  return (
    <span
      ref={wrapRef}
      className="relative inline-block"
      onMouseEnter={openNow}
      onMouseLeave={closeLater}
      onFocus={openNow}
      onBlur={closeLater}
    >
      <Link
        href={`/stock/${symbol}`}
        aria-describedby={open ? popId : undefined}
        className={cn(
          "inline-flex items-center rounded-md transition",
          variant !== "bare" && SIZES[size],
          VARIANTS[variant],
          className,
        )}
      >
        {children ?? symbol}
      </Link>
      {open && (
        <span
          id={popId}
          role="tooltip"
          className={cn(
            "absolute left-1/2 z-50 w-64 -translate-x-1/2 rounded-xl border border-border-strong bg-card/95 p-2 shadow-glow backdrop-blur fade-up",
            pos === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
          )}
          onMouseEnter={openNow}
          onMouseLeave={closeLater}
        >
          <span className="mb-1.5 flex items-center justify-between px-2 pt-1">
            <span className="text-[11px] font-bold tracking-wide text-fg">{symbol}</span>
            {name && (
              <span className="ml-2 truncate text-[10px] text-muted">{name}</span>
            )}
          </span>
          <span className="grid grid-cols-1 gap-0.5">
            <ChipAction href={`/stock/${symbol}`} icon={LineChart} label="Open stock page" />
            <ChipAction href={`/tools/doctor?symbol=${symbol}`} icon={Stethoscope} label="Doctor verdict" />
            <ChipAction href={`/tools/should-i-buy?symbol=${symbol}`} icon={ShoppingCart} label="Should I buy?" />
            <ChipAction href={`/alerts?symbol=${symbol}`} icon={Bell} label="Set an alert" />
            <ChipAction href={`/watchlist?add=${symbol}`} icon={Star} label="Add to watchlist" />
            <ChipAction href={`/news?stock=${symbol}`} icon={Newspaper} label="Read news" />
          </span>
        </span>
      )}
    </span>
  );
}

function ChipAction({
  href, icon: Icon, label,
}: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-fg transition hover:bg-brand/10 hover:text-brand"
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Link>
  );
}
