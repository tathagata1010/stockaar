import type { Fundamentals } from "@/lib/fundamentals";
import type { Quote } from "@/lib/upstox";
import { formatCompactINR, formatNumber, cn } from "@/lib/utils";
import { Target, IndianRupee, BarChart3, Percent } from "lucide-react";

export function HeroMetrics({
  fundamentals,
  quote,
}: {
  fundamentals: Fundamentals | null;
  quote: Quote | null;
}) {
  const mcap = Number.isFinite(fundamentals?.marketCap) ? fundamentals!.marketCap : null;
  const pe = Number.isFinite(fundamentals?.trailingPE) ? fundamentals!.trailingPE : null;
  const divYld = Number.isFinite(fundamentals?.dividendYield) ? fundamentals!.dividendYield : null;
  const target = Number.isFinite(fundamentals?.targetMeanPrice) ? fundamentals!.targetMeanPrice : null;
  const lastPrice = Number.isFinite(quote?.lastPrice) ? quote!.lastPrice : null;
  const targetUpside = target != null && lastPrice != null && lastPrice > 0
    ? ((target - lastPrice) / lastPrice) * 100
    : null;

  return (
    <div className="grid grid-cols-2 gap-2 text-[11px]">
      <Metric
        icon={<IndianRupee className="h-3 w-3" />}
        label="Mkt Cap"
        value={mcap != null ? formatCompactINR(mcap) : "—"}
      />
      <Metric
        icon={<BarChart3 className="h-3 w-3" />}
        label="P/E"
        value={pe != null ? formatNumber(pe, 1) : "—"}
      />
      <Metric
        icon={<Percent className="h-3 w-3" />}
        label="Div Yld"
        value={divYld != null ? `${(divYld * 100).toFixed(2)}%` : "—"}
      />
      <Metric
        icon={<Target className="h-3 w-3" />}
        label="Target"
        value={target != null ? formatCompactINR(target) : "—"}
        accent={targetUpside != null ? (targetUpside >= 0 ? "accent" : "danger") : undefined}
        sub={targetUpside != null ? `${targetUpside >= 0 ? "+" : ""}${targetUpside.toFixed(1)}%` : undefined}
      />
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: "accent" | "danger";
}) {
  return (
    <div className="rounded-lg bg-bg/40 px-2 py-1.5 ring-1 ring-border">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="font-semibold tabular-nums text-fg">{value}</span>
        {sub && (
          <span className={cn(
            "text-[10px] font-semibold tabular-nums",
            accent === "accent" && "text-accent",
            accent === "danger" && "text-danger",
            !accent && "text-muted",
          )}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}
