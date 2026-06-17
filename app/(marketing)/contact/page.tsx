import { Mail, Twitter, Linkedin, Clock, MessageCircle } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export const revalidate = 86400;

export default function ContactPage() {
  return (
    <main className="space-y-8">
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-6 shadow-glow md:p-10">
        <div className="chip chip-brand mb-3">
          <MessageCircle className="h-3 w-3" />
          Contact
        </div>
        <h1 className="num-display text-4xl font-bold tracking-tight md:text-5xl">
          Talk to <span className="text-gradient-animate">a human</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted md:text-base">
          Question, bug, feature request, partnership — every message reaches
          the founder directly. {APP_NAME} is a one-person team and proud of
          it.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <ContactCard
          icon={<Mail className="h-5 w-5" />}
          label="Email"
          value="stockaarin@gmail.com"
          href="mailto:stockaarin@gmail.com"
        />
        <ContactCard
          icon={<Twitter className="h-5 w-5" />}
          label="Twitter / X"
          value="@stockaar"
          href="https://twitter.com/stockaar"
        />
        <ContactCard
          icon={<Linkedin className="h-5 w-5" />}
          label="Founder DM"
          value="LinkedIn"
          href="https://linkedin.com/in/stockaar"
        />
      </section>

      <section className="surface-strong p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-gradient text-brand-fg shadow-pop">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="num-display text-lg font-bold">Response time</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              We typically reply within{" "}
              <span className="font-medium text-fg">24–48 hours</span> during
              IST business hours (Mon–Fri, 10:00–18:00). Billing and account
              issues are prioritised and usually answered the same day.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function ContactCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="surface p-6 transition-all hover:border-brand/40 hover:shadow-glow"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-brand-fg shadow-pop">
        {icon}
      </div>
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 text-base font-medium text-brand">{value}</div>
    </a>
  );
}
