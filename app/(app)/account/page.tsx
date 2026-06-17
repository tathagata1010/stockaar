import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Sparkles, ShieldCheck, Bell, ListChecks, Mail, ExternalLink, Crown, Zap,
  TrendingUp, Quote, Star, Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/constants";
import { isRazorpayConfigured } from "@/lib/razorpay";
import { CancelButton } from "@/components/CancelButton";
import { PricingSection } from "@/components/PricingSection";
import { UsageMeter } from "@/components/UsageMeter";
import { ProFeatureGrid, PRO_FEATURES, MissingOutBanner } from "@/components/ProFeatureGrid";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";

// TEMP: app is free-for-all while Pro launch is pending. Set to false to bring back upgrade CTAs.
const PRO_PAUSED = true;

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: profile }, watchlistRes, alertsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    supabase.from("watchlist_items").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("alerts").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active"),
  ]);

  const plan = (profile?.plan ?? "free") as PlanId;
  const planMeta = PLANS[plan];
  const isPro = plan !== "free";
  const status = profile?.subscription_status as string | null;
  const periodEnd = profile?.current_period_end ? new Date(profile.current_period_end) : null;
  const memberSince = profile?.created_at ? new Date(profile.created_at) : null;
  const rzpReady = isRazorpayConfigured();

  const watchlistCount = watchlistRes.count ?? 0;
  const alertCount = alertsRes.count ?? 0;
  const lockedFeatureCount = PRO_FEATURES.filter((f) => f.proOnly).length;

  return (
    <AppShell>
      <div className="max-w-6xl space-y-10">
      <AccountHeader
        email={user.email ?? ""}
        plan={plan}
        memberSince={memberSince}
      />

      {!isPro && !PRO_PAUSED && <MissingOutBanner count={lockedFeatureCount} />}

      <UsageSection
        plan={plan}
        watchlistCount={watchlistCount}
        alertCount={alertCount}
      />

      {isPro && (
        <SubscriptionSection
          plan={plan}
          status={status}
          periodEnd={periodEnd}
        />
      )}

      <section>
        <SectionTitle
          eyebrow={isPro || PRO_PAUSED ? "Your toolkit" : "What you'd unlock"}
          title={isPro || PRO_PAUSED ? "Everything you have access to." : "These eight features change how you read the market."}
          sub={isPro || PRO_PAUSED
            ? "Click into any one \u2014 they're all live for you while we're in free-for-all mode."
            : "Free gives you the basics. Pro gives you the edge that retail usually pays a CA for."}
        />
        <div className="mt-6">
          <ProFeatureGrid isPro={isPro || PRO_PAUSED} />
        </div>
      </section>

      {!isPro && !PRO_PAUSED && <UpgradeSocialProof />}

      {!isPro && !PRO_PAUSED && (
        <PricingSection
          mode="checkout"
          email={user.email ?? undefined}
          rzpReady={rzpReady}
          headline="Cheaper than a coffee."
          sub="Pay once a month, never miss a market move again. Cancel anytime."
          showFree={false}
          className="!py-10"
        />
      )}

      {!isPro && !PRO_PAUSED && <UpgradeFAQ />}

      <QuickLinksSection isPro={isPro || PRO_PAUSED} />

      <LegalFooter />
      </div>
    </AppShell>
  );
}

/* -------------------- Header -------------------- */

function AccountHeader({
  email, plan, memberSince,
}: {
  email: string;
  plan: PlanId;
  memberSince: Date | null;
}) {
  const isPro = plan !== "free";
  return (
    <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-4 shadow-glow sm:p-6 md:p-8 lg:p-10">
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className={cn("chip mb-3", isPro ? "chip-brand" : PRO_PAUSED ? "chip-accent" : "chip-warning")}>
            {isPro ? <Crown className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
            {isPro ? `${PLANS[plan].name} member` : PRO_PAUSED ? "Free-for-all \u00b7 all features unlocked" : "Free plan \u00b7 8 features locked"}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
            {isPro ? (
              <>Welcome back, <span className="text-gradient-animate">Pro</span>.</>
            ) : (
              <>Your <span className="text-gradient-animate">account</span></>
            )}
          </h1>
          <p className="mt-2 text-sm text-muted">{email}</p>
          {memberSince && (
            <p className="mt-1 text-[11px] text-muted">
              Member since {memberSince.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
            </p>
          )}
        </div>
        {!isPro && !PRO_PAUSED && (
          <Link
            href="#pricing"
            className="btn-brand inline-flex items-center gap-2 px-5 py-3 text-sm"
          >
            <Sparkles className="h-4 w-4" />
            Upgrade to Pro — ₹299/mo
          </Link>
        )}
        {(isPro || PRO_PAUSED) && (
          <Link
            href="/dashboard"
            className="btn-brand inline-flex items-center gap-2 px-5 py-3 text-sm"
          >
            Open dashboard →
          </Link>
        )}
      </div>
    </section>
  );
}

/* -------------------- Usage -------------------- */

function UsageSection({
  plan, watchlistCount, alertCount,
}: { plan: PlanId; watchlistCount: number; alertCount: number }) {
  const limits = PLANS[plan];
  return (
    <section>
      <SectionTitle
        eyebrow="Usage this period"
        title="How much you're using."
        sub="All users get 15 stocks and 15 active alerts while we're in free-for-all mode."
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <UsageMeter
          label="Watchlist"
          used={watchlistCount}
          limit={limits.maxWatchlistItems}
          icon={<ListChecks className="h-3.5 w-3.5 text-brand" />}
        />
        <UsageMeter
          label="Active alerts"
          used={alertCount}
          limit={limits.maxAlerts}
          icon={<Bell className="h-3.5 w-3.5 text-brand" />}
        />
      </div>
      {plan === "free" && !PRO_PAUSED && (watchlistCount >= 3 || alertCount >= 3) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <Lock className="h-4 w-4 text-danger" />
            <div className="text-sm">
              <span className="font-semibold">You&apos;ve hit your free limit.</span>{" "}
              <span className="text-muted">Add more by going Pro — instant unlock.</span>
            </div>
          </div>
          <Link href="#pricing" className="btn-brand whitespace-nowrap px-4 py-2 text-xs">
            Go Pro →
          </Link>
        </div>
      )}
    </section>
  );
}

/* -------------------- Subscription details (Pro only) -------------------- */

function SubscriptionSection({
  plan, status, periodEnd,
}: { plan: PlanId; status: string | null; periodEnd: Date | null }) {
  const cancelled = status === "cancelled";
  return (
    <section>
      <SectionTitle
        eyebrow="Subscription"
        title="Billing & plan details."
      />
      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">{PLANS[plan].name}</div>
              <div className="text-[11px] text-muted">Managed by Razorpay</div>
            </div>
          </div>
          <span
            className={cn(
              "chip",
              cancelled ? "chip-warning" : "chip-accent",
            )}
          >
            {cancelled ? "Cancelling at period end" : (status ?? "Active")}
          </span>
        </div>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
          <Stat label="Plan" value={PLANS[plan].name} />
          <Stat label="Status" value={status ?? "active"} />
          <Stat
            label={cancelled ? "Access ends" : "Renews on"}
            value={periodEnd ? periodEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
          />
        </dl>
        {!cancelled && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <p className="max-w-md text-xs text-muted">
              Cancel anytime — you keep Pro until the end of the current period. No refunds for partial periods.
            </p>
            <CancelButton />
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-2/40 p-3">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 font-semibold capitalize">{value}</dd>
    </div>
  );
}

/* -------------------- Social proof (free upsell) -------------------- */

const TESTIMONIALS = [
  { name: "Aditya R.", role: "Software engineer · Bangalore", quote: "Cancelled my Moneycontrol Pro. The AI brief alone is worth ₹299." },
  { name: "Priya M.", role: "Doctor · Mumbai", quote: "I don't watch CNBC anymore. Alerts + morning email = I'm sorted." },
  { name: "Rohan K.", role: "CA · Pune", quote: "Scorecard told me TCS was stretched 3 weeks before the correction." },
];

function UpgradeSocialProof() {
  return (
    <section className="rounded-3xl border border-border bg-bg-2/40 p-8 md:p-12">
      <div className="mx-auto max-w-2xl text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand">
          <TrendingUp className="h-3 w-3" />
          Why retail investors switch
        </div>
        <h2 className="mt-4 text-3xl font-bold md:text-4xl">
          The edge most retail never gets.
        </h2>
        <p className="mt-3 text-sm text-muted">
          Pro pays for itself the first time you avoid one bad trade.
        </p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure key={t.name} className="surface p-5">
            <Quote className="h-4 w-4 text-brand/40" />
            <blockquote className="mt-2 text-sm leading-relaxed text-fg">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-brand-fg">
                {t.name.charAt(0)}
              </div>
              <div>
                <div className="text-xs font-semibold">{t.name}</div>
                <div className="text-[10px] text-muted">{t.role}</div>
              </div>
              <div className="ml-auto flex gap-0.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-3 w-3 fill-brand text-brand" />
                ))}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* -------------------- Upgrade FAQ (free upsell) -------------------- */

const UPGRADE_FAQS = [
  { q: "What happens to my watchlist when I upgrade?", a: "Nothing. Your existing 3 stocks stay. You just gain the ability to add unlimited more, plus get AI Brief, Scorecard, Screener on every single one." },
  { q: "Can I downgrade later?", a: "Yes — cancel any time and you'll automatically move to Free at the end of the current cycle. Your data is preserved (you'll just be capped at 3 again)." },
  { q: "Is there a refund?", a: "We don't pro-rate refunds for partial periods, but you'll keep Pro until the period ends. See our Refund Policy." },
  { q: "What payment methods?", a: "Razorpay handles checkout — UPI, all major Indian debit/credit cards, net banking, and wallets. GST invoices issued on request." },
];

function UpgradeFAQ() {
  return (
    <section>
      <SectionTitle eyebrow="Common questions" title="Still thinking about it?" />
      <div className="mt-6 space-y-2">
        {UPGRADE_FAQS.map((f) => (
          <details key={f.q} className="surface group p-4 open:shadow-pop">
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold marker:hidden">
              {f.q}
              <span className="text-muted transition-transform group-open:rotate-90">›</span>
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* -------------------- Quick links -------------------- */

function QuickLinksSection({ isPro }: { isPro: boolean }) {
  const links = [
    { href: "/watchlist", label: "Watchlist", desc: "Track your stocks" },
    { href: "/alerts", label: "Alerts", desc: "Manage price targets" },
    { href: "/dashboard", label: "Dashboard", desc: "Indices · movers · heatmap" },
    isPro
      ? { href: "/screener", label: "Screener", desc: "Filter the universe" }
      : { href: "#pricing", label: "Unlock Pro", desc: "8 features waiting" },
  ];
  return (
    <section>
      <SectionTitle eyebrow="Quick links" title="Jump in." />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="surface group flex items-center justify-between p-4 hover-lift"
          >
            <div>
              <div className="text-sm font-semibold">{l.label}</div>
              <div className="text-[11px] text-muted">{l.desc}</div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted transition group-hover:text-brand" />
          </Link>
        ))}
      </div>
    </section>
  );
}

/* -------------------- Misc -------------------- */

function SectionTitle({
  eyebrow, title, sub,
}: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div>
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
        {eyebrow}
      </span>
      <h2 className="mt-1 text-2xl font-bold md:text-3xl">{title}</h2>
      {sub && <p className="mt-1.5 max-w-2xl text-sm text-muted">{sub}</p>}
    </div>
  );
}

function LegalFooter() {
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-6 text-xs text-muted">
      <div className="flex flex-wrap items-center gap-2">
        <Mail className="h-3.5 w-3.5" />
        <span>Need help? Email </span>
        <Link href="mailto:stockaarin@gmail.com" className="text-brand underline">stockaarin@gmail.com</Link>
      </div>
      <p className="mt-3 leading-relaxed">
        Payments processed by Razorpay. By subscribing you agree to our{" "}
        <Link href="/terms" className="underline">Terms</Link>,{" "}
        <Link href="/refund" className="underline">Refund Policy</Link>, and{" "}
        <Link href="/privacy" className="underline">Privacy Policy</Link>.
        For informational purposes only — not investment advice.
      </p>
    </section>
  );
}
