"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { bumpVisit, claimDailyToast } from "@/lib/visit-local";
import { toast } from "@/lib/toast";

export function StreakBadge() {
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    const info = bumpVisit();
    setStreak(info.streak);
    if (info.isFirstToday && claimDailyToast()) {
      const msg = info.streak === 1
        ? "Welcome back — streak begins today."
        : `${info.streak}-day streak · longest ${Math.max(info.longest, info.streak)}`;
      toast.show({ title: `🔥 ${info.streak === 1 ? "Day 1" : `${info.streak}-day streak`}`, description: msg, tone: "success", durationMs: 5000 });
    }
  }, []);

  if (streak === null || streak < 1) return null;

  return (
    <span
      className="hidden xl:inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] font-semibold text-warning"
      title={`${streak}-day visit streak`}
    >
      <Flame className="h-3 w-3" />
      <span className="tabular-nums">{streak}</span>
    </span>
  );
}
