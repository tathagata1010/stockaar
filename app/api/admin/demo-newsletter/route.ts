import { NextResponse } from "next/server";
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
  const url = new URL(req.url);
  const to = url.searchParams.get("email");
  if (!to) return NextResponse.json({ error: "missing ?email=" }, { status: 400 });

  const [indices, movers] = await Promise.all([
    getAllIndices().catch(() => []),
    getTopMovers(5).catch(() => ({ gainers: [], losers: [], updatedAt: Date.now() })),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://stockaar.app";
  const dateStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const html = buildBriefHtml({
    dateStr,
    indices: indices.map((idx) => ({ name: idx.name, price: idx.lastPrice, changePct: idx.changePct })),
    gainers: movers.gainers,
    losers: movers.losers,
    siteUrl,
    isDemo: true,
  });

  const res = await sendEmail({
    to,
    subject: `Demo · stocकaar market brief · ${dateStr}`,
    html,
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true, id: res.id, to, indices: indices.length, gainers: movers.gainers.length, losers: movers.losers.length });
}
