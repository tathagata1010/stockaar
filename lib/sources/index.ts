// Cross-source fallback orchestrators. Call sites in lib/upstox.ts and
// lib/fundamentals.ts use these to backfill anything Yahoo couldn't return.
//
// Order: Yahoo (handled by caller) → NSE public → Tickertape → caller falls back to stale.

import type { Quote } from "../upstox";
import type { Fundamentals } from "../fundamentals";
import { fetchNseQuotes } from "./nse-public";
import { fetchTickertapeFundamentals } from "./tickertape";

export async function fetchQuotesFallback(
  items: { symbol: string; exchange: "NSE" | "BSE" }[],
): Promise<Quote[]> {
  if (items.length === 0) return [];
  const nseItems = items.filter((i) => i.exchange === "NSE");
  if (nseItems.length === 0) return [];
  return fetchNseQuotes(nseItems);
}

export async function fetchFundamentalsFallback(
  symbol: string,
  exchange: "NSE" | "BSE",
): Promise<Partial<Fundamentals> | null> {
  return fetchTickertapeFundamentals(symbol, exchange);
}
