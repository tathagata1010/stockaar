// LLM extraction of forward-looking guidance signals from corporate filings.
//
// Strategy: hand the LLM the headline + raw body text, ask for strict JSON of
// every quantified forward-looking statement. Reject vague/past-tense lines.
// Free path: NVIDIA NIM (Llama-3.3-70B). On failure, return [] — caller marks
// the filing as failed and retries on the next cron.

import { z } from "zod";
import { nvidiaChat, isNvidiaConfigured } from "@/lib/nvidia";

export const MetricEnum = z.enum(["revenue", "ebitda", "margin", "volume", "capex", "orders", "other"]);
export const DirectionEnum = z.enum(["up", "down", "flat", "mixed"]);

export const GuidanceSignalSchema = z.object({
  metric: MetricEnum,
  direction: DirectionEnum,
  value_text: z.string().max(120).nullable().optional(),
  timeframe: z.string().max(80).nullable().optional(),
  quote: z.string().min(8).max(500),
  confidence: z.number().min(0).max(1),
});

export type ExtractedSignal = z.infer<typeof GuidanceSignalSchema>;

const SYSTEM = `You extract MANAGEMENT-driven signals from Indian listed companies' corporate filings (concall transcripts, investor presentations, business updates, press releases, order announcements).

What counts as a signal:
- Forward-looking guidance: "we expect 12-14% revenue growth in FY26"
- Quantified order wins / contract wins: "received Letter of Intent of Rs. 589 Cr"
- Capex announcements: "Board approved Rs. 1,200 Cr capex for new plant by 2027"
- Capacity expansion: "commissioning new facility doubling capacity"
- Margin / volume direction with a number: "expect EBITDA margin to expand 200 bps next year"

What to skip:
- Pure regulatory disclosures (SAST, insider trading, Reg 30 notices) with no business substance
- Past-tense recaps of completed quarters with no forward statement
- Vague feelings without ANY number, timeframe, or quantified context

Rules:
1. "quote" MUST be a verbatim slice of the source text (<=500 chars). Do not paraphrase.
2. Confidence: 1.0 = explicit numeric forward guidance; 0.7 = quantified order/capex/contract; 0.5 = directional with metric but no value; 0.3 = qualitative but specific.
3. Output ONLY valid JSON, no prose, no markdown fences. Schema: { "signals": [ { "metric": "...", "direction": "...", "value_text": "...", "timeframe": "...", "quote": "...", "confidence": 0.0 } ] }
4. metric: revenue | ebitda | margin | volume | capex | orders | other.
5. direction: up | down | flat | mixed. For order wins / capex / capacity expansion always use "up".
6. If nothing qualifies, output { "signals": [] }.`;

function userPrompt(headline: string, body: string): string {
  // Maverick has a 1M-token context. Keep input at ~60k chars (≈15k tokens)
  // to fit a full concall transcript without truncation while leaving room
  // for the system prompt + a generous output budget.
  const trimmedBody = body.length > 60000 ? body.slice(0, 60000) + " …" : body;
  return `COMPANY FILING

Headline:
${headline}

Body:
${trimmedBody}

Extract guidance signals as JSON.`;
}

// Strip ```json fences / leading prose some LLMs add despite instructions.
function tryParseJson(raw: string): unknown | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function extractGuidance({
  headline,
  body,
}: {
  headline: string;
  body: string;
}): Promise<ExtractedSignal[] | null> {
  if (!isNvidiaConfigured()) return null;
  const text = (body || "").trim();
  if (text.length < 30) return [];

  const raw = await nvidiaChat(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPrompt(headline, text) },
    ],
    { maxTokens: 4000, temperature: 0.1 },
  );
  if (!raw) return null;

  const parsed = tryParseJson(raw);
  if (!parsed || typeof parsed !== "object") {
    console.warn("[guidance/extract] unparseable JSON:", headline.slice(0, 80), "| raw:", raw.slice(0, 200));
    return null;
  }
  const signalsRaw = (parsed as { signals?: unknown }).signals;
  if (!Array.isArray(signalsRaw)) return [];

  const out: ExtractedSignal[] = [];
  for (const s of signalsRaw) {
    const r = GuidanceSignalSchema.safeParse(s);
    if (r.success) out.push(r.data);
  }
  return out;
}
