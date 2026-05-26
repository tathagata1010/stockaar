import Link from "next/link";
import {
  Bot, Bell, BarChart3, Flame, AlertTriangle, Mail, Target, Search, Sparkles, LineChart,
} from "lucide-react";

export type ProFeature = {
  icon: React.ReactNode;
  title: string;
  body: string;
  href?: string;
  proOnly?: boolean;
};

export const PRO_FEATURES: ProFeature[] = [
  {
    icon: <Bot className="h-4 w-4" />,
    title: "AI Brief on every stock",
    body: "Bull, base, bear price scenarios with rationale, plus moat, risk, and the catalysts to watch.",
    href: "/stock/RELIANCE",
    proOnly: true,
  },
  {
    icon: <Target className="h-4 w-4" />,
    title: "4-Pillar Scorecard",
    body: "Valuation · Growth · Quality · Momentum. One number you can act on. Updated every 6 hours.",
    href: "/stock/RELIANCE",
  },
  {
    icon: <Flame className="h-4 w-4" />,
    title: "Hot Stocks & Anomalies",
    body: "Volume spikes, 52W breakouts, gap-ups, block deals — surfaced before X/Twitter sees them.",
    href: "/hot-stocks",
    proOnly: true,
  },
  {
    icon: <Search className="h-4 w-4" />,
    title: "Screener for retail",
    body: "Sliders for P/E, market cap, dividend yield, sector. Save filters. Export to CSV.",
    href: "/screener",
    proOnly: true,
  },
  {
    icon: <Bell className="h-4 w-4" />,
    title: "Unlimited price alerts",
    body: "Above or below any target, any stock. Emailed only during market hours. No spam.",
    href: "/alerts",
  },
  {
    icon: <Mail className="h-4 w-4" />,
    title: "Daily morning brief",
    body: "9 AM IST every weekday. What moved, why, what to watch. 3-minute read. Free for everyone.",
  },
  {
    icon: <BarChart3 className="h-4 w-4" />,
    title: "Sector heatmap & spotlights",
    body: "See where money is rotating before consensus catches on. Top movers per sector, live.",
    href: "/dashboard",
  },
  {
    icon: <LineChart className="h-4 w-4" />,
    title: "Live watchlist with sparklines",
    body: "Day range, 52W range, day chart in a glance. Add up to 3 free, unlimited on Pro.",
    href: "/watchlist",
  },
];

/** Compact feature card. `locked=true` adds a lock overlay + greyed look. */
export function ProFeatureCard({
  feature,
  locked,
}: {
  feature: ProFeature;
  locked: boolean;
}) {
  const inner = (
    <div
      className={`surface relative h-full p-4 transition ${
        locked ? "opacity-90" : "hover-lift"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 text-brand">
          {feature.icon}
        </div>
        {feature.proOnly && locked && (
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning">
            Pro
          </span>
        )}
        {feature.proOnly && !locked && (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
            Unlocked
          </span>
        )}
      </div>
      <div className="mt-3 text-sm font-semibold">{feature.title}</div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{feature.body}</p>
      {locked && feature.proOnly && (
        <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-warning">
          <Sparkles className="h-3 w-3" /> Upgrade to unlock
        </div>
      )}
    </div>
  );
  if (locked || !feature.href) return inner;
  return (
    <Link href={feature.href} className="block h-full">
      {inner}
    </Link>
  );
}

/** Grid of all Pro features; locked vs unlocked styling driven by `isPro`. */
export function ProFeatureGrid({ isPro }: { isPro: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {PRO_FEATURES.map((f) => (
        <ProFeatureCard key={f.title} feature={f} locked={!isPro && !!f.proOnly} />
      ))}
    </div>
  );
}

/** Small banner row that converts: "You're missing X — upgrade to unlock." */
export function MissingOutBanner({ count }: { count: number }) {
  return (
    <div className="aurora flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/15 text-warning">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">
            You&apos;re missing {count} Pro feature{count === 1 ? "" : "s"}.
          </div>
          <div className="text-[11px] text-muted">
            AI brief, scorecard, screener, anomalies, hot stocks, unlimited tracking.
          </div>
        </div>
      </div>
      <Link href="#pricing" className="btn-brand whitespace-nowrap px-4 py-2 text-xs">
        Unlock everything →
      </Link>
    </div>
  );
}
