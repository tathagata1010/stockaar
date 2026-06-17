"use client";

import { cn } from "@/lib/utils";

export function LiveDot({ label = false, className }: { label?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-accent", className)}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      {label && <span>Live</span>}
    </span>
  );
}
