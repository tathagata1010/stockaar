"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = searchParams.get(paramName) ?? "";

  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-sync local when URL changes externally (back/forward, or chip click).
  useEffect(() => {
    setValue(searchParams.get(paramName) ?? "");
  }, [searchParams, paramName]);

  const push = (next: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const qs = new URLSearchParams(searchParams.toString());
      if (next.trim()) qs.set(paramName, next.trim());
      else qs.delete(paramName);
      const qsStr = qs.toString();
      startTransition(() => router.replace(qsStr ? `${pathname}?${qsStr}` : pathname, { scroll: false }));
    }, debounceMs);
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => { setValue(e.target.value); push(e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Escape") { setValue(""); push(""); inputRef.current?.blur(); } }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full rounded-lg border border-border bg-card/60 py-2 pl-9 pr-10 text-sm text-fg placeholder:text-muted/70 focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
          {value && (
            <button
              type="button"
              onClick={() => { setValue(""); push(""); inputRef.current?.focus(); }}
              className="rounded p-0.5 text-muted hover:bg-border/40 hover:text-fg"
              aria-label="Clear filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {hint && !value && (
        <p className="mt-1.5 text-[11px] text-muted">{hint}</p>
      )}
    </div>
  );
}
