import { NextResponse } from "next/server";
import { refreshInstFlows } from "@/lib/inst-flows";

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
  const t0 = Date.now();
  const payload = await refreshInstFlows();
  return NextResponse.json({
    daysCovered: payload.daysCovered,
    totalDeals: payload.totalDeals,
    symbols: Object.keys(payload.bySymbol).length,
    ms: Date.now() - t0,
  });
}
