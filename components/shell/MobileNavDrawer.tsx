"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY, DISCOVER, TOOLS } from "@/components/NavLinks";
import { signOut } from "@/app/auth/actions";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function MobileNavDrawer({ email, onClose }: { email: string; onClose: () => void }) {
  const pathname = usePathname();
  const initialPath = useRef(pathname);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (pathname !== initialPath.current) onClose();
  }, [pathname, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[85] md:hidden">
      <div
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 w-[85%] max-w-sm overflow-hidden border-l border-border-strong bg-card shadow-glow animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="text-sm font-semibold">Menu</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-bg-2 hover:text-fg"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(100vh-3.25rem)] overflow-y-auto p-4 pb-24">
          <NavGroup label="Main" items={PRIMARY} pathname={pathname} />
          <NavGroup label="Discover" items={DISCOVER} pathname={pathname} />
          <NavGroup label="Tools" items={TOOLS} pathname={pathname} />

          <div className="mt-6 rounded-xl border border-border bg-bg/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted">Signed in as</div>
            <div className="mt-1 truncate text-sm font-medium">{email || "—"}</div>
            <form action={signOut} className="mt-3">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted transition hover:border-danger/50 hover:bg-danger/10 hover:text-danger"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: { href: string; label: string; icon: any; desc?: string }[];
  pathname: string;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <ul className="space-y-0.5">
        {items.map((i) => {
          const Icon = i.icon;
          const active = isActive(pathname, i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                className={cn(
                  "flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all",
                  active ? "bg-brand/10 text-brand" : "text-fg hover:bg-bg-2",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    active ? "bg-brand-gradient text-brand-fg shadow-pop" : "bg-bg/60 text-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold leading-tight">{i.label}</div>
                  {i.desc && <div className="text-[11px] text-muted">{i.desc}</div>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
