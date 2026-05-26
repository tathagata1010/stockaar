import { FileText } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export const revalidate = 86400;

export default function TermsPage() {
  return (
    <main className="space-y-8">
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-6 shadow-glow md:p-10">
        <div className="chip chip-brand mb-3">
          <FileText className="h-3 w-3" />
          Legal
        </div>
        <h1 className="num-display text-4xl font-bold tracking-tight md:text-5xl">
          Terms of <span className="text-gradient-animate">Service</span>
        </h1>
        <p className="mt-3 text-sm text-muted">
          Last updated: 23 May 2026
        </p>
      </section>

      <article className="surface p-8 space-y-6 text-sm leading-relaxed text-fg/90 [&_h2]:num-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-fg [&_h2]:mt-2">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and
          use of {APP_NAME} (&quot;Service&quot;), a stock-market analytics
          platform operated from Bengaluru, India. By creating an account or
          using the Service you agree to these Terms.
        </p>

        <section>
          <h2>1. Acceptance</h2>
          <p>
            By accessing or using {APP_NAME} you confirm that you have read,
            understood and agree to be bound by these Terms and our Privacy
            Policy. If you do not agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2>2. Eligibility</h2>
          <p>
            You must be at least 18 years old and competent to contract under
            the Indian Contract Act, 1872. The Service is intended for
            residents of India trading on NSE/BSE. You are responsible for
            ensuring compliance with any local laws that apply to you.
          </p>
        </section>

        <section>
          <h2>3. Account</h2>
          <p>
            You agree to provide accurate information, maintain the security of
            your credentials and notify us immediately of any unauthorised use.
            You are responsible for all activity under your account.
          </p>
        </section>

        <section>
          <h2>4. Subscription & Billing</h2>
          <p>
            Paid plans are billed in advance through Razorpay on a monthly
            (₹299) or annual (₹2,999) basis. Subscriptions renew automatically
            until cancelled. All prices are inclusive of applicable taxes
            unless stated otherwise. Failed payments may result in immediate
            downgrade to the Free plan. Refunds, where applicable, are
            governed by our Refund Policy.
          </p>
        </section>

        <section>
          <h2>5. Acceptable Use</h2>
          <p>
            You may not scrape, resell, redistribute, reverse-engineer or
            otherwise abuse the Service or its data. You may not use the
            Service to violate any law, infringe any third-party right,
            transmit malware, or interfere with other users.
          </p>
        </section>

        <section>
          <h2>6. Intellectual Property</h2>
          <p>
            All software, content, designs and trademarks on {APP_NAME} are
            owned by us or our licensors and are protected by Indian and
            international IP laws. You receive a limited, non-exclusive,
            non-transferable licence to use the Service for personal,
            non-commercial purposes during your subscription.
          </p>
        </section>

        <section>
          <h2>7. Disclaimers</h2>
          <p>
            The Service provides market data and analytics{" "}
            <strong>for informational purposes only</strong>. It is{" "}
            <strong>not investment advice</strong>, a recommendation, or a
            solicitation to buy or sell any security. Data may be delayed,
            inaccurate or incomplete. Past performance does not guarantee
            future results. You are solely responsible for your investment
            decisions and should consult a SEBI-registered advisor.
          </p>
        </section>

        <section>
          <h2>8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, {APP_NAME}, its founder,
            employees and contractors will not be liable for any indirect,
            incidental, consequential or punitive damages, or any loss of
            profits, trading losses, data or goodwill arising out of your use
            of the Service. Our total aggregate liability shall not exceed
            the amount you paid in the preceding three (3) months.
          </p>
        </section>

        <section>
          <h2>9. Termination</h2>
          <p>
            You may cancel your subscription anytime from your account page.
            We may suspend or terminate access for breach of these Terms,
            non-payment, or any conduct that we believe harms other users or
            the Service. Sections that by their nature should survive
            termination will do so.
          </p>
        </section>

        <section>
          <h2>10. Governing Law & Jurisdiction</h2>
          <p>
            These Terms are governed by the laws of India. Any dispute shall
            be subject to the exclusive jurisdiction of the courts at
            Bengaluru, Karnataka.
          </p>
        </section>

        <section>
          <h2>11. Changes</h2>
          <p>
            We may update these Terms from time to time. Material changes will
            be notified by email or an in-app banner at least 7 days before
            taking effect. Continued use of the Service after the effective
            date constitutes acceptance of the revised Terms.
          </p>
        </section>

        <p className="text-xs text-muted">
          Questions about these Terms? Email{" "}
          <a className="text-brand" href="mailto:hello@stockaar.in">
            hello@stockaar.in
          </a>
          .
        </p>
      </article>
    </main>
  );
}
