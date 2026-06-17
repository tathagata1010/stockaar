"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { NSE_SYMBOLS, type SymbolEntry } from "@/lib/nse-symbols";
import { INDICES } from "@/lib/market";
import { cn } from "@/lib/utils";
import { useDismiss } from "@/lib/hooks/useDismiss";

type Result =
  | { kind: "stock"; symbol: string; name: string; sector: string; exchange: "NSE" | "BSE" }
  | { kind: "index"; slug: string; name: string };

const ALL_RESULTS: Result[] = [
  ...INDICES.map((i) => ({ kind: "index" as const, slug: i.slug, name: i.name })),
  ...NSE_SYMBOLS.map((s: SymbolEntry) => ({
    kind: "stock" as const,
    symbol: s.symbol,
    name: s.name,
    sector: s.sector,
    exchange: s.exchange,
  })),
];

function score(r: Result, q: string): number {
  const needle = q.toLowerCase();
  const sym = r.kind === "stock" ? r.symbol.toLowerCase() : "";
  const name = r.name.toLowerCase();
  if (sym === needle) return 1000;
  if (sym.startsWith(needle)) return 800;
  if (name.startsWith(needle)) return 600;
  if (sym.includes(needle)) return 400;
  if (name.includes(needle)) return 200;
  return 0;
}

export function StockSearch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);

  const results = useMemo(() => {
    if (q.trim().length === 0) return [] as Result[];
    return ALL_RESULTS
      .map((r) => ({ r, s: score(r, q.trim()) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((x) => x.r);
  }, [q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(boxRef, open, close, { escape: false });

  useEffect(() => { setActive(0); }, [q]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function go(r: Result) {
    const href = r.kind === "stock" ? `/stock/${r.symbol}` : `/indices/${r.slug}`;
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && results[active]) { e.preventDefault(); go(results[active]); }
    else if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
  }

  return (
    <div ref={boxRef} className={cn("relative", compact ? "w-full" : "w-full md:w-72")}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search stocks, indices…"
          aria-label="Search stocks and indices"
          className="w-full rounded-lg border border-border bg-card/60 py-1.5 pl-8 pr-12 text-sm text-fg placeholder:text-muted/70 focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        {q ? (
          <button
            type="button"
            onClick={() => { setQ(""); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:bg-border/40 hover:text-fg"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden rounded border border-border bg-bg/60 px-1.5 py-0.5 font-mono text-[10px] text-muted md:inline-block">
            /
          </kbd>
        )}
      </div>

      {open && q.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-auto rounded-lg border border-border bg-card shadow-pop">
          {results.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted">No matches for &ldquo;{q}&rdquo;</div>
          ) : (
            <ul className="py-1">
              {results.map((r, i) => {
                const isActive = i === active;
                return (
                  <li
                    key={r.kind === "stock" ? `s:${r.symbol}` : `i:${r.slug}`}
                    ref={(el) => { itemRefs.current[i] = el; }}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(r)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors",
                        isActive ? "bg-brand/10 text-fg" : "text-fg hover:bg-bg/60",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold tabular-nums">{r.kind === "stock" ? r.symbol : r.name}</span>
                          <span className={cn(
                            "rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                            r.kind === "index" ? "bg-brand/15 text-brand" : "bg-border/40 text-muted",
                          )}>
                            {r.kind === "index" ? "Index" : r.exchange}
                          </span>
                        </div>
                        <div className="truncate text-[11px] text-muted">
                          {r.kind === "stock" ? `${r.name} · ${r.sector}` : "Indian market index"}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted">
            <kbd className="font-mono">↑↓</kbd> navigate · <kbd className="font-mono">↵</kbd> open · <kbd className="font-mono">esc</kbd> close
          </div>
        </div>
      )}
    </div>
  );
}
