"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export type PanelContextValue = {
  pathname: string;
  symbol?: string;
  screenerParams: Record<string, string>;
  storyId?: string;
};

const Ctx = createContext<PanelContextValue | null>(null);

function symbolFromPath(pathname: string): string | undefined {
  const m = pathname.match(/^\/stock\/([^/]+)/);
  return m ? decodeURIComponent(m[1]).toUpperCase() : undefined;
}

function storyIdFromPath(pathname: string): string | undefined {
  const m = pathname.match(/^\/story\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

// usePathname + useSearchParams both re-render on route change, so the memo
// key stays fresh across navigation — this is important for the Refine tab,
// which needs to reflect the *current* URL not the URL at panel mount.
export function PanelContextProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = useMemo<PanelContextValue>(() => {
    const screenerParams: Record<string, string> = {};
    if (pathname === "/screener" && searchParams) {
      searchParams.forEach((v, k) => {
        if (v) screenerParams[k] = v;
      });
    }
    return {
      pathname,
      symbol: symbolFromPath(pathname),
      screenerParams,
      storyId: storyIdFromPath(pathname),
    };
  }, [pathname, searchParams]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePanelContext(): PanelContextValue {
  const v = useContext(Ctx);
  if (!v) {
    // Panel used outside provider (e.g. server-mounted preview) — return a
    // safe default rather than throwing so nothing crashes at first paint.
    return { pathname: "/", screenerParams: {} };
  }
  return v;
}
