"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  to: number;
  durationMs?: number;
  format?: (n: number) => string;
  from?: number;
  className?: string;
};

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function CountUp({ to, durationMs = 800, format = (n) => n.toFixed(2), from = 0, className }: Props) {
  const [value, setValue] = useState<number>(to);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }
    setValue(from);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(from + (to - from) * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(to);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, from, durationMs]);

  return <span className={className}>{format(value)}</span>;
}
