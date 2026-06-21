"use client";

import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RedFlag } from "@/lib/doctor/schema";

const META = {
  high: {
    icon: AlertTriangle,
    tone: "border-danger/40 bg-danger/10 text-danger",
    chip: "bg-danger/20 text-danger",
  },
  med: {
    icon: AlertCircle,
    tone: "border-warning/40 bg-warning/10 text-warning",
    chip: "bg-warning/20 text-warning",
  },
  low: {
    icon: Info,
    tone: "border-border bg-card/60 text-muted",
    chip: "bg-bg-2 text-muted",
  },
};

export function RedFlagCard({ flag }: { flag: RedFlag }) {
  const meta = META[flag.severity];
  const Icon = meta.icon;
  return (
    <article className={cn("rounded-2xl border p-4", meta.tone)}>
      <div className="flex items-start gap-3">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.chip)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-fg">{flag.title}</h4>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", meta.chip)}>
              {flag.severity}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-fg/80">{flag.message}</p>
          {flag.affected_symbols.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {flag.affected_symbols.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-bg-2 px-2 py-0.5 text-[10px] font-mono uppercase ring-1 ring-border"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
