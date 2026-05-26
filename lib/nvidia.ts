// OpenAI-compatible client for NVIDIA NIM (build.nvidia.com).
// Free tier: get key at https://build.nvidia.com/, set NVIDIA_API_KEY in env.

const ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";

// Free, high-quality models on NVIDIA NIM. Override with NVIDIA_MODEL env var.
export const NVIDIA_MODEL =
  process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct";

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
