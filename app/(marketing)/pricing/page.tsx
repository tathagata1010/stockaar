import Link from "next/link";
import { Check, Sparkles, Crown, ArrowRight, IndianRupee } from "lucide-react";
import { APP_NAME, PLANS } from "@/lib/constants";

export const revalidate = 3600;

const FREE_FEATURES = [
  "Track 3 stocks",
  "3 active price alerts",
  "Market dashboard (Nifty, Sensex, Bank Nifty)",
  "Top gainers & losers",
  "Email delivery",
];

const PRO_FEATURES = [
  "Unlimited stocks & alerts",
  "AI brief on every stock (Claude-powered)",
  "Scorecard (4-pillar fundamentals)",
  "Buy / Hold / Sell calls",
  "Screener with 15+ filters",
  "Hot Stocks & Market Anomalies",
  "RSI scanner",
  "Daily 3-min morning newsletter",
  "Priority email & support",
];

const FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your account page — you keep Pro until the end of your current billing period. No pro-rata refund.",
  },
  {
    q: "Which payment methods are supported?",
    a: `All Razorpay rails: UPI, cards (Visa / Mastercard / RuPay), netbanking and wallets. We never see your card number.`,
  },
  {
    q: "Is the data real-time?",
    a: "Live during market hours (9:15–15:30 IST) when our primary feed is healthy. Otherwise ~15-minute delayed fallback. Indicator is shown on every page.",
  },
  {
    q: "Do you offer refunds?",
    a: "Within 7 days of your first charge if the product is unused, and for billing errors. See the Refund Policy for details.",
  },
  {
    q: "Are you SEBI registered?",
    a: `${APP_NAME} provides analytics and data for informational purposes only. Nothing on the platform is investment advice. Consult a SEBI-registered advisor before transacting.`,
  },
  {
    q: "Will my price be locked in?",
    a: "Yes. Annual subscribers lock in ₹2,999/yr for as long as the subscription renews uninterrupted.",
  },
];

export default function PricingPage() {
  return (
    <main className="space-y-8">
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-6 shadow-glow md:p-10">
        <div className="chip chip-brand mb-3">
          <IndianRupee className="h-3 w-3" />
          Simple pricing
        </div>
        <h1 className="num-display text-4xl font-bold tracking-tight md:text-5xl">
          One plan. <span className="text-gradient-animate">Zero noise.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted md:text-base">
          Free forever for casual tracking. Upgrade to Pro for the full
          intelligence stack — at less than the price of one trade.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {/* Free card */}
        <div className="surface-strong relative p-6">
          <div className="chip mb-4">Free</div>
          <div className="num-display flex items-baseline gap-1 text-4xl font-bold tabular-nums">
            ₹{PLANS.free.priceMonthly}
            <span className="text-base font-normal text-muted">/mo</span>
          </div>
          <p className="mt-2 text-sm text-muted">
            For casual market watchers getting started.
          </p>
          <Link
            href="/auth/signup"
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-border-strong bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-brand/50"
          >
            Start free
          </Link>
          <ul className="mt-6 space-y-3">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 flex-none text-brand" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pro card */}
        <div className="surface-strong relative p-6 ring-1 ring-brand/40">
          <div className="chip chip-brand mb-4">
            <Crown className="h-3 w-3" />
            Most popular
          </div>
          <div className="num-display flex items-baseline gap-1 text-4xl font-bold tabular-nums">
            ₹{PLANS.pro_monthly.priceMonthly}
            <span className="text-base font-normal text-muted">/mo</span>
          </div>
          <p className="mt-2 text-sm text-muted">
            or{" "}
            <span className="font-medium text-fg tabular-nums">
              ₹{PLANS.pro_annual.priceAnnual?.toLocaleString("en-IN")}
            </span>
            /yr{" "}
            <span className="chip chip-accent ml-1 align-middle text-[10px]">
              save 17%
            </span>
          </p>
          <Link
            href="/auth/signup"
            className="btn-brand mt-5 inline-flex w-full items-center justify-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Upgrade to Pro
          </Link>
          <ul className="mt-6 space-y-3">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 flex-none text-brand" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="num-display mb-4 text-2xl font-bold">
          Frequently asked
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FAQ.map((item) => (
            <div key={item.q} className="surface p-5">
              <h3 className="text-sm font-semibold">{item.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-strong relative overflow-hidden p-8 text-center">
        <h2 className="num-display text-2xl font-bold">
          Try Pro free for the first 30 seconds
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          That&apos;s how long signup takes. Cancel anytime, no questions.
        </p>
        <Link
          href="/auth/signup"
          className="btn-brand mt-5 inline-flex items-center gap-2"
        >
          Get started <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
