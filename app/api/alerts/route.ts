import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/constants";
import { CreateAlertBodySchema } from "@/lib/alerts/schema";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("alerts")
    .select("id, symbol, exchange, label, triggers, status, last_notified_at, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = CreateAlertBodySchema.safeParse(await request.json().catch(() => ({})));
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

  const { symbol, exchange, label, triggers } = parsed.data;

  // Keep legacy condition + target_price columns populated when a price trigger
  // exists — old downstream code reading the table directly still works.
  const legacyPriceCols = triggers.price
    ? { condition: triggers.price.condition, target_price: triggers.price.target }
    : { condition: null, target_price: null };

  const { data, error } = await supabase
    .from("alerts")
    .insert({
      user_id: user.id,
      symbol,
      exchange,
      label: label ?? null,
      triggers,
      ...legacyPriceCols,
    })
    .select("id, symbol, exchange, label, triggers, status, last_notified_at, created_at")
    .single();

  if (error) {
    console.error("[alerts:insert]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
