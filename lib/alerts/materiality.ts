import { z } from "zod";
import { createHash } from "crypto";
import { redis } from "../redis";
import { nvidiaChat } from "../nvidia";
import type { NewsItem } from "../news";

const ScoreSchema = z.object({
  scores: z.array(
    z.object({
      url: z.string(),
      score: z.number().int().min(0).max(10),
      reason: z.string().max(160),
    }),
  ),
});

export type MaterialityScore = { score: number; reason: string };

const TTL_SEC = 60 * 60 * 24; // url score is permanent-ish; 24h is a safe ceiling
const keyFor = (urlHash: string) => `mat:${urlHash}`;

export function urlHash(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 24);
}

/**
 * Score a batch of fresh headlines for materiality (0-10).
 * Cached per (url) — same headline never re-scored.
 * Returns a Map keyed by url. Missing entries = LLM unavailable; caller should
 * treat as non-material (skip rather than spam).
 */
export async function scoreHeadlines(
  symbol: string,
  headlines: NewsItem[],
): Promise<Map<string, MaterialityScore>> {
  const out = new Map<string, MaterialityScore>();
  if (headlines.length === 0) return out;

  // 1. Try cache first.
  const hashes = headlines.map((h) => urlHash(h.url));
  const cached = await redis
    .mget<(MaterialityScore | null)[]>(...hashes.map(keyFor))
    .catch(() => hashes.map(() => null));
  const toScore: NewsItem[] = [];
  headlines.forEach((h, i) => {
    const c = cached[i];
    if (c && typeof c.score === "number") out.set(h.url, c);
    else toScore.push(h);
  });
  if (toScore.length === 0) return out;

  // 2. Batch-score uncached headlines in one LLM call (cap at 8).
  const batch = toScore.slice(0, 8);
  const list = batch
    .map((h, i) => `${i + 1}. [${h.publisher}] "${h.title}" (url: ${h.url})`)
    .join("\n");

  const raw = await nvidiaChat(
    [
      {
        role: "system",
        content:
          "You are an Indian-equity analyst. Score each headline 0-10 by how likely it MOVES the stock or CHANGES the investment thesis. " +
          "Anchors: 10 = earnings beat/miss with numbers, M&A, regulatory action, promoter pledge/exit, guidance change. " +
          "7-9 = brokerage upgrade with target, deal wins, capex, hiring spree, leadership change. " +
          "4-6 = sector-wide news that secondarily touches the stock, opinion pieces. " +
          "0-3 = generic sector commentary, repeats of older news, rumors, listicles. " +
          "Output STRICT JSON only — no markdown — matching: " +
          '{"scores":[{"url":"...","score":<int 0-10>,"reason":"<=120 chars"}]}',
      },
      {
        role: "user",
        content: `Stock: ${symbol}\n\nHeadlines:\n${list}\n\nReturn JSON now.`,
      },
    ],
    { maxTokens: 600, temperature: 0.1 },
  );

  if (!raw) return out;

  // Strip code-fence if model returned one despite instructions.
  const clean = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed;
  try {
    parsed = ScoreSchema.parse(JSON.parse(clean));
  } catch {
    return out;
  }

  // 3. Cache + return.
  const pipe = redis.pipeline();
  for (const s of parsed.scores) {
    const entry: MaterialityScore = { score: s.score, reason: s.reason };
    out.set(s.url, entry);
    pipe.set(keyFor(urlHash(s.url)), entry, { ex: TTL_SEC });
  }
  await pipe.exec().catch(() => {});

  return out;
}
