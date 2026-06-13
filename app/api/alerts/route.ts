import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/constants";

const createSchema = z.object({
  symbol: z.string().trim().toUpperCase().min(1).max(20),
  exchange: z.enum(["NSE", "BSE"]).default("NSE"),
  condition: z.enum(["above", "below"]),
  target_price: z.coerce.number().positive().max(1_000_000),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("alerts")
    .select("id, symbol, exchange, condition, target_price, status, created_at, triggered_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid input" }, { status: 400 });
  }

  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("plan").eq("user_id", user.id).single(),
    supabase.from("alerts").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const plan = (profile?.plan ?? "free") as PlanId;
  const max = PLANS[plan].maxAlerts;
  if ((count ?? 0) >= max) {
    return NextResponse.json(
      { error: `Alert limit reached (${max}). Remove one to add another.` },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("alerts")
    .insert({
      user_id: user.id,
      symbol: parsed.data.symbol,
      exchange: parsed.data.exchange,
      condition: parsed.data.condition,
      target_price: parsed.data.target_price,
    })
    .select()
    .single();

  if (error) {
    console.error("[alerts:insert]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
