"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Client-side collapse for a set of items you want to hide behind
 * a "Show N more" toggle. Renders `head` items eagerly and reveals
 * `tail` items on click. Use for lists that grow unbounded (years of
 * corporate actions, historical rows) to cap the initial scroll height.
 */
export function CollapsibleGroup({
  head,
  tail,
  moreLabel,
  className,
}: {
  head: ReactNode;
  tail: ReactNode[];
  moreLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (tail.length === 0) return <>{head}</>;
  return (
    <div className={className}>
      {head}
      {open && tail}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "mt-3 inline-flex items-center gap-1 rounded-md px-2 py-1",
          "text-[11px] font-semibold text-brand hover:bg-brand/10",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
        )}
        aria-expanded={open}
      >
        {open ? `Show less` : moreLabel}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
    </div>
  );
}
