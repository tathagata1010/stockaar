import { cn } from "@/lib/utils";
import type { Scorecard } from "@/lib/scorecard";
import { ScorecardRadar } from "@/components/charts/ScorecardRadar";

function scoreColor(score: number): string {
  if (score >= 70) return "text-accent";
  if (score >= 50) return "text-fg";
  if (score >= 35) return "text-amber-400";
  return "text-danger";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Strong";
  if (score >= 50) return "Average";
  if (score >= 35) return "Weak";
  return "Poor";
}

function ring(score: number) {
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;
  return { radius, circ, dash };
}

export function ScorecardView({ scorecard }: { scorecard: Scorecard }) {
  const pillars = [
    scorecard.pillars.valuation,
    scorecard.pillars.growth,
    scorecard.pillars.quality,
    scorecard.pillars.momentum,
  ];
  const r = ring(scorecard.composite);

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Scorecard</h3>
        <span className="text-xs text-muted">Composite of 4 pillars · 0–100</span>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex items-center gap-4">
          <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
            <circle cx="48" cy="48" r={r.radius} className="stroke-border" strokeWidth="8" fill="none" />
            <circle
              cx="48"
              cy="48"
              r={r.radius}
              className={cn("transition-all", scoreColor(scorecard.composite))}
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${r.dash} ${r.circ}`}
            />
          </svg>
          <div>
            <div className={cn("text-3xl font-bold tabular-nums", scoreColor(scorecard.composite))}>
              {scorecard.composite}
            </div>
            <div className="text-xs text-muted">{scoreLabel(scorecard.composite)}</div>
          </div>
        </div>

        <ScorecardRadar pillars={pillars} />
      </div>

      <div className="mt-5 grid gap-2 border-t border-border/60 pt-4 sm:grid-cols-2">
        {pillars.map((p) => (
          <div key={p.name} className="flex items-start gap-2 text-xs">
            <span className={cn("mt-0.5 inline-block min-w-[2.25rem] text-right font-bold tabular-nums", scoreColor(p.score))}>
              {p.score}
            </span>
            <div className="min-w-0">
              <div className="text-fg">{p.name}</div>
              {p.notes[0] && <div className="text-muted">{p.notes[0]}</div>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
