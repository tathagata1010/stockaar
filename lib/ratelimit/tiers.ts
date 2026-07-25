import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis";

export type Tier = "free" | "pro";
export type Window = "hourly" | "burst";

// Tier config. Free-tier keeps friction low enough that a curious visitor can
// try the agent a few times before hitting the ceiling; burst window blunts
// spike abuse (bots, refresh-mashing) without punishing normal exploration.
// Burst is per-minute — needs enough headroom that a user who cancels-and-
// retries a slow answer doesn't hit 429 on their second click. Pro users get
// ~5x the hourly + burst — still finite so a single hijacked session can't
// burn our monthly Groq budget.
const LIMITS: Record<Tier, Record<Window, number>> = {
  free: { hourly: 10, burst: 5 },
  pro: { hourly: 60, burst: 20 },
};

const cache = new Map<string, Ratelimit>();

export function getLimiter(tier: Tier, window: Window): Ratelimit {
  const cacheKey = `${tier}:${window}`;
  let inst = cache.get(cacheKey);
  if (!inst) {
    const duration = window === "hourly" ? ("1 h" as const) : ("1 m" as const);
    inst = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(LIMITS[tier][window], duration),
      prefix: `rl:chat:${tier}:${window}`,
      analytics: false,
    });
    cache.set(cacheKey, inst);
  }
  return inst;
}

export function limitFor(tier: Tier, window: Window): number {
  return LIMITS[tier][window];
}
