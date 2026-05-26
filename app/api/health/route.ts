import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Diagnostic endpoint — confirms env, auth, DB, and Upstox connectivity.
// Safe: never returns secret values, only whether they're set.
export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    UPSTOX_ACCESS_TOKEN: process.env.UPSTOX_ACCESS_TOKEN
      ? `set (${process.env.UPSTOX_ACCESS_TOKEN.length} chars)`
      : "missing",
  };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let upstoxStatus: string = "skipped";
  if (process.env.UPSTOX_ACCESS_TOKEN) {
    try {
      const r = await fetch(
        "https://api.upstox.com/v2/market-quote/quotes?instrument_key=" +
          encodeURIComponent("NSE_EQ|INE002A01018"), // Reliance ISIN
        { headers: { Authorization: `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}` } },
      );
      upstoxStatus = `${r.status} ${r.statusText}`;
    } catch (e) {
      upstoxStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json({
    env,
    auth: user ? { user_id: user.id, email: user.email } : "anonymous",
    upstox_test: upstoxStatus,
  });
}
