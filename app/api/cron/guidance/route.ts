import { NextResponse } from "next/server";
import { ingestRecentFilings } from "@/lib/guidance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days") ?? "2");
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const concurrency = Number(url.searchParams.get("concurrency") ?? "6");
  const stats = await ingestRecentFilings({ days, limit, concurrency });
  return NextResponse.json(stats);
}
