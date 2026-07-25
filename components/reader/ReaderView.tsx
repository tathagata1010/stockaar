import { Suspense } from "react";
import Link from "next/link";
import { ExternalLink, ArrowLeft, ChevronRight, Clock, Sparkles } from "lucide-react";

import { Disclaimer } from "@/components/Disclaimer";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { FreshnessStamp } from "@/components/ui/FreshnessStamp";
import { readArticle } from "@/lib/news/reader";
import { unfurl, type UnfurledMeta } from "@/lib/news/unfurl";
import { getStoredArticle, type StoredArticle } from "@/lib/news/stored";
import { deriveSymbolsFromText } from "@/lib/agent/stream-derivations";
import { summarizeArticle } from "@/lib/insights/summarize";
import { getStockNews } from "@/lib/news";
import { TodayColumn } from "@/components/reader/TodayColumn";
import { ReaderRail } from "@/components/reader/ReaderRail";
import { ArticleRailSplit } from "@/components/reader/ArticleRailSplit";
import { RelatedSurfaces } from "@/components/RelatedSurfaces";
import { TickerChip } from "@/components/TickerChip";

export function InvalidTargetView() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-[11px] text-muted">
        <Link href="/news" className="inline-flex items-center gap-1 hover:text-fg">
          <ArrowLeft className="h-3 w-3" /> Back to News
        </Link>
      </nav>
      <div className="surface p-8 text-center shadow-soft">
        <h1 className="text-xl font-bold">Can&apos;t open this link</h1>
        <p className="mt-3 text-sm text-muted">
          This URL doesn&apos;t point to a readable article. Try picking a story from the news feed.
        </p>
        <Link
          href="/news"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-medium text-brand hover:bg-brand/20"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to News
        </Link>
      </div>
    </div>
  );
}

export function isInvalidTarget(target: string): boolean {
  try {
    const t = new URL(target);
    if (
      /\.(?:js|mjs|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|map|json|xml)(?:$|\?)/i.test(t.pathname) ||
      t.hostname === "news.google.com" ||
      t.hostname === "www.google-analytics.com" ||
      t.hostname === "google-analytics.com" ||
      t.hostname === "www.googletagmanager.com" ||
      t.hostname === "googletagmanager.com"
    ) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

// Renders the shell instantly from `stored` (or a cheap unfurl fallback) and
// streams in body + insight + related-news via Suspense boundaries below.
// Redis cache in readArticle/summarizeArticle dedupes the repeated calls
// inside the suspended chunks on warm cache.
export async function ReaderView({ target, stored: preStored }: { target: string; stored?: StoredArticle | null }) {
  const stored = preStored ?? (await getStoredArticle(target).catch(() => null));

  const meta: UnfurledMeta = stored
    ? {
        url: target,
        title: stored.title,
        description: stored.description ?? undefined,
        imageUrl: stored.imageUrl ?? undefined,
        siteName: stored.publisher,
        favicon: stored.publisherDomain
          ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(stored.publisherDomain)}&sz=64`
          : undefined,
      }
    : await unfurl(target).catch((): UnfurledMeta => ({ url: target }));

  const host = new URL(target).hostname.replace(/^www\./, "");
  const publisher = stored?.publisher ?? meta.siteName ?? host;
  const title = stored?.title ?? meta.title ?? "Article";
  const image = stored?.imageUrl ?? meta.imageUrl ?? undefined;
  const publishedAt = stored?.publishedAt;
  const contextSymbol =
    stored?.tickers?.[0] ??
    deriveSymbolsFromText(`${title} ${meta.description ?? ""}`)[0]?.symbol;

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 sm:py-6">
      <link rel="canonical" href={target} />

      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-[11px] text-muted">
        <Link href="/news" className="inline-flex items-center gap-1 hover:text-fg">
          <ArrowLeft className="h-3 w-3" /> News
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-fg/80">{publisher}</span>
        <ChevronRight className="h-3 w-3" />
        <span className="line-clamp-1 max-w-[520px] truncate text-fg/80">{title}</span>
      </nav>

      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden xl:sticky xl:top-24 xl:block xl:self-start xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-1">
          <TodayColumn excludeUrl={target} />
        </aside>

        <ArticleRailSplit
          article={
            <main className="min-w-0">
              <article className="surface overflow-hidden shadow-soft">
                {image && (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image}
                      alt=""
                      className="h-[240px] w-full object-cover sm:h-[320px]"
                      loading="eager"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
                      <div className="flex flex-wrap items-center gap-2">
                        <SourceBadge source="web" label={publisher} iconUrl={meta.favicon} />
                        {publishedAt && <FreshnessStamp ts={publishedAt} />}
                        <Suspense fallback={null}>
                          <ReadTimeBadge target={target} overlay />
                        </Suspense>
                        {contextSymbol && (
                          <TickerChip
                            symbol={contextSymbol}
                            variant="solid"
                            size="xs"
                            className="shadow-sm"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-5 sm:p-8">
                  {!image && (
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <SourceBadge source="web" label={publisher} iconUrl={meta.favicon} />
                      {publishedAt && <FreshnessStamp ts={publishedAt} />}
                      <Suspense fallback={null}>
                        <ReadTimeBadge target={target} overlay={false} />
                      </Suspense>
                      {contextSymbol && (
                        <TickerChip symbol={contextSymbol} variant="outline" size="xs" />
                      )}
                    </div>
                  )}

                  <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-[32px] sm:leading-[1.15]">
                    {title}
                  </h1>

                  <Suspense fallback={<TldrSkeleton />}>
                    <TldrBlock
                      target={target}
                      title={title}
                      description={meta.description}
                    />
                  </Suspense>

                  <Suspense
                    fallback={
                      <ArticleBodySkeleton description={meta.description} target={target} host={host} />
                    }
                  >
                    <ArticleBody target={target} description={meta.description} host={host} />
                  </Suspense>

                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg-2/40 p-4">
                    <div className="text-xs text-muted">
                      Content and copyright belong to <span className="font-medium text-fg">{publisher}</span>.
                    </div>
                    <a
                      href={target}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
                    >
                      View original on {host} ↗
                    </a>
                  </div>
                </div>
              </article>

              <Disclaimer className="mt-8" />
            </main>
          }
          rail={
            <Suspense fallback={<RailFallback contextSymbol={contextSymbol} />}>
              <AsyncRail
                target={target}
                title={title}
                publisher={publisher}
                publishedAt={publishedAt}
                contextSymbol={contextSymbol}
                description={meta.description}
              />
            </Suspense>
          }
        />
      </div>
      <RelatedSurfaces kind="reader" contextSymbol={contextSymbol ?? null} />
    </div>
  );
}

// ---------- Suspended chunks ----------

async function ArticleBody({
  target,
  description,
  host,
}: {
  target: string;
  description?: string;
  host: string;
}) {
  const article = await readArticle(target).catch(() => null);
  if (article) {
    return (
      <>
        {article.byline && <p className="mt-2 text-sm text-muted">By {article.byline}</p>}
        <div
          className="reader-body mt-7"
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />
      </>
    );
  }
  return (
    <div className="mt-7 space-y-3 text-sm text-muted">
      <p>
        We couldn&apos;t extract this article&apos;s body — the source may block automated readers or use a heavy layout.
      </p>
      {description && <p className="text-fg/90">{description}</p>}
      <a
        href={target}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand/20"
      >
        Read on {host}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

async function TldrBlock({
  target,
  title,
  description,
}: {
  target: string;
  title: string;
  description?: string;
}) {
  const article = await readArticle(target).catch(() => null);
  const insight = await summarizeArticle({
    url: target,
    title,
    contentHtml: article?.contentHtml,
    textPreview: article?.textPreview ?? description,
  }).catch(() => null);
  if (!insight?.summary) return null;
  return (
    <div className="mt-6 rounded-xl border border-brand/30 bg-gradient-to-br from-brand/10 via-card to-card p-4 shadow-soft sm:p-5">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand">
        <Sparkles className="h-3.5 w-3.5" />
        fuzz TL;DR
      </div>
      <p className="text-[15px] leading-relaxed text-fg/95">{insight.summary}</p>
    </div>
  );
}

async function ReadTimeBadge({ target, overlay }: { target: string; overlay: boolean }) {
  const article = await readArticle(target).catch(() => null);
  if (!article) return null;
  const minutes = Math.max(1, Math.round(article.wordCount / 220));
  if (overlay) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur">
        <Clock className="h-3 w-3" />
        {minutes} min read
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-2/60 px-2 py-0.5 text-[10px] text-muted">
      <Clock className="h-3 w-3" />
      {minutes} min read
    </span>
  );
}

async function AsyncRail({
  target,
  title,
  publisher,
  publishedAt,
  contextSymbol,
  description,
}: {
  target: string;
  title: string;
  publisher: string;
  publishedAt?: number;
  contextSymbol?: string;
  description?: string;
}) {
  const [article, relatedNews] = await Promise.all([
    readArticle(target).catch(() => null),
    contextSymbol
      ? getStockNews(contextSymbol, "NSE", 20)
          .then((items) =>
            items
              .filter((n) => n.url !== target)
              .slice(0, 12)
              .map((n) => ({
                title: n.title,
                url: n.url,
                publisher: n.publisher,
                publisherDomain: n.publisherDomain,
                publisherIcon: n.publisherIcon,
                publishedAt: n.publishedAt,
                imageUrl: n.imageUrl,
                description: n.description,
              })),
          )
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const insight = await summarizeArticle({
    url: target,
    title,
    contentHtml: article?.contentHtml,
    textPreview: article?.textPreview ?? description,
  }).catch(() => null);

  const articleBody = article?.contentHtml
    ? article.contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : article?.textPreview ?? description ?? "";
  const articleContext =
    articleBody.length >= 50
      ? {
          title,
          url: target,
          publisher,
          publishedAt,
          body: articleBody.slice(0, 8000),
        }
      : undefined;

  return (
    <ReaderRail
      contextSymbol={contextSymbol}
      articleContext={articleContext}
      relatedNews={relatedNews}
      insight={insight}
    />
  );
}

// ---------- Skeletons ----------

function TldrSkeleton() {
  return (
    <div className="mt-6 rounded-xl border border-border bg-card/60 p-4 sm:p-5">
      <div className="mb-3 h-3 w-24 animate-pulse rounded-full bg-white/10" />
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-white/5" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-white/5" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-white/5" />
      </div>
    </div>
  );
}

function ArticleBodySkeleton({
  description,
  target,
  host,
}: {
  description?: string;
  target: string;
  host: string;
}) {
  return (
    <div className="mt-7 space-y-3">
      {description && <p className="text-sm text-fg/80">{description}</p>}
      <div className="space-y-2 pt-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`h-3 animate-pulse rounded bg-white/5 ${i % 3 === 2 ? "w-3/4" : "w-full"}`}
          />
        ))}
      </div>
      <a
        href={target}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg"
      >
        Reading on {host}…
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function RailFallback({ contextSymbol }: { contextSymbol?: string }) {
  return (
    <div className="surface flex h-full min-h-[620px] flex-col overflow-hidden p-4 shadow-soft">
      <div className="mb-3 h-3 w-32 animate-pulse rounded-full bg-white/10" />
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-white/5" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-white/5" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
      </div>
      <div className="mt-6 text-xs text-muted">
        {contextSymbol ? `Loading fuzz for ${contextSymbol}…` : "Loading fuzz…"}
      </div>
      <div className="mt-2 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3 w-full animate-pulse rounded bg-white/5" />
        ))}
      </div>
    </div>
  );
}
