import { createHash } from "node:crypto";
import { nvidiaChat, NVIDIA_MODEL, isNvidiaConfigured } from "@/lib/nvidia";
import { redis } from "@/lib/redis";
import { DiagnosisSchema, type Diagnosis, type Holding } from "./schema";
import { NIFTY_SECTOR_WEIGHTS } from "./nifty-sector-weights";
import type { PortfolioAnalysis } from "./portfolio";
import { tryParseJson } from "./json";

export const CACHE_PREFIX = "doctor:diag:v1:";
const CACHE_TTL_SEC = 6 * 60 * 60;

export function cacheKeyFor(holdings: Holding[]): string {
  return CACHE_PREFIX + canonicalKey(holdings);
}

const SYSTEM = `You are a portfolio doctor for Indian retail investors looking at NSE/BSE equities.

Hard rules — these are non-negotiable:
1. NEVER recommend buying or selling specific stocks. Do not output the words "buy" or "sell" or "target ₹X" anywhere.
2. NEVER recommend stocks the user does not already hold. Only refer to symbols present in the input holdings.
3. Frame all suggestions as "consider reviewing", "high concentration risk", "evaluate exposure", "diversification gap" — educational, not directive.
4. Do not invent fundamentals (P/E, debt) you were not given. If a quality issue is just "high concentration", say that — do not fabricate ratios.
5. Output STRICT JSON only matching the schema. No markdown fences, no preamble.

What to surface:
- Concentration risks (single stock > 25%, sector > 40%, top 3 > 60%)
- Sector tilt vs Nifty 50 (over/under-weight)
- P/L outliers (heavy losers in the same sector → cluster risk)
- Diversification gaps (only Banks+IT, no defensives)
- Brutally honest, but constructive — tone of a senior friend, not a salesman.

Schema:
{
  "health_score": 0-100 integer,
  "doctors_note": "2-3 sentence summary, max 300 chars",
  "red_flags": [{ "severity": "high"|"med"|"low", "title": "...", "message": "...", "affected_symbols": ["..."] }],
  "quality_issues": [{ "symbol": "...", "issue": "...", "evidence": "..." }],
  "rebalance_suggestions": [{ "action": "consider trimming overweight ...", "symbol": "..." or null, "rationale": "..." }],
  "sector_tilt": { "dominant": "Banks", "pct": 45.2, "vs_nifty_pct": 15.2 } or null
}

Health score guide: 90+ = exemplary diversification & balance; 70-89 = solid with minor issues; 50-69 = needs review; <50 = significant risks.`;

export function canonicalKey(holdings: Holding[]): string {
  const sorted = [...holdings]
    .map((h) => ({ s: h.symbol, q: Number(h.qty), a: Number(h.avg) }))
    .sort((a, b) => a.s.localeCompare(b.s));
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex").slice(0, 32);
}

function postProcess(d: Diagnosis, holdingSymbols: Set<string>): Diagnosis {
  const banned = /\b(buy|sell)\b|target\s*₹/i;
  const stripBanned = (s: string) => s.replace(banned, "review").trim();
  return {
    ...d,
    doctors_note: stripBanned(d.doctors_note),
    red_flags: d.red_flags.map((f) => ({
      ...f,
      title: stripBanned(f.title),
      message: stripBanned(f.message),
      affected_symbols: f.affected_symbols.filter((s) => holdingSymbols.has(s.toUpperCase())),
    })),
    quality_issues: d.quality_issues
      .filter((q) => holdingSymbols.has(q.symbol.toUpperCase()))
      .map((q) => ({ ...q, issue: stripBanned(q.issue), evidence: stripBanned(q.evidence) })),
    rebalance_suggestions: d.rebalance_suggestions
      .filter((r) => !r.symbol || holdingSymbols.has(r.symbol.toUpperCase()))
      .map((r) => ({
        ...r,
        action: stripBanned(r.action),
        rationale: stripBanned(r.rationale),
      })),
  };
}

function ruleBasedFallback(analysis: PortfolioAnalysis): Diagnosis {
  const flags: Diagnosis["red_flags"] = [];
  for (const r of analysis.rows) {
    if (r.conc > 25) {
      flags.push({
        severity: r.conc > 40 ? "high" : "med",
        title: `${r.symbol} is ${r.conc.toFixed(1)}% of portfolio`,
        message: `Single-stock concentration above 25% materially increases idiosyncratic risk. Consider trimming to a more balanced weight.`,
        affected_symbols: [r.symbol],
      });
    }
  }
  for (const s of analysis.sectorBreakdown) {
    if (s.pct > 40) {
      flags.push({
        severity: s.pct > 60 ? "high" : "med",
        title: `${s.sector} sector is ${s.pct.toFixed(1)}% of portfolio`,
        message: `Sector exposure above 40% concentrates risk in one industry's cycle. Consider diversifying across sectors.`,
        affected_symbols: analysis.rows.filter((r) => r.sector === s.sector).map((r) => r.symbol),
      });
    }
  }
  let score = 85;
  for (const f of flags) score -= f.severity === "high" ? 15 : f.severity === "med" ? 8 : 3;
  score = Math.max(20, Math.min(95, score));

  const dominant = analysis.sectorBreakdown[0];
  const tilt = dominant
    ? {
        dominant: dominant.sector,
        pct: Number(dominant.pct.toFixed(1)),
        vs_nifty_pct: Number(
          (dominant.pct - (NIFTY_SECTOR_WEIGHTS[dominant.sector] ?? 0)).toFixed(1),
        ),
      }
    : null;

  return {
    health_score: score,
    doctors_note:
      flags.length === 0
        ? "Basic checks look clean — no concentration above 25% per stock or 40% per sector. AI doctor unavailable for deeper review."
        : `Found ${flags.length} concentration concern${flags.length === 1 ? "" : "s"}. AI doctor unavailable — basic rule-based scan only.`,
    red_flags: flags,
    quality_issues: [],
    rebalance_suggestions: [],
    sector_tilt: tilt,
  };
}

function userPrompt(analysis: PortfolioAnalysis): string {
  const tableRows = analysis.rows
    .map(
      (r) =>
        `${r.symbol} | qty=${r.qty} | avg=${r.avg} | LTP=${r.currentPrice ?? "?"} | sector=${r.sector} | conc=${r.conc.toFixed(1)}% | P/L=${r.plPct.toFixed(1)}%`,
    )
    .join("\n");
  const sectors = analysis.sectorBreakdown
    .map(
      (s) =>
        `${s.sector}: portfolio ${s.pct.toFixed(1)}% vs Nifty ${(NIFTY_SECTOR_WEIGHTS[s.sector] ?? 0).toFixed(1)}%`,
    )
    .join("\n");
  return `PORTFOLIO HOLDINGS

Total invested: ₹${analysis.invested.toFixed(0)}
Current value: ₹${analysis.current.toFixed(0)}
Overall P/L: ${analysis.plPct.toFixed(2)}%

Per-stock:
${tableRows}

Sector breakdown vs Nifty 50:
${sectors}

Diagnose this portfolio strictly per the schema. JSON only.`;
}

export type DiagnoseResult = {
  diagnosis: Diagnosis;
  source: "llm" | "cache" | "fallback";
  model: string;
};

export async function diagnose({
  holdings,
  analysis,
  cached,
}: {
  holdings: Holding[];
  analysis: PortfolioAnalysis;
  cached?: Diagnosis | null;
}): Promise<DiagnoseResult> {
  const cacheKey = cacheKeyFor(holdings);
  const hit = cached ?? (await redis.get<Diagnosis>(cacheKey));
  if (hit) return { diagnosis: hit, source: "cache", model: NVIDIA_MODEL };

  if (!isNvidiaConfigured()) {
    return { diagnosis: ruleBasedFallback(analysis), source: "fallback", model: "rule-based" };
  }

  const holdingSymbols = new Set(holdings.map((h) => h.symbol.toUpperCase()));
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await nvidiaChat(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt(analysis) },
      ],
      { maxTokens: 2400, temperature: attempt === 0 ? 0.3 : 0.1 },
    );
    if (!raw) continue;
    const parsed = tryParseJson(raw);
    if (!parsed) continue;
    const result = DiagnosisSchema.safeParse(parsed);
    if (!result.success) continue;
    const finalDiagnosis = postProcess(result.data, holdingSymbols);
    await redis.set(cacheKey, finalDiagnosis, { ex: CACHE_TTL_SEC });
    return { diagnosis: finalDiagnosis, source: "llm", model: NVIDIA_MODEL };
  }

  return { diagnosis: ruleBasedFallback(analysis), source: "fallback", model: "rule-based" };
}
