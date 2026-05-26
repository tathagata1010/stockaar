import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: { email?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  const source = String(body.source ?? "landing").slice(0, 32);

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: existing } = await admin
    .from("newsletter_subscribers")
    .select("id, status, unsubscribe_token")
    .eq("email", email)
    .maybeSingle();

  let token = existing?.unsubscribe_token as string | undefined;

  if (existing) {
    if (existing.status !== "active") {
      await admin
        .from("newsletter_subscribers")
        .update({ status: "active", unsubscribed_at: null })
        .eq("id", existing.id);
    }
  } else {
    const { data: inserted, error } = await admin
      .from("newsletter_subscribers")
      .insert({ email, source })
      .select("unsubscribe_token")
      .single();
    if (error) {
      return NextResponse.json({ error: "Could not subscribe right now." }, { status: 500 });
    }
    token = inserted?.unsubscribe_token as string;
  }

  // Fire-and-forget welcome (don't block response on Resend latency)
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://stockaar.app";
  const unsubUrl = `${site}/api/newsletter/unsubscribe?t=${token}`;
  sendEmail({
    to: email,
    subject: "You're in — the daily brief lands tomorrow at 9 AM IST",
    html: `<!doctype html><html><body style="font-family:Inter,system-ui,sans-serif;background:#f6f8fc;margin:0;padding:24px;color:#0e1525">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e7f0;border-radius:16px;padding:28px">
    <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;color:#4f46e5;text-transform:uppercase">stocकaar · daily brief</div>
    <h1 style="margin:8px 0 16px;font-size:24px">Welcome aboard 👋</h1>
    <p style="margin:0 0 14px;line-height:1.55;color:#3a4357">Every weekday at <b>9:00 AM IST</b> you'll get a 3-minute read on what moved overnight, why it moved, and what to watch today. Zero CFA jargon.</p>
    <p style="margin:0 0 22px;line-height:1.55;color:#3a4357">No spam. One email a day. Unsubscribe in one click whenever.</p>
    <a href="${site}/dashboard" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Open dashboard</a>
    <p style="margin-top:24px;font-size:11px;color:#5a6478;line-height:1.5">For informational purposes only. Not investment advice.<br/>
    Don't want these? <a href="${unsubUrl}" style="color:#5a6478">Unsubscribe</a>.</p>
  </div>
</body></html>`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, status: existing ? "resubscribed" : "subscribed" });
}
