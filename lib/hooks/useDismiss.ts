"use client";

import { useEffect, type RefObject } from "react";

export function useDismiss(
  ref: RefObject<HTMLElement>,
  open: boolean,
  onDismiss: () => void,
  options: { escape?: boolean } = { escape: true },
) {
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("mousedown", onClick);
    if (options.escape) document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      if (options.escape) document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, onDismiss, options.escape]);
}
