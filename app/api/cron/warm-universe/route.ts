import { NextResponse } from "next/server";
import { warmUniverse } from "@/lib/universe";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  try {
    const count = await warmUniverse();
    return NextResponse.json({ count, ms: Date.now() - t0 });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error)?.message ?? "warm-universe failed", ms: Date.now() - t0 },
      { status: 500 },
    );
  }
}
