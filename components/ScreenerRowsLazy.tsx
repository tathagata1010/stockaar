"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn, formatINR, formatPct } from "@/lib/utils";
import type { UniverseRow } from "@/lib/universe";
import { StockLogo } from "./StockLogo";

const SIGNAL_STYLES: Record<string, string> = {
  BUY: "bg-accent/20 text-accent border-accent/40",
  HOLD: "bg-muted/20 text-muted border-muted/40",
  SELL: "bg-danger/20 text-danger border-danger/40",
};

function fmtCr(n?: number): string {
  if (n === undefined || n === null) return "—";
  const cr = n / 1e7;
  if (cr >= 1e5) return `₹${(cr / 1e5).toFixed(2)}L Cr`;
  if (cr >= 1000) return `₹${(cr / 1000).toFixed(1)}K Cr`;
  return `₹${cr.toFixed(0)} Cr`;
}
function fmtNum(n?: number, digits = 1): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}
function fmtPctVal(n?: number, digits = 1): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

function PillarCell({ value }: { value?: number }) {
  if (value === undefined) return <td className="px-3 py-3 text-right text-muted">—</td>;
  const color = value >= 70 ? "text-accent" : value >= 40 ? "text-fg" : "text-danger";
  return <td className={cn("px-3 py-3 text-right tabular-nums", color)}>{value}</td>;
}

const PAGE = 25;

export function ScreenerRowsLazy({ rows }: { rows: UniverseRow[] }) {
  const [count, setCount] = useState(PAGE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setCount(PAGE), [rows]);

  useEffect(() => {
    if (count >= rows.length || !sentinelRef.current) return;
    const el = sentinelRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setCount((c) => Math.min(c + PAGE, rows.length));
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [count, rows.length]);

  const shown = rows.slice(0, count);
  return (
    <>
      <tbody>
        {shown.map((r, idx) => {
          const q = r.quote;
          const fu = r.fundamentals;
          const sc = r.scorecard;
          const up = q && q.changePct >= 0;
          return (
            <tr key={r.entry.symbol} className={`border-b border-border/40 last:border-0 hover:bg-border/20 fade-up-${(idx % 5) + 1}`}>
              <td className="px-3 py-3">
                <Link href={`/stock/${r.entry.symbol}`} className="flex items-center gap-2.5">
                  <StockLogo symbol={r.entry.symbol} sector={r.entry.sector} size="sm" />
                  <div className="min-w-0">
                    <div className="font-semibold">{r.entry.symbol}</div>
                    <div className="text-[11px] text-muted line-clamp-1">
                      {r.entry.sector}{r.entry.industry ? ` · ${r.entry.industry}` : ""}
                    </div>
                  </div>
                </Link>
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{q ? formatINR(q.lastPrice) : "—"}</td>
              <td className={cn(
                "px-3 py-3 text-right font-medium tabular-nums",
                q && (up ? "text-accent" : "text-danger"),
              )}>
                {q ? formatPct(q.changePct) : "—"}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{fmtCr(fu?.marketCap)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{fmtNum(fu?.trailingPE)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{fmtNum(fu?.priceToBook, 2)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{fmtPctVal(fu?.dividendYield)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{fmtPctVal(fu?.returnOnEquity)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{fmtPctVal(fu?.profitMargin)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{fmtPctVal(fu?.revenueGrowth)}</td>
              <td className="px-3 py-3 text-right tabular-nums">
                {r.rangePosition !== null ? `${r.rangePosition.toFixed(0)}%` : "—"}
              </td>
              <PillarCell value={sc?.pillars.valuation.score} />
              <PillarCell value={sc?.pillars.growth.score} />
              <PillarCell value={sc?.pillars.quality.score} />
              <PillarCell value={sc?.pillars.momentum.score} />
              <td className="px-3 py-3 text-right font-semibold tabular-nums">{sc ? sc.composite : "—"}</td>
              <td className="px-3 py-3 text-right">
                {r.signal ? (
                  <span className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                    SIGNAL_STYLES[r.signal],
                  )}>{r.signal}</span>
                ) : <span className="text-xs text-muted">—</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
      {count < rows.length && (
        <tfoot>
          <tr>
            <td colSpan={17} className="px-3 py-6 text-center text-xs text-muted">
              <div ref={sentinelRef} className="inline-flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
                Loading {Math.min(PAGE, rows.length - count)} more of {rows.length}…
              </div>
            </td>
          </tr>
        </tfoot>
      )}
    </>
  );
}
