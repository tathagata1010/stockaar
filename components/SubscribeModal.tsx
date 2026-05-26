"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, Mail, TrendingUp, Zap } from "lucide-react";

const STORAGE_KEY = "stockaar:subscribe-modal:v1";

export function SubscribeModal() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {}
    const t = setTimeout(() => setOpen(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {}
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: "landing-modal" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(json.error || "Could not subscribe. Try again.");
        return;
      }
      setStatus("ok");
      setMessage("You're in. Check your inbox tomorrow morning.");
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {}
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border-strong bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />

        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted transition hover:bg-bg-2 hover:text-fg"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative px-6 pt-7 pb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand ring-1 ring-brand/30">
            <Sparkles className="h-3 w-3" /> Free daily brief
          </span>
          <h2 className="mt-3 text-2xl font-bold leading-tight">
            India's markets, decoded in 3 minutes.
          </h2>
          <p className="mt-2 text-sm text-muted">
            Get the Stocक aar morning brief — Nifty pulse, top movers, anomalies, and one stock to watch. Free, every market day at 8:30 AM IST.
          </p>

          <ul className="mt-4 space-y-2 text-[13px]">
            <li className="flex items-start gap-2">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              <span>Pre-open snapshot: indices, gainers, losers, sectors.</span>
            </li>
            <li className="flex items-start gap-2">
              <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
              <span>Anomaly radar — volume spikes & 52W breakouts.</span>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg/70" />
              <span>Unsubscribe anytime. No spam, ever.</span>
            </li>
          </ul>

          {status === "ok" ? (
            <div className="mt-5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-3 text-sm text-fg">
              {message}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 rounded-lg border border-border bg-bg px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="btn-brand whitespace-nowrap px-4 py-2.5 text-sm disabled:opacity-60"
                >
                  {status === "loading" ? "Joining…" : "Join free"}
                </button>
              </div>
              {status === "error" && (
                <div className="text-xs text-danger">{message}</div>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="self-start text-[11px] text-muted underline-offset-2 hover:text-fg hover:underline"
              >
                No thanks
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
