"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [show, setShow] = useState(false);
  const [width, setWidth] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function start() {
    clearTimers();
    setShow(true);
    setWidth(8);
    timers.current.push(setTimeout(() => setWidth(35), 100));
    timers.current.push(setTimeout(() => setWidth(65), 350));
    timers.current.push(setTimeout(() => setWidth(82), 800));
    timers.current.push(setTimeout(() => setWidth(92), 1600));
  }

  function finish() {
    clearTimers();
    setWidth(100);
    timers.current.push(
      setTimeout(() => {
        setShow(false);
        setWidth(0);
      }, 250),
    );
  }

  // Detect link clicks → start progress immediately
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank") return;
      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
        start();
      } catch {}
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Finish whenever the URL changes (route has resolved)
  useEffect(() => {
    finish();
    return clearTimers;
  }, [pathname, search]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px]">
      <div
        className="h-full bg-gradient-to-r from-brand via-accent to-brand-2 shadow-[0_0_10px_rgba(99,102,241,0.6)] transition-all duration-200 ease-out"
        style={{
          width: `${width}%`,
          opacity: show ? 1 : 0,
        }}
      />
    </div>
  );
}
