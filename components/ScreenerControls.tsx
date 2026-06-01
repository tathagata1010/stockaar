"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { ALL_SECTORS } from "@/lib/nse-symbols";
import { Select } from "@/components/ui/Select";
import {
  X, Filter, RotateCcw,
  BadgeIndianRupee, TrendingUp, Sparkles, Zap, Target, Gauge, Building2,
  LucideIcon,
} from "lucide-react";

type SP = Record<string, string | undefined>;

type Slider = {
  name: string; label: string;
  min: number; max: number; step: number;
  unit?: string;
  edge: "min" | "max";
};

const PILLARS: Slider[] = [
  { name: "scoreMin", label: "Composite",  min: 0, max: 100, step: 5, edge: "min" },
  { name: "valMin",   label: "Valuation",  min: 0, max: 100, step: 5, edge: "min" },
  { name: "grwMin",   label: "Growth",     min: 0, max: 100, step: 5, edge: "min" },
  { name: "qulMin",   label: "Quality",    min: 0, max: 100, step: 5, edge: "min" },
  { name: "momMin",   label: "Momentum",   min: 0, max: 100, step: 5, edge: "min" },
];

const VAL_SLIDERS: Slider[] = [
  { name: "peMax",  label: "P/E",       min: 0, max: 100, step: 1,    unit: "x", edge: "max" },
  { name: "pbMax",  label: "P/B",       min: 0, max: 20,  step: 0.5,  unit: "x", edge: "max" },
  { name: "divMin", label: "Div Yield", min: 0, max: 10,  step: 0.25, unit: "%", edge: "min" },
];

const QUALITY_SLIDERS: Slider[] = [
  { name: "roeMin",  label: "ROE",            min: 0, max: 60,  step: 1, unit: "%", edge: "min" },
  { name: "pmMin",   label: "Profit Margin",  min: 0, max: 50,  step: 1, unit: "%", edge: "min" },
  { name: "deMax",   label: "Debt / Equity",  min: 0, max: 300, step: 5, edge: "max" },
];

const GROWTH_SLIDERS: Slider[] = [
  { name: "revGrowMin",  label: "Revenue Growth",  min: -20, max: 100, step: 1, unit: "%", edge: "min" },
  { name: "earnGrowMin", label: "Earnings Growth", min: -20, max: 100, step: 1, unit: "%", edge: "min" },
];

const TECH_SLIDERS: Slider[] = [
  { name: "chgMin", label: "Min Today %",     min: -10, max: 10,  step: 0.5, unit: "%", edge: "min" },
  { name: "chgMax", label: "Max Today %",     min: -10, max: 10,  step: 0.5, unit: "%", edge: "max" },
  { name: "posMin", label: "Min 52W Pos",     min: 0,   max: 100, step: 5,   unit: "%", edge: "min" },
  { name: "posMax", label: "Max 52W Pos",     min: 0,   max: 100, step: 5,   unit: "%", edge: "max" },
];

// Sliders are in ₹ Crores of NET institutional flow over a 30-day rolling window
// (bulk + block deals classified by client name).
const FLOW_SLIDERS: Slider[] = [
  { name: "instNetMin", label: "Min Net FII+DII", min: 0, max: 500, step: 5, unit: "Cr", edge: "min" },
  { name: "fiiNetMin",  label: "Min Net FII",     min: 0, max: 300, step: 5, unit: "Cr", edge: "min" },
  { name: "diiNetMin",  label: "Min Net DII",     min: 0, max: 300, step: 5, unit: "Cr", edge: "min" },
];

const ALL_SLIDERS = [...PILLARS, ...VAL_SLIDERS, ...QUALITY_SLIDERS, ...GROWTH_SLIDERS, ...TECH_SLIDERS, ...FLOW_SLIDERS];
const SLIDER_BY_NAME = new Map(ALL_SLIDERS.map((s) => [s.name, s] as const));

const CAP_OPTIONS = [
  { value: "all",   label: "All caps" },
  { value: "mega",  label: "Mega (>₹2L Cr)" },
  { value: "large", label: "Large (₹50K–2L Cr)" },
  { value: "mid",   label: "Mid (₹10K–50K Cr)" },
  { value: "small", label: "Small (<₹10K Cr)" },
];
const SIGNAL_OPTIONS = [
  { value: "all",  label: "Any signal" },
  { value: "BUY",  label: "BUY only" },
  { value: "HOLD", label: "HOLD only" },
  { value: "SELL", label: "SELL only" },
];

const PRESET_TONES: Record<string, { active: string; idle: string }> = {
  brand:   { active: "border-brand/60   bg-brand/15   text-brand   shadow-glow", idle: "border-border hover:border-brand/60 hover:text-brand" },
  accent:  { active: "border-accent/60  bg-accent/15  text-accent  shadow-glow", idle: "border-border hover:border-accent/60 hover:text-accent" },
  danger:  { active: "border-danger/60  bg-danger/15  text-danger  shadow-glow", idle: "border-border hover:border-danger/60 hover:text-danger" },
  warning: { active: "border-warning/60 bg-warning/15 text-warning shadow-glow", idle: "border-border hover:border-warning/60 hover:text-warning" },
};

const PRESETS: { name: string; icon: LucideIcon; tone: keyof typeof PRESET_TONES; params: Record<string, string> }[] = [
  { name: "FII/DII inflow",       icon: Building2,        tone: "accent",  params: { instNetMin: "25", cap: "large", momMin: "55" } },
  { name: "Value picks",          icon: BadgeIndianRupee, tone: "brand",   params: { peMax: "20", pbMax: "3", divMin: "1", scoreMin: "55" } },
  { name: "Growth stars",         icon: TrendingUp,       tone: "accent",  params: { revGrowMin: "15", earnGrowMin: "15", qulMin: "55" } },
  { name: "Quality compounders",  icon: Sparkles,         tone: "brand",   params: { roeMin: "18", pmMin: "12", deMax: "80", scoreMin: "60" } },
  { name: "Momentum leaders",     icon: Zap,              tone: "warning", params: { momMin: "70", posMin: "70", chgMin: "0" } },
  { name: "Strong BUY signals",   icon: Target,           tone: "accent",  params: { signal: "BUY", scoreMin: "70" } },
  { name: "Beaten down",          icon: Gauge,            tone: "danger",  params: { posMax: "25", peMax: "25", qulMin: "50" } },
];

function isSliderActive(value: string | undefined, slider: Slider): boolean {
  if (!value) return false;
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  return slider.edge === "min" ? n > slider.min : n < slider.max;
}

function normalize(sp: SP): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (v == null || v === "" || v === "all") continue;
    if (k === "sort" || k === "dir") continue;
    out[k] = v;
  }
  return out;
}

export function ScreenerControls({
  industries,
  searchParams,
  children,
}: {
  industries: string[];
  searchParams: SP;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [local, setLocal] = useState<Record<string, string>>(() => normalize(searchParams));

  // Re-sync local when URL changes externally (e.g. user clicks back/forward)
  const spKey = useMemo(() => JSON.stringify(normalize(searchParams)), [searchParams]);
  useEffect(() => {
    setLocal(normalize(searchParams));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spKey]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushUrl = (next: Record<string, string>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const qs = new URLSearchParams();
      const sort = searchParams.sort;
      const dir = searchParams.dir;
      if (sort) qs.set("sort", sort);
      if (dir) qs.set("dir", dir);
      for (const [k, v] of Object.entries(next)) {
        if (!v || v === "all") continue;
        qs.set(k, v);
      }
      const qsStr = qs.toString();
      startTransition(() => router.replace(qsStr ? `/screener?${qsStr}` : "/screener", { scroll: false }));
    }, 220);
  };

  const setField = (key: string, value: string) => {
    setLocal((prev) => {
      const next = { ...prev };
      if (!value || value === "all") delete next[key];
      else next[key] = value;
      pushUrl(next);
      return next;
    });
  };

  const removeField = (key: string) => {
    setLocal((prev) => {
      const next = { ...prev };
      delete next[key];
      pushUrl(next);
      return next;
    });
  };

  const resetAll = () => {
    setLocal({});
    pushUrl({});
  };

  const activePresetName = useMemo(() => {
    return PRESETS.find((p) => {
      const presetKeys = Object.keys(p.params);
      const localKeys = Object.keys(local);
      if (presetKeys.length !== localKeys.length) return false;
      return presetKeys.every((k) => local[k] === p.params[k]);
    })?.name;
  }, [local]);

  const applyPreset = (params: Record<string, string>) => {
    setLocal(params);
    pushUrl(params);
  };

  const chips = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    if (local.sector) out.push({ key: "sector", label: `Sector: ${local.sector}` });
    if (local.industry) out.push({ key: "industry", label: `Industry: ${local.industry}` });
    if (local.cap) {
      const c = CAP_OPTIONS.find((o) => o.value === local.cap);
      if (c) out.push({ key: "cap", label: c.label });
    }
    if (local.signal) out.push({ key: "signal", label: `${local.signal} only` });
    for (const k of Object.keys(local)) {
      const s = SLIDER_BY_NAME.get(k);
      if (s && isSliderActive(local[k], s)) {
        const op = s.edge === "min" ? "≥" : "≤";
        out.push({ key: k, label: `${s.label} ${op} ${local[k]}${s.unit ?? ""}` });
      }
    }
    return out;
  }, [local]);

  return (
    <>
      {/* Preset row */}
      <div className="mt-5 flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const Icon = p.icon;
          const active = activePresetName === p.name;
          const tone = PRESET_TONES[p.tone];
          return (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p.params)}
              className={cn(
                "group inline-flex items-center gap-1.5 rounded-full border bg-card/70 px-3 py-1.5 text-xs font-semibold backdrop-blur transition hover:-translate-y-0.5",
                active ? tone.active : tone.idle,
              )}
            >
              <Icon className="h-3 w-3" />
              {p.name}
            </button>
          );
        })}
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Active</span>
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => removeField(c.key)}
              className="group inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand transition hover:bg-brand/20"
            >
              {c.label}
              <X className="h-3 w-3 opacity-70 transition group-hover:opacity-100" />
            </button>
          ))}
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2.5 py-0.5 text-[11px] font-semibold text-muted transition hover:border-danger/40 hover:text-danger"
          >
            <RotateCcw className="h-3 w-3" />
            Reset all
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Sticky live filter rail */}
        <aside className="lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto pr-1">
          <div className={cn(
            "surface relative overflow-hidden p-5 transition",
            pending && "ring-1 ring-brand/40",
          )}>
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand via-brand-2 to-accent" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  <Filter className="h-4 w-4 text-brand" />
                  Live filters
                </div>
                <span className={cn(
                  "inline-flex h-2 w-2 rounded-full transition",
                  pending ? "bg-brand animate-pulse" : "bg-accent/60",
                )} />
              </div>

              <SelectField label="Sector" name="sector" value={local.sector ?? "all"} onChange={setField}
                options={[{ value: "all", label: "All sectors" }, ...ALL_SECTORS.map((s) => ({ value: s, label: s }))]} />
              <SelectField label="Industry" name="industry" value={local.industry ?? "all"} onChange={setField}
                options={[{ value: "all", label: "All industries" }, ...industries.map((i) => ({ value: i, label: i }))]} />
              <SelectField label="Market Cap" name="cap" value={local.cap ?? "all"} onChange={setField} options={CAP_OPTIONS} />
              <SelectField label="Signal" name="signal" value={local.signal ?? "all"} onChange={setField} options={SIGNAL_OPTIONS} />

              <SliderGroup title="Scorecard Pillars" sliders={PILLARS} local={local} onChange={setField} />
              <SliderGroup title="Institutional Flow (30d)" sliders={FLOW_SLIDERS} local={local} onChange={setField} />
              <SliderGroup title="Valuation" sliders={VAL_SLIDERS} local={local} onChange={setField} />
              <SliderGroup title="Quality" sliders={QUALITY_SLIDERS} local={local} onChange={setField} />
              <SliderGroup title="Growth" sliders={GROWTH_SLIDERS} local={local} onChange={setField} />
              <SliderGroup title="Technicals" sliders={TECH_SLIDERS} local={local} onChange={setField} />
            </div>
          </div>
        </aside>

        <div className={cn("min-w-0 transition-opacity", pending && "opacity-60")}>
          {children}
        </div>
      </div>
    </>
  );
}

function SelectField({
  label, name, value, onChange, options,
}: {
  label: string; name: string; value: string;
  onChange: (k: string, v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="mt-3 flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>
      <Select
        value={value}
        onChange={(v) => onChange(name, v)}
        options={options}
        ariaLabel={label}
      />
    </label>
  );
}

function SliderGroup({
  title, sliders, local, onChange,
}: {
  title: string;
  sliders: Slider[];
  local: Record<string, string>;
  onChange: (k: string, v: string) => void;
}) {
  return (
    <div className="mt-5 border-t border-border/60 pt-4">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</div>
      <div className="space-y-3">
        {sliders.map((s) => (
          <SliderRow key={s.name} slider={s} value={local[s.name]} onChange={onChange} />
        ))}
      </div>
    </div>
  );
}

function SliderRow({
  slider, value, onChange,
}: {
  slider: Slider;
  value: string | undefined;
  onChange: (k: string, v: string) => void;
}) {
  const active = isSliderActive(value, slider);
  const fallback = slider.edge === "min" ? slider.min : slider.max;
  const num = value != null && Number.isFinite(Number(value)) ? Number(value) : fallback;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className={cn("font-medium", active ? "text-fg" : "text-muted")}>{slider.label}</span>
        <span className={cn(
          "num-display rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ring-1 transition",
          active ? "bg-brand/15 text-brand ring-brand/30" : "bg-bg-2 text-muted ring-border",
        )}>
          {slider.edge === "min" ? "≥ " : "≤ "}{num}{slider.unit ?? ""}
        </span>
      </div>
      <input
        type="range"
        min={slider.min}
        max={slider.max}
        step={slider.step}
        value={num}
        onChange={(e) => onChange(slider.name, e.target.value)}
        onDoubleClick={() => onChange(slider.name, "")}
        className={cn(
          "mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full accent-brand transition",
          active ? "bg-brand/20" : "bg-bg-2",
        )}
        title={`Double-click to clear ${slider.label}`}
      />
    </div>
  );
}
