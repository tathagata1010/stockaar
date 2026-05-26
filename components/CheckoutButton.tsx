"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve(true);
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function CheckoutButton({
  plan, label, className, email,
}: {
  plan: "pro_monthly" | "pro_annual";
  label: string;
  className?: string;
  email?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true); setError(null);
    try {
      const ok = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      if (!ok) throw new Error("Could not load Razorpay");

      const res = await fetch("/api/razorpay/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout");

      if (!window.Razorpay) throw new Error("Razorpay unavailable");
      const rzp = new window.Razorpay({
        key: data.key_id,
        subscription_id: data.subscription_id,
        name: "stocकaar",
        description: plan === "pro_annual" ? "Pro Annual" : "Pro Monthly",
        prefill: email ? { email } : undefined,
        theme: { color: "#4f46e5" },
        handler: () => router.refresh(),
        modal: { ondismiss: () => setPending(false) },
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setPending(false);
    }
  }

  return (
    <div>
      <button
        onClick={start}
        disabled={pending}
        className={cn(
          "rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-fg shadow-pop transition hover:-translate-y-0.5 disabled:opacity-60",
          className,
        )}
      >
        {pending ? "Starting…" : label}
      </button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
