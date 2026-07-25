-- News aggregation: continuous crawler ingest table.
-- One row per unique article URL. Populated by the /api/cron/crawl-news job.

create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  canonical_url text,
  title text not null,
  publisher text not null,
  publisher_domain text,
  published_at timestamptz not null,
  image_url text,
  description text,
  content_html text,
  word_count integer,
  tickers text[] not null default '{}',
  sector text,
  source_feed text not null,
  crawled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists news_articles_pub_idx
  on public.news_articles(published_at desc);

create index if not exists news_articles_publisher_idx
  on public.news_articles(publisher_domain, published_at desc);

create index if not exists news_articles_tickers_idx
  on public.news_articles using gin (tickers);

-- Public read (news is a market-wide surface, not per-user)
alter table public.news_articles enable row level security;

drop policy if exists "news_articles_public_read" on public.news_articles;
create policy "news_articles_public_read" on public.news_articles
  for select using (true);
-- Writes go through the service role in the cron route.
