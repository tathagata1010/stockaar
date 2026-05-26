import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { Sparkles, ShieldCheck } from "lucide-react";

const PRODUCT = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/hot-stocks", label: "Hot Stocks" },
  { href: "/calls", label: "Calls" },
  { href: "/screener", label: "Screener" },
  { href: "/news", label: "News" },
];

const COVERAGE = [
  { href: "/sectors", label: "Sectors" },
  { href: "/anomalies", label: "Anomalies" },
  { href: "/calendar", label: "Calendar" },
  { href: "/alerts", label: "Alerts" },
];

const COMPANY = [
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/learn", label: "Learn" },
  { href: "/contact", label: "Contact" },
];

const TOOLS = [
  { href: "/tools/portfolio", label: "Portfolio Analyzer" },
  { href: "/tools/should-i-buy", label: "Should I Buy?" },
  { href: "/tools/rsi", label: "RSI Scanner" },
  { href: "/calendar", label: "Earnings Calendar" },
];

const LEGAL = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/disclaimer", label: "Disclaimer" },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border-strong bg-bg-2/60 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 sm:gap-10 md:grid-cols-12">
          {/* Brand column */}
          <div className="sm:col-span-2 md:col-span-4">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-brand-fg shadow-pop">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="num-display text-xl font-bold">{APP_NAME}</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              India&apos;s most intuitive stock intelligence platform. Live prices, AI briefs, scorecards, screener and alerts for NSE & BSE — built for retail investors.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1.5 text-[11px] text-accent">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              Live now · NSE / BSE
            </div>

            <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[11px] text-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-brand" />
              Razorpay verified payments
            </div>
          </div>

          {/* Link columns */}
          <FooterCol title="Product" items={PRODUCT} />
          <FooterCol title="Coverage" items={COVERAGE} />
          <FooterCol title="Company" items={COMPANY} />
          <FooterCol title="Free Tools" items={TOOLS} />
          <FooterCol title="Legal" items={LEGAL} />
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 md:flex-row md:items-start md:justify-between">
          <p className="text-[11px] text-muted">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <p className="max-w-2xl text-[11px] leading-relaxed text-muted md:text-right">
            {APP_NAME} provides market data and analytics for informational purposes only. Nothing here is investment advice. Past performance does not guarantee future results.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title, items,
}: {
  title: string;
  items: { href: string; label: string }[];
}) {
  return (
    <div className="md:col-span-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</div>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              className="text-sm text-fg/80 transition-colors hover:text-brand"
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
