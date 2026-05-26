import { cn } from "@/lib/utils";
import type { Scorecard } from "@/lib/scorecard";

function scoreColor(score: number): string {
  if (score >= 70) return "text-accent";
  if (score >= 50) return "text-fg";
  if (score >= 35) return "text-amber-400";
  return "text-danger";
}

function scoreBg(score: number): string {
  if (score >= 70) return "bg-accent";
  if (score >= 50) return "bg-fg";
  if (score >= 35) return "bg-amber-400";
  return "bg-danger";
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {pillars.map((p) => (
            <div key={p.name} className="rounded-md border border-border bg-bg/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-muted">{p.name}</span>
                <span className={cn("text-sm font-bold tabular-nums", scoreColor(p.score))}>{p.score}</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-border">
                <div
                  className={cn("h-full rounded-full", scoreBg(p.score))}
                  style={{ width: `${p.score}%` }}
                />
              </div>
              {p.notes[0] && (
                <div className="mt-2 text-[11px] leading-snug text-muted">{p.notes[0]}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
