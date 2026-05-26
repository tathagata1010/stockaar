import { Suspense, cache } from "react";
import { StocksCarousel, type CarouselStock } from "@/components/StocksCarousel";
import { getQuotes } from "@/lib/upstox";
import { NSE_SYMBOLS } from "@/lib/nse-symbols";

const CAROUSEL_SYMBOLS = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "BHARTIARTL",
  "ITC", "SBIN", "LT", "HINDUNILVR", "AXISBANK", "MARUTI",
  "KOTAKBANK", "BAJFINANCE", "SUNPHARMA", "TITAN", "ASIANPAINT", "ADANIENT",
  "WIPRO", "ULTRACEMCO", "TATAMOTORS", "TATASTEEL", "POWERGRID", "NTPC",
  "ZOMATO", "PAYTM", "DMART", "DIVISLAB",
] as const;

const fetchCarouselStocks = cache(async (): Promise<CarouselStock[]> => {
  const quotes = await getQuotes(
    CAROUSEL_SYMBOLS.map((symbol) => ({ symbol, exchange: "NSE" as const })),
  ).catch(() => []);
  const byKey = new Map(quotes.map((q) => [q.symbol, q]));
  return CAROUSEL_SYMBOLS.map((sym) => {
    const meta = NSE_SYMBOLS.find((s) => s.symbol === sym);
    const quote = byKey.get(sym);
    return {
      symbol: sym,
      name: meta?.name ?? sym,
      sector: meta?.sector,
      price: quote?.lastPrice ?? null,
      changePct: quote?.changePct ?? null,
    };
  });
});

async function CarouselAsync({ title }: { title?: string }) {
  const stocks = await fetchCarouselStocks();
  return <StocksCarousel stocks={stocks} title={title} />;
}

function CarouselSkeleton() {
  return (
    <section className="border-y border-border bg-bg-2/20 py-2">
      <div className="flex gap-2 overflow-hidden px-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-6 w-32 shrink-0 animate-pulse rounded-md bg-bg-2" />
        ))}
      </div>
    </section>
  );
}

/** Drop-in live carousel. Self-fetches, Suspense-wrapped, safe to mount anywhere. */
export function StocksCarouselLive({ title }: { title?: string } = {}) {
  return (
    <Suspense fallback={<CarouselSkeleton />}>
      <CarouselAsync title={title} />
    </Suspense>
  );
}
