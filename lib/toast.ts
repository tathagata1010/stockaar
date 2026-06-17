"use client";

// CustomEvent-based toast pub/sub. No external dep.
// Use toast.success(msg) anywhere on the client; <Toaster /> in the layout renders them.

export type ToastTone = "default" | "success" | "info" | "warn" | "danger";

export type ToastInput = {
  id?: string;
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
};

export type Toast = Required<Pick<ToastInput, "title">> & {
  id: string;
  description?: string;
  tone: ToastTone;
  durationMs: number;
};

const EVENT = "sb:toast";

function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function emit(t: ToastInput): void {
  if (typeof window === "undefined") return;
  const detail: Toast = {
    id: t.id ?? rid(),
    title: t.title,
    description: t.description,
    tone: t.tone ?? "default",
    durationMs: t.durationMs ?? 4000,
  };
  window.dispatchEvent(new CustomEvent<Toast>(EVENT, { detail }));
}

export const toast = {
  show: (t: ToastInput) => emit(t),
  success: (title: string, description?: string) => emit({ title, description, tone: "success" }),
  info:    (title: string, description?: string) => emit({ title, description, tone: "info" }),
  warn:    (title: string, description?: string) => emit({ title, description, tone: "warn" }),
  danger:  (title: string, description?: string) => emit({ title, description, tone: "danger" }),
};

export function subscribeToast(handler: (t: Toast) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<Toast>).detail);
  window.addEventListener(EVENT, listener as EventListener);
  return () => window.removeEventListener(EVENT, listener as EventListener);
}
