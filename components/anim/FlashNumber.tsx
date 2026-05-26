"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  format?: (n: number) => string;
  className?: string;
  flashOn?: "value" | "sign";
  durationMs?: number;
};

export function FlashNumber({
  value,
  format = (n) => String(n),
  className,
  flashOn = "value",
  durationMs = 900,
}: Props) {
  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (prev.current === null) {
      prev.current = value;
      return;
    }
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      prev.current = value;
      return;
    }
    const last = prev.current;
    const changed = flashOn === "sign" ? Math.sign(value) !== Math.sign(last) : value !== last;
    if (changed) {
      setFlash(value > last ? "up" : value < last ? "down" : null);
      const t = setTimeout(() => setFlash(null), durationMs);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value, flashOn, durationMs]);

  return (
    <span
      className={cn(
        "inline-block rounded px-0.5 transition-colors",
        flash === "up" && "flash-up",
        flash === "down" && "flash-down",
        className,
      )}
    >
      {format(value)}
    </span>
  );
}
