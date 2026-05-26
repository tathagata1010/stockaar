import { redis } from "./redis";
import { NSE_SYMBOLS, type SymbolEntry } from "./nse-symbols";
import { getMarketNews } from "./news";
import type { NewsItem } from "./news";

export type BuzzPost = {
  id: string;
  title: string;
  url: string;
  subreddit: string;
  ups: number;
  comments: number;
  createdAt: number;
};

export type BuzzNews = {
  title: string;
  url: string;
  publisher: string;
  publishedAt: number;
};

export type BuzzItem = {
  entry: SymbolEntry;
  score: number;
  redditScore: number;
  newsScore: number;
  mentions: number;
  upvotes: number;
  comments: number;
  newsCount: number;
  topPost: BuzzPost;
  posts: BuzzPost[];
  news: BuzzNews[];
};

export type BuzzPayload = {
  builtAt: number;
  items: BuzzItem[];
  sampleSize: number;
  newsSample: number;
};

const FRESH_KEY = "buzz:reddit:v2:fresh";
const STABLE_KEY = "buzz:reddit:v2:stable";
const FRESH_TTL_SEC = 15 * 60;
const SUBS = ["IndianStockMarket", "IndiaInvestments", "DalalStreetTalks", "StockMarketIndia"];
const UA = "stockaar/1.0 (+https://stockaar.in)";

// Per-headline weight relative to (1 upvote + 0 comments). News carries more signal
// than a single upvote because editorial pickup means broader reach.
const NEWS_HEADLINE_WEIGHT = 25;

// Tokens that look like symbols but aren't (avoid noise). NSE has "IT", "TCS" etc — short ones must be word-boundaried.
const STOPWORDS = new Set([
  "I", "A", "IS", "OR", "AT", "ON", "IN", "TO", "OF", "BY", "BE", "DO", "GO", "HE", "ME", "MY", "WE", "AS", "AN", "IF",
  "IT", "US", "SO", "UP", "NO", "OK", "PE", "EPS", "ROE", "ROCE", "CEO", "CFO", "USA", "USD", "INR", "NSE", "BSE",
  "IPO", "ETF", "API", "OTC", "FII", "DII", "NPS", "EMI", "TDS", "GST", "AMC", "NAV", "EOD", "WTI", "LTP", "MC",
  "ALL", "NEW", "OLD", "ONE", "TWO", "RBI", "SEBI", "GDP", "Q1", "Q2", "Q3", "Q4", "FY", "AI", "ML",
]);

function buildMatchers() {
  // Map uppercase token -> SymbolEntry. Include symbol + first name word (when distinct & not stopword).
  const map = new Map<string, SymbolEntry>();
  for (const e of NSE_SYMBOLS) {
    const sym = e.symbol.toUpperCase();
    if (sym.length >= 3 && !STOPWORDS.has(sym)) {
      if (!map.has(sym)) map.set(sym, e);
    }
    const first = e.name.split(/\s+/)[0]?.toUpperCase() ?? "";
    if (first.length >= 5 && !STOPWORDS.has(first) && !map.has(first)) {
      map.set(first, e);
    }
  }
  return map;
}

const MATCHERS = buildMatchers();

function extractSymbols(text: string): Set<string> {
  const hits = new Set<string>();
  // Word tokens, length 3+, uppercase or with $ prefix.
  const re = /\$?[A-Z][A-Z0-9&]{2,14}/g;
  const upper = text.toUpperCase();
  let m: RegExpExecArray | null;
  while ((m = re.exec(upper))) {
    const tok = m[0].replace(/^\$/, "");
    const entry = MATCHERS.get(tok);
    if (entry) hits.add(entry.symbol);
  }
  return hits;
}

type RawPost = BuzzPost & { selftext: string; sub: string };

async function fetchSubreddit(sub: string): Promise<RawPost[]> {
  const url = `https://www.reddit.com/r/${sub}/hot.json?limit=75&raw_json=1`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const children = (data?.data?.children ?? []) as Array<{ data: Record<string, unknown> }>;
    return children
      .map((c) => c.data)
      .filter((d) => !d.stickied && !d.over_18)
      .map((d) => ({
        id: String(d.id ?? ""),
        title: String(d.title ?? ""),
        url: `https://www.reddit.com${String(d.permalink ?? "")}`,
        subreddit: sub,
        sub,
        ups: Number(d.ups ?? d.score ?? 0),
        comments: Number(d.num_comments ?? 0),
        createdAt: Number(d.created_utc ?? 0) * 1000,
        selftext: String(d.selftext ?? ""),
      }))
      .filter((p) => p.id && p.title);
  } catch {
    return [];
  }
}

async function rebuild(): Promise<BuzzPayload> {
  const [lists, news] = await Promise.all([
    Promise.all(SUBS.map(fetchSubreddit)),
    getMarketNews(80).catch(() => [] as NewsItem[]),
  ]);
  const all = lists.flat();
  const seen = new Set<string>();
  const posts = all.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));

  const bySym = new Map<string, BuzzItem>();
  const now = Date.now();

  for (const p of posts) {
    const hits = extractSymbols(`${p.title}\n${p.selftext.slice(0, 4000)}`);
    if (hits.size === 0) continue;
    const ageHr = Math.max(0, (now - p.createdAt) / 3_600_000);
    const decay = Math.max(0.2, 1 - ageHr / 72);
    const weight = (p.ups + 2 * p.comments) * decay;

    const postLite: BuzzPost = {
      id: p.id, title: p.title, url: p.url, subreddit: p.sub,
      ups: p.ups, comments: p.comments, createdAt: p.createdAt,
    };

    for (const sym of hits) {
      const entry = MATCHERS.get(sym) ?? NSE_SYMBOLS.find((e) => e.symbol === sym);
      if (!entry) continue;
      const existing = bySym.get(sym);
      if (existing) {
        existing.redditScore += weight;
        existing.score += weight;
        existing.mentions += 1;
        existing.upvotes += p.ups;
        existing.comments += p.comments;
        existing.posts.push(postLite);
        if (postLite.ups > existing.topPost.ups) existing.topPost = postLite;
      } else {
        bySym.set(sym, {
          entry,
          score: weight,
          redditScore: weight,
          newsScore: 0,
          mentions: 1,
          upvotes: p.ups,
          comments: p.comments,
          newsCount: 0,
          topPost: postLite,
          posts: [postLite],
          news: [],
        });
      }
    }
  }

  // News signal: count headlines mentioning each tracked symbol/name, fold into score.
  for (const n of news) {
    const hits = extractSymbols(n.title);
    if (hits.size === 0) continue;
    const ageHr = Math.max(0, (now - n.publishedAt) / 3_600_000);
    const decay = Math.max(0.2, 1 - ageHr / 48);
    const weight = NEWS_HEADLINE_WEIGHT * decay;
    const lite: BuzzNews = {
      title: n.title,
      url: n.url,
      publisher: n.publisher,
      publishedAt: n.publishedAt,
    };
    for (const sym of hits) {
      const entry = MATCHERS.get(sym) ?? NSE_SYMBOLS.find((e) => e.symbol === sym);
      if (!entry) continue;
      const existing = bySym.get(sym);
      if (existing) {
        existing.score += weight;
        existing.newsScore += weight;
        existing.newsCount += 1;
        if (existing.news.length < 5) existing.news.push(lite);
      } else {
        bySym.set(sym, {
          entry,
          score: weight,
          redditScore: 0,
          newsScore: weight,
          mentions: 0,
          upvotes: 0,
          comments: 0,
          newsCount: 1,
          topPost: {
            id: lite.url, title: lite.title, url: lite.url, subreddit: lite.publisher,
            ups: 0, comments: 0, createdAt: lite.publishedAt,
          },
          posts: [],
          news: [lite],
        });
      }
    }
  }

  const items = Array.from(bySym.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .map((it) => ({
      ...it,
      posts: it.posts.sort((a, b) => b.ups - a.ups).slice(0, 5),
      news: it.news.sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 5),
    }));

  return { builtAt: now, items, sampleSize: posts.length, newsSample: news.length };
}

export async function getRedditBuzz(): Promise<BuzzPayload> {
  // Stale-while-revalidate: serve stable cache immediately, kick off rebuild if stale.
  const [fresh, stable] = await Promise.all([
    redis.get<BuzzPayload>(FRESH_KEY).catch(() => null),
    redis.get<BuzzPayload>(STABLE_KEY).catch(() => null),
  ]);
  if (fresh?.items?.length) return fresh;
  if (stable?.items?.length) {
    // Fire-and-forget background refresh; don't await.
    void refreshBuzz().catch(() => {});
    return stable;
  }
  return refreshBuzz();
}

export async function refreshBuzz(): Promise<BuzzPayload> {
  const built = await rebuild();
  if (built.items.length) {
    await Promise.all([
      redis.set(FRESH_KEY, built, { ex: FRESH_TTL_SEC }).catch(() => {}),
      redis.set(STABLE_KEY, built).catch(() => {}),
    ]);
  }
  return built;
}
