"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

export function ShareButton({ symbol, name }: { symbol: string; name: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = `${name} (${symbol}) on stockaar`;
    const text = `${name} (${symbol}) — share price, scorecard, and analysis on stockaar.`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch {
      // user cancelled or share unsupported — fall through to copy
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <button onClick={share} className="btn-ghost w-full justify-center" type="button">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
