"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renders its children only after entering the viewport (within `rootMargin`).
 * Use for heavy tables/charts below the fold to keep first paint fast.
 */
export function LazyMount({
  children,
  fallback,
  rootMargin = "400px",
  minHeight = 240,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, rootMargin]);

  return (
    <div ref={ref} style={!shown ? { minHeight } : undefined}>
      {shown ? children : (fallback ?? <DefaultFallback />)}
    </div>
  );
}

function DefaultFallback() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="h-4 w-32 shimmer rounded" />
      <div className="mt-4 space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 w-full shimmer rounded" />
        ))}
      </div>
    </div>
  );
}

/**
 * Paginated client-side renderer: shows the first `pageSize` items, then
 * appends another chunk when the sentinel scrolls into view. Great for
 * 500+ row screener/anomalies tables.
 */
export function LazyChunks<T>({
  items,
  pageSize = 25,
  render,
  empty,
}: {
  items: T[];
  pageSize?: number;
  render: (chunk: T[], index: number) => ReactNode;
  empty?: ReactNode;
}) {
  const [count, setCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCount(pageSize);
  }, [items, pageSize]);

  useEffect(() => {
    if (count >= items.length || !sentinelRef.current) return;
    const el = sentinelRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setCount((c) => Math.min(c + pageSize, items.length));
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [count, items.length, pageSize]);

  if (items.length === 0) return <>{empty}</>;

  const shown = items.slice(0, count);
  return (
    <>
      {render(shown, count)}
      {count < items.length && (
        <div ref={sentinelRef} className="mt-4 flex items-center justify-center py-6 text-xs text-muted">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand mr-2" />
          Loading {Math.min(pageSize, items.length - count)} more of {items.length}…
        </div>
      )}
    </>
  );
}
