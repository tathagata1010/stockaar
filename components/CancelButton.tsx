"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function cancel() {
    setPending(true); setError(null);
    const res = await fetch("/api/razorpay/cancel", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not cancel");
      setPending(false);
      return;
    }
    setConfirming(false);
    router.refresh();
    setPending(false);
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted hover:border-danger hover:text-danger"
      >
        Cancel subscription
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={cancel}
        disabled={pending}
        className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:bg-danger/90 disabled:opacity-60"
      >
        {pending ? "Cancelling…" : "Yes, cancel"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="rounded-lg border border-border bg-card px-4 py-2 text-sm"
      >
        Keep Pro
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
