// Task-based model registry.
//
// Each AI feature in the app has a shape:
//   - "agent"   — tool-calling reasoning (research agent)
//   - "compose" — long-form synthesis (deep-mode final pass, briefs)
//   - "brief"   — one-shot summaries (AI Brief for a stock)
//   - "fast"    — batch JSON scoring (materiality gate, quick extract)
//   - "vision"  — multimodal (portfolio-doctor screenshot OCR)
//
// Each role has an ordered preference list. `pickModel(role)` returns the
// first entry whose provider has an API key set. This means:
//   1. Groq keys present  → agent + compose + brief + fast go Groq
//   2. Only NVIDIA present → everything falls back to NVIDIA Maverick / Nemotron
//   3. Vision always prefers NVIDIA Maverick (Groq's vision path is flaky)
//
// The result: every AI task in the app runs on the best-fit model available,
// in parallel across features, with graceful degradation when a provider is
// down or unfunded.

export type AITaskRole = "agent" | "compose" | "brief" | "fast" | "vision";

export type Provider = "groq" | "nvidia";

export type ModelConfig = {
  provider: Provider;
  model: string;
  temperature: number;
  maxTokens: number;
};

export const GROQ_BASE_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
export const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";

// Registry order = preference order. First provider with a key wins.
const REGISTRY: Record<AITaskRole, ModelConfig[]> = {
  // Tool orchestration — needs real OpenAI-style tool_calls + strong
  // reasoning to chain 8 preflight tools then optionally web_search + read_url.
  // gpt-oss-120b is Groq's flagship agentic reasoning model; llama-3.3-70b
  // is the reliable backup; NVIDIA Nemotron is the escape hatch.
  agent: [
    { provider: "groq", model: process.env.AGENT_MODEL_GROQ || "openai/gpt-oss-120b", temperature: 0.2, maxTokens: 2500 },
    { provider: "groq", model: "llama-3.3-70b-versatile", temperature: 0.2, maxTokens: 2500 },
    { provider: "nvidia", model: process.env.AGENT_MODEL || "nvidia/llama-3.3-nemotron-super-49b-v1", temperature: 0.2, maxTokens: 2000 },
  ],
  // Long-form synthesis — Kimi K2 is a 1T-param MoE tuned for narrative
  // reasoning + long context; excellent at composing a "bull vs bear" case
  // over multiple data sources. Falls back to gpt-oss-120b.
  compose: [
    { provider: "groq", model: process.env.COMPOSE_MODEL_GROQ || "moonshotai/kimi-k2-instruct", temperature: 0.3, maxTokens: 4000 },
    { provider: "groq", model: "openai/gpt-oss-120b", temperature: 0.3, maxTokens: 4000 },
    { provider: "nvidia", model: "meta/llama-3.3-70b-instruct", temperature: 0.3, maxTokens: 3000 },
  ],
  // One-shot brief — reasoning-heavy summary but shorter than compose.
  // NOTE: gpt-oss-* are reasoning models that leave `content` empty (answer
  // goes into `reasoning_content`) and often break strict-JSON tasks, so an
  // instruct model like llama-3.3-70b leads for the brief role. gpt-oss stays
  // as a secondary fallback (runLLM extracts reasoning_content when needed).
  brief: [
    { provider: "groq", model: "llama-3.3-70b-versatile", temperature: 0.3, maxTokens: 2000 },
    { provider: "groq", model: "openai/gpt-oss-120b", temperature: 0.3, maxTokens: 2000 },
    { provider: "nvidia", model: "meta/llama-3.3-70b-instruct", temperature: 0.3, maxTokens: 2000 },
  ],
  // Batch JSON — materiality scoring 12 headlines, short structured extracts.
  // 8B-instant is ~10× cheaper than 70B and plenty for JSON classification.
  fast: [
    { provider: "groq", model: "llama-3.1-8b-instant", temperature: 0.1, maxTokens: 1500 },
    { provider: "nvidia", model: "meta/llama-3.3-70b-instruct", temperature: 0.1, maxTokens: 1500 },
  ],
  // Multimodal — Maverick is the only reliable vision model in our stack.
  // Groq's Maverick host is experimental; prefer NVIDIA's build.
  vision: [
    { provider: "nvidia", model: "meta/llama-4-maverick-17b-128e-instruct", temperature: 0.1, maxTokens: 4000 },
    { provider: "groq", model: "meta-llama/llama-4-maverick-17b-128e-instruct", temperature: 0.1, maxTokens: 4000 },
  ],
};

function hasKey(provider: Provider): boolean {
  if (provider === "groq") return !!process.env.GROQ_API_KEY;
  return !!process.env.NVIDIA_API_KEY;
}

export function pickModel(role: AITaskRole): ModelConfig {
  for (const cfg of REGISTRY[role]) {
    if (hasKey(cfg.provider)) return cfg;
  }
  throw new Error(`No AI provider configured for role "${role}" — set GROQ_API_KEY or NVIDIA_API_KEY.`);
}

// Ordered chain of usable models for a role. Only entries with an API key
// are returned. Callers walk this list on 429/5xx to fall back to the next
// provider. Used by lib/ai/chat.ts runLLM and lib/agent/llm.ts pickAgentModel.
export function pickModelChain(role: AITaskRole): ModelConfig[] {
  return REGISTRY[role].filter((cfg) => hasKey(cfg.provider));
}

export function modelId(cfg: ModelConfig): string {
  return `${cfg.provider}:${cfg.model}`;
}

export function providerCredentials(provider: Provider): { apiKey: string; baseURL: string } {
  if (provider === "groq") {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY not set");
    return { apiKey, baseURL: GROQ_BASE_URL };
  }
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY not set");
  return { apiKey, baseURL: NVIDIA_BASE_URL };
}
