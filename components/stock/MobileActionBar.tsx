"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Plus, Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileActionBar({
  symbol,
  exchange,
  alreadyAdded,
  name,
}: {
  symbol: string;
  exchange: "NSE" | "BSE";
  alreadyAdded: boolean;
  name: string;
}) {
  const [visible, setVisible] = useState(false);
  const [added, setAdded] = useState(alreadyAdded);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.top = "240px";
    el.style.left = "0";
    el.style.right = "0";
    el.style.height = "1px";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);
    sentinelRef.current = el;

    const obs = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      el.remove();
    };
  }, []);

  async function add() {
    if (added || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, exchange }),
      });
      if (res.ok) setAdded(true);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${name} (${symbol})`, url });
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 lg:hidden",
        "transition-transform duration-300",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-2 mb-2 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card/95 p-2 shadow-pop backdrop-blur">
        <button
          onClick={add}
          disabled={busy || added}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-semibold transition",
            added
              ? "bg-accent/10 text-accent"
              : "bg-brand/10 text-brand hover:bg-brand/20",
          )}
        >
          {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {added ? "Added" : busy ? "Adding…" : "Watchlist"}
        </button>
        <Link
          href={`/alerts?symbol=${symbol}`}
          className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-bg/60 py-2 text-[10px] font-semibold text-fg transition hover:bg-bg/80"
        >
          <Bell className="h-4 w-4" />
          Alert
        </Link>
        <button
          onClick={share}
          className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-bg/60 py-2 text-[10px] font-semibold text-fg transition hover:bg-bg/80"
        >
          {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          {copied ? "Copied" : "Share"}
        </button>
      </div>
    </div>
  );
}
