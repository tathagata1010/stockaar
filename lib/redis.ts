import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

// IMPORTANT: force every underlying fetch() the Upstash client makes to bypass
// Next.js's fetch Data Cache. Without this, whichever cache option the SDK's
// bundled build happens to pass (it only self-defaults to "no-store" in its
// ESM build) is at the mercy of which module format Next's per-route bundler
// picks — leaving room for a route's very first redis.get() to get cached by
// Next indefinitely (regardless of Redis actually changing afterward, and
// invisible to browser-side cache-busting since it's a server-side cache).
// Being explicit here removes that ambiguity for every command this client issues.

// -----------------------------------------------------------------------------
// In-process LRU tier
// -----------------------------------------------------------------------------
// Upstash counts every command against the monthly quota. In a hot path like the
// market ticker (polls every 30–60s → mget indices + mget top-stocks + a
// write-through pipeline for each fresh Yahoo pull), a handful of open browser
// tabs can burn hundreds of commands per minute. An in-process LRU in front of
// Upstash:
//   • collapses repeated reads of the same key within a TTL window into a single
//     Upstash round-trip,
//   • acts as a soft fallback when Upstash is failing (quota exceeded, transient
//     error) — degraded reads return the last known value instead of null,
//   • is bounded so a runaway key-space can't OOM the serverless instance.
// The cache is per-process (Vercel spins many), so it doesn't replace Upstash —
// it just shields Upstash from repeat traffic on any single instance.
// -----------------------------------------------------------------------------

const LRU_MAX = 5000;
const LRU_STALE_GRACE_MS = 5 * 60_000; // serve stale-on-fail up to 5 min past TTL
// Default read-cache TTL when the underlying Upstash TTL is unknown at set time.
// Values in Upstash typically live for minutes/hours (quotes ≥60s, movers 5m,
// universe hours, fundamentals 6–24h), so caching reads for only 60s meant every
// hot key still hit Upstash 60×/hour per process. 5 min is the right middle:
// enough to collapse per-page-load bursts without going stale relative to the
// actual Upstash TTLs.
const LRU_READ_CACHE_SEC = 300;

type LruEntry = { value: unknown; expiresAt: number };
const lru = new Map<string, LruEntry>();

function lruGet(key: string, allowStale = false): { hit: boolean; value: unknown; stale: boolean } {
  const entry = lru.get(key);
  if (!entry) return { hit: false, value: null, stale: false };
  const now = Date.now();
  if (now <= entry.expiresAt) {
    // LRU touch
    lru.delete(key);
    lru.set(key, entry);
    return { hit: true, value: entry.value, stale: false };
  }
  if (allowStale && now - entry.expiresAt <= LRU_STALE_GRACE_MS) {
    return { hit: true, value: entry.value, stale: true };
  }
  lru.delete(key);
  return { hit: false, value: null, stale: false };
}

function lruSet(key: string, value: unknown, ttlSec: number) {
  if (lru.size >= LRU_MAX) {
    // Evict the oldest 5% in one pass — cheaper than trimming on every set.
    const drop = Math.max(1, Math.floor(LRU_MAX * 0.05));
    let i = 0;
    for (const k of lru.keys()) {
      lru.delete(k);
      if (++i >= drop) break;
    }
  }
  lru.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

function lruDel(key: string) {
  lru.delete(key);
}

// -----------------------------------------------------------------------------
// Local dev without Upstash: silent no-op — everything served from LRU or
// fetched fresh, no warnings.
// -----------------------------------------------------------------------------
const noopRedis = {
  get: async () => null,
  set: async () => "OK",
  mget: async (...keys: string[]) => keys.map(() => null),
  del: async () => 0,
  incr: async () => 0,
  expire: async () => 0,
  pipeline: () => ({
    set: () => ({ exec: async () => [] }),
    get: () => ({ exec: async () => [] }),
    exec: async () => [],
  }),
} as unknown as Redis;

// -----------------------------------------------------------------------------
// Resilient + memoized wrapper
// -----------------------------------------------------------------------------
// Wraps live Upstash so command errors (monthly-cap, timeouts) degrade to
// stale-LRU-or-null instead of throwing, and short-circuits reads that were
// recently satisfied. Only the commands we actually use are intercepted; every
// other command passes through unmodified.
// -----------------------------------------------------------------------------
function makeResilientRedis(real: Redis): Redis {
  let warned = false;
  const onErr = (e: unknown, op: string) => {
    if (!warned) {
      console.warn(
        `[redis] command failed (${op}) — degrading to LRU/cache-miss:`,
        (e as Error).message?.slice(0, 200),
      );
      warned = true;
    }
  };

  const wrapped = {
    async get<T = unknown>(key: string): Promise<T | null> {
      const hit = lruGet(key);
      if (hit.hit) return hit.value as T | null;
      try {
        const v = await (real.get as (k: string) => Promise<T | null>)(key);
        if (v != null) lruSet(key, v, LRU_READ_CACHE_SEC);
        return v;
      } catch (e) {
        onErr(e, "get");
        const stale = lruGet(key, true);
        return stale.hit ? (stale.value as T | null) : null;
      }
    },

    async mget<T = unknown>(...keys: string[]): Promise<(T | null)[]> {
      const out: (T | null)[] = new Array(keys.length).fill(null);
      const missIdx: number[] = [];
      const missKeys: string[] = [];
      keys.forEach((k, i) => {
        const hit = lruGet(k);
        if (hit.hit) out[i] = hit.value as T | null;
        else {
          missIdx.push(i);
          missKeys.push(k);
        }
      });
      if (missKeys.length === 0) return out;
      try {
        const fresh = await (real.mget as (...k: string[]) => Promise<(T | null)[]>)(...missKeys);
        fresh.forEach((v, j) => {
          out[missIdx[j]] = v;
          if (v != null) lruSet(missKeys[j], v, LRU_READ_CACHE_SEC);
        });
        return out;
      } catch (e) {
        onErr(e, "mget");
        // Serve whatever LRU has (stale allowed), leave the rest null.
        missKeys.forEach((k, j) => {
          const stale = lruGet(k, true);
          if (stale.hit) out[missIdx[j]] = stale.value as T | null;
        });
        return out;
      }
    },

    async set(key: string, value: unknown, opts?: { ex?: number }): Promise<string | null> {
      const ttl = opts?.ex ?? 60;
      lruSet(key, value, ttl);
      try {
        return await (real.set as (k: string, v: unknown, o?: { ex?: number }) => Promise<string | null>)(
          key,
          value,
          opts,
        );
      } catch (e) {
        onErr(e, "set");
        return "OK";
      }
    },

    async del(...keys: string[]): Promise<number> {
      keys.forEach(lruDel);
      try {
        return await (real.del as (...k: string[]) => Promise<number>)(...keys);
      } catch (e) {
        onErr(e, "del");
        return 0;
      }
    },

    async incr(key: string): Promise<number> {
      lruDel(key); // invalidate — counter changed
      try {
        return await (real.incr as (k: string) => Promise<number>)(key);
      } catch (e) {
        onErr(e, "incr");
        return 0;
      }
    },

    async expire(key: string, seconds: number): Promise<number> {
      try {
        return await (real.expire as (k: string, s: number) => Promise<number>)(key, seconds);
      } catch (e) {
        onErr(e, "expire");
        return 0;
      }
    },

    pipeline(): ReturnType<Redis["pipeline"]> {
      const pipe = real.pipeline();
      // Mirror sets from the pipeline into the LRU so subsequent reads on this
      // process short-circuit even before pipe.exec() lands in Upstash.
      const origSet = pipe.set.bind(pipe);
      pipe.set = ((k: string, v: unknown, o?: { ex?: number }) => {
        lruSet(k, v, o?.ex ?? 60);
        // Cast around Upstash's discriminated SetCommandOptions union — every
        // call site in this repo uses the { ex } shape.
        return (origSet as (k: string, v: unknown, o?: unknown) => unknown)(k, v, o);
      }) as typeof pipe.set;
      const origExec = pipe.exec.bind(pipe);
      pipe.exec = (async () => {
        try {
          return await origExec();
        } catch (e) {
          onErr(e, "pipeline.exec");
          return [];
        }
      }) as typeof pipe.exec;
      return pipe;
    },
  };

  // Return a proxy so commands we didn't intercept still work.
  return new Proxy(real, {
    get(target, prop) {
      if (prop in wrapped) return (wrapped as Record<string, unknown>)[prop as string];
      return Reflect.get(target, prop);
    },
  });
}

export const redis: Redis =
  url && token
    ? makeResilientRedis(new Redis({ url, token, cache: "no-store" }))
    : noopRedis;
