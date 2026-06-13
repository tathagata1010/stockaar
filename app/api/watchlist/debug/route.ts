import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Debug endpoint — shows user state for diagnosing watchlist issues.
// Visit /api/watchlist/debug while logged in.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not logged in" });

  const profile = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  const items = await supabase.from("watchlist_items").select("*");

  // Test insert with explicit error capture
  const testInsert = await supabase
    .from("watchlist_items")
    .insert({ user_id: user.id, symbol: "__DEBUG_TEST__", exchange: "NSE" })
    .select()
    .single();

  // Clean up if it succeeded
  if (testInsert.data) {
    await supabase.from("watchlist_items").delete().eq("id", testInsert.data.id);
  }

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    profile: { data: profile.data, error: profile.error?.message },
    items: { count: items.data?.length, error: items.error?.message },
    test_insert: {
      success: !testInsert.error,
      error: testInsert.error
        ? {
            code: testInsert.error.code,
            message: testInsert.error.message,
            details: testInsert.error.details,
            hint: testInsert.error.hint,
          }
        : null,
    },
  });
}
