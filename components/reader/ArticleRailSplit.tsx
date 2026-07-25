"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";

const STORAGE_KEY = "reader:rail-width";
const MIN_RAIL = 300;
const MAX_RAIL = 640;
const DEFAULT_RAIL = 380;

export function ArticleRailSplit({ article, rail }: { article: ReactNode; rail: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [railWidth, setRailWidth] = useState<number>(DEFAULT_RAIL);
  const [dragging, setDragging] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n >= MIN_RAIL && n <= MAX_RAIL) setRailWidth(n);
    setReady(true);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const raw = rect.right - e.clientX;
      const clamped = Math.min(MAX_RAIL, Math.max(MIN_RAIL, raw));
      setRailWidth(clamped);
    },
    [dragging],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setDragging(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(railWidth));
    } catch {}
  }, [dragging, railWidth]);

  return (
    <div
      ref={containerRef}
      className="flex min-w-0 gap-0 lg:gap-2"
      style={{ cursor: dragging ? "col-resize" : undefined }}
    >
      <div className="min-w-0 flex-1">{article}</div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize reader panel"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="group/handle hidden lg:flex w-2 shrink-0 cursor-col-resize items-center justify-center select-none"
      >
        <span
          className={`flex h-16 w-1 items-center justify-center rounded-full bg-border transition group-hover/handle:bg-brand/70 ${
            dragging ? "bg-brand" : ""
          }`}
        >
          <GripVertical className="h-3 w-3 text-transparent group-hover/handle:text-white" />
        </span>
      </div>

      <aside
        style={ready ? { width: railWidth } : undefined}
        className="hidden lg:sticky lg:top-24 lg:block lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1 lg:shrink-0"
      >
        {rail}
      </aside>
    </div>
  );
}
