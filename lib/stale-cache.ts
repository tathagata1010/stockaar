// Last-known-good cache. Live key has short TTL; stale: mirror has 7d so we
// can serve "yesterday's number" when every upstream source is down.

import { redis } from "./redis";

export const STALE_TTL_SECONDS = 60 * 60 * 24 * 7;

export function staleKey(key: string): string {
  return `stale:${key}`;
}

export async function writeStale<T>(key: string, value: T): Promise<void> {
  await redis.set(staleKey(key), value, { ex: STALE_TTL_SECONDS }).catch(() => {});
}

export async function readStale<T>(key: string): Promise<T | null> {
  return redis.get<T>(staleKey(key)).catch(() => null);
}

export async function readStaleMany<T>(keys: string[]): Promise<(T | null)[]> {
  if (keys.length === 0) return [];
  const staleKeys = keys.map(staleKey);
  return (await redis
    .mget<(T | null)[]>(...staleKeys)
    .catch(() => keys.map(() => null))) as (T | null)[];
}
