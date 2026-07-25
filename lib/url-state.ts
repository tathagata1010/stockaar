"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Single URL search-param bound to local state, with debounced replace + transition.
 * Mirrors the Screener pattern so filter/tab/search UIs across the app feel identical:
 * - URL is the source of truth (shareable, back-button restores state)
 * - `router.replace` inside `startTransition` — no full navigation, no scroll jump
 * - Debounce for text input; pass `0` for immediate (tabs, chips)
 */
export function useUrlParam(
  name: string,
  opts: { debounceMs?: number } = {},
): {
  value: string;
  set: (next: string) => void;
  pending: boolean;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = searchParams.get(name) ?? "";

  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(searchParams.get(name) ?? "");
  }, [searchParams, name]);

  const push = (next: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const debounceMs = opts.debounceMs ?? 200;
    const run = () => {
      const qs = new URLSearchParams(searchParams.toString());
      if (next.trim()) qs.set(name, next.trim());
      else qs.delete(name);
      const qsStr = qs.toString();
      startTransition(() =>
        router.replace(qsStr ? `${pathname}?${qsStr}` : pathname, { scroll: false }),
      );
    };
    if (debounceMs <= 0) run();
    else debounceRef.current = setTimeout(run, debounceMs);
  };

  const set = (next: string) => {
    setValue(next);
    push(next);
  };

  return { value, set, pending };
}
