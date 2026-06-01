import { Suspense } from "react";
import Link from "next/link";
import { Flame, MessageSquare, ArrowUp, ExternalLink, Sparkles, TrendingUp, Clock, Newspaper } from "lucide-react";
import { getRedditBuzz, type BuzzItem } from "@/lib/reddit-buzz";
import { StockLogo } from "@/components/StockLogo";
import { Skeleton } from "@/components/Skeleton";
import { AppShell } from "@/components/shell/AppShell";

export const revalidate = 60;

export const metadata = {
  title: "Trending Stocks — Most Searched on NSE Today",
  description: "Most searched and discussed Indian stocks right now, ranked by retail interest and momentum.",
  alternates: { canonical: "/trending" },
};

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export default function TrendingPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <Hero />
        <Suspense fallback={<BuzzGridSkeleton />}>
          <BuzzGrid />
        </Suspense>
      </div>
    </AppShell>
  );
}

function Hero() {
  return (
    <section className="surface relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-soft">
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative max-w-3xl">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand ring-1 ring-brand/30">
          <Flame className="h-3 w-3" /> Market Buzz · Trending
        </span>
        <h1 className="num-display mt-4 text-2xl font-bold leading-tight sm:text-3xl md:text-4xl lg:text-5xl">
          What India is <span className="bg-gradient-to-r from-brand via-accent to-brand-2 bg-clip-text text-transparent">talking about</span> today.
        </h1>
        <p className="mt-3 max-w-2xl text-xs text-muted sm:text-sm">
          Tickers ranked by chatter across <span className="text-fg/90">r/IndianStockMarket</span>, r/IndiaInvestments,
          r/DalalStreetTalks, r/StockMarketIndia and live financial news headlines. Scored by upvotes, comments, news pickup
          and recency — refreshed every 15 minutes.
        </p>
      </div>
    </section>
  );
}

async function BuzzGrid() {
  const { items, sampleSize, newsSample, builtAt } = await getRedditBuzz();

  if (!items.length) {
    return (
      <div className="surface rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted shadow-soft">
        Feed is quiet right now. Check back in a few minutes.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <Sparkles className="h-3.5 w-3.5 text-brand" />
          Scanned <span className="font-semibold text-fg">{sampleSize}</span> Reddit posts ·{" "}
          <span className="font-semibold text-fg">{newsSample}</span> news headlines · found{" "}
          <span className="font-semibold text-fg">{items.length}</span> trending tickers
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Updated {timeAgo(builtAt)}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <BuzzCard key={it.entry.symbol} item={it} rank={i + 1} className={`fade-up-${(i % 5) + 1}`} />
        ))}
      </div>

      <p className="pt-4 text-center text-[11px] text-muted">
        Aggregated from public Reddit data. For informational purposes only. Not investment advice.
      </p>
    </>
  );
}

function BuzzCard({ item, rank, className }: { item: BuzzItem; rank: number; className?: string }) {
  const { entry, mentions, upvotes, score, topPost, posts, news, newsCount } = item;
  const tier = rank <= 3 ? "hot" : rank <= 10 ? "warm" : "cool";
  const hasReddit = posts.length > 0;
  const hasNews = news.length > 0;

  return (
    <div className={`surface group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-1 hover:border-brand/40 hover:shadow-pop ${className ?? ""}`}>
      <span
        className={`pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b ${
          tier === "hot" ? "from-danger via-brand to-accent" : tier === "warm" ? "from-brand via-accent to-brand-2" : "from-border via-border-strong to-border"
        } opacity-70 transition-opacity group-hover:opacity-100`}
      />
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent transition-transform duration-700 group-hover:translate-x-full" />

      <div className="relative flex items-start gap-3 p-5 pb-3">
        <Link href={`/stock/${entry.symbol}`} className="shrink-0">
          <StockLogo symbol={entry.symbol} name={entry.name} sector={entry.sector} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link href={`/stock/${entry.symbol}`} className="text-base font-bold tracking-tight hover:text-brand">
              {entry.symbol}
            </Link>
            <span className="rounded-full bg-bg-2 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted ring-1 ring-border">
              {entry.exchange}
            </span>
          </div>
          <div className="truncate text-xs text-muted">{entry.name}</div>
        </div>
        <div
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold tabular-nums ring-1 ${
            tier === "hot"
              ? "bg-danger/10 text-danger ring-danger/30"
              : tier === "warm"
                ? "bg-brand/10 text-brand ring-brand/30"
                : "bg-bg-2 text-muted ring-border"
          }`}
        >
          <Flame className="h-3 w-3" /> #{rank}
        </div>
      </div>

      <div className="relative grid grid-cols-3 gap-2 px-5 pb-3 text-center">
        <Stat icon={<MessageSquare className="h-3 w-3" />} label="Posts" value={String(mentions)} />
        <Stat icon={<Newspaper className="h-3 w-3" />} label="News" value={String(newsCount)} />
        <Stat icon={<TrendingUp className="h-3 w-3" />} label="Score" value={compact(score)} />
      </div>

      <div className="relative flex flex-wrap items-center gap-1.5 px-5 pb-2 text-[10px]">
        {hasReddit && (
          <span className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-1.5 py-0.5 font-semibold text-brand ring-1 ring-brand/30">
            <ArrowUp className="h-2.5 w-2.5" /> {compact(upvotes)} Reddit
          </span>
        )}
        {hasNews && (
          <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-1.5 py-0.5 font-semibold text-accent ring-1 ring-accent/30">
            <Newspaper className="h-2.5 w-2.5" /> {newsCount} headline{newsCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {hasReddit && (
        <div className="relative border-t border-border/60 px-5 py-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Top chatter</div>
          <a
            href={topPost.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-border/60 bg-bg-2/40 p-3 transition hover:border-brand/40 hover:bg-bg-2/80"
          >
            <div className="flex items-center gap-2 text-[10px] text-muted">
              <span className="inline-flex items-center rounded-md bg-card px-1.5 py-0.5 font-semibold text-fg/80 ring-1 ring-border">
                r/{topPost.subreddit}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <ArrowUp className="h-2.5 w-2.5" /> {compact(topPost.ups)}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <MessageSquare className="h-2.5 w-2.5" /> {compact(topPost.comments)}
              </span>
              <span className="ml-auto">{timeAgo(topPost.createdAt)}</span>
            </div>
            <div className="mt-1.5 line-clamp-2 text-xs font-medium leading-snug text-fg/95">
              {topPost.title}
            </div>
          </a>

          {posts.length > 1 && (
            <details className="group/det mt-2">
              <summary className="cursor-pointer list-none text-[11px] text-muted hover:text-brand">
                <span className="inline-flex items-center gap-1">
                  + {posts.length - 1} more {posts.length - 1 === 1 ? "thread" : "threads"}
                </span>
              </summary>
              <ul className="mt-2 space-y-1.5">
                {posts.slice(1).map((p) => (
                  <li key={p.id}>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-[11px] transition hover:bg-bg-2/60"
                    >
                      <ArrowUp className="mt-0.5 h-2.5 w-2.5 shrink-0 text-muted" />
                      <span className="tabular-nums text-muted">{compact(p.ups)}</span>
                      <span className="line-clamp-1 text-fg/85">{p.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {hasNews && (
        <div className="relative border-t border-border/60 px-5 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
            <Newspaper className="h-3 w-3" /> Latest headlines
          </div>
          <ul className="space-y-1.5">
            {news.slice(0, 3).map((n) => (
              <li key={n.url}>
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-[11px] transition hover:bg-bg-2/60"
                >
                  <span className="line-clamp-2 flex-1 leading-snug text-fg/85">{n.title}</span>
                  <span className="shrink-0 whitespace-nowrap text-[10px] text-muted">{timeAgo(n.publishedAt)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="relative mt-auto flex items-center justify-between gap-2 border-t border-border/60 bg-bg-2/30 px-5 py-3">
        <Link
          href={`/stock/${entry.symbol}`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand transition hover:gap-1.5"
        >
          View {entry.symbol} <ExternalLink className="h-3 w-3" />
        </Link>
        <span className="text-[10px] uppercase tracking-wider text-muted">{entry.sector}</span>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-bg-2/40 px-2 py-1.5 ring-1 ring-border/60">
      <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-muted">
        {icon} {label}
      </div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}

function BuzzGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton key={i} className="h-72" />
      ))}
    </div>
  );
}
