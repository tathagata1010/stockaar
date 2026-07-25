import { redis } from "@/lib/redis";
import { logCbTrip } from "@/lib/telemetry/log";

// Per-model circuit breaker. When a model returns 429 repeatedly we "trip"
// it — a Redis key with a 5-minute TTL — so subsequent requests skip it
// until the CB clears. A 15s in-memory cache over the Redis GET keeps this
// hot-path cheap (no round-trip on every LLM call).

const CB_PREFIX = "llm:cb:";
const DEFAULT_TRIP_TTL_SEC = 300;
const MEMO_TTL_MS = 15_000;

type MemoEntry = { open: boolean; until: number };
const memo = new Map<string, MemoEntry>();

function key(modelId: string): string {
  return CB_PREFIX + modelId;
}

export async function isOpen(modelId: string): Promise<boolean> {
  const now = Date.now();
  const cached = memo.get(modelId);
  if (cached && cached.until > now) return cached.open;
  let open = false;
  try {
    const val = await redis.get<number | string | null>(key(modelId));
    open = val != null;
  } catch {
    open = false;
  }
  memo.set(modelId, { open, until: now + MEMO_TTL_MS });
  return open;
}

export async function trip(modelId: string, ttlSec: number = DEFAULT_TRIP_TTL_SEC): Promise<void> {
  try {
    await redis.set(key(modelId), 1, { ex: ttlSec });
    logCbTrip(modelId, ttlSec);
  } catch {
    /* best-effort — never let CB writes break the caller */
  }
  memo.set(modelId, { open: true, until: Date.now() + MEMO_TTL_MS });
}

export function clearMemo(): void {
  memo.clear();
}
