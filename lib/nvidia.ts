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

// Multimodal chat — Llama-4 Maverick accepts images via OpenAI-compatible
// `image_url` content blocks. Pass a raw base64 string (no data: prefix);
// we'll wrap it as a data URL ourselves.
export async function nvidiaVisionChat(opts: {
  imageBase64: string;
  systemPrompt: string;
  userPrompt: string;
  mimeType?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string | null> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return null;
  const mime = opts.mimeType ?? "image/jpeg";
  const dataUrl = `data:${mime};base64,${opts.imageBase64}`;

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
        messages: [
          { role: "system", content: opts.systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: opts.userPrompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: opts.maxTokens ?? 1500,
        temperature: opts.temperature ?? 0.2,
        top_p: 0.9,
        stream: false,
      }),
    });
    if (!res.ok) {
      console.warn("[nvidia/vision] " + res.status + " " + (await res.text()).slice(0, 200));
      return null;
    }
    const json = await res.json();
    const text: string | undefined = json.choices?.[0]?.message?.content;
    return text ?? null;
  } catch (e) {
    console.warn("[nvidia/vision] error", e);
    return null;
  }
}
