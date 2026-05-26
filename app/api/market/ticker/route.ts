import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/upstox";
import { getAllIndices } from "@/lib/market";

const TICKER_SYMBOLS: { symbol: string; exchange: "NSE" | "BSE" }[] = [
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

export const dynamic = "force-dynamic";

export async function GET() {
  const [indices, stocks] = await Promise.all([
    getAllIndices(),
    getQuotes(TICKER_SYMBOLS),
  ]);

  const items: { symbol: string; last: number; changePct: number; isIndex: boolean; href?: string }[] = [];
  for (const i of indices) {
    items.push({ symbol: i.name, last: i.lastPrice, changePct: i.changePct, isIndex: true });
  }
  const byKey = new Map(stocks.map((q) => [`${q.exchange}:${q.symbol}`, q]));
  for (const t of TICKER_SYMBOLS) {
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
  return NextResponse.json(
    { data: items },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
}
