"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, ArrowUpDown, CornerDownLeft, X, Clock } from "lucide-react";
import { NSE_SYMBOLS, searchSymbols, type SymbolEntry } from "@/lib/nse-symbols";

const MAX_RESULTS = 8;
const DEFAULT_RECENT_KEY = "stockaar:symbol-picker:recents";

export type SymbolPickerProps = {
  /** Initial value shown in the input. */
  defaultSymbol?: string;
  /** Custom placeholder text. */
  placeholder?: string;
  /** Visual size — "md" is the big hero search, "sm" is a compact inline picker. */
  size?: "md" | "sm";
  /**
   * Optional select handler. If omitted, the picker navigates to
   * `/tools/should-i-buy?symbol=<symbol>` (legacy default).
   */
  onSelect?: (entry: SymbolEntry) => void;
  /** Clear the input after a successful pick. Default: true when onSelect is provided. */
  clearOnSelect?: boolean;
  /** Disable the input. */
  disabled?: boolean;
  /**
   * Separate localStorage namespaces so e.g. "Add to watchlist" recents don't
   * overwrite "Should I buy" recents.
   */
  recentKey?: string;
  /** Auto-focus the input on mount. */
  autoFocus?: boolean;
};

export function SymbolPicker({
  defaultSymbol,
  placeholder = "Search any NSE stock — TCS, Infosys, Reliance…",
  size = "md",
  onSelect,
  clearOnSelect,
  disabled = false,
  recentKey = DEFAULT_RECENT_KEY,
  autoFocus = false,
}: SymbolPickerProps) {
  const [query, setQuery] = useState(defaultSymbol ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [recents, setRecents] = useState<SymbolEntry[]>([]);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(recentKey);
      if (raw) setRecents(JSON.parse(raw).slice(0, 5));
    } catch {}
    if (autoFocus) inputRef.current?.focus();
  }, [recentKey, autoFocus]);

  const results = useMemo<SymbolEntry[]>(() => {
    const q = query.trim();
    if (!q) return recents;
    return searchSymbols(q, MAX_RESULTS);
  }, [query, recents]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useLayoutEffect(() => {
    if (!open) return;
    function updateRect() {
      if (wrapRef.current) setRect(wrapRef.current.getBoundingClientRect());
    }
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      const portal = document.getElementById("symbol-picker-portal");
      if (portal?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(s: SymbolEntry) {
    setOpen(false);
    inputRef.current?.blur();
    const next = [s, ...recents.filter((r) => r.symbol !== s.symbol)].slice(0, 5);
    setRecents(next);
    try {
      localStorage.setItem(recentKey, JSON.stringify(next));
    } catch {}
    const shouldClear = clearOnSelect ?? !!onSelect;
    setQuery(shouldClear ? "" : s.symbol);
    if (onSelect) {
      onSelect(s);
    } else {
      router.push(`/tools/should-i-buy?symbol=${s.symbol}`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      const r = results[active];
      if (r) {
        e.preventDefault();
        pick(r);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showingRecents = !query.trim() && recents.length > 0;
  const isSm = size === "sm";

  return (
    <>
      <div ref={wrapRef} className="relative">
        <div
          className={`relative rounded-${isSm ? "xl" : "2xl"} p-[1px] transition-all duration-300 ${
            open
              ? "bg-gradient-to-r from-brand via-accent to-brand shadow-glow"
              : "bg-gradient-to-r from-border via-border-strong to-border"
          } ${disabled ? "opacity-50" : ""}`}
        >
          <div className={`relative rounded-${isSm ? "xl" : "2xl"} bg-card`}>
            <Search
              className={`pointer-events-none absolute ${isSm ? "left-3" : "left-4"} top-1/2 ${isSm ? "h-3.5 w-3.5" : "h-4 w-4"} -translate-y-1/2 transition-colors ${
                open ? "text-brand" : "text-muted"
              }`}
            />
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={query}
              disabled={disabled}
              onChange={(e) => {
                setQuery(e.target.value.toUpperCase());
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              autoComplete="off"
              className={`w-full rounded-${isSm ? "xl" : "2xl"} bg-transparent ${
                isSm ? "py-2 pl-9 pr-20 text-xs" : "py-3.5 pl-11 pr-28 text-sm"
              } font-medium tracking-wide outline-none placeholder:text-muted/70`}
            />
            {query && !disabled && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className={`absolute ${isSm ? "right-14" : "right-20"} top-1/2 -translate-y-1/2 rounded-md p-1 text-muted transition hover:bg-bg-2 hover:text-fg`}
                aria-label="Clear"
              >
                <X className={isSm ? "h-3 w-3" : "h-3.5 w-3.5"} />
              </button>
            )}
            <div className={`pointer-events-none absolute ${isSm ? "right-2" : "right-3"} top-1/2 hidden -translate-y-1/2 items-center gap-1 text-[10px] text-muted sm:flex`}>
              <kbd className="rounded border border-border bg-bg-2 px-1.5 py-0.5 font-mono">↑↓</kbd>
              <kbd className="rounded border border-border bg-bg-2 px-1.5 py-0.5 font-mono">↵</kbd>
            </div>
          </div>
        </div>
      </div>

      {mounted && open && rect &&
        createPortal(
          <div
            id="symbol-picker-portal"
            className="fixed z-[90] animate-in fade-in slide-in-from-top-1 duration-150"
            style={{ top: rect.bottom + 8, left: rect.left, width: rect.width }}
          >
            <div className="overflow-hidden rounded-2xl border border-border-strong bg-card/95 shadow-2xl backdrop-blur-md">
              {showingRecents && (
                <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted">
                  <Clock className="h-3 w-3" /> Recent
                </div>
              )}
              {results.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted">
                  No matches for{" "}
                  <span className="font-semibold text-fg">{query}</span>
                </div>
              ) : (
                <ul className="max-h-[320px] overflow-auto py-1">
                  {results.map((r, i) => (
                    <li key={`${r.exchange}:${r.symbol}`}>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => pick(r)}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                          i === active ? "bg-brand/10" : "hover:bg-bg-2"
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ring-1 transition ${
                            i === active
                              ? "bg-brand-gradient text-brand-fg ring-brand/50"
                              : "bg-bg-2 text-fg/80 ring-border"
                          }`}
                        >
                          {r.symbol.slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{r.symbol}</span>
                            <span className="rounded-full bg-bg-2 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted ring-1 ring-border">
                              {r.exchange}
                            </span>
                          </div>
                          <div className="truncate text-xs text-muted">
                            {r.name} · {r.sector}
                          </div>
                        </div>
                        {i === active && (
                          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-brand" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center justify-between border-t border-border bg-bg-2/40 px-3 py-1.5 text-[10px] text-muted">
                <span className="inline-flex items-center gap-1">
                  <ArrowUpDown className="h-3 w-3" /> navigate · ↵ select · esc close
                </span>
                <span className="tabular-nums">
                  {results.length}/{NSE_SYMBOLS.length}
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
