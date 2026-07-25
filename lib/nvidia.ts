// OpenAI-compatible client for NVIDIA NIM (build.nvidia.com).
// Free tier: get key at https://build.nvidia.com/, set NVIDIA_API_KEY in env.

const ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";

// Hard client-side timeout so a stalled model routing decision (observed with
// llama-4-maverick in Jul-2026) never hangs a Suspense boundary for the full
// Vercel maxDuration. Reader/insight LLM calls should either succeed fast or
// bail so we render the article without the TL;DR.
const REQUEST_TIMEOUT_MS = 25_000;

// Free, capable NIM-hosted model with reliable free-tier availability.
// Nemotron Super 49B is NVIDIA's reasoning-tuned Llama-3.3 variant — fast
// enough for interactive TL;DRs and materiality scoring.
// Override via NVIDIA_MODEL env.
export const NVIDIA_MODEL =
  process.env.NVIDIA_MODEL || "nvidia/llama-3.3-nemotron-super-49b-v1";

export type LLMMessage = { role: "system" | "user" | "assistant"; content: string };

export async function nvidiaChat(
  messages: LLMMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return null;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
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
      signal: ctrl.signal,
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
  } finally {
    clearTimeout(t);
  }
}

export function isNvidiaConfigured(): boolean {
  return !!process.env.NVIDIA_API_KEY;
}

// Multimodal chat — accepts images via OpenAI-compatible `image_url` content
// blocks. Pass a raw base64 string (no data: prefix); we'll wrap it as a data
// URL ourselves. Vision-capable model must be set via NVIDIA_VISION_MODEL
// (Nemotron 49B is text-only; use meta/llama-3.2-90b-vision-instruct or similar).
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
  const visionModel = process.env.NVIDIA_VISION_MODEL || NVIDIA_MODEL;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: visionModel,
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
      signal: ctrl.signal,
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
  } finally {
    clearTimeout(t);
  }
}
