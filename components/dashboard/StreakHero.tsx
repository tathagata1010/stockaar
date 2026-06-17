"use client";

import { useEffect, useState } from "react";
import { Flame, Trophy } from "lucide-react";
import { getStreakSnapshot } from "@/lib/visit-local";

export function StreakHero() {
  const [snap, setSnap] = useState<{ streak: number; longest: number } | null>(null);

  useEffect(() => {
    const s = getStreakSnapshot();
    if (s.streak > 0) setSnap({ streak: s.streak, longest: Math.max(s.longest, s.streak) });
  }, []);

  if (!snap) return null;

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-[11px] font-semibold text-warning">
      <Flame className="h-3 w-3" />
      <span className="tabular-nums">{snap.streak}-day streak</span>
      <span className="inline-flex items-center gap-1 text-warning/70">
        <Trophy className="h-3 w-3" />
        <span className="tabular-nums">best {snap.longest}</span>
      </span>
    </span>
  );
}
