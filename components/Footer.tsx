import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { Sparkles, ShieldCheck } from "lucide-react";

const PRODUCT = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/hot-stocks", label: "Hot Stocks" },
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
  { href: "/tools/stock-check", label: "Stock Check" },
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
    <footer className="mt-16 border-t border-hairline-strong">
      <div className="mx-auto max-w-[1520px] px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 sm:gap-10 md:grid-cols-12">
          {/* Brand column */}
          <div className="sm:col-span-2 md:col-span-4">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-gradient text-brand-fg shadow-e1">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="num-display text-lg font-bold">{APP_NAME}</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed t-mid">
              India&apos;s most intuitive stock intelligence platform. Live prices, AI briefs, scorecards, screener and alerts for NSE &amp; BSE — built for retail investors.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="chip chip--accent">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                </span>
                Live · NSE / BSE
              </span>
              <span className="chip chip--muted">
                <ShieldCheck className="h-3 w-3 text-brand" />
                Razorpay verified
              </span>
            </div>
          </div>

          {/* Link columns */}
          <FooterCol title="Product" items={PRODUCT} />
          <FooterCol title="Coverage" items={COVERAGE} />
          <FooterCol title="Company" items={COMPANY} />
          <FooterCol title="Free Tools" items={TOOLS} />
          <FooterCol title="Legal" items={LEGAL} />
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-hairline pt-6 md:flex-row md:items-start md:justify-between">
          <p className="t-caption">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <p className="max-w-2xl t-caption leading-relaxed md:text-right">
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
      <div className="t-label">{title}</div>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              className="text-sm t-mid transition-colors duration-fast ease-out hover:text-brand"
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
