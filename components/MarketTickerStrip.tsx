import { Suspense, cache } from "react";
import { Activity } from "lucide-react";
import { getQuotes } from "@/lib/upstox";
import { getAllIndices } from "@/lib/market";
import { MarketTickerStripClient, type TickerItem } from "./MarketTickerStripClient";

const HERO_SYMBOLS: { symbol: string; exchange: "NSE" | "BSE" }[] = [
  { symbol: "RELIANCE", exchange: "NSE" },
  { symbol: "TCS", exchange: "NSE" },
  { symbol: "HDFCBANK", exchange: "NSE" },
  { symbol: "INFY", exchange: "NSE" },
  { symbol: "ICICIBANK", exchange: "NSE" },
  { symbol: "BHARTIARTL", exchange: "NSE" },
  { symbol: "ITC", exchange: "NSE" },
  { symbol: "SBIN", exchange: "NSE" },
  { symbol: "LT", exchange: "NSE" },
  { symbol: "HINDUNILVR", exchange: "NSE" },
  { symbol: "BAJFINANCE", exchange: "NSE" },
  { symbol: "MARUTI", exchange: "NSE" },
  { symbol: "WIPRO", exchange: "NSE" },
  { symbol: "TATAMOTORS", exchange: "NSE" },
  { symbol: "ADANIENT", exchange: "NSE" },
];

const fetchInitialTicker = cache(async (): Promise<TickerItem[]> => {
  const [indices, quotes] = await Promise.all([
    getAllIndices().catch(() => []),
    getQuotes(HERO_SYMBOLS).catch(() => []),
  ]);
  const items: TickerItem[] = [];
  for (const i of indices) {
    items.push({ symbol: i.name, last: i.lastPrice, changePct: i.changePct, isIndex: true });
  }
  const byKey = new Map(quotes.map((q) => [`${q.exchange}:${q.symbol}`, q]));
  for (const t of HERO_SYMBOLS) {
    const q = byKey.get(`${t.exchange}:${t.symbol}`);
    if (!q) continue;
    items.push({
      symbol: t.symbol,
      last: q.lastPrice,
      changePct: q.changePct,
      isIndex: false,
      href: `/stock/${t.symbol}`,
    });
  }
  return items;
});

async function MarketTickerInner() {
  const initial = await fetchInitialTicker();
  return <MarketTickerStripClient initial={initial} />;
}

function TickerSkeleton() {
  return (
    <section className="sticky top-0 z-50 border-b border-border bg-bg-2/80 backdrop-blur">
      <div className="flex items-center gap-3 overflow-hidden px-3 py-2">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-bg px-2 py-1 text-[10px] uppercase tracking-wider text-muted ring-1 ring-border">
          <Activity className="h-3 w-3 text-accent animate-pulse-soft" /> Live
        </span>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-6 w-28 shrink-0 animate-pulse rounded-md bg-bg-2" />
        ))}
      </div>
    </section>
  );
}

export function MarketTickerStripAsync() {
  return (
    <Suspense fallback={<TickerSkeleton />}>
      <MarketTickerInner />
    </Suspense>
  );
}
