import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { NSE_SYMBOLS } from "@/lib/nse-symbols";
import {
  Sparkles,
  Target,
  User,
  IndianRupee,
  Database,
  Layers3,
  Cable,
  Timer,
  ArrowRight,
} from "lucide-react";

export const revalidate = 3600;

export default function AboutPage() {
  const symbolsCount = NSE_SYMBOLS.length;

  return (
    <main className="space-y-8">
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-6 shadow-glow md:p-10">
        <div className="chip chip-brand mb-3">
          <Sparkles className="h-3 w-3" />
          About us
        </div>
        <h1 className="num-display text-4xl font-bold tracking-tight md:text-5xl">
          About <span className="text-gradient-animate">{APP_NAME}</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted md:text-base">
          We&apos;re building India&apos;s most intuitive stock intelligence
          platform — live prices, AI briefs, scorecards and alerts for NSE &
          BSE, made for retail investors who want clarity over noise.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <div className="surface-strong p-6">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-brand-fg shadow-pop">
            <Target className="h-5 w-5" />
          </div>
          <h2 className="num-display text-lg font-bold">Mission</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Help every Indian investor make confident decisions with clean,
            fast, jargon-free analytics — without paying terminal-grade prices.
          </p>
        </div>

        <div className="surface-strong p-6">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-brand-fg shadow-pop">
            <User className="h-5 w-5" />
          </div>
          <h2 className="num-display text-lg font-bold">Who built it</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            A solo founder who got tired of fragmented broker dashboards and
            overpriced research portals. {APP_NAME} is built end-to-end in
            India, shipped weekly, and listens to its users.
          </p>
        </div>

        <div className="surface-strong p-6">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-brand-fg shadow-pop">
            <IndianRupee className="h-5 w-5" />
          </div>
          <h2 className="num-display text-lg font-bold">How we make money</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            A simple subscription — ₹299/mo or ₹2,999/yr. No ads, no broker
            kickbacks, no &quot;sponsored&quot; calls. Aligned with you, not
            with order flow.
          </p>
        </div>
      </section>

      <section>
        <h2 className="num-display mb-4 text-2xl font-bold">By the numbers</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            icon={<Database className="h-5 w-5" />}
            label="NSE symbols covered"
            value={`${symbolsCount}+`}
          />
          <StatCard
            icon={<Layers3 className="h-5 w-5" />}
            label="Sectors tracked"
            value="18"
          />
          <StatCard
            icon={<Cable className="h-5 w-5" />}
            label="Data sources"
            value="4"
          />
          <StatCard
            icon={<Timer className="h-5 w-5" />}
            label="Refresh interval"
            value="60s"
          />
        </div>
      </section>

      <section className="surface-strong relative overflow-hidden p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-brand-fg shadow-pop">
          <Sparkles className="h-5 w-5" />
        </div>
        <h2 className="num-display mt-4 text-2xl font-bold">
          Ready to upgrade your portfolio?
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          Start free in 30 seconds. Cancel anytime.
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

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="surface p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-card text-brand ring-1 ring-border-strong">
        {icon}
      </div>
      <div className="num-display text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}
