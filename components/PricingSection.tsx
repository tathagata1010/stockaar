import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import { PLANS } from "@/lib/constants";
import { CheckoutButton } from "@/components/CheckoutButton";

export type PricingMode = "signup" | "checkout";

type PriceCardProps = {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  href?: string;
  planId?: "pro_monthly" | "pro_annual";
  highlight?: boolean;
  tag?: string;
  save?: string;
  strikethrough?: string;
  trial?: string;
  mode: PricingMode;
  email?: string;
  rzpReady?: boolean;
};

function PriceCard({
  name, price, period, features, cta, href, planId, highlight, tag, save,
  strikethrough, trial, mode, email, rzpReady,
}: PriceCardProps) {
  const showCheckout = mode === "checkout" && planId;
  return (
    <div
      className={`relative rounded-2xl border p-6 ${
        highlight ? "border-brand bg-bg-2 shadow-pop md:scale-105" : "border-border bg-card"
      }`}
    >
      {tag && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-fg px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-bg">
          {tag}
        </div>
      )}
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">{name}</h3>
        {save && (
          <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
            {save}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="num-display text-4xl font-bold">{price}</span>
        <span className="text-sm text-muted">{period}</span>
        {strikethrough && (
          <span className="text-sm text-muted line-through">{strikethrough}</span>
        )}
      </div>
      <ul className="mt-6 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {trial && (
        <div className="mt-5 rounded-lg bg-accent/10 px-3 py-2 text-center text-[11px] font-semibold text-accent">
          🎁 {trial}
        </div>
      )}
      <div className="mt-5">
        {showCheckout && rzpReady ? (
          <CheckoutButton plan={planId} email={email} label={cta} className="w-full" />
        ) : showCheckout && !rzpReady ? (
          <button
            disabled
            className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-muted"
          >
            Checkout coming soon
          </button>
        ) : (
          <Link
            href={href ?? "/auth/signup"}
            className={`block rounded-lg px-4 py-3 text-center text-sm font-semibold transition ${
              highlight ? "btn-brand" : "border border-border bg-card hover:border-brand"
            }`}
          >
            {cta} →
          </Link>
        )}
      </div>
      <p className="mt-2 text-center text-[10px] text-muted">
        Cancel anytime · No questions asked
      </p>
    </div>
  );
}

export function PricingSection({
  mode = "signup",
  email,
  rzpReady,
  headline = "Cheaper than a coffee.",
  sub = "One subscription. Everything unlocked. Cancel anytime.",
  showFree = true,
  className = "",
}: {
  mode?: PricingMode;
  email?: string;
  rzpReady?: boolean;
  headline?: string;
  sub?: string;
  showFree?: boolean;
  className?: string;
}) {
  // TEMP: paid checkout is disabled while we run the app in free-for-all mode.
  // Re-enable by removing this line and passing the real rzpReady value through.
  void rzpReady;
  void mode;
  const rzpReadyForRender = false;
  const effectiveMode: PricingMode = "signup";
  return (
    <section id="pricing" className={`mx-auto max-w-6xl px-6 py-20 ${className}`}>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold md:text-4xl">{headline}</h2>
        <p className="mt-3 text-sm text-muted">{sub}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand">
          <Sparkles className="h-3 w-3" /> Launch week pricing
        </span>
      </div>
      <div
        className={`mx-auto mt-10 grid gap-5 ${
          showFree ? "max-w-4xl md:grid-cols-3" : "max-w-3xl md:grid-cols-2"
        }`}
      >
        {showFree && (
          <PriceCard
            mode={effectiveMode}
            name="Free"
            price="₹0"
            period="forever"
            features={["Track up to 15 stocks", "15 active price alerts", "Market dashboard", "Email alerts"]}
            cta="Start free"
            href="/auth/signup"
          />
        )}
        <PriceCard
          mode={effectiveMode}
          email={email}
          rzpReady={rzpReadyForRender}
          planId="pro_monthly"
          highlight
          tag="Coming soon"
          name="Pro Monthly"
          price={`₹${PLANS.pro_monthly.priceMonthly}`}
          period="/ month"
          strikethrough="₹499"
          features={[
            "Unlimited watchlist & alerts",
            "AI Brief on every stock",
            "Scorecard (4-pillar model)",
            "Screener · Anomalies · Hot Stocks",
            "Daily morning newsletter",
            "Priority email delivery",
          ]}
          cta="Free for everyone right now"
          href="/auth/signup"
        />
        <PriceCard
          mode={effectiveMode}
          email={email}
          rzpReady={rzpReadyForRender}
          planId="pro_annual"
          name="Pro Annual"
          price="₹2,999"
          period="/ year"
          save="Save 17%"
          features={[
            "Everything in Pro Monthly",
            "2 months free",
            "Locked-in pricing forever",
            "GST invoice included",
          ]}
          cta="Free for everyone right now"
          href="/auth/signup"
        />
      </div>
      <p className="mt-6 text-center text-[11px] text-muted">
        Razorpay secure checkout · UPI, cards, net banking · GST invoice on request
      </p>
    </section>
  );
}
