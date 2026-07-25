"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, TrendingUp } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";
import { MobileNavDrawer } from "./shell/MobileNavDrawer";
import { StockSearch } from "./StockSearch";
import { AccountMenu } from "./AccountMenu";
import { StreakBadge } from "./StreakBadge";

export function Header({ email }: { email: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="surface-glass sticky top-10 z-30">
      <nav className="mx-auto flex max-w-[1520px] items-center gap-2 px-4 py-2.5 sm:px-6 lg:gap-3 lg:px-8">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-md border border-hairline bg-surface-1/60 p-2 text-text-lo transition-colors duration-fast ease-out hover:border-brand/40 hover:bg-surface-1 hover:text-fg md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Link href="/dashboard" className="group flex shrink-0 items-center gap-2 font-bold">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-md bg-brand-gradient text-white shadow-e2 transition-transform duration-base ease-out group-hover:scale-105 group-hover:rotate-3">
              <TrendingUp className="h-4 w-4" />
              <span className="absolute inset-0 rounded-md ring-1 ring-white/20" />
            </span>
            <span className="text-gradient-animate tracking-tight text-lg sm:text-xl">{APP_NAME}</span>
          </Link>
        </div>
        <div className="hidden shrink-0 md:block md:w-44 lg:w-52 xl:w-60">
          <StockSearch compact />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
          <NavLinks />
          <div className="flex items-center gap-2">
            <StreakBadge />
            <ThemeToggle />
            <div className="hidden md:block">
              <AccountMenu email={email} />
            </div>
          </div>
        </div>
      </nav>
      <div className="mx-auto max-w-[1520px] px-4 pb-2 sm:px-6 lg:px-8 md:hidden">
        <StockSearch compact />
      </div>
      <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" />

      {drawerOpen && <MobileNavDrawer email={email} onClose={() => setDrawerOpen(false)} />}
    </header>
  );
}
