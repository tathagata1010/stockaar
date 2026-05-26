"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, TrendingUp } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";
import { MobileNavDrawer } from "./shell/MobileNavDrawer";
import { signOut } from "@/app/auth/actions";

export function Header({ email }: { email: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="glass sticky top-10 z-30">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg border border-border bg-card/60 p-2 text-muted transition hover:bg-card hover:text-fg md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Link href="/dashboard" className="group flex items-center gap-2 text-xl font-bold">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-pop transition-transform group-hover:scale-110 group-hover:rotate-6 float-slow">
              <TrendingUp className="h-4 w-4" />
              <span className="absolute inset-0 rounded-xl ring-1 ring-white/20" />
            </span>
            <span className="text-gradient-animate text-xl tracking-tight sm:text-2xl">{APP_NAME}</span>
          </Link>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <NavLinks />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={signOut} className="hidden md:block">
              <button
                type="submit"
                title={email}
                className="rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-danger/50 hover:bg-danger/10 hover:text-danger"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>
      <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" />

      {drawerOpen && <MobileNavDrawer email={email} onClose={() => setDrawerOpen(false)} />}
    </header>
  );
}
