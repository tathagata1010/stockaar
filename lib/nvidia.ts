// OpenAI-compatible client for NVIDIA NIM (build.nvidia.com).
// Free tier: get key at https://build.nvidia.com/, set NVIDIA_API_KEY in env.

const ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";

// Free, large-context model on NVIDIA NIM. Llama-4 Maverick is MoE
// (17B active / 400B total, 128 experts) — best free quality+speed combo,
// with a 1M-token context window so long PDFs don't need aggressive trimming.
// Override via NVIDIA_MODEL env (alternates: nvidia/llama-3.1-nemotron-70b-instruct,
// meta/llama-3.1-405b-instruct, qwen/qwen2.5-72b-instruct).
export const NVIDIA_MODEL =
  process.env.NVIDIA_MODEL || "meta/llama-4-maverick-17b-128e-instruct";

export type LLMMessage = { role: "system" | "user" | "assistant"; content: string };

export async function nvidiaChat(
  messages: LLMMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.4,
        top_p: 0.9,
        stream: false,
      }),
    });
    if (!res.ok) {
      console.warn("[nvidia] " + res.status + " " + (await res.text()).slice(0, 200));
      return null;
    }
    const json = await res.json();
    const text: string | undefined = json.choices?.[0]?.message?.content;
    return text ?? null;
  } catch (e) {
    console.warn("[nvidia] error", e);
    return null;
  }
}

export function isNvidiaConfigured(): boolean {
  return !!process.env.NVIDIA_API_KEY;
}
