import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PatchAlertBodySchema } from "@/lib/alerts/schema";

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase.from("alerts").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = PatchAlertBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid input" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.label !== undefined) update.label = parsed.data.label;
  if (parsed.data.triggers !== undefined) {
    update.triggers = parsed.data.triggers;
    update.condition = parsed.data.triggers.price?.condition ?? null;
    update.target_price = parsed.data.triggers.price?.target ?? null;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("alerts")
    .update(update)
    .eq("id", params.id)
    .select("id, symbol, exchange, label, triggers, status, last_notified_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
