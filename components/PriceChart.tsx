"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { cn, formatINR, formatPct } from "@/lib/utils";
import { CHART_COLORS } from "@/lib/chart-theme";
import { useChartTheme } from "@/lib/hooks/useChartTheme";

const RANGES = [
  { key: "1d",  label: "1D" },
  { key: "5d",  label: "5D" },
  { key: "1mo", label: "1M" },
  { key: "3mo", label: "3M" },
  { key: "6mo", label: "6M" },
  { key: "1y",  label: "1Y" },
  { key: "5y",  label: "5Y" },
] as const;

type Point = { t: number; p: number };

export function PriceChart({
  symbol, exchange, historyPath, title,
}: {
  symbol: string;
  exchange: "NSE" | "BSE";
  historyPath?: string;
  title?: string;
}) {
  const [range, setRange] = useState<typeof RANGES[number]["key"]>("1mo");
  const [points, setPoints] = useState<Point[]>([]);
  const [prevClose, setPrevClose] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const base = historyPath ?? `/api/stocks/${symbol}/history`;
    const sep = base.includes("?") ? "&" : "?";
    const url = `${base}${sep}range=${range}&exchange=${exchange}`;
    fetch(url, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setPoints([]); return; }
        setPoints(d.data.points);
        setPrevClose(d.data.previousClose);
      })
      .catch((e) => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [symbol, exchange, range, historyPath]);

  const { open, last, change, changePct, up } = useMemo(() => {
    if (points.length < 2) return { open: 0, last: 0, change: 0, changePct: 0, up: true };
    const open = range === "1d" ? (prevClose ?? points[0].p) : points[0].p;
    const last = points[points.length - 1].p;
    const change = last - open;
    return { open, last, change, changePct: open ? (change / open) * 100 : 0, up: change >= 0 };
  }, [points, prevClose, range]);

  const stroke = up ? CHART_COLORS.accent : CHART_COLORS.danger;
  const reactId = useId();
  const gradId = `grad-${reactId}-${up ? "u" : "d"}`;
  const { colors, tooltipStyle, itemStyle, labelStyle } = useChartTheme();

  return (
    <div className="rounded-lg border border-border bg-card p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                "shrink-0 rounded px-2.5 py-1 text-xs font-medium transition sm:px-3",
                range === r.key ? "bg-fg text-bg" : "text-muted hover:bg-border/40 hover:text-fg",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        {points.length > 0 && (
          <div className="text-right text-sm">
            <span className="tabular-nums">{formatINR(last)}</span>
            <span className={cn("ml-2 tabular-nums", up ? "text-accent" : "text-danger")}>
              {up ? "+" : ""}{change.toFixed(2)} ({formatPct(changePct)})
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 h-56 w-full sm:h-72">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">Loading…</div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-sm text-danger">{error}</div>
        ) : points.length < 2 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">No data for this range.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={stroke} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t: number) => formatTick(t, range)}
                stroke={colors.axis}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={["auto", "auto"]}
                stroke={colors.axis}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={50}
                tickFormatter={(v: number) => v.toFixed(0)}
                orientation="right"
              />
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={itemStyle}
                labelStyle={labelStyle}
                formatter={(v: number) => [formatINR(v), "Price"]}
                labelFormatter={(t: number | string) => new Date(t as number).toLocaleString("en-IN")}
              />
              {prevClose && range === "1d" && (
                <ReferenceLine y={prevClose} stroke={colors.axis} strokeDasharray="3 3" />
              )}
              <Area
                type="monotone"
                dataKey="p"
                stroke={stroke}
                strokeWidth={2}
                fill={`url(#${gradId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function formatTick(t: number, range: string) {
  const d = new Date(t);
  if (range === "1d" || range === "5d") {
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (range === "1mo" || range === "3mo") {
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  }
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}
