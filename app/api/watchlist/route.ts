import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/constants";

const addSchema = z.object({
  symbol: z.string().trim().toUpperCase().min(1).max(20),
  exchange: z.enum(["NSE", "BSE"]).default("NSE"),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = addSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid input" }, { status: 400 });

  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("plan").eq("user_id", user.id).single(),
    supabase.from("watchlist_items").select("id", { count: "exact", head: true }),
  ]);

  const plan = (profile?.plan ?? "free") as PlanId;
  const max = PLANS[plan].maxWatchlistItems;
  if ((count ?? 0) >= max) {
    return NextResponse.json(
      { error: `Watchlist full (${max} stocks). Remove one to add another.` },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("watchlist_items")
    .insert({ user_id: user.id, symbol: parsed.data.symbol, exchange: parsed.data.exchange })
    .select()
    .single();

  if (error) {
    console.error("[watchlist:insert]", { code: error.code, message: error.message, details: error.details });
    if (error.code === "23505") return NextResponse.json({ error: "Already in watchlist" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
