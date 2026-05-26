import { NextResponse } from "next/server";
import { refreshBuzz } from "@/lib/reddit-buzz";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const hdr = req.headers.get("authorization") || "";
  return hdr === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const t0 = Date.now();
  const built = await refreshBuzz();
  return NextResponse.json({
    items: built.items.length,
    posts: built.sampleSize,
    news: built.newsSample,
    ms: Date.now() - t0,
  });
}
