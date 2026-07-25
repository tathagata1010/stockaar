"use client";

const EVENT = "sb:agent-seed";

export function seedAgentPrompt(prompt: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { prompt } }));
}

export function onAgentSeed(listener: (prompt: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const ce = e as CustomEvent<{ prompt: string }>;
    if (ce.detail?.prompt) listener(ce.detail.prompt);
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
