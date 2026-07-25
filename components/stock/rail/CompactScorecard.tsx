import { getQuote } from "@/lib/upstox";
import { getFundamentals } from "@/lib/fundamentals";
import { buildScorecard, deriveSignal, SIGNAL_LABEL } from "@/lib/scorecard";
import { cn } from "@/lib/utils";
import { Award } from "lucide-react";

export async function CompactScorecard({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const [fundamentals, quote] = await Promise.all([
    getFundamentals(symbol, exchange),
    getQuote(symbol, exchange),
  ]);
  if (!fundamentals) return null;
  const sc = buildScorecard(fundamentals, quote);
  const { signal } = deriveSignal(sc);
  const pillars = [
    { key: "V", label: "Value", score: sc.pillars.valuation.score },
    { key: "G", label: "Growth", score: sc.pillars.growth.score },
    { key: "Q", label: "Quality", score: sc.pillars.quality.score },
    { key: "M", label: "Momentum", score: sc.pillars.momentum.score },
  ];
  const tone =
    signal === "POSITIVE" ? "text-accent bg-accent/15"
      : signal === "CAUTION" ? "text-danger bg-danger/15"
      : "text-warning bg-warning/15";

  return (
    <a
      href="#scorecard"
      className="block rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:border-brand/40"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand/15 text-brand">
          <Award className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Scorecard
          </div>
          <div className="text-[10px] text-muted">4-pillar composite</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold tabular-nums leading-none">{sc.composite}</div>
          <div className={cn("mt-1 inline-block rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", tone)}>
            {SIGNAL_LABEL[signal]}
          </div>
        </div>
      </div>
      <ul className="space-y-1.5">
        {pillars.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span className="w-14 text-[10px] text-muted">{p.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-2">
              <div
                className={cn(
                  "h-full rounded-full",
                  p.score >= 65 ? "bg-accent" : p.score >= 40 ? "bg-warning" : "bg-danger",
                )}
                style={{ width: `${Math.max(4, Math.min(100, p.score))}%` }}
              />
            </div>
            <span className="w-6 text-right text-[10px] tabular-nums text-fg/80">{p.score}</span>
          </li>
        ))}
      </ul>
    </a>
  );
}
