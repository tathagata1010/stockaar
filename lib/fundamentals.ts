import { cache } from "react";
import { redis } from "./redis";
import { getYahooCrumb, invalidateYahooCrumb, YAHOO_UA } from "./yahoo-auth";

export type AnalystCounts = {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
};

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
  updatedAt: number;
};

const CACHE_TTL_SECONDS = 60 * 60 * 6;
// Yahoo doesn't recognize every NSE symbol (delistings, NSE-only IPOs that
// haven't reached Yahoo's coverage yet). Once we see a 404, remember it for a
// day so we stop re-asking on every page load.
const NEGATIVE_CACHE_TTL_SECONDS = 60 * 60 * 24;

function fundamentalsKey(symbol: string, exchange: string) {
  return `fundamentals:${exchange}:${symbol}:v4`;
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
  const merged = mergeFundamentals(symbol, exchange, summary, quote);
  if (merged) await redis.set(key, merged, { ex: CACHE_TTL_SECONDS }).catch(() => {});
  return merged;
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
    updatedAt: Date.now(),
  };
}

async function fetchYahooQuote(
  symbol: string,
  exchange: "NSE" | "BSE",
): Promise<Partial<Fundamentals> | null> {
  // v7 quote: many key stats, no crumb required in most regions
  const suffix = exchange === "NSE" ? ".NS" : ".BO";
  try {
    const crumb = await getYahooCrumb();
    const url = new URL("https://query1.finance.yahoo.com/v7/finance/quote");
    url.searchParams.set("symbols", symbol + suffix);
    if (crumb) url.searchParams.set("crumb", crumb.crumb);
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": YAHOO_UA,
        Accept: "application/json",
        ...(crumb ? { Cookie: crumb.cookie } : {}),
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      console.warn("[yahoo-quote] " + res.status + " for " + symbol + suffix);
      return null;
    }
    const json = await res.json();
    const q = json.quoteResponse?.result?.[0];
    if (!q) return null;
    return {
      marketCap: q.marketCap,
      trailingPE: q.trailingPE,
      forwardPE: q.forwardPE,
      trailingEps: q.epsTrailingTwelveMonths,
      forwardEps: q.epsForward,
      priceToBook: q.priceToBook,
      dividendYield: q.trailingAnnualDividendYield ?? q.dividendYield,
      yearHigh: q.fiftyTwoWeekHigh,
      yearLow: q.fiftyTwoWeekLow,
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

  const attempt = async (refresh = false): Promise<Response | null> => {
    if (refresh) await invalidateYahooCrumb();
    const crumb = await getYahooCrumb();
    const url = new URL(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol + suffix)}`,
    );
    url.searchParams.set("modules", modules);
    if (crumb) url.searchParams.set("crumb", crumb.crumb);
    try {
      return await fetch(url.toString(), {
        headers: {
          "User-Agent": YAHOO_UA,
          Accept: "application/json",
          ...(crumb ? { Cookie: crumb.cookie } : {}),
        },
        next: { revalidate: 0 },
      });
    } catch (e) {
      console.warn("[yahoo-fundamentals] fetch error", e);
      return null;
    }
  };

  try {
    let res = await attempt(false);
    if (res && (res.status === 401 || res.status === 403)) {
      res = await attempt(true);
    }
    if (!res || !res.ok) {
      if (res) {
        console.warn("[yahoo-fundamentals] " + res.status + " for " + symbol + suffix);
        if (res.status === 404) {
          redis
            .set(notFoundKey(symbol, exchange), Date.now(), { ex: NEGATIVE_CACHE_TTL_SECONDS })
            .catch(() => {});
        }
      }
      return null;
    }
    const json = await res.json();
    const result = json.quoteSummary?.result?.[0];
    if (!result) return null;

    const sd = result.summaryDetail ?? {};
    const dks = result.defaultKeyStatistics ?? {};
    const fd = result.financialData ?? {};
    const rt = result.recommendationTrend?.trend?.[0] ?? {};
    const ce = result.calendarEvents ?? {};

    const v = (x: any) => (x && typeof x === "object" && "raw" in x ? x.raw : x);
    const earningsDateRaw = ce.earnings?.earningsDate?.[0];
    const earningsDate = v(earningsDateRaw);

    return {
      marketCap: v(sd.marketCap),
      trailingPE: v(sd.trailingPE),
      forwardPE: v(sd.forwardPE),
      trailingEps: v(dks.trailingEps),
      forwardEps: v(dks.forwardEps),
      priceToBook: v(dks.priceToBook),
      dividendYield: v(sd.dividendYield),
      beta: v(sd.beta) ?? v(dks.beta),
      yearHigh: v(sd.fiftyTwoWeekHigh),
      yearLow: v(sd.fiftyTwoWeekLow),
      revenueTTM: v(fd.totalRevenue),
      grossProfitsTTM: v(fd.grossProfits),
      ebitdaTTM: v(fd.ebitda),
      netIncomeTTM: v(dks.netIncomeToCommon),
      operatingMargin: v(fd.operatingMargins),
      profitMargin: v(fd.profitMargins),
      returnOnEquity: v(fd.returnOnEquity),
      returnOnAssets: v(fd.returnOnAssets),
      debtToEquity: v(fd.debtToEquity),
      revenueGrowth: v(fd.revenueGrowth),
      earningsGrowth: v(fd.earningsGrowth),
      earningsDate: typeof earningsDate === "number" ? earningsDate * 1000 : undefined,
      analystRecommendation: v(fd.recommendationMean),
      analystCounts: rt.strongBuy !== undefined
        ? {
            strongBuy: rt.strongBuy ?? 0,
            buy: rt.buy ?? 0,
            hold: rt.hold ?? 0,
            sell: rt.sell ?? 0,
            strongSell: rt.strongSell ?? 0,
          }
        : undefined,
    };
  } catch (e) {
    console.warn("[yahoo-fundamentals] error", e);
    return null;
  }
}
