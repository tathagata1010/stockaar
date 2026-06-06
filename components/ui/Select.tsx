"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismiss } from "@/lib/hooks/useDismiss";

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
  className,
  placeholder,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, value, options]);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(options[active].value); }
  }

  function pick(v: T) {
    onChange(v);
    setOpen(false);
    btnRef.current?.focus();
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm text-fg transition-colors",
          "hover:border-brand/40 focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-brand/50 ring-2 ring-brand/20",
        )}
      >
        <span className={cn("truncate", !current && "text-muted")}>
          {current?.label ?? placeholder ?? "Select…"}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-card py-1 shadow-pop"
        >
          {options.map((o, i) => {
            const isSel = o.value === value;
            const isActive = i === active;
            return (
              <li key={o.value} role="option" aria-selected={isSel}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o.value)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors",
                    isActive ? "bg-brand/10 text-fg" : "text-fg hover:bg-bg/60",
                    isSel && "font-semibold",
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate">{o.label}</div>
                    {o.hint && <div className="truncate text-[11px] text-muted">{o.hint}</div>}
                  </div>
                  {isSel && <Check className="h-3.5 w-3.5 shrink-0 text-brand" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
