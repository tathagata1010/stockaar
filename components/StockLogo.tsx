"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Sector } from "@/lib/nse-symbols";
import { STOCK_DOMAINS } from "@/lib/stock-domains";

const SECTOR_GRADIENTS: Record<Sector, [string, string]> = {
  IT:               ["#6366f1", "#06b6d4"],
  Banks:            ["#0ea5e9", "#1d4ed8"],
  NBFC:             ["#3b82f6", "#8b5cf6"],
  Auto:             ["#ef4444", "#f59e0b"],
  Pharma:           ["#10b981", "#14b8a6"],
  FMCG:             ["#f59e0b", "#ec4899"],
  Energy:           ["#f97316", "#dc2626"],
  Metals:           ["#64748b", "#475569"],
  Telecom:          ["#8b5cf6", "#d946ef"],
  Cement:           ["#a3a3a3", "#525252"],
  Power:            ["#fbbf24", "#f97316"],
  Insurance:        ["#06b6d4", "#0891b2"],
  Consumer:         ["#ec4899", "#f43f5e"],
  Realty:           ["#84cc16", "#22c55e"],
  "Capital Goods":  ["#7c3aed", "#2563eb"],
  Chemicals:        ["#14b8a6", "#0ea5e9"],
  Infrastructure:   ["#d97706", "#92400e"],
  Media:            ["#e11d48", "#9f1239"],
  Logistics:        ["#0891b2", "#1e40af"],
  Textiles:         ["#db2777", "#a21caf"],
  Agri:             ["#65a30d", "#166534"],
  Other:            ["#6366f1", "#a855f7"],
};

function pickGradient(symbol: string, sector?: Sector): [string, string] {
  if (sector && SECTOR_GRADIENTS[sector]) return SECTOR_GRADIENTS[sector];
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) | 0;
  const sectors = Object.values(SECTOR_GRADIENTS);
  return sectors[Math.abs(h) % sectors.length];
}

function getInitials(symbol: string): string {
  const clean = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return clean.slice(0, 2);
}

const SIZE_PX: Record<string, number> = {
  xs: 24, sm: 32, md: 40, lg: 56, xl: 80,
};

export function StockLogo({
  symbol,
  name,
  sector,
  domain: domainProp,
  size = "md",
  className,
  animated = true,
}: {
  symbol: string;
  name?: string;
  sector?: Sector;
  domain?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  animated?: boolean;
}) {
  // Only use an *explicitly known* mapped domain. Name-derived guesses produce
  // mostly-wrong domains that Google s2 then renders as a generic globe — worse
  // than the gradient initials fallback. So we don't try to guess here.
  const domain = domainProp ?? STOCK_DOMAINS[symbol.toUpperCase()];
  // 0 = google s2 favicon (always returns a valid PNG), 1 = gradient fallback.
  const [errored, setErrored] = useState(false);

  const [c1, c2] = pickGradient(symbol, sector);
  const initials = getInitials(symbol);
  const px = SIZE_PX[size];

  const sizes = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-lg",
    xl: "h-20 w-20 text-2xl",
  };

  const wrap = cn(
    "relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-xl font-bold text-white shadow-md ring-1 ring-black/5 dark:ring-white/10 bg-white",
    animated && "transition-transform duration-300 hover:scale-110 hover:rotate-3",
    sizes[size],
    className,
  );

  if (domain && !errored) {
    const src = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    return (
      <div className={wrap} aria-label={`${symbol} logo`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`${symbol} logo`}
          width={px}
          height={px}
          loading="lazy"
          className="h-full w-full object-contain p-1"
          onError={() => setErrored(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(wrap, "bg-transparent")}
      style={{ backgroundImage: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}
      aria-label={`${symbol} logo`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.6), transparent 50%)",
        }}
      />
      <span className="relative tracking-tight drop-shadow-sm">{initials}</span>
    </div>
  );
}
