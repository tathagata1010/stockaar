import { Lock } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export const revalidate = 86400;

export default function PrivacyPage() {
  return (
    <main className="space-y-8">
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-6 shadow-glow md:p-10">
        <div className="chip chip-brand mb-3">
          <Lock className="h-3 w-3" />
          Privacy
        </div>
        <h1 className="num-display text-4xl font-bold tracking-tight md:text-5xl">
          Privacy <span className="text-gradient-animate">Policy</span>
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated: 23 May 2026</p>
      </section>

      <article className="surface p-8 space-y-6 text-sm leading-relaxed text-fg/90 [&_h2]:num-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-fg [&_h2]:mt-2">
        <p>
          {APP_NAME} (&quot;we&quot;) respects your privacy. This policy
          describes what we collect, how we use it, and the rights you have
          under Indian law, including the Digital Personal Data Protection Act,
          2023 (&quot;DPDP Act&quot;).
        </p>

        <section>
          <h2>1. What we collect</h2>
          <p>
            <strong>Account data:</strong> name, email, hashed password, OAuth
            identifier when you sign in with Google.
            <br />
            <strong>Payment metadata:</strong> Razorpay subscription IDs,
            invoice numbers, plan, status. We never see or store your card
            number, CVV or UPI PIN — these stay with Razorpay.
            <br />
            <strong>Product data:</strong> stocks you watch, alerts you create,
            preferences.
            <br />
            <strong>Usage analytics:</strong> page views, feature usage, device
            type, approximate location (city) and crash diagnostics.
          </p>
        </section>

        <section>
          <h2>2. How we use it</h2>
          <p>
            To operate the Service, deliver alerts and newsletters, process
            payments, prevent fraud and abuse, comply with legal obligations
            and improve the product. We do not sell your personal data.
          </p>
        </section>

        <section>
          <h2>3. Cookies</h2>
          <p>
            We use first-party cookies for authentication and preferences, and
            privacy-respecting analytics cookies to understand product usage.
            You can disable non-essential cookies via your browser; some
            features may not function correctly.
          </p>
        </section>

        <section>
          <h2>4. Third parties</h2>
          <p>
            We share the minimum data required with trusted processors:{" "}
            <strong>Supabase</strong> (database and authentication),{" "}
            <strong>Upstash</strong> (Redis cache), <strong>Razorpay</strong>{" "}
            (payments), <strong>Resend</strong> (email delivery),{" "}
            <strong>NVIDIA NIM</strong> and Anthropic (AI inference), and{" "}
            <strong>Yahoo Finance</strong> &amp; Upstox (market data). Each
            processor is contractually bound to confidentiality and security
            obligations.
          </p>
        </section>

        <section>
          <h2>5. Data retention</h2>
          <p>
            We keep account data while your account is active and for up to 36
            months thereafter for tax, accounting and dispute-resolution
            purposes. You can request earlier deletion (see Your rights).
          </p>
        </section>

        <section>
          <h2>6. Your rights</h2>
          <p>
            Under the DPDP Act you have the right to access, correct, update,
            and erase your personal data, withdraw consent, and nominate
            another individual to exercise these rights in case of your death
            or incapacity. Email{" "}
            <a className="text-brand" href="mailto:privacy@stockaar.in">
              privacy@stockaar.in
            </a>{" "}
            and we will respond within statutory timelines.
          </p>
        </section>

        <section>
          <h2>7. Children</h2>
          <p>
            The Service is not directed at anyone under 18. We do not
            knowingly collect data from minors. If you believe we have, please
            contact us and we will delete it.
          </p>
        </section>

        <section>
          <h2>8. Security</h2>
          <p>
            We use TLS in transit, encryption at rest, role-level access
            controls and audit logging. No system is perfectly secure — please
            use a strong, unique password and enable 2FA where available.
          </p>
        </section>

        <section>
          <h2>9. Contact</h2>
          <p>
            Privacy questions or requests:{" "}
            <a className="text-brand" href="mailto:privacy@stockaar.in">
              privacy@stockaar.in
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
