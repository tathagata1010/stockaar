"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  ComposedChart, LineChart, Area, Line, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceDot,
} from "recharts";
import { cn, formatINR, formatPct } from "@/lib/utils";
import { CHART_COLORS } from "@/lib/chart-theme";
import { useChartTheme } from "@/lib/hooks/useChartTheme";
import { computeSMA, computeRsiSeries } from "@/lib/technicals";

const RANGES = [
  { key: "1d",  label: "1D" },
  { key: "5d",  label: "5D" },
  { key: "1mo", label: "1M" },
  { key: "3mo", label: "3M" },
  { key: "6mo", label: "6M" },
  { key: "1y",  label: "1Y" },
  { key: "5y",  label: "5Y" },
] as const;

type Range = typeof RANGES[number]["key"];
type Point = { t: number; p: number; v?: number };

export type ChartMarker = {
  t: number;
  label: string;
  kind: "dividend" | "split";
};

type Toggles = {
  ma20: boolean;
  ma50: boolean;
  ma200: boolean;
  volume: boolean;
  rsi: boolean;
};

const DEFAULT_TOGGLES: Toggles = {
  ma20: true, ma50: false, ma200: false, volume: false, rsi: false,
};

const TOGGLE_STORAGE_KEY = "stockaar:chart-toggles:v1";

export function PriceChartAdvanced({
  symbol,
  exchange,
  markers: markersProp,
}: {
  symbol: string;
  exchange: "NSE" | "BSE";
  markers?: ChartMarker[];
}) {
  const [range, setRange] = useState<Range>("1mo");
  const [points, setPoints] = useState<Point[]>([]);
  const [prevClose, setPrevClose] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggles, setToggles] = useState<Toggles>(DEFAULT_TOGGLES);
  const [fetchedMarkers, setFetchedMarkers] = useState<ChartMarker[] | null>(null);
  const markers = markersProp ?? fetchedMarkers ?? [];

  useEffect(() => {
    if (markersProp) return;
    const ctrl = new AbortController();
    fetch(`/api/stocks/${symbol}/corporate-actions?exchange=${exchange}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        const actions = d?.data;
        if (!actions) return;
        const out: ChartMarker[] = [];
        for (const div of actions.dividends ?? []) {
          out.push({ t: div.date, kind: "dividend", label: `Dividend ₹${Number(div.amount).toFixed(2)}` });
        }
        for (const sp of actions.splits ?? []) {
          out.push({ t: sp.date, kind: "split", label: `Split ${sp.numerator}:${sp.denominator}` });
        }
        setFetchedMarkers(out);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [symbol, exchange, markersProp]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TOGGLE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Toggles>;
        setToggles({ ...DEFAULT_TOGGLES, ...parsed });
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(TOGGLE_STORAGE_KEY, JSON.stringify(toggles));
    } catch {}
  }, [toggles]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const url = `/api/stocks/${symbol}/history?range=${range}&exchange=${exchange}`;
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
  }, [symbol, exchange, range]);

  const enriched = useMemo(() => {
    if (points.length === 0) return [];
    const closes = points.map((p) => p.p);
    const ma20 = computeSMA(closes, 20);
    const ma50 = computeSMA(closes, 50);
    const ma200 = computeSMA(closes, 200);
    const rsi = computeRsiSeries(closes, 14);
    return points.map((p, i) => ({
      t: p.t,
      p: p.p,
      v: p.v ?? 0,
      ma20: ma20[i],
      ma50: ma50[i],
      ma200: ma200[i],
      rsi: rsi[i],
    }));
  }, [points]);

  const { open, last, change, changePct, up } = useMemo(() => {
    if (points.length < 2) return { open: 0, last: 0, change: 0, changePct: 0, up: true };
    const o = range === "1d" ? (prevClose ?? points[0].p) : points[0].p;
    const l = points[points.length - 1].p;
    const c = l - o;
    return { open: o, last: l, change: c, changePct: o ? (c / o) * 100 : 0, up: c >= 0 };
  }, [points, prevClose, range]);

  const stroke = up ? CHART_COLORS.accent : CHART_COLORS.danger;
  const reactId = useId();
  const gradId = `grad-${reactId}-${up ? "u" : "d"}`;
  const { colors, tooltipStyle, itemStyle, labelStyle } = useChartTheme();

  const showMA200 = points.length >= 200;
  const ma200Disabled = !showMA200;
  const hasVolume = points.some((p) => p.v && p.v > 0);

  const inRangeMarkers = useMemo(() => {
    if (!markers || !markers.length || !points.length) return [];
    const min = points[0].t;
    const max = points[points.length - 1].t;
    return markers.filter((m) => m.t >= min && m.t <= max);
  }, [markers, points]);

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-soft sm:p-5">
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

      <div className="mt-3 flex flex-wrap gap-1.5">
        <ToggleChip label="MA20" active={toggles.ma20} onClick={() => setToggles((t) => ({ ...t, ma20: !t.ma20 }))} color={colors.brand2} />
        <ToggleChip label="MA50" active={toggles.ma50} onClick={() => setToggles((t) => ({ ...t, ma50: !t.ma50 }))} color={colors.brand} />
        <ToggleChip
          label="MA200"
          active={toggles.ma200 && !ma200Disabled}
          disabled={ma200Disabled}
          onClick={() => !ma200Disabled && setToggles((t) => ({ ...t, ma200: !t.ma200 }))}
          color={colors.muted}
        />
        <ToggleChip label="Volume" active={toggles.volume && hasVolume} disabled={!hasVolume} onClick={() => hasVolume && setToggles((t) => ({ ...t, volume: !t.volume }))} />
        <ToggleChip label="RSI" active={toggles.rsi} onClick={() => setToggles((t) => ({ ...t, rsi: !t.rsi }))} />
      </div>

      <div className={cn("mt-3 w-full", toggles.rsi ? "h-56 sm:h-64" : "h-64 sm:h-80")}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">Loading…</div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-sm text-danger">{error}</div>
        ) : points.length < 2 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">No data for this range.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={enriched} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
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
                yAxisId="price"
                domain={["auto", "auto"]}
                stroke={colors.axis}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={50}
                tickFormatter={(v: number) => v.toFixed(0)}
                orientation="right"
              />
              {toggles.volume && hasVolume && (
                <YAxis
                  yAxisId="volume"
                  hide
                  domain={[0, (dataMax: number) => dataMax * 4]}
                />
              )}
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={itemStyle}
                labelStyle={labelStyle}
                formatter={(value: number | string, name: string) => {
                  if (name === "Volume") return [formatVolume(Number(value)), name];
                  if (typeof value === "number") return [formatINR(value), name];
                  return [value, name];
                }}
                labelFormatter={(t: number | string) => new Date(t as number).toLocaleString("en-IN")}
              />
              {prevClose && range === "1d" && (
                <ReferenceLine yAxisId="price" y={prevClose} stroke={colors.axis} strokeDasharray="3 3" />
              )}
              {toggles.volume && hasVolume && (
                <Bar
                  yAxisId="volume"
                  dataKey="v"
                  fill={colors.muted}
                  fillOpacity={0.2}
                  name="Volume"
                  isAnimationActive={false}
                />
              )}
              <Area
                yAxisId="price"
                type="monotone"
                dataKey="p"
                stroke={stroke}
                strokeWidth={2}
                fill={`url(#${gradId})`}
                name="Price"
                isAnimationActive={false}
              />
              {toggles.ma20 && (
                <Line yAxisId="price" type="monotone" dataKey="ma20" stroke={colors.brand2} strokeWidth={1.25} dot={false} name="MA20" isAnimationActive={false} connectNulls />
              )}
              {toggles.ma50 && (
                <Line yAxisId="price" type="monotone" dataKey="ma50" stroke={colors.brand} strokeWidth={1.25} dot={false} name="MA50" isAnimationActive={false} connectNulls />
              )}
              {toggles.ma200 && !ma200Disabled && (
                <Line yAxisId="price" type="monotone" dataKey="ma200" stroke={colors.muted} strokeWidth={1.25} strokeDasharray="4 3" dot={false} name="MA200" isAnimationActive={false} connectNulls />
              )}
              {inRangeMarkers.map((m, i) => (
                <ReferenceDot
                  key={`${m.kind}-${m.t}-${i}`}
                  yAxisId="price"
                  x={m.t}
                  y={priceAt(enriched, m.t)}
                  r={5}
                  fill={m.kind === "dividend" ? colors.accent : colors.warning}
                  stroke={colors.card}
                  strokeWidth={1.5}
                  ifOverflow="extendDomain"
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {toggles.rsi && enriched.length > 14 && (
        <div className="mt-2 h-20 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={enriched} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} hide />
              <YAxis domain={[0, 100]} stroke={colors.axis} fontSize={10} tickLine={false} axisLine={false} width={28} orientation="right" ticks={[30, 50, 70]} />
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={itemStyle}
                labelStyle={labelStyle}
                formatter={(v: number) => [typeof v === "number" ? v.toFixed(1) : v, "RSI"]}
                labelFormatter={(t: number | string) => new Date(t as number).toLocaleDateString("en-IN")}
              />
              <ReferenceLine y={70} stroke={colors.danger} strokeOpacity={0.4} strokeDasharray="3 3" />
              <ReferenceLine y={30} stroke={colors.accent} strokeOpacity={0.4} strokeDasharray="3 3" />
              <Line type="monotone" dataKey="rsi" stroke={colors.brand} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ToggleChip({
  label, active, onClick, color, disabled,
}: { label: string; active: boolean; onClick: () => void; color?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
        active
          ? "border-brand/60 bg-brand/10 text-brand"
          : "border-border bg-bg/40 text-muted hover:text-fg",
        disabled && "cursor-not-allowed opacity-40 hover:text-muted",
      )}
    >
      {color && (
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      )}
      {label}
    </button>
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

function formatVolume(v: number): string {
  if (!v) return "—";
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)} L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)} K`;
  return v.toFixed(0);
}

function priceAt(rows: { t: number; p: number }[], target: number): number {
  let best = rows[0];
  let bestDiff = Math.abs(rows[0].t - target);
  for (let i = 1; i < rows.length; i++) {
    const d = Math.abs(rows[i].t - target);
    if (d < bestDiff) { bestDiff = d; best = rows[i]; }
  }
  return best.p;
}
