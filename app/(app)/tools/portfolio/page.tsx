import { PortfolioAnalyzer } from "@/components/PortfolioAnalyzer";
import { NSE_SYMBOLS } from "@/lib/nse-symbols";
import { Disclaimer } from "@/components/Disclaimer";
import { Briefcase } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";

export const revalidate = 3600;

export default function PortfolioPage() {
  const sectorBySymbol: Record<string, string> = {};
  for (const s of NSE_SYMBOLS) sectorBySymbol[s.symbol] = s.sector;

  return (
    <AppShell>
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-4 shadow-glow sm:p-6 md:p-8 lg:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="chip chip-brand mb-3">
              <Briefcase className="h-3 w-3" />
              Tools
            </div>
            <h1 className="num-display text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
              Portfolio <span className="text-gradient-animate">Analyzer</span>
            </h1>
            <p className="mt-3 text-xs text-muted sm:text-sm md:text-base">
              Paste your holdings to see live P/L, sector concentration, and risk warnings — nothing leaves your browser except live price lookups.
            </p>
          </div>
        </div>
      </section>

      <PortfolioAnalyzer sectorBySymbol={sectorBySymbol} />

      <Disclaimer className="mt-10" />
    </AppShell>
  );
}
