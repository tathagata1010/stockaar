import { NextResponse } from "next/server";
import { z } from "zod";
import { ocrScreenshot } from "@/lib/doctor/ocr";
import { createClient } from "@/lib/supabase/server";
import { checkAndIncrement, clientIp } from "@/lib/doctor/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 5 * 1024 * 1024;

const BodySchema = z.object({ imageBase64: z.string().min(1) });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
  }
  const { imageBase64 } = parsed.data;
  if (imageBase64.length * 0.75 > MAX_BYTES) {
    return NextResponse.json({ error: "image too large (max 5MB)" }, { status: 413 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const limiterKey = user ? `doctor:ocr:user:${user.id}` : `doctor:ocr:ip:${clientIp(req)}`;
  const limit = user ? 10 : 3;
  const { ok, remaining } = await checkAndIncrement({ key: limiterKey, limit });
  if (!ok) {
    return NextResponse.json(
      { error: "Daily OCR limit reached. Sign up for more, or paste CSV instead." },
      { status: 429 },
    );
  }

  const ocr = await ocrScreenshot(imageBase64);
  if (!ocr) {
    return NextResponse.json(
      { error: "Could not read screenshot. Try a clearer image or paste CSV." },
      { status: 502 },
    );
  }
  return NextResponse.json({
    holdings: ocr.holdings,
    unresolvedRows: ocr.unresolved,
    remainingToday: remaining,
  });
}
