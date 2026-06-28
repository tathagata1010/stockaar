import { redis } from "../redis";
import { nvidiaChat } from "../nvidia";
import type { NewsItem } from "../news";
import type { TriggerKind } from "./schema";

// SEBI guardrail — strip any LLM output that wanders into prescriptive territory.
// Mirrors the rule from lib/ai-brief.ts. If the brief trips this, we fall back.
const BANNED = /\b(buy|sell|target|recommend)\b|target\s*₹|₹\s*\d+\s*target/i;

const CACHE_TTL = 60 * 60; // 1h — same trigger combo within the hour reuses

export type BriefInput = {
  symbol: string;
  exchange: "NSE" | "BSE";
  triggerKinds: TriggerKind[];
  snapshot: {
    price: number;
    changePct: number;
    volume?: number;
    avg20dVolume?: number;
  };
  news?: NewsItem;
};

type CacheEntry = { brief: string; ts: number };

function cacheKey(i: BriefInput): string {
  const hour = new Date().toISOString().slice(0, 13);
  const kinds = [...i.triggerKinds].sort().join("+");
  const newsKey = i.news?.url ?? "_";
  return `alert-brief:${i.exchange}:${i.symbol}:${kinds}:${newsKey}:${hour}`;
}

function templatedFallback(i: BriefInput): string {
  const parts: string[] = [];
  const sign = i.snapshot.changePct >= 0 ? "+" : "";
  parts.push(`${i.symbol} is at ₹${i.snapshot.price.toFixed(2)} (${sign}${i.snapshot.changePct.toFixed(2)}% today).`);

  if (i.snapshot.volume && i.snapshot.avg20dVolume && i.snapshot.avg20dVolume > 0) {
    const mult = i.snapshot.volume / i.snapshot.avg20dVolume;
    if (mult >= 1.5) parts.push(`Volume is ${mult.toFixed(1)}× the 20-day average — unusual activity.`);
  }
  if (i.news) parts.push(`Latest headline: "${i.news.title}" (${i.news.publisher}).`);
  parts.push("Watch the next session for follow-through.");
  return parts.join(" ");
}

/**
 * Generates a 2-3 sentence narrative for the alert email.
 * Always returns something — never null — because we'd rather email a templated
 * snapshot than fail to notify the user at all.
 */
export async function generateBrief(input: BriefInput): Promise<string> {
  const key = cacheKey(input);

  const cached = await redis.get<CacheEntry>(key).catch(() => null);
  if (cached?.brief) return cached.brief;

  const fallback = templatedFallback(input);

  const llmBrief = await callLLM(input);
  const chosen = llmBrief && !BANNED.test(llmBrief) ? llmBrief : fallback;

  await redis.set(key, { brief: chosen, ts: Date.now() }, { ex: CACHE_TTL }).catch(() => {});
  return chosen;
}

async function callLLM(i: BriefInput): Promise<string | null> {
  const kindList = i.triggerKinds.join(", ");
  const triggerLines: string[] = [];
  if (i.triggerKinds.includes("price")) {
    triggerLines.push(`- Price trigger fired: now ₹${i.snapshot.price.toFixed(2)}, day change ${i.snapshot.changePct.toFixed(2)}%`);
  }
  if (i.triggerKinds.includes("move")) {
    triggerLines.push(`- Day move ${i.snapshot.changePct >= 0 ? "+" : ""}${i.snapshot.changePct.toFixed(2)}%`);
  }
  if (i.triggerKinds.includes("volume") && i.snapshot.volume && i.snapshot.avg20dVolume) {
    const m = (i.snapshot.volume / i.snapshot.avg20dVolume).toFixed(2);
    triggerLines.push(`- Volume ${m}× the 20-day average (${i.snapshot.volume.toLocaleString()} vs ${i.snapshot.avg20dVolume.toLocaleString()})`);
  }
  if (i.triggerKinds.includes("news") && i.news) {
    triggerLines.push(`- Fresh headline: "${i.news.title}" — ${i.news.publisher}`);
  }

  const raw = await nvidiaChat(
    [
      {
        role: "system",
        content:
          "You are a senior Indian-equity analyst writing a 2-3 sentence alert note for a retail investor who set this watch. " +
          "Tell the STORY: what just happened, why it matters for THIS company, and what to watch next. " +
          "Be concrete — cite the move/volume/headline. NEVER use the words 'buy', 'sell', 'target', or 'recommend'. " +
          "NEVER predict a price. Frame forward-looking statements as 'watch for', 'monitor', 'if X then observation Y'. " +
          "Output plain text only — no markdown, no headers, no bullet list. Max 3 sentences, ~60 words total.",
      },
      {
        role: "user",
        content:
          `Stock: ${i.symbol} (${i.exchange})\n` +
          `Triggers that fired: ${kindList}\n\n` +
          `Details:\n${triggerLines.join("\n")}\n\n` +
          `Write the 2-3 sentence alert note now.`,
      },
    ],
    { maxTokens: 200, temperature: 0.5 },
  );

  if (!raw) return null;
  return raw.trim().replace(/^["']|["']$/g, "");
}
