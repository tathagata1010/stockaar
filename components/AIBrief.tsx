import {
  Sparkles, TrendingUp, TrendingDown, Zap, Shield, Target,
  Clock, Crown, Trophy, Coins, Rocket, Compass, ChartBar,
} from "lucide-react";
import type { AIBrief as AIBriefType } from "@/lib/ai-brief";
import { cn, formatINR } from "@/lib/utils";

function modelShortName(model: string): string {
  if (!model || model === "none") return "AI";
  if (model.includes("llama")) return "Llama";
  if (model.includes("deepseek")) return "DeepSeek";
  if (model.includes("mistral")) return "Mistral";
  if (model.includes("qwen")) return "Qwen";
  return model.split("/").pop() ?? "AI";
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function signalTone(s: string | null): { label: string; cls: string } {
  if (!s) return { label: "—", cls: "bg-card text-muted ring-border" };
  const u = s.toUpperCase();
  if (u.includes("STRONG BUY") || u === "BUY") return { label: s, cls: "bg-accent/15 text-accent ring-accent/30" };
  if (u.includes("SELL")) return { label: s, cls: "bg-danger/15 text-danger ring-danger/30" };
  return { label: s, cls: "bg-brand/15 text-brand ring-brand/30" };
}

function riskMeter(r: AIBriefType["riskLevel"]): { label: string; pct: number; color: string } {
  if (r === "Low") return { label: "Low", pct: 25, color: "bg-accent" };
  if (r === "Medium") return { label: "Medium", pct: 60, color: "bg-brand" };
  if (r === "High") return { label: "High", pct: 92, color: "bg-danger" };
  return { label: "—", pct: 0, color: "bg-muted" };
}

function horizonStep(h: AIBriefType["horizon"]): number {
  if (h === "Short") return 0;
  if (h === "Medium") return 1;
  if (h === "Long") return 2;
  return -1;
}

function fmtPct(n: number | null, mult = 100): string {
  if (n === null || !Number.isFinite(n)) return "n/a";
  return `${(n * mult).toFixed(1)}%`;
}
function fmtNum(n: number | null, d = 2): string {
  if (n === null || !Number.isFinite(n)) return "n/a";
  return n.toFixed(d);
}
function fmtCr(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "n/a";
  return `₹${(n / 1e7).toFixed(0)} Cr`;
}

export function AIBrief({ brief }: { brief: AIBriefType | null }) {
  if (!brief) {
    return (
      <section className="surface p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-semibold">AI Analysis</h3>
        </div>
        <p className="mt-3 text-sm text-muted">Analysis not available for this stock right now.</p>
      </section>
    );
  }

  const a = brief.analytics;
  const sig = signalTone(a?.signal ?? null);
  const risk = riskMeter(brief.riskLevel);
  const rangePos = a?.price && a?.yearHigh && a?.yearLow && a.yearHigh > a.yearLow
    ? Math.max(0, Math.min(1, (a.price - a.yearLow) / (a.yearHigh - a.yearLow)))
    : null;
  const hStep = horizonStep(brief.horizon);
  const scenarios = brief.scenarios ?? {
    bull: { price: null, pct: null, rationale: "" },
    base: { price: null, pct: null, rationale: "" },
    bear: { price: null, pct: null, rationale: "" },
  };
  const fit = brief.investorFit ?? { value: 0, growth: 0, dividend: 0, momentum: 0 };
  const catalysts = brief.catalysts ?? [];
  const bullPoints = brief.bullPoints ?? [];
  const bearPoints = brief.bearPoints ?? [];

  return (
    <section className="space-y-5">
      {/* Verdict header */}
      <div className="surface-strong p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-brand-fg shadow-pop">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">AI Analysis</h3>
              <p className="text-[11px] text-muted">
                {modelShortName(brief.model)} · {brief.cached ? "cached · " : ""}{timeAgo(brief.generatedAt)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ring-1", sig.cls)}>
              <Target className="h-3 w-3" /> {sig.label}
            </span>
            <RiskGauge risk={risk} />
          </div>
        </div>

        {brief.summary && (
          <p className="mt-4 text-sm leading-relaxed text-fg">{brief.summary}</p>
        )}

        {brief.moat && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-bg/40 p-3">
            <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-brand">Competitive moat</div>
              <p className="text-xs text-fg">{brief.moat}</p>
            </div>
          </div>
        )}
      </div>

      {/* Latest update callout (news synthesis) */}
      {brief.latestUpdate && (
        <div className="surface relative overflow-hidden p-4 sm:p-5">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand to-accent" />
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand">
            <Zap className="h-3 w-3" />
            Latest from news
          </div>
          <p className="text-sm leading-relaxed text-fg">{brief.latestUpdate}</p>
        </div>
      )}

      {/* Scenario projections — Bull / Base / Bear */}
      {(scenarios.bull.price || scenarios.base.price || scenarios.bear.price) && (
        <div className="surface p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChartBar className="h-3.5 w-3.5 text-muted" />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">12-month scenario map</h4>
            </div>
            {a?.price != null && <span className="text-[11px] text-muted">From {formatINR(a.price)}</span>}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <ScenarioCard kind="bull" data={scenarios.bull} current={a?.price ?? null} />
            <ScenarioCard kind="base" data={scenarios.base} current={a?.price ?? null} />
            <ScenarioCard kind="bear" data={scenarios.bear} current={a?.price ?? null} />
          </div>
          {a?.price != null && (scenarios.bull.price || scenarios.bear.price) && (
            <ScenarioBand
              current={a.price}
              bull={scenarios.bull.price}
              base={scenarios.base.price}
              bear={scenarios.bear.price}
            />
          )}
        </div>
      )}

      {/* Investor fit profiles */}
      {(fit.value + fit.growth + fit.dividend + fit.momentum) > 0 && (
        <div className="surface p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Compass className="h-3.5 w-3.5 text-muted" />
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Who is this stock for?</h4>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FitBar label="Value investor" icon={<Crown className="h-3.5 w-3.5" />} score={fit.value} hint="Cheap multiples, asset backing" />
            <FitBar label="Growth investor" icon={<Rocket className="h-3.5 w-3.5" />} score={fit.growth} hint="Revenue & earnings acceleration" />
            <FitBar label="Income investor" icon={<Coins className="h-3.5 w-3.5" />} score={fit.dividend} hint="Dividend yield & consistency" />
            <FitBar label="Momentum trader" icon={<Trophy className="h-3.5 w-3.5" />} score={fit.momentum} hint="Trend, news flow, breakouts" />
          </div>
        </div>
      )}

      {/* Holding horizon meter */}
      {hStep >= 0 && (
        <div className="surface p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted" />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Suggested holding horizon</h4>
            </div>
            <span className="text-xs font-semibold text-brand">{brief.horizon}</span>
          </div>
          <HorizonMeter step={hStep} />
        </div>
      )}

      {/* 52W position visualization */}
      {rangePos !== null && a?.price != null && a?.yearLow != null && a?.yearHigh != null && (
        <div className="surface p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">52-week price position</h4>
            <span className="text-xs text-muted tabular-nums">{(rangePos * 100).toFixed(0)}% of range</span>
          </div>
          <div className="relative h-2 rounded-full bg-bg/60 ring-1 ring-border">
            <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-gradient-to-r from-danger via-brand to-accent opacity-60" />
            <div
              className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg shadow-pop"
              style={{ left: `${rangePos * 100}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] tabular-nums text-muted">
            <span>Low {formatINR(a.yearLow)}</span>
            <span className="font-semibold text-fg">Now {formatINR(a.price)}</span>
            <span>High {formatINR(a.yearHigh)}</span>
          </div>
        </div>
      )}

      {/* Bull / Bear case */}
      {(bullPoints.length > 0 || bearPoints.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {bullPoints.length > 0 && (
            <PointList title="Bull case" icon={<TrendingUp className="h-3.5 w-3.5" />} tone="up" points={bullPoints} />
          )}
          {bearPoints.length > 0 && (
            <PointList title="Bear case" icon={<TrendingDown className="h-3.5 w-3.5" />} tone="down" points={bearPoints} />
          )}
        </div>
      )}

      {/* Catalysts */}
      {catalysts.length > 0 && (
        <div className="surface p-4 sm:p-5">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Catalysts to watch</h4>
          <ul className="space-y-2">
            {catalysts.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                <span className="text-fg">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Snapshot metrics (compact, just numbers — Scorecard handles the deep view) */}
      <div className="surface p-5">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Snapshot</h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label="P/E" value={fmtNum(a?.pe ?? null, 1)} />
          <MiniStat label="ROE" value={fmtPct(a?.roe ?? null)} />
          <MiniStat label="D/E" value={fmtNum(a?.debtToEquity ?? null, 0)} />
          <MiniStat label="Mkt Cap" value={fmtCr(a?.marketCap ?? null)} />
        </div>
      </div>

      {/* AI takeaway */}
      {brief.takeaway && (
        <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 to-brand/5 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-accent">What to watch next</div>
          <p className="mt-1 text-sm text-fg">{brief.takeaway}</p>
        </div>
      )}

      <p className="text-[11px] text-muted">
        AI-generated for informational purposes only. Not investment advice. Verify with primary sources.
      </p>
    </section>
  );
}

function RiskGauge({ risk }: { risk: { label: string; pct: number; color: string } }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-card px-2.5 py-1 ring-1 ring-border">
      <Shield className="h-3 w-3 text-muted" />
      <span className="text-[11px] text-muted">Risk</span>
      <div className="relative h-1.5 w-14 overflow-hidden rounded-full bg-bg ring-1 ring-border">
        <div className={cn("h-full rounded-full transition-all", risk.color)} style={{ width: `${risk.pct}%` }} />
      </div>
      <span className="text-xs font-semibold">{risk.label}</span>
    </div>
  );
}

function ScenarioCard({
  kind, data, current,
}: {
  kind: "bull" | "base" | "bear";
  data: { price: number | null; pct: number | null; rationale: string };
  current: number | null;
}) {
  const tone =
    kind === "bull" ? { ring: "border-accent/40 bg-accent/5", label: "Bull", chip: "text-accent", icon: <TrendingUp className="h-3 w-3" /> }
    : kind === "bear" ? { ring: "border-danger/40 bg-danger/5", label: "Bear", chip: "text-danger", icon: <TrendingDown className="h-3 w-3" /> }
    : { ring: "border-border bg-bg/40", label: "Base", chip: "text-brand", icon: <Target className="h-3 w-3" /> };
  return (
    <div className={cn("rounded-xl border p-3", tone.ring)}>
      <div className="flex items-center justify-between">
        <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide", tone.chip)}>
          {tone.icon} {tone.label}
        </span>
        {data.pct !== null && (
          <span className={cn("text-[11px] font-semibold tabular-nums", tone.chip)}>
            {data.pct >= 0 ? "+" : ""}{data.pct.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-1 num-display text-lg font-bold tabular-nums">
        {data.price !== null ? formatINR(data.price) : "—"}
      </div>
      {data.rationale && <p className="mt-1 text-[11px] leading-snug text-muted">{data.rationale}</p>}
    </div>
  );
}

function ScenarioBand({
  current, bull, base, bear,
}: {
  current: number; bull: number | null; base: number | null; bear: number | null;
}) {
  const pts = [bull, base, bear, current].filter((x): x is number => x !== null && x > 0);
  if (pts.length < 2) return null;
  const lo = Math.min(...pts) * 0.98;
  const hi = Math.max(...pts) * 1.02;
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-gradient-to-r from-danger/40 via-brand/40 to-accent/40 ring-1 ring-border">
        {bear !== null && (
          <Marker pos={pos(bear)} color="bg-danger" label="Bear" />
        )}
        {base !== null && (
          <Marker pos={pos(base)} color="bg-brand" label="Base" />
        )}
        {bull !== null && (
          <Marker pos={pos(bull)} color="bg-accent" label="Bull" />
        )}
        <div
          className="absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-fg"
          style={{ left: `${pos(current)}%` }}
          title="Current"
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted tabular-nums">
        <span>{formatINR(lo)}</span>
        <span className="font-semibold text-fg">Now {formatINR(current)}</span>
        <span>{formatINR(hi)}</span>
      </div>
    </div>
  );
}

function Marker({ pos, color, label }: { pos: number; color: string; label: string }) {
  return (
    <div
      className={cn("absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-bg", color)}
      style={{ left: `${pos}%` }}
      title={label}
    />
  );
}

function FitBar({ label, icon, score, hint }: { label: string; icon: React.ReactNode; score: number; hint: string }) {
  const tone = score >= 70 ? "bg-accent text-accent" : score >= 40 ? "bg-brand text-brand" : "bg-muted/60 text-muted";
  const [bar, text] = tone.split(" ");
  const verdict = score >= 70 ? "Great fit" : score >= 40 ? "Decent" : "Not a fit";
  return (
    <div className="rounded-xl border border-border bg-bg/40 p-3">
      <div className="flex items-center justify-between">
        <div className={cn("flex items-center gap-1.5 text-xs font-medium", text)}>
          {icon}
          <span className="text-fg">{label}</span>
        </div>
        <span className="text-xs font-bold tabular-nums">{score}<span className="text-[10px] text-muted">/100</span></span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg ring-1 ring-border">
        <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${Math.max(4, score)}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px]">
        <span className="text-muted">{hint}</span>
        <span className={text}>{verdict}</span>
      </div>
    </div>
  );
}

function HorizonMeter({ step }: { step: number }) {
  const labels = ["Short", "Medium", "Long"];
  const hints = ["days-weeks", "3-12 months", "2-5+ years"];
  return (
    <div>
      <div className="relative flex items-center justify-between">
        <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-border" />
        <div
          className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-r from-brand to-accent transition-all"
          style={{ width: `${(step / 2) * 100}%` }}
        />
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative z-10 flex flex-col items-center">
            <div className={cn(
              "h-4 w-4 rounded-full ring-2 transition-all",
              i <= step ? "bg-brand-gradient ring-brand shadow-pop" : "bg-bg ring-border",
            )} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px]">
        {labels.map((l, i) => (
          <div key={l} className={cn("text-center", i === step ? "font-semibold text-brand" : "text-muted")}>
            <div>{l}</div>
            <div className="text-[10px] text-muted">{hints[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-bg/40 p-2 ring-1 ring-border">
      <div className="text-[10px] uppercase text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}

function PointList({
  title, icon, tone, points,
}: {
  title: string; icon: React.ReactNode; tone: "up" | "down"; points: string[];
}) {
  return (
    <div className={cn(
      "rounded-2xl border p-4",
      tone === "up" ? "border-accent/30 bg-accent/5" : "border-danger/30 bg-danger/5",
    )}>
      <div className={cn(
        "mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide",
        tone === "up" ? "text-accent" : "text-danger",
      )}>
        {icon}
        {title}
      </div>
      <ul className="space-y-1.5 text-sm">
        {points.map((p, i) => (
          <li key={i} className="flex gap-2">
            <span className={cn("mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full",
              tone === "up" ? "bg-accent" : "bg-danger")} />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
