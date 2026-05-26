import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifyWebhookSignature, type PlanKey } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WebhookSub = {
  id: string;
  status: string;
  current_end?: number;
  notes?: { user_id?: string; plan?: PlanKey };
};

export async function POST(req: Request) {
  const signature = req.headers.get("x-razorpay-signature");
  const raw = await req.text();
  if (!signature || !verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "service env missing" }, { status: 500 });
  const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false } });

  const evt = JSON.parse(raw) as { event: string; payload?: { subscription?: { entity?: WebhookSub } } };
  const sub = evt.payload?.subscription?.entity;
  if (!sub) return NextResponse.json({ ok: true, ignored: evt.event });

  const userId = sub.notes?.user_id;
  const planKey: PlanKey = sub.notes?.plan ?? "pro_monthly";
  if (!userId) return NextResponse.json({ ok: true, ignored: "no user_id" });

  const activeStates = ["subscription.activated", "subscription.charged", "subscription.resumed"];
  const inactiveStates = ["subscription.cancelled", "subscription.completed", "subscription.halted", "subscription.paused"];

  let plan: "free" | PlanKey = "free";
  if (activeStates.includes(evt.event)) plan = planKey;
  else if (inactiveStates.includes(evt.event)) plan = "free";
  else plan = sub.status === "active" || sub.status === "authenticated" ? planKey : "free";

  const update: Record<string, unknown> = {
    plan,
    razorpay_subscription_id: sub.id,
    subscription_status: sub.status,
    updated_at: new Date().toISOString(),
  };
  if (sub.current_end) update.current_period_end = new Date(sub.current_end * 1000).toISOString();

  const { error } = await admin.from("profiles").update(update).eq("user_id", userId);
  if (error) {
    console.error("[razorpay:webhook]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, event: evt.event, plan });
}
