import { getQuotes } from "@/lib/upstox";
import { redis } from "@/lib/redis";
import { SECTOR_BY_SYMBOL } from "@/lib/nse-symbols";
import { analyze, type PortfolioAnalysis } from "./portfolio";
import { diagnose, cacheKeyFor, canonicalKey } from "./diagnose";
import type { Diagnosis, Holding } from "./schema";
import { getServiceClient } from "@/lib/supabase/service";

type QuoteLite = { symbol: string; lastPrice: number; changePct: number };

async function fetchQuotesWithBseFallback(holdings: Holding[]): Promise<Record<string, QuoteLite>> {
  const quoteMap: Record<string, QuoteLite> = {};
  const nseRows = await getQuotes(holdings.map((h) => ({ symbol: h.symbol, exchange: "NSE" as const })));
  for (const q of nseRows) {
    quoteMap[q.symbol] = { symbol: q.symbol, lastPrice: q.lastPrice, changePct: q.changePct };
  }
  // Microcaps + SME issues are frequently BSE-only. Retry the misses on BSE so
  // unpriced holdings don't inflate concentration errors downstream.
  const missing = holdings.filter((h) => !quoteMap[h.symbol]);
  if (missing.length > 0) {
    const bseRows = await getQuotes(
      missing.map((h) => ({ symbol: h.symbol, exchange: "BSE" as const })),
    ).catch((err) => {
      console.warn("[doctor/pipeline] BSE fallback quotes failed:", err);
      return [] as Awaited<ReturnType<typeof getQuotes>>;
    });
    for (const q of bseRows) {
      quoteMap[q.symbol] = { symbol: q.symbol, lastPrice: q.lastPrice, changePct: q.changePct };
    }
  }
  return quoteMap;
}

export type RunDoctorInput = {
  holdings: Holding[];
  source: "screenshot" | "csv" | "manual";
  userId: string | null;
  imageHash?: string;
  persist?: boolean;
};

export type RunDoctorResult = {
  importId: string | null;
  analysis: PortfolioAnalysis;
  diagnosis: Diagnosis;
  diagnosisSource: "cache" | "llm" | "fallback";
  model: string;
};

// Shared pipeline: quotes (NSE→BSE fallback) → analyze → diagnose (Redis-cached)
// → optional persist to portfolio_imports + portfolio_diagnostics. Used by both
// /api/tools/doctor/diagnose (HTTP surface) and the agent's run_portfolio_doctor
// tool so BSE fallback + cache + persistence stay in one place.
export async function runDoctorPipeline(input: RunDoctorInput): Promise<RunDoctorResult> {
  const { holdings, source, userId, imageHash, persist = true } = input;

  const [quoteMap, cached] = await Promise.all([
    fetchQuotesWithBseFallback(holdings),
    redis.get<Diagnosis>(cacheKeyFor(holdings)),
  ]);

  const analysis = analyze(holdings, quoteMap, SECTOR_BY_SYMBOL);
  const { diagnosis, source: diagnosisSource, model } = await diagnose({
    holdings,
    analysis,
    cached,
  });

  let importId: string | null = null;
  if (persist) {
    const admin = getServiceClient();
    if (admin) {
      try {
        const { data: importRow } = await admin
          .from("portfolio_imports")
          .insert({
            user_id: userId,
            source,
            holdings,
            raw_image_hash: imageHash ?? canonicalKey(holdings),
          })
          .select("id")
          .maybeSingle();
        if (importRow?.id) {
          importId = importRow.id;
          await admin.from("portfolio_diagnostics").insert({
            import_id: importId,
            health_score: diagnosis.health_score,
            doctors_note: diagnosis.doctors_note,
            red_flags: diagnosis.red_flags,
            quality_issues: diagnosis.quality_issues,
            rebalance_suggestions: diagnosis.rebalance_suggestions,
            sector_tilt: diagnosis.sector_tilt ?? null,
            model,
          });
        }
      } catch (e) {
        console.warn("[doctor/pipeline] persistence failed:", (e as Error).message);
      }
    }
  }

  return { importId, analysis, diagnosis, diagnosisSource, model };
}
