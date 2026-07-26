"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Star, Flame, Filter, Zap, Bell,
  Newspaper, Layers3, CalendarDays, Briefcase, SearchCheck, Activity,
  GraduationCap, User2, Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageRail, RailSection } from "@/components/shell/PageRail";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Main" as const },
  { href: "/watchlist", label: "Watchlist", icon: Star, group: "Main" as const },
  { href: "/screener", label: "Screener", icon: Filter, group: "Main" as const },
  { href: "/news", label: "News", icon: Newspaper, group: "Main" as const },

  { href: "/trending", label: "Trending", icon: Flame, group: "Discover" as const },
  { href: "/hot-stocks", label: "Hot stocks", icon: Flame, group: "Discover" as const },
  { href: "/anomalies", label: "Anomalies", icon: Zap, group: "Discover" as const },
  { href: "/sectors", label: "Sectors", icon: Layers3, group: "Discover" as const },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, group: "Discover" as const },
  { href: "/alerts", label: "Alerts", icon: Bell, group: "Discover" as const },

  { href: "/tools/doctor", label: "Portfolio Doctor", icon: Stethoscope, group: "Tools" as const },
  { href: "/tools/portfolio", label: "Portfolio", icon: Briefcase, group: "Tools" as const },
  { href: "/tools/stock-check", label: "Stock Check", icon: SearchCheck, group: "Tools" as const },
  { href: "/tools/rsi", label: "RSI scanner", icon: Activity, group: "Tools" as const },
  { href: "/learn", label: "Learn hub", icon: GraduationCap, group: "Tools" as const },
  { href: "/account", label: "Account", icon: User2, group: "Tools" as const },
];

export function QuickLinksRail({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const groups = ["Main", "Discover", "Tools"] as const;
  return (
    <PageRail>
      {children}
      {groups.map((g) => (
        <RailSection key={g} label={g}>
          <ul className="space-y-0.5">
            {LINKS.filter((l) => l.group === g).map((l) => {
              const Icon = l.icon;
              const active = pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-all",
                      active ? "bg-brand/10 text-brand font-semibold" : "text-muted hover:bg-bg-2 hover:text-fg",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg text-[11px]",
                        active ? "bg-brand-gradient text-brand-fg shadow-pop" : "bg-bg/60 group-hover:bg-bg",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span>{l.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </RailSection>
      ))}
    </PageRail>
  );
}
