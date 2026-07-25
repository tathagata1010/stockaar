import { ChatOpenAI } from "@langchain/openai";

import { isOpen } from "@/lib/ai/circuit-breaker";
import {
  modelId,
  pickModel,
  pickModelChain,
  providerCredentials,
  type AITaskRole,
  type ModelConfig,
} from "@/lib/ai/models";
import { logFallback } from "@/lib/telemetry/log";

// Backwards-compat re-exports — existing callers import these constants.
export {
  GROQ_BASE_URL,
  NVIDIA_BASE_URL,
} from "@/lib/ai/models";

// Walk the role's chain and return the first model whose CB is closed. If
// every entry is tripped, fall back to the very first (best-effort — the
// user still gets *something* rather than a hard error). LangChain
// streamEvents can't recover mid-stream, so this is a start-of-turn pick.
export async function pickAgentModel(role: AITaskRole = "agent"): Promise<ModelConfig> {
  const chain = pickModelChain(role);
  if (chain.length === 0) return pickModel(role);
  let skippedFrom: string | null = null;
  for (const cfg of chain) {
    const id = modelId(cfg);
    if (await isOpen(id)) {
      skippedFrom = id;
      continue;
    }
    if (skippedFrom && skippedFrom !== id) logFallback(skippedFrom, id, "cb_open", 0);
    return cfg;
  }
  return chain[0]!;
}

// makeLLM builds a ChatOpenAI wired to whichever provider has a key set,
// picking the best model for the requested role (default: "agent"). If a
// pre-picked ModelConfig is passed (e.g. from pickAgentModel after a CB
// check), we honor it instead of re-picking.
export function makeLLM(opts: { role?: AITaskRole; temperature?: number; config?: ModelConfig } = {}) {
  const cfg = opts.config ?? pickModel(opts.role ?? "agent");
  const { apiKey, baseURL } = providerCredentials(cfg.provider);
  return new ChatOpenAI({
    model: cfg.model,
    apiKey,
    configuration: { baseURL },
    streaming: true,
    temperature: opts.temperature ?? cfg.temperature,
    maxTokens: cfg.maxTokens,
  });
}
