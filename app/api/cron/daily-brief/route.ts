import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getAllIndices, getTopMovers } from "@/lib/market";
import { sendEmail } from "@/lib/email";
import { buildBriefHtml } from "@/lib/newsletter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "supabase service env missing" }, { status: 500 });
  }
  const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false } });

  const [indices, movers] = await Promise.all([
    getAllIndices().catch(() => []),
    getTopMovers(5).catch(() => ({ gainers: [], losers: [], updatedAt: Date.now() })),
  ]);

  if (!indices.length && !movers.gainers.length) {
    return NextResponse.json({ ok: false, skipped: "no market data available" });
  }

  const { data: subs, error } = await admin
    .from("newsletter_subscribers")
    .select("id, email, unsubscribe_token")
    .eq("status", "active")
    .limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const recipients = (subs ?? []) as { id: string; email: string; unsubscribe_token: string }[];
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: "no subscribers" });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://stockaar.app";
  const dateStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  let sent = 0;
  let failed = 0;
  const sentIds: string[] = [];

  // Throttle: 5 in parallel
  for (let i = 0; i < recipients.length; i += 5) {
    const batch = recipients.slice(i, i + 5);
    await Promise.all(
      batch.map(async (r) => {
        const html = buildBriefHtml({
          dateStr,
          indices: indices.map((idx) => ({ name: idx.name, price: idx.lastPrice, changePct: idx.changePct })),
          gainers: movers.gainers,
          losers: movers.losers,
          unsubscribeUrl: `${siteUrl}/api/newsletter/unsubscribe?t=${r.unsubscribe_token}`,
          siteUrl,
        });
        const res = await sendEmail({
          to: r.email,
          subject: `Market brief · ${dateStr}`,
          html,
        });
        if (res.ok) {
          sent++;
          sentIds.push(r.id);
        } else {
          failed++;
        }
      }),
    );
  }

  if (sentIds.length) {
    await admin
      .from("newsletter_subscribers")
      .update({ last_sent_at: new Date().toISOString() })
      .in("id", sentIds);
  }

  return NextResponse.json({ ok: true, total: recipients.length, sent, failed });
}
