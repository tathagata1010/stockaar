import { NextResponse } from "next/server";
import { getIpos } from "@/lib/ipo-calendar";

export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { ipos, source } = await getIpos({ force: true });
  return NextResponse.json({ ok: true, source, count: ipos.length });
}

export const GET = POST;
