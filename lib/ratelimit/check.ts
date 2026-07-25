import { logRatelimitBlock } from "@/lib/telemetry/log";

import { getLimiter, limitFor, type Tier } from "./tiers";

export type LimitDecision = {
  ok: boolean;
  remaining: number;
  resetSec: number;
  limit: number;
  scope: "hourly" | "burst";
};

// Two-window check per request. Burst first (tighter, fails faster). On any
// Redis blip we fail OPEN — better to serve a spike than lock users out.
export async function enforceChat(opts: {
  userId: string | null;
  ip: string;
  tier: Tier;
}): Promise<LimitDecision> {
  const identifier = opts.userId ? `u:${opts.userId}` : `ip:${opts.ip}`;

  try {
    const burst = await getLimiter(opts.tier, "burst").limit(identifier);
    if (!burst.success) {
      logRatelimitBlock(opts.userId, "burst", opts.tier);
      return {
        ok: false,
        remaining: burst.remaining,
        resetSec: Math.max(1, Math.ceil((burst.reset - Date.now()) / 1000)),
        limit: limitFor(opts.tier, "burst"),
        scope: "burst",
      };
    }

    const hourly = await getLimiter(opts.tier, "hourly").limit(identifier);
    if (!hourly.success) {
      logRatelimitBlock(opts.userId, "hourly", opts.tier);
    }
    return {
      ok: hourly.success,
      remaining: hourly.remaining,
      resetSec: Math.max(1, Math.ceil((hourly.reset - Date.now()) / 1000)),
      limit: limitFor(opts.tier, "hourly"),
      scope: "hourly",
    };
  } catch {
    return {
      ok: true,
      remaining: limitFor(opts.tier, "hourly"),
      resetSec: 3600,
      limit: limitFor(opts.tier, "hourly"),
      scope: "hourly",
    };
  }
}
