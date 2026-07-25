// Publisher feed registry for the continuous news crawler.
// Each entry produces one RSS/Atom feed we hit on every crawl tick.
// Adding a publisher = one line here. The crawler handles dedupe by URL.

export type PublisherFeed = {
  id: string;
  name: string;
  domain: string;
  feedUrl: string;
  category?: "markets" | "business" | "policy" | "wire";
};

export const PUBLISHERS: PublisherFeed[] = [
  {
    id: "moneycontrol-markets",
    name: "Moneycontrol",
    domain: "moneycontrol.com",
    feedUrl: "https://www.moneycontrol.com/rss/marketsnews.xml",
    category: "markets",
  },
  {
    id: "moneycontrol-business",
    name: "Moneycontrol",
    domain: "moneycontrol.com",
    feedUrl: "https://www.moneycontrol.com/rss/business.xml",
    category: "business",
  },
  {
    id: "moneycontrol-latest",
    name: "Moneycontrol",
    domain: "moneycontrol.com",
    feedUrl: "https://www.moneycontrol.com/rss/latestnews.xml",
    category: "markets",
  },
  {
    id: "moneycontrol-economy",
    name: "Moneycontrol",
    domain: "moneycontrol.com",
    feedUrl: "https://www.moneycontrol.com/rss/economy.xml",
    category: "policy",
  },
  {
    id: "moneycontrol-results",
    name: "Moneycontrol",
    domain: "moneycontrol.com",
    feedUrl: "https://www.moneycontrol.com/rss/results.xml",
    category: "business",
  },
  {
    id: "moneycontrol-ipo",
    name: "Moneycontrol",
    domain: "moneycontrol.com",
    feedUrl: "https://www.moneycontrol.com/rss/iponews.xml",
    category: "markets",
  },
  {
    id: "et-markets",
    name: "Economic Times",
    domain: "economictimes.indiatimes.com",
    feedUrl: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
    category: "markets",
  },
  {
    id: "et-stocks",
    name: "Economic Times",
    domain: "economictimes.indiatimes.com",
    feedUrl: "https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms",
    category: "markets",
  },
  {
    id: "et-industry",
    name: "Economic Times",
    domain: "economictimes.indiatimes.com",
    feedUrl: "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms",
    category: "business",
  },
  {
    id: "livemint-markets",
    name: "LiveMint",
    domain: "livemint.com",
    feedUrl: "https://www.livemint.com/rss/markets",
    category: "markets",
  },
  {
    id: "livemint-companies",
    name: "LiveMint",
    domain: "livemint.com",
    feedUrl: "https://www.livemint.com/rss/companies",
    category: "business",
  },
  {
    id: "bs-markets",
    name: "Business Standard",
    domain: "business-standard.com",
    feedUrl: "https://www.business-standard.com/rss/markets-106.rss",
    category: "markets",
  },
  {
    id: "bs-companies",
    name: "Business Standard",
    domain: "business-standard.com",
    feedUrl: "https://www.business-standard.com/rss/companies-101.rss",
    category: "business",
  },
  {
    id: "financialexpress-markets",
    name: "Financial Express",
    domain: "financialexpress.com",
    feedUrl: "https://www.financialexpress.com/market/feed/",
    category: "markets",
  },
  {
    id: "financialexpress-industry",
    name: "Financial Express",
    domain: "financialexpress.com",
    feedUrl: "https://www.financialexpress.com/industry/feed/",
    category: "business",
  },
  {
    id: "cnbctv18-markets",
    name: "CNBC-TV18",
    domain: "cnbctv18.com",
    feedUrl: "https://www.cnbctv18.com/commonfeeds/v1/cne/rss/market.xml",
    category: "markets",
  },
  {
    id: "cnbctv18-business",
    name: "CNBC-TV18",
    domain: "cnbctv18.com",
    feedUrl: "https://www.cnbctv18.com/commonfeeds/v1/cne/rss/business.xml",
    category: "business",
  },
  {
    id: "businessline-markets",
    name: "The Hindu BusinessLine",
    domain: "thehindubusinessline.com",
    feedUrl: "https://www.thehindubusinessline.com/markets/feeder/default.rss",
    category: "markets",
  },
  {
    id: "businessline-stock-markets",
    name: "The Hindu BusinessLine",
    domain: "thehindubusinessline.com",
    feedUrl: "https://www.thehindubusinessline.com/markets/stock-markets/feeder/default.rss",
    category: "markets",
  },
  {
    id: "businessline-companies",
    name: "The Hindu BusinessLine",
    domain: "thehindubusinessline.com",
    feedUrl: "https://www.thehindubusinessline.com/companies/feeder/default.rss",
    category: "business",
  },
  {
    id: "businessline-economy",
    name: "The Hindu BusinessLine",
    domain: "thehindubusinessline.com",
    feedUrl: "https://www.thehindubusinessline.com/economy/feeder/default.rss",
    category: "policy",
  },
  {
    id: "businessline-latest",
    name: "The Hindu BusinessLine",
    domain: "thehindubusinessline.com",
    feedUrl: "https://www.thehindubusinessline.com/feeder/default.rss",
    category: "markets",
  },
  {
    id: "investing-india",
    name: "Investing.com India",
    domain: "in.investing.com",
    feedUrl: "https://in.investing.com/rss/news.rss",
    category: "markets",
  },
  {
    id: "tradebrains-features",
    name: "Trade Brains",
    domain: "tradebrains.in",
    feedUrl: "https://tradebrains.in/features/feed/",
    category: "markets",
  },
  {
    id: "rediff-money",
    name: "Rediff Money",
    domain: "rediff.com",
    feedUrl: "https://www.rediff.com/rss/moneyrss.xml",
    category: "markets",
  },
];

export function publisherFromDomain(domain: string): string {
  const d = domain.toLowerCase().replace(/^www\./, "");
  const match = PUBLISHERS.find((p) => p.domain === d);
  if (match) return match.name;
  return d;
}
