import Link from "next/link";
import { Suspense } from "react";
import { getUniverse } from "@/lib/universe";
import { Disclaimer } from "@/components/Disclaimer";
import { SymbolPicker } from "@/components/SymbolPicker";
import { cn, formatINR, formatPct, formatCompactINR } from "@/lib/utils";
import { Gauge, Sparkles, ShieldCheck, Clock, Target, ArrowUpRight, ArrowDownRight, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";

export const revalidate = 300;

function num(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === "object" && "raw" in (v as Record<string, unknown>)) {
    const r = (v as { raw: unknown }).raw;
    return typeof r === "number" && Number.isFinite(r) ? r : null;
  }
  return null;
}
function fmtNum(v: unknown, digits = 2): string {
  const n = num(v);
  return n === null ? "—" : n.toFixed(digits);
}
function fmtPct(v: unknown, digits = 2): string {
  const n = num(v);
  return n === null ? "—" : `${(n * 100).toFixed(digits)}%`;
}

type Verdict = "STRONG BUY" | "BUY" | "HOLD" | "AVOID" | "SELL";

const VERDICT_STYLE: Record<Verdict, { bg: string; ring: string; text: string }> = {
  "STRONG BUY": { bg: "bg-accent/15", ring: "ring-accent/40", text: "text-accent" },
  "BUY":        { bg: "bg-accent/10", ring: "ring-accent/30", text: "text-accent" },
  "HOLD":       { bg: "bg-brand/10",  ring: "ring-brand/30",  text: "text-brand"  },
  "AVOID":      { bg: "bg-warning/10",ring: "ring-warning/40",text: "text-warning"},
  "SELL":       { bg: "bg-danger/15", ring: "ring-danger/40", text: "text-danger" },
};

function computeVerdict(score: number, momentum: number, rangePos: number | null): Verdict {
  if (score >= 75 && momentum >= 60) return "STRONG BUY";
  if (score >= 65) return "BUY";
  if (score >= 50) return rangePos != null && rangePos > 90 ? "HOLD" : "HOLD";
  if (score >= 40) return "AVOID";
  return "SELL";
}

function timeHorizon(score: number, growth: number, quality: number): string {
  if (quality >= 65 && growth >= 60) return "Long term (3–5 years)";
  if (score >= 60) return "Medium term (1–3 years)";
  return "Short term (under 12 months)";
}

function riskFromBeta(beta?: number): { label: string; tone: "accent" | "brand" | "warning" | "danger" } {
  if (beta === undefined) return { label: "Unknown", tone: "brand" };
  if (beta < 0.8) return { label: "Low", tone: "accent" };
  if (beta < 1.2) return { label: "Moderate", tone: "brand" };
  if (beta < 1.6) return { label: "High", tone: "warning" };
  return { label: "Very High", tone: "danger" };
}

export default async function ShouldIBuyPage(
  props: {
    searchParams: Promise<{ symbol?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const symbol = (searchParams.symbol ?? "").toUpperCase().trim();

  return (
    <AppShell>
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-4 shadow-glow sm:p-6 md:p-8 lg:p-10">
        <div className="chip chip-brand mb-3">
          <Gauge className="h-3 w-3" />
          Tools · Algorithmic verdict
        </div>
        <h1 className="num-display text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
          Should I <span className="text-gradient-animate">Buy?</span>
        </h1>
        <p className="mt-3 max-w-2xl text-xs text-muted sm:text-sm md:text-base">
          Get an instant data-driven verdict for any NSE stock — combining our 4-pillar scorecard, technical position and analyst signals.
        </p>
        <div className="mt-6 max-w-xl">
          <SymbolPicker defaultSymbol={symbol} />
        </div>
      </section>

      {!symbol ? (
        <section className="surface mt-8 rounded-2xl p-10 text-center text-sm text-muted">
          <Sparkles className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3">Pick a stock above to see the verdict.</p>
        </section>
      ) : (
        <Suspense fallback={<VerdictSkeleton />}>
          <VerdictBlock symbol={symbol} />
        </Suspense>
      )}

      <Disclaimer className="mt-10" />
    </AppShell>
  );
}

async function VerdictBlock({ symbol }: { symbol: string }) {
  const universe = await getUniverse();
  const row = universe.find((r) => r.entry.symbol === symbol);

  if (!row) {
    return (
      <section className="surface mt-8 rounded-2xl p-10 text-center text-sm text-muted">
        We don&apos;t have <strong>{symbol}</strong> in our universe. Try another ticker.
      </section>
    );
  }
  if (!row.scorecard) {
    return (
      <section className="surface mt-8 rounded-2xl p-10 text-center text-sm text-muted">
        Fundamentals aren&apos;t available for <strong>{row.entry.symbol}</strong> right now. Try again in a few minutes.
      </section>
    );
  }
  return <VerdictView row={row} />;
}

function VerdictSkeleton() {
  return (
    <section className="mt-8 space-y-6">
      <SectionSkeleton h={220} />
      <div className="grid gap-4 md:grid-cols-3">
        <SectionSkeleton h={120} />
        <SectionSkeleton h={120} />
        <SectionSkeleton h={120} />
      </div>
      <SectionSkeleton h={160} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SectionSkeleton h={120} />
        <SectionSkeleton h={120} />
        <SectionSkeleton h={120} />
        <SectionSkeleton h={120} />
      </div>
    </section>
  );
}

function VerdictView({ row }: { row: NonNullable<Awaited<ReturnType<typeof getUniverse>>>[number] }) {
  if (!row.scorecard) return null;
  const sc = row.scorecard;
  const verdict = computeVerdict(sc.composite, sc.pillars.momentum.score, row.rangePosition);
  const horizon = timeHorizon(sc.composite, sc.pillars.growth.score, sc.pillars.quality.score);
  const risk = riskFromBeta(row.fundamentals?.beta);
  const style = VERDICT_STYLE[verdict];
  const q = row.quote;

  const reasons: string[] = [];
  if (sc.pillars.valuation.notes[0]) reasons.push(sc.pillars.valuation.notes[0]);
  if (sc.pillars.growth.notes[0]) reasons.push(sc.pillars.growth.notes[0]);
  if (sc.pillars.quality.notes[0]) reasons.push(sc.pillars.quality.notes[0]);
  if (sc.pillars.momentum.notes[0]) reasons.push(sc.pillars.momentum.notes[0]);
  if (row.rangePosition != null) reasons.push(`Trading at ${row.rangePosition.toFixed(0)}% of 52-week range`);

  return (
    <section className="mt-8 space-y-6">
      <div className={cn(
        "fade-up overflow-hidden rounded-3xl border p-6 shadow-glow ring-1 md:p-10",
        style.bg, style.ring, "border-border-strong",
      )}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted">{row.entry.name}</div>
            <div className="num-display mt-1 text-3xl font-bold md:text-4xl">{row.entry.symbol}</div>
            <div className="mt-1 text-xs text-muted">{row.entry.sector} · {row.entry.industry}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted">Verdict</div>
            <div className={cn("num-display mt-1 text-4xl font-extrabold tracking-tight md:text-5xl text-gradient-animate", style.text)}>
              {verdict}
            </div>
            <div className="mt-1 text-xs text-muted tabular-nums">Composite {sc.composite}/100</div>
          </div>
        </div>

        {q && (
          <div className="mt-6 flex flex-wrap items-end gap-6">
            <div>
              <div className="text-[10px] uppercase text-muted">Last price</div>
              <div className="num-display text-3xl font-bold tabular-nums">{formatINR(q.lastPrice)}</div>
            </div>
            <span className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold tabular-nums ring-1",
              q.changePct >= 0 ? "bg-accent/10 text-accent ring-accent/25" : "bg-danger/10 text-danger ring-danger/25",
            )}>
              {q.changePct >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {formatPct(q.changePct)}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Risk level"
          value={risk.label}
          sub={row.fundamentals?.beta != null ? `Beta ${row.fundamentals.beta.toFixed(2)}` : "—"}
          tone={risk.tone}
        />
        <InfoCard
          icon={<Clock className="h-4 w-4" />}
          label="Time horizon"
          value={horizon}
          sub="Based on Quality + Growth"
          tone="brand"
        />
        <InfoCard
          icon={<Target className="h-4 w-4" />}
          label="52W range position"
          value={row.rangePosition != null ? `${row.rangePosition.toFixed(0)}%` : "—"}
          sub={row.fundamentals?.yearLow && row.fundamentals?.yearHigh
            ? `${formatINR(row.fundamentals.yearLow)} – ${formatINR(row.fundamentals.yearHigh)}`
            : "—"}
          tone="accent"
        />
      </div>

      <div className="surface-strong rounded-2xl border border-border p-5 shadow-soft">
        <h3 className="text-sm font-semibold">Why this verdict</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span className="text-fg/90">{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Pillar name="Valuation" score={sc.pillars.valuation.score} />
        <Pillar name="Growth"    score={sc.pillars.growth.score} />
        <Pillar name="Quality"   score={sc.pillars.quality.score} />
        <Pillar name="Momentum"  score={sc.pillars.momentum.score} />
      </div>

      <div className="surface rounded-2xl p-5 shadow-soft">
        <h3 className="text-sm font-semibold">Key stats</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <Stat label="Market cap" value={num(row.fundamentals?.marketCap) !== null ? formatCompactINR(num(row.fundamentals?.marketCap)!) : "—"} />
          <Stat label="P/E (TTM)" value={fmtNum(row.fundamentals?.trailingPE, 1)} />
          <Stat label="P/B" value={fmtNum(row.fundamentals?.priceToBook, 2)} />
          <Stat label="Div yield" value={fmtPct(row.fundamentals?.dividendYield, 2)} />
          <Stat label="ROE" value={fmtPct(row.fundamentals?.returnOnEquity, 1)} />
          <Stat label="Profit margin" value={fmtPct(row.fundamentals?.profitMargin, 1)} />
          <Stat label="Debt/Equity" value={fmtNum(row.fundamentals?.debtToEquity, 0)} />
          <Stat label="Beta" value={fmtNum(row.fundamentals?.beta, 2)} />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs text-fg/85">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
        This verdict is generated algorithmically from public data. Always do your own research and consult a SEBI-registered investment adviser before trading.
      </div>

      <div>
        <Link href={`/stock/${row.entry.symbol}`} className="btn-brand inline-flex items-center gap-2">
          See full {row.entry.symbol} analysis →
        </Link>
      </div>
    </section>
  );
}

function InfoCard({ icon, label, value, sub, tone }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  tone: "accent" | "brand" | "warning" | "danger";
}) {
  const ring = tone === "accent" ? "bg-accent/15 text-accent ring-accent/30"
    : tone === "warning" ? "bg-warning/15 text-warning ring-warning/30"
    : tone === "danger" ? "bg-danger/15 text-danger ring-danger/30"
    : "bg-brand/15 text-brand ring-brand/30";
  return (
    <div className="surface-strong rounded-2xl p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg ring-1", ring)}>{icon}</span>
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted">{label}</div>
      </div>
      <div className="num-display mt-3 text-xl font-bold">{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function Pillar({ name, score }: { name: string; score: number }) {
  const tone = score >= 70 ? "text-accent bg-accent/10 ring-accent/30"
    : score >= 50 ? "text-brand bg-brand/10 ring-brand/30"
    : "text-danger bg-danger/10 ring-danger/30";
  return (
    <div className="surface rounded-2xl p-4 shadow-soft">
      <div className="text-[10px] uppercase text-muted">{name}</div>
      <div className="mt-2 flex items-end justify-between">
        <span className={cn("num-display rounded-md px-2 py-0.5 text-xl font-bold tabular-nums ring-1", tone)}>{score}</span>
        <span className="text-[10px] text-muted">/100</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg/60">
        <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="text-[10px] uppercase text-muted">{label}</div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SectionSkeleton({ h = 256 }: { h?: number }) {
  return <div className="shimmer rounded-2xl" style={{ height: h }} />;
}
