import { createHash } from "node:crypto";
import { redis } from "@/lib/redis";
import { runLLM } from "@/lib/ai/chat";
import { sebiStrip } from "@/lib/sebi";

export type FuzzInsight = {
  summary: string;
  bullets: string[];
  followUps: string[];
  generatedAt: number;
};

const CACHE_TTL = 60 * 60 * 24;
const NEG_TTL = 60 * 30;
const MAX_INPUT_CHARS = 6000;
const MAX_OUTPUT_TOKENS = 640;

function hash(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 20);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampStr(s: unknown, min: number, max: number): string | null {
  if (typeof s !== "string") return null;
  const t = sebiStrip(s.trim());
  if (t.length < min || t.length > max) return null;
  return t;
}

function parseJsonInsight(raw: string): { summary: string; bullets: string[]; followUps: string[] } | null {
  // Strip common markdown code fences before parsing.
  const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;

  const summary = clampStr(rec.summary, 40, 600);
  if (!summary) return null;

  const bulletsRaw = Array.isArray(rec.bullets) ? rec.bullets : [];
  const bullets = bulletsRaw
    .map((b) => clampStr(b, 15, 320))
    .filter((b): b is string => Boolean(b))
    .slice(0, 4);
  if (bullets.length < 2) return null;

  const followsRaw = Array.isArray(rec.followUps ?? rec.follow_up_questions) ? (rec.followUps ?? rec.follow_up_questions) : [];
  const followUps = (followsRaw as unknown[])
    .map((q) => clampStr(q, 8, 140))
    .filter((q): q is string => Boolean(q))
    .slice(0, 4);

  return { summary, bullets, followUps };
}

export async function summarizeArticle(opts: {
  url: string;
  title: string;
  contentHtml?: string;
  textPreview?: string;
}): Promise<FuzzInsight | null> {
  const key = `fuzz-insights:v2:${hash(opts.url)}`;
  try {
    const cached = await redis.get<FuzzInsight | { miss: true }>(key);
    if (cached && "bullets" in cached) return cached;
    if (cached) return null;
  } catch {
    /* noop */
  }

  const body = (opts.contentHtml ? stripHtml(opts.contentHtml) : opts.textPreview ?? "").slice(0, MAX_INPUT_CHARS);
  if (body.length < 200) return null;

  const system =
    "You are a SEBI-compliant Indian-equity research assistant. Read the article and produce JSON with three fields:\n" +
    "- summary: a 2–3 sentence neutral overview (40–600 chars) covering the key fact, why it matters, and what to watch next.\n" +
    "- bullets: 3–4 concise takeaways (each a single line, 15–200 chars) — the key fact, sector/company implication, and forward watchpoint.\n" +
    "- followUps: 3–4 short natural-language follow-up questions a curious investor would ask next (each 8–120 chars, no leading verbs like 'Please').\n" +
    "Use POSITIVE / NEUTRAL / CAUTION tone words — NEVER 'buy', 'sell', 'hold', or price targets. Return ONLY valid JSON, no markdown, no headers.";
  const user = `Title: ${opts.title}\n\nArticle:\n${body}\n\nReturn JSON: {\"summary\":\"...\",\"bullets\":[\"...\"],\"followUps\":[\"...\"]}`;

  const raw = await runLLM(
    "brief",
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { maxTokens: MAX_OUTPUT_TOKENS, temperature: 0.3 },
  );
  if (!raw) {
    try { await redis.set(key, { miss: true }, { ex: NEG_TTL }); } catch { /* noop */ }
    return null;
  }

  const parsed = parseJsonInsight(raw);
  if (!parsed) {
    try { await redis.set(key, { miss: true }, { ex: NEG_TTL }); } catch { /* noop */ }
    return null;
  }

  const insight: FuzzInsight = { ...parsed, generatedAt: Date.now() };
  try { await redis.set(key, insight, { ex: CACHE_TTL }); } catch { /* noop */ }
  return insight;
}
