import { createHash } from "node:crypto";

import { redis } from "@/lib/redis";
import { logCacheHit, logCacheWrite } from "@/lib/telemetry/log";

// Response cache — replays a full assistant turn as SSE. Same question in the
// same freshness bucket (hourly for time-sensitive, daily for evergreen) hits
// this and skips both the LLM call and the rate-limit budget.

const KEY_PREFIX = "chat:cache:v1:";
const HOURLY_TTL_SEC = 60 * 60;
const DAILY_TTL_SEC = 60 * 60 * 24;
const REPLAY_MS = Number(process.env.RESPONSE_CACHE_REPLAY_MS ?? 12);
const CHUNK_SIZE = 30;
const MAX_FRAMES = 2000;
const MAX_BYTES = 32 * 1024;

// Conservative: lean toward hourly bucketing whenever the question sniffs
// time-sensitive. Better to under-cache than serve stale price data.
const TIME_SENSITIVE_RE = /\b(today|now|latest|price|news|flow|nse|bse|intraday|current|breaking|live|trending|movers|volume)\b/i;
const PORTFOLIO_RE = /\b(portfolio|my holdings|my trades|my alerts|my watchlist)\b/i;

export type SSEFrame = { event: string; data: unknown };

export type CachedTurn = {
  v: 1;
  createdAt: number;
  bucket: "h" | "d";
  symbol?: string;
  frames: SSEFrame[];
  fullText: string;
};

export type Bucket = { tag: "h" | "d"; id: number; ttlSec: number };

export type CacheKeyInput = {
  message: string;
  symbol?: string;
  articleUrl?: string;
};

export type CacheableInput = CacheKeyInput & {
  articleBody?: string;
};

function normalize(msg: string): string {
  return msg.trim().toLowerCase().replace(/\s+/g, " ").replace(/[?.!]+$/g, "");
}

export function bucketFor(message: string): Bucket {
  if (TIME_SENSITIVE_RE.test(message)) {
    return { tag: "h", id: Math.floor(Date.now() / 3600000), ttlSec: HOURLY_TTL_SEC };
  }
  return { tag: "d", id: Math.floor(Date.now() / 86400000), ttlSec: DAILY_TTL_SEC };
}

export function cacheKey(input: CacheKeyInput, bucket: Bucket): string {
  const raw = [normalize(input.message), input.symbol ?? "", input.articleUrl ?? "", bucket.tag + bucket.id].join("|");
  return KEY_PREFIX + createHash("sha1").update(raw).digest("hex").slice(0, 24);
}

export function isCacheable(input: CacheableInput): boolean {
  if (input.articleBody && input.articleBody.length >= 50) return false;
  if (PORTFOLIO_RE.test(input.message)) return false;
  return true;
}

export async function readCache(key: string): Promise<CachedTurn | null> {
  try {
    const raw = await redis.get<CachedTurn>(key);
    if (!raw || typeof raw !== "object") return null;
    if (raw.v !== 1 || !Array.isArray(raw.frames)) return null;
    logCacheHit(key, raw.bucket);
    return raw;
  } catch {
    return null;
  }
}

async function writeCache(key: string, turn: CachedTurn, ttlSec: number): Promise<void> {
  try {
    const json = JSON.stringify(turn);
    if (json.length > MAX_BYTES) return;
    await redis.set(key, turn, { ex: ttlSec });
    logCacheWrite(key, json.length, turn.frames.length);
  } catch {
    /* swallow — cache write must never break the response */
  }
}

export type TurnRecorder = {
  push: (event: string, data: unknown) => void;
  poison: () => void;
  finalize: () => void;
};

export function createRecorder(opts: {
  key: string;
  bucket: Bucket;
  symbol?: string;
}): TurnRecorder {
  const frames: SSEFrame[] = [];
  let fullText = "";
  let poisoned = false;

  return {
    push(event, data) {
      if (poisoned) return;
      if (frames.length >= MAX_FRAMES) {
        poisoned = true;
        return;
      }
      frames.push({ event, data });
      if (event === "delta") {
        const t = (data as { text?: string } | null)?.text;
        if (typeof t === "string") fullText += t;
      }
    },
    poison() {
      poisoned = true;
    },
    finalize() {
      if (poisoned) return;
      const hasDone = frames.some((f) => f.event === "done");
      const hasError = frames.some((f) => f.event === "error");
      if (!hasDone || hasError) return;
      if (fullText.length < 20) return;
      const turn: CachedTurn = {
        v: 1,
        createdAt: Date.now(),
        bucket: opts.bucket.tag,
        symbol: opts.symbol,
        frames,
        fullText,
      };
      void writeCache(opts.key, turn, opts.bucket.ttlSec);
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Replay a cached turn as a fresh SSE stream. Non-delta frames emit instantly
// (users still see the tool-progression progression); delta text is rebatched
// into 30-char chunks with 12ms spacing so it reads like natural typing.
export async function replayFromCache(
  turn: CachedTurn,
  emit: (event: string, data: unknown) => void,
): Promise<void> {
  let deltaBuffer = "";
  const flushDeltas = async () => {
    while (deltaBuffer.length > 0) {
      emit("delta", { text: deltaBuffer.slice(0, CHUNK_SIZE) });
      deltaBuffer = deltaBuffer.slice(CHUNK_SIZE);
      if (REPLAY_MS > 0) await sleep(REPLAY_MS);
    }
  };

  for (const frame of turn.frames) {
    if (frame.event === "delta") {
      const t = (frame.data as { text?: string } | null)?.text;
      if (typeof t === "string") deltaBuffer += t;
      continue;
    }
    await flushDeltas();
    emit(frame.event, frame.data);
  }
  await flushDeltas();
}
