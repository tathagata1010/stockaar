import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getQuotes } from "@/lib/upstox";
import { redis } from "@/lib/redis";
import { NSE_SYMBOLS } from "@/lib/nse-symbols";
import { HoldingSchema } from "@/lib/doctor/schema";
import type { Diagnosis } from "@/lib/doctor/schema";
import { analyze } from "@/lib/doctor/portfolio";
import { diagnose, cacheKeyFor, canonicalKey } from "@/lib/doctor/diagnose";
import { checkAndIncrement, clientIp } from "@/lib/doctor/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BodySchema = z.object({
  holdings: z.array(HoldingSchema).min(1).max(100),
  source: z.enum(["screenshot", "csv", "manual"]).default("manual"),
  imageHash: z.string().optional(),
});

const sectorBySymbol: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const s of NSE_SYMBOLS) m[s.symbol] = s.sector;
  return m;
})();

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

  const [quotes, cached] = await Promise.all([
    getQuotes(holdings.map((h) => ({ symbol: h.symbol, exchange: "NSE" as const }))),
    redis.get<Diagnosis>(cacheKeyFor(holdings)),
  ]);
  const quoteMap: Record<string, { symbol: string; lastPrice: number; changePct: number }> = {};
  for (const q of quotes) {
    quoteMap[q.symbol] = {
      symbol: q.symbol,
      lastPrice: q.lastPrice,
      changePct: q.changePct,
    };
  }

  const analysis = analyze(holdings, quoteMap, sectorBySymbol);
  const result = await diagnose({ holdings, analysis, cached });

  let importId: string | null = null;
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceUrl && serviceKey) {
    try {
      const admin = createServiceClient(serviceUrl, serviceKey, {
        auth: { persistSession: false },
      });
      const insertImport = await admin
        .from("portfolio_imports")
        .insert({
          user_id: user?.id ?? null,
          source,
          holdings,
          raw_image_hash: imageHash ?? canonicalKey(holdings),
        })
        .select("id")
        .single();
      if (insertImport.data?.id) {
        importId = insertImport.data.id;
        await admin.from("portfolio_diagnostics").insert({
          import_id: importId,
          health_score: result.diagnosis.health_score,
          doctors_note: result.diagnosis.doctors_note,
          red_flags: result.diagnosis.red_flags,
          quality_issues: result.diagnosis.quality_issues,
          rebalance_suggestions: result.diagnosis.rebalance_suggestions,
          sector_tilt: result.diagnosis.sector_tilt ?? null,
          model: result.model,
        });
      }
    } catch (e) {
      console.warn("[doctor/diagnose] persistence failed:", (e as Error).message);
    }
  }

  return NextResponse.json({
    importId,
    diagnosis: result.diagnosis,
    analysis: {
      invested: analysis.invested,
      current: analysis.current,
      pl: analysis.pl,
      plPct: analysis.plPct,
      rows: analysis.rows,
      sectorBreakdown: analysis.sectorBreakdown,
    },
    source: result.source,
  });
}
