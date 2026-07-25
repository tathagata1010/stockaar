// OpenAI-compatible chat helper that walks the pickModelChain fallback list.
// On 429/5xx it retries with exponential backoff (500 → 1500 → 4500ms, 3
// attempts per model), then trips a Redis-backed circuit breaker and moves
// on to the next provider. Every fallback is telemetered.

import { isOpen, trip } from "@/lib/ai/circuit-breaker";
import {
  modelId,
  pickModelChain,
  providerCredentials,
  type AITaskRole,
  type ModelConfig,
} from "@/lib/ai/models";
import { logFallback } from "@/lib/telemetry/log";

export type LLMMessage = { role: "system" | "user" | "assistant"; content: string };

const REQUEST_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [500, 1500, 4500];

type AttemptOutcome =
  | { ok: true; text: string | null }
  | { ok: false; reason: "429" | "5xx" | "timeout" | "other"; retryable: boolean };

async function callOnce(
  cfg: ModelConfig,
  messages: LLMMessage[],
  opts: { maxTokens?: number; temperature?: number },
): Promise<AttemptOutcome> {
  const { apiKey, baseURL } = providerCredentials(cfg.provider);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        max_tokens: opts.maxTokens ?? cfg.maxTokens,
        temperature: opts.temperature ?? cfg.temperature,
        top_p: 0.9,
        stream: false,
      }),
      signal: ctrl.signal,
    });
    if (res.status === 429) return { ok: false, reason: "429", retryable: true };
    if (res.status >= 500) return { ok: false, reason: "5xx", retryable: true };
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[llm/${cfg.provider}] ${res.status} ${body.slice(0, 200)}`);
      return { ok: false, reason: "other", retryable: false };
    }
    const json = await res.json();
    const msg = json.choices?.[0]?.message ?? {};
    // Groq reasoning models (gpt-oss-*) return the answer under `reasoning_content`
    // and leave `content` empty. Fall back to reasoning_content when content is blank.
    const raw: string = (msg.content ?? "") || (msg.reasoning_content ?? "") || "";
    const text = raw.trim();
    // Treat empty completion as a non-retryable "other" failure so the chain
    // advances to the next model instead of returning "" to the caller (which
    // then trips `if (!text) return null` in getAIBrief).
    if (!text) {
      console.warn(`[llm/${cfg.provider}] empty completion for ${cfg.model}`);
      return { ok: false, reason: "other", retryable: false };
    }
    return { ok: true, text };
  } catch (e) {
    const aborted = (e as { name?: string })?.name === "AbortError";
    console.warn(`[llm/${cfg.provider}] error`, e);
    return { ok: false, reason: aborted ? "timeout" : "other", retryable: aborted };
  } finally {
    clearTimeout(t);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runLLM(
  role: AITaskRole,
  messages: LLMMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  const chain = pickModelChain(role);
  if (chain.length === 0) return null;

  let lastFrom: string | null = null;

  for (let i = 0; i < chain.length; i++) {
    const cfg = chain[i]!;
    const id = modelId(cfg);

    if (await isOpen(id)) {
      if (lastFrom && lastFrom !== id) logFallback(lastFrom, id, "cb_open", 0);
      lastFrom = id;
      continue;
    }

    let lastReason: "429" | "5xx" | "timeout" | "other" = "other";
    let attempts = 0;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      attempts++;
      const out = await callOnce(cfg, messages, opts);
      if (out.ok) {
        if (lastFrom && lastFrom !== id) logFallback(lastFrom, id, lastReason as "429" | "5xx" | "timeout", attempt);
        return out.text;
      }
      lastReason = out.reason;
      if (!out.retryable) break;
      if (attempt < MAX_ATTEMPTS - 1) await sleep(BACKOFF_MS[attempt]!);
    }

    if (lastReason === "429" && attempts >= MAX_ATTEMPTS) {
      await trip(id);
    }

    const next = chain[i + 1];
    if (next) {
      logFallback(id, modelId(next), lastReason === "other" ? "5xx" : lastReason, attempts);
    }
    lastFrom = id;
  }

  return null;
}
