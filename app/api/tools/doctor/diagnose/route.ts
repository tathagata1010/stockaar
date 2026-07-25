import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { HoldingSchema } from "@/lib/doctor/schema";
import { runDoctorPipeline } from "@/lib/doctor/pipeline";
import { checkAndIncrement, clientIp } from "@/lib/doctor/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BodySchema = z.object({
  holdings: z.array(HoldingSchema).min(1).max(100),
  source: z.enum(["screenshot", "csv", "manual"]).default("manual"),
  imageHash: z.string().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { holdings, source, imageHash } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const limiterKey = user
    ? `doctor:diag:user:${user.id}`
    : `doctor:diag:ip:${clientIp(req)}`;
  const limit = user ? 10 : 3;
  const { ok } = await checkAndIncrement({ key: limiterKey, limit });
  if (!ok) {
    return NextResponse.json(
      { error: "Daily diagnosis limit reached. Sign up for more diagnoses." },
      { status: 429 },
    );
  }

  const { importId, analysis, diagnosis, diagnosisSource } = await runDoctorPipeline({
    holdings,
    source,
    userId: user?.id ?? null,
    imageHash,
  });

  return NextResponse.json({
    importId,
    diagnosis,
    analysis: {
      invested: analysis.invested,
      current: analysis.current,
      pl: analysis.pl,
      plPct: analysis.plPct,
      rows: analysis.rows,
      sectorBreakdown: analysis.sectorBreakdown,
    },
    source: diagnosisSource,
  });
}
