// Live-ingest nudge. Called from the guidance page on mount so that browsing
// the feed is itself the trigger for fresh data — no need to wait for the
// daily cron. Throttle is best-effort: tries Redis first, falls back to a
// Supabase recency check, and skips throttle entirely if both fail (the
// underlying ingest is idempotent on filings.status, so duplicate work is
// minor and self-healing).

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redis } from "@/lib/redis";
import { ingestRecentFilings } from "@/lib/guidance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const THROTTLE_KEY = "guidance:nudge:lock";
const THROTTLE_WINDOW_MS = 5 * 60_000;

async function isThrottled(): Promise<boolean> {
  const now = Date.now();
  // Try Redis first (fast, cross-instance).
  try {
    const last = (await redis.get<number>(THROTTLE_KEY)) ?? 0;
    if (last && now - last < THROTTLE_WINDOW_MS) return true;
    await redis.set(THROTTLE_KEY, now, { ex: Math.ceil(THROTTLE_WINDOW_MS / 1000) });
    return false;
  } catch {
    // Redis unavailable (e.g. Upstash request cap). Fall through to Supabase.
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  try {
    const admin = createServiceClient(url, key, { auth: { persistSession: false } });
    const since = new Date(now - THROTTLE_WINDOW_MS).toISOString();
    const { count } = await admin
      .from("filings")
      .select("id", { count: "exact", head: true })
      .gte("extracted_at", since);
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function POST() {
  if (await isThrottled()) {
    return NextResponse.json({ ok: true, throttled: true });
  }
  const stats = await ingestRecentFilings({ days: 2, limit: 18, concurrency: 4 });
  return NextResponse.json({ ok: true, stats });
}
