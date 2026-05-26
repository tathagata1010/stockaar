import { StockLogo } from "@/components/StockLogo";
import { formatINR } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { Sector } from "@/lib/nse-symbols";

export type CarouselStock = {
  symbol: string;
  name: string;
  sector?: Sector;
  price: number | null;
  changePct: number | null;
};

/** Auto-scrolling, infinite stock carousel. Pure CSS marquee — no JS needed. */
export function StocksCarousel({
  stocks,
  title = "Tracked live across NSE",
  speed = "60s",
}: {
  stocks: CarouselStock[];
  title?: string;
  speed?: string;
}) {
  if (!stocks.length) return null;
  // Duplicate so the -50% translate seamlessly loops
  const loop = [...stocks, ...stocks];

  return (
    <section className="border-y border-border bg-bg-2/30 py-2">
      <div className="group relative overflow-hidden">
        {/* Edge fade masks */}
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16 bg-gradient-to-r from-bg to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-gradient-to-l from-bg to-transparent" />
        <div
          className="animate-ticker flex w-max items-center gap-2 px-3"
          style={{ animationDuration: speed }}
        >
          {loop.map((s, i) => {
            const up = (s.changePct ?? 0) >= 0;
            return (
              <a
                key={`${s.symbol}-${i}`}
                href={`/stock/${encodeURIComponent(s.symbol)}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[11px] hover:border-brand"
                aria-label={`${s.symbol} live price`}
                title={s.name}
              >
                <StockLogo symbol={s.symbol} name={s.name} sector={s.sector} size="xs" animated={false} />
                <span className="font-semibold">{s.symbol}</span>
                <span className="text-muted tabular-nums">
                  {s.price !== null ? formatINR(s.price) : "—"}
                </span>
                {s.changePct !== null && (
                  <span
                    className={`inline-flex items-center gap-0.5 tabular-nums ${
                      up ? "text-accent" : "text-danger"
                    }`}
                  >
                    {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                    {`${up ? "+" : ""}${s.changePct.toFixed(2)}%`}
                  </span>
                )}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
