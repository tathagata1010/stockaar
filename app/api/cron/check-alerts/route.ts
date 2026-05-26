import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getQuotes } from "@/lib/upstox";
import { isMarketOpen } from "@/lib/constants";
import { alertEmailHtml, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron pings with: Authorization: Bearer <CRON_SECRET>
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // allow in dev
  const hdr = req.headers.get("authorization") || "";
  return hdr === `Bearer ${secret}`;
}

type AlertRow = {
  id: string;
  user_id: string;
  symbol: string;
  exchange: "NSE" | "BSE";
  condition: "above" | "below";
  target_price: number;
};

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!isMarketOpen()) {
    return NextResponse.json({ ok: true, skipped: "market closed" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "supabase service env missing" }, { status: 500 });
  }
  const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: alerts, error } = await admin
    .from("alerts")
    .select("id, user_id, symbol, exchange, condition, target_price")
    .eq("status", "active")
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (alerts ?? []) as AlertRow[];
  if (rows.length === 0) return NextResponse.json({ ok: true, checked: 0, triggered: 0 });

  // Bulk fetch all distinct symbols in one call
  const uniqItems = Array.from(
    new Map(rows.map((a) => [`${a.exchange}:${a.symbol}`, { symbol: a.symbol, exchange: a.exchange }])).values(),
  );
  const quotes = await getQuotes(uniqItems).catch(() => []);
  const quoteMap = new Map<string, number>(quotes.map((q) => [`${q.exchange}:${q.symbol}`, q.lastPrice]));

  const triggered: { id: string; symbol: string; price: number }[] = [];
  for (const a of rows) {
    const price = quoteMap.get(`${a.exchange}:${a.symbol}`);
    if (price == null) continue;
    const hit = a.condition === "above" ? price >= a.target_price : price <= a.target_price;
    if (!hit) continue;

    const triggeredAt = new Date().toISOString();
    const { error: updErr } = await admin
      .from("alerts")
      .update({ status: "triggered", triggered_at: triggeredAt })
      .eq("id", a.id)
      .eq("status", "active");
    if (updErr) {
      console.error("[cron:alert update]", a.id, updErr);
      continue;
    }
    await admin.from("alert_history").insert({ alert_id: a.id, triggered_at: triggeredAt, price_at_trigger: price });

    // Fetch user email
    const { data: userRes } = await admin.auth.admin.getUserById(a.user_id);
    const email = userRes?.user?.email;
    if (email) {
      await sendEmail({
        to: email,
        subject: `${a.symbol} ${a.condition === "above" ? "↑" : "↓"} ₹${a.target_price}`,
        html: alertEmailHtml({
          symbol: a.symbol,
          exchange: a.exchange,
          condition: a.condition,
          target: a.target_price,
          current: price,
        }),
      });
    }
    triggered.push({ id: a.id, symbol: a.symbol, price });
  }

  return NextResponse.json({ ok: true, checked: rows.length, triggered: triggered.length, details: triggered });
}
