import Link from "next/link";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { Footer } from "@/components/Footer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MarketTickerStripAsync } from "@/components/MarketTickerStrip";
import { NavProgress } from "@/components/NavProgress";
import { PageTransition } from "@/components/anim/PageTransition";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense fallback={null}><NavProgress /></Suspense>
      <MarketTickerStripAsync />
      <header className="sticky top-10 z-40 border-b border-border-strong bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-brand-fg shadow-pop">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="num-display text-xl font-bold">{APP_NAME}</span>
          </Link>
          <nav className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/auth/login"
              className="rounded-lg px-3 py-2 text-sm text-fg/80 transition-colors hover:text-brand"
            >
              Log in
            </Link>
            <Link href="/auth/signup" className="btn-brand">
              Get started
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <PageTransition>{children}</PageTransition>
      </div>
      <Footer />
    </div>
  );
}
