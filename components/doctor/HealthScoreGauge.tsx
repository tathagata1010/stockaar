"use client";

import { CountUp } from "@/components/anim/CountUp";
import { cn } from "@/lib/utils";

type Props = { score: number; size?: number };

function toneFor(score: number) {
  if (score >= 75) return { stroke: "var(--accent, #22c55e)", text: "text-accent", label: "Healthy" };
  if (score >= 50) return { stroke: "var(--warning, #f59e0b)", text: "text-warning", label: "Needs review" };
  return { stroke: "var(--danger, #ef4444)", text: "text-danger", label: "High risk" };
}

export function HealthScoreGauge({ score, size = 160 }: Props) {
  const tone = toneFor(score);
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * (Math.max(0, Math.min(100, score)) / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={10}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={tone.stroke}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            fill="none"
            style={{ transition: "stroke-dasharray 800ms ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <CountUp
            to={score}
            durationMs={800}
            format={(n) => Math.round(n).toString()}
            className={cn("num-display text-4xl font-bold tabular-nums", tone.text)}
          />
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">/ 100</div>
        </div>
      </div>
      <span
        className={cn(
          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
          tone.text,
          "bg-card/60",
        )}
      >
        {tone.label}
      </span>
    </div>
  );
}
