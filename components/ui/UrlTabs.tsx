"use client";

import { cn } from "@/lib/utils";
import { useUrlParam } from "@/lib/url-state";

export type UrlTab<V extends string> = {
  value: V;
  label: string;
  count?: number;
};

/**
 * Debounced URL-bound tab bar. Renders as a filter row that updates `?param=value`
 * via `router.replace` inside `useTransition` — no full navigation, no scroll jump.
 * Use for any list page whose primary state is one of a small set of options
 * (Calls signal tabs, Anomalies category, etc.).
 */
export function UrlTabs<V extends string>({
  paramName,
  tabs,
  defaultValue,
  className,
}: {
  paramName: string;
  tabs: readonly UrlTab<V>[];
  defaultValue?: V;
  className?: string;
}) {
  const { value, set, pending } = useUrlParam(paramName, { debounceMs: 0 });
  const active = (value || defaultValue || tabs[0]?.value) as V;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 text-sm transition-opacity",
        pending && "opacity-70",
        className,
      )}
    >
      {tabs.map((t) => {
        const isActive = active === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => set(t.value)}
            className={cn(
              "rounded-md border px-3 py-1.5 transition",
              isActive
                ? "border-accent bg-accent/10 text-accent shadow-glow"
                : "border-border text-muted hover:border-accent/40 hover:text-fg",
            )}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className="ml-1 text-xs opacity-70">({t.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
