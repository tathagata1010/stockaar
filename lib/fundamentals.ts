import { cache } from "react";
import { redis } from "./redis";
import { writeStale, readStale } from "./stale-cache";
import { fetchFundamentalsFallback } from "./sources";
import { yahooFetch } from "./yahoo/client";

export type AnalystCounts = {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
};

export type RecommendationTrendEntry = AnalystCounts & { period: string };

export type Fundamentals = {
  symbol: string;
  exchange: "NSE" | "BSE";
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  trailingEps?: number;
  forwardEps?: number;
  priceToBook?: number;
  dividendYield?: number;
  beta?: number;
  yearHigh?: number;
  yearLow?: number;
  revenueTTM?: number;
  grossProfitsTTM?: number;
  ebitdaTTM?: number;
  netIncomeTTM?: number;
  operatingMargin?: number;
  profitMargin?: number;
  returnOnEquity?: number;
  returnOnAssets?: number;
  debtToEquity?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  earningsDate?: number;
  analystRecommendation?: number;
  analystCounts?: AnalystCounts;
  recommendationTrendHistory?: RecommendationTrendEntry[];
  targetMeanPrice?: number;
  targetHighPrice?: number;
  targetLowPrice?: number;
  numberOfAnalystOpinions?: number;
  updatedAt: number;
};

const CACHE_TTL_SECONDS = 60 * 60 * 6;
// Yahoo doesn't recognize every NSE symbol (delistings, NSE-only IPOs that
// haven't reached Yahoo's coverage yet). Once we see a 404, remember it for a
// day so we stop re-asking on every page load.
const NEGATIVE_CACHE_TTL_SECONDS = 60 * 60 * 24;

function fundamentalsKey(symbol: string, exchange: string) {
  return `fundamentals:${exchange}:${symbol}:v6`;
}
function notFoundKey(symbol: string, exchange: string) {
  return `fundamentals:404:${exchange}:${symbol}`;
}

export const getFundamentals = cache(async (
  symbol: string,
  exchange: "NSE" | "BSE" = "NSE",
): Promise<Fundamentals | null> => {
  const key = fundamentalsKey(symbol, exchange);
  const cached = await redis.get<Fundamentals>(key).catch(() => null);
  if (cached) return cached;

  const notFound = await redis.get<number>(notFoundKey(symbol, exchange)).catch(() => null);
  if (notFound) return null;

  const [summary, quote] = await Promise.all([
    fetchYahooQuoteSummary(symbol, exchange),
    fetchYahooQuote(symbol, exchange),
  ]);
  let merged = mergeFundamentals(symbol, exchange, summary, quote);

  // If Yahoo gave us nothing useful, try Tickertape before falling back to stale.
  if (!merged) {
    const tt = await fetchFundamentalsFallback(symbol, exchange);
    if (tt) merged = mergeFundamentals(symbol, exchange, tt, null);
  }

  if (merged) {
    await redis.set(key, merged, { ex: CACHE_TTL_SECONDS }).catch(() => {});
    await writeStale(key, merged);
    return merged;
  }
  return readStale<Fundamentals>(key);
});

function mergeFundamentals(
  symbol: string,
  exchange: "NSE" | "BSE",
  a: Partial<Fundamentals> | null,
  b: Partial<Fundamentals> | null,
): Fundamentals | null {
  if (!a && !b) return null;
  const pick = <K extends keyof Fundamentals>(k: K): Fundamentals[K] =>
    (a?.[k] ?? b?.[k]) as Fundamentals[K];
  return {
    symbol,
    exchange,
    marketCap: pick("marketCap"),
    trailingPE: pick("trailingPE"),
    forwardPE: pick("forwardPE"),
    trailingEps: pick("trailingEps"),
    forwardEps: pick("forwardEps"),
    priceToBook: pick("priceToBook"),
    dividendYield: pick("dividendYield"),
    beta: pick("beta"),
    yearHigh: pick("yearHigh"),
    yearLow: pick("yearLow"),
    revenueTTM: pick("revenueTTM"),
    grossProfitsTTM: pick("grossProfitsTTM"),
    ebitdaTTM: pick("ebitdaTTM"),
    netIncomeTTM: pick("netIncomeTTM"),
    operatingMargin: pick("operatingMargin"),
    profitMargin: pick("profitMargin"),
    returnOnEquity: pick("returnOnEquity"),
    returnOnAssets: pick("returnOnAssets"),
    debtToEquity: pick("debtToEquity"),
    revenueGrowth: pick("revenueGrowth"),
    earningsGrowth: pick("earningsGrowth"),
    earningsDate: pick("earningsDate"),
    analystRecommendation: pick("analystRecommendation"),
    analystCounts: pick("analystCounts"),
    recommendationTrendHistory: pick("recommendationTrendHistory"),
    targetMeanPrice: pick("targetMeanPrice"),
    targetHighPrice: pick("targetHighPrice"),
    targetLowPrice: pick("targetLowPrice"),
    numberOfAnalystOpinions: pick("numberOfAnalystOpinions"),
    updatedAt: Date.now(),
  };
}

async function fetchYahooQuote(
  symbol: string,
  exchange: "NSE" | "BSE",
): Promise<Partial<Fundamentals> | null> {
  const suffix = exchange === "NSE" ? ".NS" : ".BO";
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol + suffix)}`;
    const res = await yahooFetch(url);
    if (!res || !res.ok) return null;
    const json = await res.json();
    const q = json.quoteResponse?.result?.[0];
    if (!q) return null;
    const nn = (x: any): number | undefined =>
      typeof x === "number" && Number.isFinite(x) ? x : undefined;
    return {
      marketCap: nn(q.marketCap),
      trailingPE: nn(q.trailingPE),
      forwardPE: nn(q.forwardPE),
      trailingEps: nn(q.epsTrailingTwelveMonths),
      forwardEps: nn(q.epsForward),
      priceToBook: nn(q.priceToBook),
      dividendYield: nn(q.trailingAnnualDividendYield ?? q.dividendYield),
      yearHigh: nn(q.fiftyTwoWeekHigh),
      yearLow: nn(q.fiftyTwoWeekLow),
    };
  } catch (e) {
    console.warn("[yahoo-quote] error", e);
    return null;
  }
}

async function fetchYahooQuoteSummary(
  symbol: string,
  exchange: "NSE" | "BSE",
): Promise<Partial<Fundamentals> | null> {
  const suffix = exchange === "NSE" ? ".NS" : ".BO";
  const modules = [
    "summaryDetail",
    "defaultKeyStatistics",
    "financialData",
    "recommendationTrend",
    "calendarEvents",
    "price",
  ].join(",");

  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol + suffix)}?modules=${encodeURIComponent(modules)}`;

  try {
    const res = await yahooFetch(url);
    if (!res || !res.ok) {
      if (res?.status === 404) {
        redis
          .set(notFoundKey(symbol, exchange), Date.now(), { ex: NEGATIVE_CACHE_TTL_SECONDS })
          .catch(() => {});
      }
      return null;
    }
    const json = await res.json();
    const result = json.quoteSummary?.result?.[0];
    if (!result) return null;

    const sd = result.summaryDetail ?? {};
    const dks = result.defaultKeyStatistics ?? {};
    const fd = result.financialData ?? {};
    const rtTrend = (result.recommendationTrend?.trend ?? []) as Array<{
      period?: string;
      strongBuy?: number;
      buy?: number;
      hold?: number;
      sell?: number;
      strongSell?: number;
    }>;
    const rt = rtTrend[0] ?? {};
    const ce = result.calendarEvents ?? {};

    const v = (x: any) => (x && typeof x === "object" && "raw" in x ? x.raw : x);
    const vn = (x: any): number | undefined => {
      const r = v(x);
      return typeof r === "number" && Number.isFinite(r) ? r : undefined;
    };
    const earningsDateRaw = ce.earnings?.earningsDate?.[0];
    const earningsDate = v(earningsDateRaw);
    const trendHistory: RecommendationTrendEntry[] = rtTrend
      .filter((t): t is typeof t & { period: string } => typeof t.period === "string")
      .map((t) => ({
        period: t.period,
        strongBuy: t.strongBuy ?? 0,
        buy: t.buy ?? 0,
        hold: t.hold ?? 0,
        sell: t.sell ?? 0,
        strongSell: t.strongSell ?? 0,
      }));

    return {
      marketCap: vn(sd.marketCap),
      trailingPE: vn(sd.trailingPE),
      forwardPE: vn(sd.forwardPE),
      trailingEps: vn(dks.trailingEps),
      forwardEps: vn(dks.forwardEps),
      priceToBook: vn(dks.priceToBook),
      dividendYield: vn(sd.dividendYield),
      beta: vn(sd.beta) ?? vn(dks.beta),
      yearHigh: vn(sd.fiftyTwoWeekHigh),
      yearLow: vn(sd.fiftyTwoWeekLow),
      revenueTTM: vn(fd.totalRevenue),
      grossProfitsTTM: vn(fd.grossProfits),
      ebitdaTTM: vn(fd.ebitda),
      netIncomeTTM: vn(dks.netIncomeToCommon),
      operatingMargin: vn(fd.operatingMargins),
      profitMargin: vn(fd.profitMargins),
      returnOnEquity: vn(fd.returnOnEquity),
      returnOnAssets: vn(fd.returnOnAssets),
      debtToEquity: vn(fd.debtToEquity),
      revenueGrowth: vn(fd.revenueGrowth),
      earningsGrowth: vn(fd.earningsGrowth),
      earningsDate: typeof earningsDate === "number" ? earningsDate * 1000 : undefined,
      analystRecommendation: vn(fd.recommendationMean),
      analystCounts: rt.strongBuy !== undefined
        ? {
            strongBuy: rt.strongBuy ?? 0,
            buy: rt.buy ?? 0,
            hold: rt.hold ?? 0,
            sell: rt.sell ?? 0,
            strongSell: rt.strongSell ?? 0,
          }
        : undefined,
      recommendationTrendHistory: trendHistory.length > 0 ? trendHistory : undefined,
      targetMeanPrice: vn(fd.targetMeanPrice),
      targetHighPrice: vn(fd.targetHighPrice),
      targetLowPrice: vn(fd.targetLowPrice),
      numberOfAnalystOpinions: vn(fd.numberOfAnalystOpinions),
    };
  } catch (e) {
    console.warn("[yahoo-fundamentals] error", e);
    return null;
  }
}
