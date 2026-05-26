"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: "landing" }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; status?: string };
      if (!res.ok) {
        setStatus("error");
        setMessage(json.error || "Something went wrong. Try again.");
        return;
      }
      setStatus("success");
      setMessage(
        json.status === "resubscribed"
          ? "Welcome back — you're on the list."
          : "You're in. Check your inbox for a quick hello.",
      );
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-5 py-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20">
          <CheckCircle2 className="h-5 w-5 text-accent" />
        </div>
        <div>
          <div className="text-sm font-semibold text-fg">{message}</div>
          <div className="mt-1 text-[11px] text-muted">First brief arrives next weekday at 9:00 AM IST.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="email"
            required
            disabled={status === "loading"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full rounded-lg border border-border bg-bg/60 py-3 pl-9 pr-4 text-sm outline-none focus:border-brand disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="btn-brand inline-flex items-center justify-center gap-2 whitespace-nowrap px-5 py-3 text-sm disabled:opacity-70"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Signing up…
            </>
          ) : (
            <>Get the daily brief</>
          )}
        </button>
      </form>
      {status === "error" && (
        <p className="mt-2 text-[11px] font-medium text-danger">{message}</p>
      )}
      <p className="mt-3 text-[11px] text-muted">Free forever · No spam · Unsubscribe in one click</p>
    </>
  );
}
