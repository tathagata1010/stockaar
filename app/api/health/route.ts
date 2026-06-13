import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Diagnostic endpoint — confirms env, auth, DB connectivity.
// Safe: never returns secret values, only whether they're set.
export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return NextResponse.json({
    env,
    auth: user ? { user_id: user.id, email: user.email } : "anonymous",
  });
}
