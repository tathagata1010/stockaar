"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const CLAMP_CLASS: Record<number, string> = {
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

/**
 * Clamp long body text to N lines with a "Read more" / "Show less" toggle.
 * The toggle only renders when the content actually overflows, so short
 * paragraphs render as plain text.
 */
export function ExpandableText({
  children,
  lines = 5,
  className,
  moreLabel = "Read more",
  lessLabel = "Show less",
}: {
  children: React.ReactNode;
  lines?: number;
  className?: string;
  moreLabel?: string;
  lessLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      // Temporarily unclamp to measure true content height.
      const prev = el.style.webkitLineClamp;
      el.style.webkitLineClamp = "unset";
      const full = el.scrollHeight;
      el.style.webkitLineClamp = prev;
      // After restoring clamp, clientHeight reflects the visible cap.
      requestAnimationFrame(() => {
        if (!ref.current) return;
        setOverflows(full - ref.current.clientHeight > 2);
      });
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, lines]);

  const clampClass = expanded ? undefined : CLAMP_CLASS[lines] ?? "line-clamp-4";

  return (
    <div className={className}>
      <div ref={ref} className={clampClass}>
        {children}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5",
            "text-[11px] font-semibold text-brand hover:bg-brand/10",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
          )}
          aria-expanded={expanded}
        >
          {expanded ? lessLabel : moreLabel}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      )}
    </div>
  );
}
