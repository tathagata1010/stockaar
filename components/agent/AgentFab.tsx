"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { AgentPanel } from "./AgentPanel";
import { PanelContextProvider } from "./PanelContext";

const STORAGE_KEY = "sb:agentFabOpen";

function symbolFromPath(pathname: string): string | undefined {
  const m = pathname.match(/^\/stock\/([^/]+)/);
  return m ? decodeURIComponent(m[1]).toUpperCase() : undefined;
}

export function AgentFab() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const contextSymbol = symbolFromPath(pathname);
  const hidden = pathname.startsWith("/read");

  useEffect(() => {
    if (hidden) return;
    setOpen(sessionStorage.getItem(STORAGE_KEY) === "1");
  }, [hidden]);

  useEffect(() => {
    if (hidden) return;
    sessionStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  }, [open, hidden]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close research agent" : "Open research agent"}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-brand-fg shadow-e3 transition-all duration-fast ease-out hover:scale-105 hover:brightness-110 hover:shadow-e4"
      >
        {open ? (
          <span aria-hidden className="text-xl leading-none">×</span>
        ) : (
          <span aria-hidden className="text-xl leading-none pulse-live">✨</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-bg/60 backdrop-blur-sm"
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col surface-glass shadow-e4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface-1/80 t-muted backdrop-blur transition-colors duration-fast ease-out hover:border-brand/40 hover:bg-surface-1 hover:text-fg"
            >
              <span aria-hidden className="text-base leading-none">×</span>
            </button>
            <div className="flex-1 overflow-hidden">
              <PanelContextProvider>
                <AgentPanel contextSymbol={contextSymbol} />
              </PanelContextProvider>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
