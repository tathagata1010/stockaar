"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { MobileRailSheet } from "./MobileRailSheet";

/**
 * Universal authed-page shell. Renders a sticky left rail on desktop and
 * collapses it into a "Filters" bottom sheet on mobile/tablet.
 *
 *  - `<lg` (mobile/tablet): main content full-width, rail accessed via a
 *    sticky "Filters" pill that opens a bottom sheet.
 *  - `lg+` (desktop): two-column grid — sticky 280px rail + main content.
 *  - `xl+`: rail bumps to 300px for breathing room.
 */
export function AppShell({
  rail,
  children,
  railLabel = "Filters",
  hero,
}: {
  rail?: ReactNode;
  children: ReactNode;
  railLabel?: string;
  hero?: ReactNode;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!rail) {
    return (
      <div className="space-y-6">
        {hero}
        <div className="min-w-0">{children}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hero}

      {/* Mobile / tablet trigger pill */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-card/80 px-4 py-2 text-xs font-semibold shadow-soft backdrop-blur transition hover:border-brand/40 hover:text-brand"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {railLabel}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto pr-1">
          {rail}
        </aside>
        <div className="min-w-0">{children}</div>
      </div>

      {sheetOpen && (
        <MobileRailSheet title={railLabel} onClose={() => setSheetOpen(false)}>
          {rail}
        </MobileRailSheet>
      )}
    </div>
  );
}
