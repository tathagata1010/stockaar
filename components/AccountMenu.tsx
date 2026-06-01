"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { User2, Settings, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/auth/actions";

export function AccountMenu({ email }: { email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (email?.[0] ?? "?").toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 py-1 pl-1 pr-2 transition-all hover:border-brand/40 hover:bg-card",
          open && "border-brand/40 bg-card",
        )}
        aria-label="Account menu"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-gradient text-xs font-semibold text-white">
          {initial}
        </span>
        <ChevronDown className={cn("h-3 w-3 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-64 origin-top-right rounded-2xl border border-border-strong bg-card/95 p-2 shadow-glow backdrop-blur fade-up">
          <div className="border-b border-border px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Signed in as</div>
            <div className="mt-0.5 truncate text-sm font-medium text-fg">{email}</div>
          </div>
          <ul className="mt-1 space-y-0.5">
            <li>
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg transition-colors hover:bg-bg/60"
              >
                <Settings className="h-4 w-4 text-muted" />
                Account settings
              </Link>
            </li>
            <li>
              <Link
                href="/alerts"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg transition-colors hover:bg-bg/60"
              >
                <User2 className="h-4 w-4 text-muted" />
                My alerts
              </Link>
            </li>
          </ul>
          <div className="my-1 border-t border-border" />
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
