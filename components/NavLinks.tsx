"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Star, Flame, Target, Filter, Zap, Bell, User2,
  Newspaper, Layers3, CalendarDays, Wrench, GraduationCap, ChevronDown,
  Briefcase, ShoppingCart, Activity,
} from "lucide-react";

export const PRIMARY = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/hot-stocks", label: "Hot", icon: Flame },
  { href: "/calls", label: "Calls", icon: Target },
  { href: "/screener", label: "Screener", icon: Filter },
  { href: "/news", label: "News", icon: Newspaper },
];

export const DISCOVER = [
  { href: "/trending", label: "Trending", icon: Flame, desc: "What Reddit is buzzing about" },
  { href: "/sectors", label: "Sectors", icon: Layers3, desc: "Live sector performance" },
  { href: "/anomalies", label: "Anomalies", icon: Zap, desc: "Unusual market moves" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, desc: "Earnings & IPO dates" },
  { href: "/alerts", label: "Alerts", icon: Bell, desc: "Price target notifications" },
];

export const TOOLS = [
  { href: "/tools/portfolio", label: "Portfolio Analyzer", icon: Briefcase, desc: "Concentration & P/L" },
  { href: "/tools/should-i-buy", label: "Should I Buy?", icon: ShoppingCart, desc: "Instant stock verdict" },
  { href: "/tools/rsi", label: "RSI Scanner", icon: Activity, desc: "Overbought / oversold" },
  { href: "/learn", label: "Learn Hub", icon: GraduationCap, desc: "Investing guides" },
];

export const RIGHT = [
  { href: "/account", label: "Account", icon: User2 },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavLinks() {
  const pathname = usePathname();
  return (
    <div className="hidden items-center gap-1 md:flex">
      {PRIMARY.map((l) => <NavItem key={l.href} {...l} active={isActive(pathname, l.href)} />)}
      <Dropdown
        label="Discover"
        items={DISCOVER}
        active={DISCOVER.some((i) => isActive(pathname, i.href))}
        pathname={pathname}
      />
      <Dropdown
        label="Tools"
        items={TOOLS}
        active={TOOLS.some((i) => isActive(pathname, i.href))}
        pathname={pathname}
      />
      {RIGHT.map((l) => <NavItem key={l.href} {...l} active={isActive(pathname, l.href)} />)}
    </div>
  );
}

function NavItem({
  href, label, icon: Icon, active,
}: { href: string; label: string; icon: typeof LayoutDashboard; active: boolean }) {
  return (
    <Link
      href={href}
      prefetch
      className={cn(
        "group relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-all",
        active ? "font-semibold text-brand" : "text-muted hover:bg-card/60 hover:text-fg",
      )}
    >
      {active && (
        <span className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-b from-brand/15 to-brand/5 ring-1 ring-brand/30" />
      )}
      <Icon className={cn("h-3.5 w-3.5", active && "text-brand")} />
      <span>{label}</span>
    </Link>
  );
}

function Dropdown({
  label, items, active, pathname,
}: {
  label: string;
  items: { href: string; label: string; icon: typeof LayoutDashboard; desc: string }[];
  active: boolean;
  pathname: string;
}) {
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group relative inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm transition-all",
          active || open ? "font-semibold text-brand" : "text-muted hover:bg-card/60 hover:text-fg",
        )}
      >
        {(active || open) && (
          <span className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-b from-brand/15 to-brand/5 ring-1 ring-brand/30" />
        )}
        <span>{label}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 origin-top-right rounded-2xl border border-border-strong bg-card/95 p-2 shadow-glow backdrop-blur fade-up">
          <ul className="space-y-0.5">
            {items.map((i) => {
              const Icon = i.icon;
              const isActiveItem = isActive(pathname, i.href);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all",
                      isActiveItem ? "bg-brand/10 text-brand" : "text-fg hover:bg-card",
                    )}
                  >
                    <span className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      isActiveItem ? "bg-brand-gradient text-brand-fg shadow-pop" : "bg-bg/60 text-muted group-hover:text-brand",
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-tight">{i.label}</div>
                      <div className="text-[11px] text-muted">{i.desc}</div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
