// Orchestration: pull recent NSE filings → upsert filings rows → run extractor →
// upsert guidance_signals. Idempotent on (source, source_id).

import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchNseFilings, ddmmyyyy, isLikelyNoise, type NseFiling } from "./nse";
import { extractGuidance } from "./extract";
import { fetchPdfText } from "./pdf";

export type IngestStats = {
  fetched: number;
  inserted: number;
  extracted: number;
  signals: number;
  failed: number;
  ms: number;
};

export type GuidanceFeedRow = {
  id: string;
  symbol: string;
  metric: string;
  direction: "up" | "down" | "flat" | "mixed";
  value_text: string | null;
  timeframe: string | null;
  quote: string;
  confidence: number;
  filed_at: string;
  filing: {
    company_name: string | null;
    category: string;
    headline: string | null;
    pdf_url: string | null;
  } | null;
};

function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

export async function ingestRecentFilings(opts: { days?: number; limit?: number; concurrency?: number } = {}): Promise<IngestStats> {
  const t0 = Date.now();
  const stats: IngestStats = { fetched: 0, inserted: 0, extracted: 0, signals: 0, failed: 0, ms: 0 };
  const admin = adminClient();
  if (!admin) {
    stats.ms = Date.now() - t0;
    return stats;
  }
  const days = Math.max(1, Math.min(30, opts.days ?? 2));
  const perRunLimit = Math.max(1, Math.min(300, opts.limit ?? 50));
  const concurrency = Math.max(1, Math.min(12, opts.concurrency ?? 6));
  const now = new Date();
  const from = new Date(now.getTime() - days * 86_400_000);

  const filings = await fetchNseFilings({
    fromDate: ddmmyyyy(from),
    toDate: ddmmyyyy(now),
  });
  stats.fetched = filings.length;

  // Upsert filings, returning rows that are newly pending (status='pending'
  // means we have not yet attempted extraction). on_conflict ignores duplicates.
  const rowsToUpsert = filings.map((f) => nseToRow(f));
  if (rowsToUpsert.length > 0) {
    const { error } = await admin
      .from("filings")
      .upsert(rowsToUpsert, { onConflict: "source,source_id", ignoreDuplicates: true });
    if (error) console.warn("[guidance] upsert filings error", error.message);
  }

  // Pull the pending set (newly inserted + any past failures we want to retry).
  // Cap to the per-run limit; parallel extraction below stays within maxDuration.
  const { data: pending, error: pendErr } = await admin
    .from("filings")
    .select("id, symbol, headline, text_body, body:text_body, pdf_url, filed_at")
    .in("status", ["pending", "failed"])
    .order("filed_at", { ascending: false })
    .limit(perRunLimit);
  if (pendErr) {
    console.warn("[guidance] pending fetch error", pendErr.message);
    stats.ms = Date.now() - t0;
    return stats;
  }

  // Process N filings in parallel. Each filing = 1 PDF fetch + 1 LLM call,
  // so concurrency=6 fits comfortably under the 60s maxDuration even with
  // ~5s/extract while staying polite to NVIDIA's free-tier rate limits.
  const queue = [...(pending ?? [])];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const row = queue.shift();
        if (!row) return;
        await processFiling(admin, row, stats);
      }
    }),
  );

  stats.ms = Date.now() - t0;
  return stats;
}

type PendingRow = {
  id: string;
  symbol: string | null;
  headline: string | null;
  text_body: string | null;
  pdf_url: string | null;
  filed_at: string;
};

async function processFiling(admin: SupabaseClient, row: PendingRow, stats: IngestStats): Promise<void> {
  const headline = row.headline ?? "";
  const blurb = row.text_body ?? "";
  const pdfUrl = row.pdf_url;

  if (isLikelyNoise(headline, blurb)) {
    await admin
      .from("filings")
      .update({ status: "skipped", extracted_at: new Date().toISOString() })
      .eq("id", row.id);
    return;
  }

  let body = blurb;
  if (pdfUrl && blurb.length < 400) {
    const pdfText = await fetchPdfText(pdfUrl);
    if (pdfText && pdfText.length > blurb.length) body = pdfText;
  }

  const signals = await extractGuidance({ headline, body });
  if (signals === null) {
    stats.failed++;
    await admin
      .from("filings")
      .update({ status: "failed", error: "extractor returned null" })
      .eq("id", row.id);
    return;
  }
  stats.extracted++;
  if (signals.length > 0 && row.symbol) {
    const insertRows = signals.map((s) => ({
      filing_id: row.id,
      symbol: row.symbol,
      metric: s.metric,
      direction: s.direction,
      value_text: s.value_text ?? null,
      timeframe: s.timeframe ?? null,
      quote: s.quote,
      confidence: s.confidence,
      filed_at: row.filed_at,
    }));
    const { error: insErr } = await admin.from("guidance_signals").insert(insertRows);
    if (insErr) console.warn("[guidance] insert signals error", insErr.message);
    else stats.signals += insertRows.length;
  }
  await admin
    .from("filings")
    .update({ status: signals.length === 0 ? "skipped" : "extracted", extracted_at: new Date().toISOString() })
    .eq("id", row.id);
}

function nseToRow(f: NseFiling) {
  return {
    source: "NSE" as const,
    source_id: f.sourceId,
    symbol: f.symbol,
    bse_scrip_code: null,
    company_name: f.companyName,
    category: f.category,
    headline: f.headline,
    filed_at: f.filedAt,
    pdf_url: f.pdfUrl,
    // Stash the announcement summary as initial text. PDF text extraction is a
    // phase-3 worker that will fill text_body for filings where the PDF would
    // yield richer guidance than the summary blurb.
    text_body: f.body,
    status: "pending" as const,
  };
}

// Read-side: latest signals for the global feed.
export async function getRecentGuidance({
  limit = 50,
  direction,
  symbol,
}: {
  limit?: number;
  direction?: "up" | "down" | "flat" | "mixed";
  symbol?: string;
} = {}): Promise<GuidanceFeedRow[]> {
  const admin = adminClient();
  if (!admin) return [];
  let q = admin
    .from("guidance_signals")
    .select(
      "id, symbol, metric, direction, value_text, timeframe, quote, confidence, filed_at, filing:filings(company_name, category, headline, pdf_url)",
    )
    .order("filed_at", { ascending: false })
    .limit(Math.max(1, Math.min(1000, limit)));
  if (direction) q = q.eq("direction", direction);
  if (symbol) q = q.eq("symbol", symbol);
  const { data, error } = await q;
  if (error) {
    console.warn("[guidance] feed read error", error.message);
    return [];
  }
  // Supabase returns the embedded relation as an array even for a single-row FK;
  // unwrap to first element.
  return (data ?? []).map((r) => {
    const filingRaw = (r as { filing: unknown }).filing;
    const filing = Array.isArray(filingRaw) ? filingRaw[0] : filingRaw;
    return { ...(r as Omit<GuidanceFeedRow, "filing">), filing: (filing as GuidanceFeedRow["filing"]) ?? null };
  });
}
