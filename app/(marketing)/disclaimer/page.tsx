import { AlertTriangle, ShieldAlert } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export const revalidate = 86400;

export default function DisclaimerPage() {
  return (
    <main className="space-y-8">
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-6 shadow-glow md:p-10">
        <div className="chip chip-warning mb-3">
          <ShieldAlert className="h-3 w-3" />
          Read carefully
        </div>
        <h1 className="num-display text-4xl font-bold tracking-tight md:text-5xl">
          Risk &amp; <span className="text-gradient-animate">Disclaimer</span>
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated: 23 May 2026</p>
      </section>

      <article className="surface p-8 space-y-6 text-sm leading-relaxed text-fg/90 [&_h2]:num-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-fg [&_h2]:mt-2">
        <div className="flex gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-4">
          <AlertTriangle className="h-5 w-5 flex-none text-danger" />
          <p className="text-sm leading-relaxed text-danger">
            <strong>{APP_NAME} is not a SEBI-registered Research Analyst,
            Investment Adviser or Stock Broker.</strong> All data, signals,
            scorecards, calls and AI briefs are provided strictly for
            informational and educational purposes. Nothing on this platform
            constitutes investment advice or a recommendation to buy, sell or
            hold any security.
          </p>
        </div>

        <section>
          <h2>Informational use only</h2>
          <p>
            Content on {APP_NAME} — including watchlists, scorecards, screener
            results, hot stocks, anomaly alerts, AI briefs and the daily
            newsletter — is generated algorithmically or aggregated from public
            sources. It is intended to help you research, not to tell you what
            to do with your money.
          </p>
        </section>

        <section>
          <h2>Regulatory status</h2>
          <p>
            We do not currently hold a SEBI Research Analyst (RA) or
            Investment Adviser (IA) registration. The platform operator is
            independently handling all applicable SEBI compliance matters. If
            you require personalised investment advice, please consult a
            SEBI-registered professional.
          </p>
        </section>

        <section>
          <h2>Data accuracy &amp; delays</h2>
          <p>
            Prices and fundamentals are sourced from third parties (Yahoo
            Finance and others). Quotes are delayed approximately 15 minutes.
            Corporate actions,
            splits and dividends may take additional time to reflect. We do
            not guarantee accuracy, completeness or timeliness of any data.
          </p>
        </section>

        <section>
          <h2>Past performance</h2>
          <p>
            Historical returns, back-tested signals and scorecard percentile
            ranks describe what <em>has</em> happened. They are not a promise
            of what <em>will</em> happen. Markets can and do behave unlike any
            prior period.
          </p>
        </section>

        <section>
          <h2>Market risk</h2>
          <p>
            Investments in equities, derivatives and mutual funds are subject
            to market risk, including the possible loss of principal. Read
            all scheme-related documents carefully before investing. Only
            invest what you can afford to lose.
          </p>
        </section>

        <section>
          <h2>Market hours &amp; alerts</h2>
          <p>
            NSE and BSE cash markets operate Monday–Friday, 09:15–15:30 IST,
            excluding exchange holidays. Price alerts fire only during these
            windows. Pre-open, post-close, and after-hours data may differ
            materially from regular session prices.
          </p>
        </section>

        <section>
          <h2>AI brief limitations</h2>
          <p>
            AI-generated briefs are produced by large language models. They
            can hallucinate, misinterpret context, or reflect stale
            information. Always cross-check against primary sources (company
            filings, exchange announcements) before acting.
          </p>
        </section>

        <section>
          <h2>Consult a SEBI-registered advisor</h2>
          <p>
            For any decision involving real capital, please consult a
            qualified, SEBI-registered investment adviser who can assess your
            personal financial situation, risk tolerance and goals.
          </p>
        </section>
      </article>
    </main>
  );
}
