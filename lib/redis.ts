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

export const redis: Redis = url && token ? new Redis({ url, token }) : noopRedis;
