"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ArrowDownRight, History } from "lucide-react";
import { getSnapshot, markSnapshot } from "@/lib/visit-local";
import { cn } from "@/lib/utils";

type Row = { symbol: string; label: string; price: number };

export function SinceLastVisit({ rows }: { rows: Row[] }) {
  const [snapshot] = useState(() => getSnapshot());

  useEffect(() => {
    markSnapshot(rows.map((r) => ({ symbol: r.symbol, price: r.price })));
  }, [rows]);

  const diffs = useMemo(() => {
    const now = Date.now();
    return rows
      .map((r) => {
        const snap = snapshot[r.symbol];
        if (!snap || !Number.isFinite(snap.price) || snap.price <= 0) return null;
        const ageHrs = (now - snap.ts) / 3_600_000;
        if (ageHrs < 1) return null;
        const pct = ((r.price - snap.price) / snap.price) * 100;
        if (!Number.isFinite(pct) || Math.abs(pct) < 0.05) return null;
        return { ...r, pct, ageHrs };
      })
      .filter((d): d is Row & { pct: number; ageHrs: number } => d !== null)
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
      .slice(0, 4);
  }, [rows, snapshot]);

  if (diffs.length === 0) return null;

  const oldestHrs = Math.max(...diffs.map((d) => d.ageHrs));
  const ago = oldestHrs >= 24 ? `${Math.round(oldestHrs / 24)}d` : `${Math.round(oldestHrs)}h`;

  return (
    <section className="surface relative mt-6 overflow-hidden p-5">
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand via-brand-2 to-accent" />
      <div className="relative flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand">
          <History className="h-3 w-3" /> Since you were last here · {ago} ago
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {diffs.map((d) => {
            const up = d.pct >= 0;
            return (
              <span
                key={d.symbol}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ring-1",
                  up ? "bg-accent/10 text-accent ring-accent/20" : "bg-danger/10 text-danger ring-danger/20",
                )}
              >
                {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                <span className="text-fg/90">{d.label}</span>
                <span>{up ? "+" : ""}{d.pct.toFixed(2)}%</span>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
