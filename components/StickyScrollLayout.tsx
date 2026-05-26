"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StickySection = {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
};

/**
 * Two-column layout with sticky left rail (hero + scroll-spy tab nav) and
 * stacked sections on the right. Tabs update as you scroll and clicking
 * smooth-scrolls to the target section.
 */
export function StickyScrollLayout({
  hero,
  sections,
  children,
  rightHeader,
}: {
  hero: ReactNode;
  sections: StickySection[];
  children: ReactNode;
  rightHeader?: ReactNode;
}) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((e): e is HTMLElement => !!e);
    if (els.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        // Pick entry whose top is closest to viewport top within band
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections]);

  function go(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: "smooth" });
    setActive(id);
  }

  return (
    <div ref={containerRef} className="grid min-w-0 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* MOBILE/TABLET — compact hero + horizontal pill nav */}
      <div className="min-w-0 lg:hidden">
        <div className="mesh-hero rounded-2xl border border-border-strong bg-card/50 p-4 shadow-glow sm:p-6">
          {hero}
        </div>
        <nav className="sticky top-[var(--app-sticky-top,6rem)] z-20 mt-3 overflow-x-auto pb-1">
          <ul className="surface flex w-max gap-1 rounded-full border border-border bg-card/80 p-1 shadow-soft backdrop-blur">
            {sections.map((s) => {
              const isActive = active === s.id;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => go(s.id)}
                    className={cn(
                      "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                      isActive
                        ? "bg-brand-gradient text-brand-fg shadow-pop"
                        : "text-muted hover:bg-bg-2 hover:text-fg",
                    )}
                  >
                    <span className="flex h-4 w-4 items-center justify-center">{s.icon}</span>
                    <span>{s.label}</span>
                    {s.badge != null && (
                      <span className={cn(
                        "rounded-md px-1 py-0.5 text-[9px] font-semibold tabular-nums",
                        isActive ? "bg-white/20 text-brand-fg" : "bg-bg/60 text-muted",
                      )}>
                        {s.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* LEFT — sticky hero + tab rail (desktop only) */}
      <aside className="hidden lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:block pr-1">
        <div className="mesh-hero rounded-2xl border border-border-strong bg-card/50 p-5 shadow-glow md:p-6 lg:p-5 xl:p-6">
          {hero}
        </div>
        <nav className="mt-4 surface rounded-2xl p-2 shadow-soft">
          <ul className="space-y-0.5">
            {sections.map((s) => {
              const isActive = active === s.id;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => go(s.id)}
                    className={cn(
                      "group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-all",
                      isActive
                        ? "text-brand"
                        : "text-muted hover:bg-card/60 hover:text-fg",
                    )}
                  >
                    {isActive && (
                      <span className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-brand/15 via-brand/5 to-transparent ring-1 ring-brand/30" />
                    )}
                    <span className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                      isActive ? "bg-brand-gradient text-brand-fg shadow-pop" : "bg-bg/60 group-hover:bg-bg",
                    )}>
                      {s.icon}
                    </span>
                    <span className="flex-1">{s.label}</span>
                    {s.badge != null && (
                      <span className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                        isActive ? "bg-brand/20 text-brand" : "bg-bg/60 text-muted",
                      )}>
                        {s.badge}
                      </span>
                    )}
                    {isActive && <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse-soft" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* RIGHT — stacked sections */}
      <div className="min-w-0">
        {rightHeader}
        <div className="space-y-8">{children}</div>
      </div>
    </div>
  );
}

export function StickySection({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)}>
      {children}
    </section>
  );
}
