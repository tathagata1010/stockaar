import { redis } from "@/lib/redis";

function istDate(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function checkAndIncrement({
  key,
  limit,
  ttlSec = 26 * 60 * 60,
}: {
  key: string;
  limit: number;
  ttlSec?: number;
}): Promise<{ ok: boolean; remaining: number; used: number }> {
  const fullKey = `ratelimit:${key}:${istDate()}`;
  const used = (await redis.incr(fullKey)) as number;
  if (used === 1) {
    try {
      await redis.expire(fullKey, ttlSec);
    } catch {
      /* noop on free tier 429 */
    }
  }
  return { ok: used <= limit, remaining: Math.max(0, limit - used), used };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "anon";
}
