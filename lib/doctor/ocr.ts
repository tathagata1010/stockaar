import { nvidiaVisionChat, isNvidiaConfigured } from "@/lib/nvidia";
import { ParsedHoldingsSchema, type Holding } from "./schema";
import { NSE_SYMBOLS } from "@/lib/nse-symbols";
import { tryParseJson } from "./json";

const SYSTEM = `You are an OCR + structured-extraction model. Given a screenshot from an Indian broker app (Zerodha Kite, Groww, Upstox, Angel One, etc.), extract the user's stock holdings.

Output STRICT JSON only:
{
  "holdings": [{ "symbol": "RELIANCE", "qty": 10, "avg": 2400.50 }],
  "unresolved_rows": ["any row text you saw but could not parse"]
}

Rules:
1. Use the NSE ticker symbol when visible. If only the company name is shown, return your best-guess ticker.
2. qty is the number of shares (integer or decimal). avg is the average buy price per share in INR.
3. If you see a "Mutual Fund" / "ETF" / "Bond" row, skip it (we only handle stocks).
4. If you cannot read a row clearly, push the raw text into unresolved_rows so the user can fix it manually.
5. Do NOT invent holdings. If the screenshot is blank or non-portfolio, return { "holdings": [], "unresolved_rows": [] }.
6. Output JSON only — no markdown, no commentary.`;

const USER_PROMPT =
  "Extract every stock holding from this broker screenshot. Output strict JSON per the schema.";

const SYMBOL_INDEX = (() => {
  const exact = new Set<string>();
  const byNameUpper = new Map<string, string>();
  for (const s of NSE_SYMBOLS) {
    exact.add(s.symbol);
    byNameUpper.set(s.name.toUpperCase(), s.symbol);
  }
  return { exact, byNameUpper };
})();

export function resolveSymbol(input: string): string | null {
  const raw = input.toUpperCase().trim();
  if (!raw) return null;
  if (SYMBOL_INDEX.exact.has(raw)) return raw;
  const namedHit = SYMBOL_INDEX.byNameUpper.get(raw);
  if (namedHit) return namedHit;
  const stripped = raw.replace(/\s+(LTD|LIMITED|INDS|INDUSTRIES|CORP|CO)\.?$/i, "").trim();
  if (SYMBOL_INDEX.exact.has(stripped)) return stripped;
  for (const s of NSE_SYMBOLS) {
    const upperName = s.name.toUpperCase();
    if (upperName.startsWith(raw) || raw.startsWith(s.symbol)) return s.symbol;
  }
  return null;
}

export type OcrResult = {
  holdings: Holding[];
  unresolved: string[];
  source: "llm" | "fallback";
};

export async function ocrScreenshot(imageBase64: string): Promise<OcrResult | null> {
  if (!isNvidiaConfigured()) return null;
  const raw = await nvidiaVisionChat({
    imageBase64,
    systemPrompt: SYSTEM,
    userPrompt: USER_PROMPT,
    maxTokens: 2000,
    temperature: 0.1,
  });
  if (!raw) return null;
  const parsed = tryParseJson(raw);
  if (!parsed) return null;
  const result = ParsedHoldingsSchema.safeParse(parsed);
  if (!result.success) return null;

  const out: Holding[] = [];
  const unresolved = [...result.data.unresolved_rows];
  for (const h of result.data.holdings) {
    const resolved = resolveSymbol(h.symbol);
    if (resolved) out.push({ symbol: resolved, qty: h.qty, avg: h.avg });
    else unresolved.push(`${h.symbol} (qty ${h.qty}, avg ${h.avg}) — symbol not found in NSE master`);
  }
  return { holdings: out, unresolved, source: "llm" };
}
