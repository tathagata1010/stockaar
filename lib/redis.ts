import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

// Local dev without Upstash: silent no-op so warnings don't flood the console
// and every cache lookup misses cleanly (data still fetched from source).
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

// Wrap the live Upstash client so command errors (e.g. monthly request-cap
// exceeded on the free tier) degrade to cache-miss behavior instead of
// 500ing pages. Reads return null, writes silently no-op.
function makeResilientRedis(real: Redis): Redis {
  let warned = false;
  const onErr = (e: unknown, op: string) => {
    if (!warned) {
      console.warn(`[redis] command failed (${op}) — degrading to cache-miss:`, (e as Error).message?.slice(0, 200));
      warned = true;
    }
  };
  return new Proxy(real, {
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig !== "function") return orig;
      return (...args: unknown[]) => {
        try {
          const out = orig.apply(target, args);
          if (out instanceof Promise) {
            return out.catch((e) => {
              onErr(e, String(prop));
              if (prop === "get" || prop === "mget") return prop === "mget" ? args.map(() => null) : null;
              if (prop === "incr" || prop === "del" || prop === "expire") return 0;
              return "OK";
            });
          }
          return out;
        } catch (e) {
          onErr(e, String(prop));
          return prop === "get" ? null : prop === "mget" ? (args as unknown[]).map(() => null) : 0;
        }
      };
    },
  });
}

export const redis: Redis =
  url && token ? makeResilientRedis(new Redis({ url, token })) : noopRedis;
