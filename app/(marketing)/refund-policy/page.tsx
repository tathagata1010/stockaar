import { RefreshCcw } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export const revalidate = 86400;

export default function RefundPolicyPage() {
  return (
    <main className="space-y-8">
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-6 shadow-glow md:p-10">
        <div className="chip chip-brand mb-3">
          <RefreshCcw className="h-3 w-3" />
          Billing
        </div>
        <h1 className="num-display text-4xl font-bold tracking-tight md:text-5xl">
          Refund &amp; <span className="text-gradient-animate">Cancellation</span>
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated: 23 May 2026</p>
      </section>

      <article className="surface p-8 space-y-6 text-sm leading-relaxed text-fg/90 [&_h2]:num-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-fg [&_h2]:mt-2">
        <p>
          We want every {APP_NAME} subscriber to be happy. This policy explains
          how cancellations, refunds and disputes work.
        </p>

        <section>
          <h2>1. Subscription model</h2>
          <p>
            {APP_NAME} Pro is a recurring subscription billed via Razorpay,
            either monthly (₹299) or annually (₹2,999). Each renewal grants
            access to the Pro feature set until the end of the billing period.
          </p>
        </section>

        <section>
          <h2>2. Cancellation</h2>
          <p>
            You can cancel anytime from <strong>Account → Subscription</strong>.
            Cancellation stops future renewals immediately. You retain Pro
            access until the end of the current billing period — there is no
            pro-rata refund for unused days within a paid period.
          </p>
        </section>

        <section>
          <h2>3. Refund eligibility</h2>
          <p>
            You may request a full refund within{" "}
            <strong>7 days of your first charge</strong> if the product is
            substantially unused (no alerts created, no Pro reports
            downloaded). We also issue refunds for verified billing errors
            (duplicate charges, accidental renewals reported within 7 days,
            inability to access Pro features due to a confirmed defect on our
            end). Refunds are not available for partial months, change of
            mind after the 7-day window, or accounts terminated for breach of
            our Terms.
          </p>
        </section>

        <section>
          <h2>4. How to request a refund</h2>
          <p>
            Email{" "}
            <a className="text-brand" href="mailto:billing@stockaar.in">
              billing@stockaar.in
            </a>{" "}
            from the address on your account. Please include the Razorpay
            payment ID (visible in your email receipt) and a short reason.
            We&apos;ll respond within 2 business days.
          </p>
        </section>

        <section>
          <h2>5. Processing time</h2>
          <p>
            Approved refunds are processed via Razorpay back to the original
            payment method within <strong>5–7 business days</strong>. Your
            bank or UPI provider may take additional time to reflect the
            credit. Subscription access is revoked at the time the refund is
            initiated.
          </p>
        </section>

        <section>
          <h2>6. Disputes via Razorpay</h2>
          <p>
            If you believe a charge is incorrect, please contact us first — we
            resolve most issues within 48 hours. You may also raise a dispute
            directly with Razorpay or your card issuer. We cooperate fully
            with Razorpay&apos;s dispute resolution process and will provide
            transaction logs as needed.
          </p>
        </section>

        <p className="text-xs text-muted">
          Billing questions:{" "}
          <a className="text-brand" href="mailto:billing@stockaar.in">
            billing@stockaar.in
          </a>
          .
        </p>
      </article>
    </main>
  );
}
