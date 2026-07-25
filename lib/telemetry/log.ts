import { redis } from "@/lib/redis";

// Fire-and-forget event log. Backed by a capped Redis list so we can inspect
// the last N events from the Upstash console without paying for a separate
// observability tool while we're still bootstrap. Swap this internal for
// Sentry/Axiom later without touching call sites.

const LIST_KEY = "telemetry:events";
const LIST_CAP = 5000;

export type TelemetryEvent =
  | { ts: number; kind: "llm_fallback"; from: string; to: string; reason: "429" | "5xx" | "timeout" | "cb_open"; attempts: number }
  | { ts: number; kind: "llm_cb_trip"; modelId: string; ttlSec: number }
  | { ts: number; kind: "cache_hit"; key: string; bucket: "h" | "d" }
  | { ts: number; kind: "cache_write"; key: string; bytes: number; frames: number }
  | { ts: number; kind: "ratelimit_block"; userId: string | null; scope: "hourly" | "burst"; tier: "free" | "pro" };

export function logEvent(event: TelemetryEvent): void {
  // Never await — telemetry must not add latency to the hot path. Redis
  // failures are already swallowed by the resilient client wrapper.
  void (async () => {
    try {
      await redis.lpush(LIST_KEY, JSON.stringify(event));
      await redis.ltrim(LIST_KEY, 0, LIST_CAP - 1);
    } catch {
      /* swallowed */
    }
  })();
}

export function logFallback(
  from: string,
  to: string,
  reason: "429" | "5xx" | "timeout" | "cb_open",
  attempts: number,
): void {
  logEvent({ ts: Date.now(), kind: "llm_fallback", from, to, reason, attempts });
}

export function logCbTrip(modelId: string, ttlSec: number): void {
  logEvent({ ts: Date.now(), kind: "llm_cb_trip", modelId, ttlSec });
}

export function logCacheHit(key: string, bucket: "h" | "d"): void {
  logEvent({ ts: Date.now(), kind: "cache_hit", key, bucket });
}

export function logCacheWrite(key: string, bytes: number, frames: number): void {
  logEvent({ ts: Date.now(), kind: "cache_write", key, bytes, frames });
}

export function logRatelimitBlock(userId: string | null, scope: "hourly" | "burst", tier: "free" | "pro"): void {
  logEvent({ ts: Date.now(), kind: "ratelimit_block", userId, scope, tier });
}
