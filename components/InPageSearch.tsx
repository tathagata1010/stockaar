"use client";

import { useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUrlParam } from "@/lib/url-state";

type Props = {
  placeholder?: string;
  paramName?: string;
  className?: string;
  hint?: string;
  debounceMs?: number;
};

// Debounced URL-as-state filter input. Pages read `searchParams[paramName]`
// server-side and render filtered output; this component only owns the URL.
// Mirrors the pattern in ScreenerControls so list pages feel identical.
export function InPageSearch({
  placeholder = "Filter…",
  paramName = "q",
  className,
  hint,
  debounceMs = 200,
}: Props) {
  const { value, set, pending } = useUrlParam(paramName, { debounceMs });
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("w-full", className)}>
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 t-muted" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => set(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") { set(""); inputRef.current?.blur(); } }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full rounded-md border border-hairline bg-card/60 py-2 pl-9 pr-10 text-sm text-fg placeholder:text-muted/70 focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin t-muted" />}
          {value && (
            <button
              type="button"
              onClick={() => { set(""); inputRef.current?.focus(); }}
              className="rounded p-0.5 t-muted hover:bg-hairline hover:text-fg"
              aria-label="Clear filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {hint && !value && (
        <p className="mt-1.5 t-caption t-muted">{hint}</p>
      )}
    </div>
  );
}
