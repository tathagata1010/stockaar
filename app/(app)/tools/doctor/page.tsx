import { PortfolioDoctor } from "@/components/doctor/PortfolioDoctor";
import { Disclaimer } from "@/components/Disclaimer";
import { Stethoscope, Sparkles } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portfolio Doctor — AI second opinion on your holdings",
  description:
    "Drop a screenshot from Zerodha, Groww, Upstox or Angel One — get a brutally honest, AI-powered diagnosis of your portfolio's risks and concentration in 12 seconds.",
  alternates: { canonical: "/tools/doctor" },
};

export default function DoctorPage() {
  return (
    <AppShell>
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-4 shadow-glow sm:p-6 md:p-8 lg:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="chip chip-brand mb-3">
              <Sparkles className="h-3 w-3" />
              New · Star feature
            </div>
            <h1 className="num-display text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
              Portfolio <span className="text-gradient-animate">Doctor</span>
            </h1>
            <p className="mt-3 max-w-2xl text-xs text-muted sm:text-sm md:text-base">
              Drop a screenshot from your broker app — Zerodha, Groww, Upstox, Angel One — and get an
              honest, AI-powered second opinion on your holdings in seconds. Concentration risks, sector
              tilt, diversification gaps, all in plain English.
            </p>
          </div>
          <div className="hidden h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/30 sm:flex">
            <Stethoscope className="h-8 w-8" />
          </div>
        </div>
      </section>

      <PortfolioDoctor />

      <Disclaimer className="mt-10" />
    </AppShell>
  );
}
