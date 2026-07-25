"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search, Newspaper, Zap, Globe2, Building2, TrendingUp, Radio } from "lucide-react";
import { StockLogo } from "@/components/StockLogo";
import { SourceBadge, type Source } from "@/components/ui/SourceBadge";
import { FreshnessStamp } from "@/components/ui/FreshnessStamp";
import { smartReaderHref } from "@/lib/news/href";
import type { Sector } from "@/lib/nse-symbols";

export type NewsFeedItem = {
  symbol: string;
  name: string;
  sector: Sector;
  title: string;
  url: string;
  publisher: string;
  publisherDomain?: string;
  publishedAt: number;
  imageUrl?: string;
  publisherIcon?: string;
  source?: Source;
  description?: string;
};

type Category = "all" | "markets" | "earnings" | "ipos" | "global";

const CATEGORIES: { key: Category; label: string; icon: typeof Zap }[] = [
  { key: "all", label: "All", icon: Radio },
  { key: "markets", label: "Markets", icon: TrendingUp },
  { key: "earnings", label: "Earnings", icon: Building2 },
  { key: "ipos", label: "IPOs", icon: Zap },
  { key: "global", label: "Global", icon: Globe2 },
];

function categorize(title: string): Category {
  const t = title.toLowerCase();
  if (/\bipo\b|listing|dr?hp|red herring|price band|subscribed|lot size/.test(t)) return "ipos";
  if (/q[1-4]\b|earnings|results|profit|revenue|ebitda|guidance|consensus|beats|misses/.test(t)) return "earnings";
  if (/\b(us|fed|china|europe|global|dollar|opec|treasury|imf|world bank|crude|brent|nasdaq|dow)\b/.test(t)) return "global";
  return "markets";
}

export function NewsFeedClient({ items }: { items: NewsFeedItem[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category>("all");
  const [buzzExpanded, setBuzzExpanded] = useState(false);

  const BUZZ_INITIAL = 12;

  useEffect(() => {
    setBuzzExpanded(false);
  }, [cat, q]);

  const { filtered, breaking, sub, connect, buzz } = useMemo(() => {
    const ql = q.trim().toLowerCase();

    let pool = items;
    if (cat !== "all") pool = pool.filter((n) => categorize(n.title) === cat);
    if (ql) {
      pool = pool.filter(
        (i) =>
          i.symbol.toLowerCase().includes(ql) ||
          i.name.toLowerCase().includes(ql) ||
          i.title.toLowerCase().includes(ql) ||
          i.publisher.toLowerCase().includes(ql),
      );
    }

    const breaking = ql ? null : pool.find((n) => n.imageUrl && n.description) ?? pool.find((n) => n.imageUrl) ?? null;
    const rest = breaking ? pool.filter((n) => n.url !== breaking.url) : pool;
    const sub = ql ? [] : rest.filter((n) => n.imageUrl).slice(0, 2);
    const subUrls = new Set(sub.map((s) => s.url));
    const connect = rest.filter((n) => !subUrls.has(n.url) && n.imageUrl).slice(0, 4);
    const connectUrls = new Set(connect.map((s) => s.url));
    const buzz = rest.filter((n) => !subUrls.has(n.url) && !connectUrls.has(n.url));

    return { filtered: pool, breaking, sub, connect, buzz };
  }, [q, cat, items]);

  return (
    <div className="space-y-6">
      <DiscoverHeader />

      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map(({ key, label, icon: Icon }) => {
          const active = cat === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setCat(key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-fast ease-out ${
                active
                  ? "border-brand/50 bg-brand/15 text-brand shadow-[0_0_0_1px_rgba(0,0,0,0)]"
                  : "border-hairline bg-card/60 t-muted hover:border-brand/30 hover:text-fg"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
        <div className="relative ml-auto flex-1 min-w-[200px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 t-muted" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by symbol, headline, publisher…"
            className="w-full rounded-full border border-hairline bg-card/60 py-2 pl-9 pr-3 text-xs shadow-e1 focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="surface p-6 t-body t-muted">
          No stories match your filters.
        </p>
      ) : (
        <div className="space-y-8">
          {breaking && (
            <section>
              <SectionHeader label="Breaking" accent tone="brand" />
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <BreakingHero item={breaking} />
                {sub.length > 0 && (
                  <div className="grid gap-3 md:grid-rows-2">
                    {sub.map((s) => (
                      <SubBreakingCard key={s.url} item={s} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {connect.length > 0 && (
            <section>
              <SectionHeader label="Connect the Dots" tone="accent" />
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {connect.map((n) => (
                  <li key={n.url}>
                    <ConnectCard item={n} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {buzz.length > 0 && (
            <section>
              <SectionHeader label="Buzzing" tone="muted" count={buzz.length} />
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {(buzzExpanded ? buzz : buzz.slice(0, BUZZ_INITIAL)).map((n) => (
                  <li key={n.url}>
                    <NewsCard item={n} />
                  </li>
                ))}
              </ul>
              {buzz.length > BUZZ_INITIAL && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setBuzzExpanded((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-xs font-semibold text-brand transition-colors duration-fast ease-out hover:bg-brand/20"
                  >
                    {buzzExpanded ? "Show less" : `View all ${buzz.length} stories`}
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-2 t-caption t-muted">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
        </span>
        Curating Indian finance news for you · 24 × 7
      </div>
    </div>
  );
}

function DiscoverHeader() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-hairline bg-gradient-to-br from-brand/10 via-card to-card p-4 shadow-e1">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand/20 text-brand">
          <Radio className="h-4.5 w-4.5" />
        </span>
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            Discover
            <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 t-label text-brand">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/70 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
              </span>
              Live
            </span>
          </div>
          <div className="mt-0.5 t-caption t-muted">Indian markets news, curated for retail investors</div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  label,
  count,
  tone = "muted",
  accent,
}: {
  label: string;
  count?: number;
  tone?: "muted" | "brand" | "accent";
  accent?: boolean;
}) {
  const toneClass =
    tone === "brand"
      ? "text-brand"
      : tone === "accent"
      ? "text-accent"
      : "text-fg/90";
  return (
    <div className="flex items-center gap-2">
      {accent && (
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
        </span>
      )}
      <h2 className={`text-sm font-semibold ${toneClass}`}>{label}</h2>
      {typeof count === "number" && (
        <span className="rounded-md bg-card px-1.5 py-0.5 t-label ring-1 ring-hairline">{count}</span>
      )}
      <span className="ml-2 h-px flex-1 bg-gradient-to-r from-hairline via-hairline/40 to-transparent" />
    </div>
  );
}

function NewsMeta({ item }: { item: NewsFeedItem }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {item.symbol ? (
        <span className="inline-flex items-center rounded-md bg-brand/15 px-1.5 py-0.5 t-label text-brand ring-1 ring-brand/30">
          {item.symbol}
        </span>
      ) : null}
      <SourceBadge source={item.source ?? "web"} label={item.publisher} iconUrl={item.publisherIcon} />
      <FreshnessStamp ts={item.publishedAt} />
    </div>
  );
}

function BreakingHero({ item }: { item: NewsFeedItem }) {
  const link = smartReaderHref(item.url, { publisherDomain: item.publisherDomain, title: item.title });
  return (
    <Link
      href={link.href}
      className="group/hero surface relative flex flex-col overflow-hidden transition-colors duration-fast ease-out hover:border-brand/40"
    >
      <span className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-brand via-accent to-brand-2 opacity-80" />
      <div className="relative aspect-[16/8] w-full overflow-hidden">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            className="h-full w-full object-cover transition duration-700 group-hover/hero:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-brand/25 via-accent/15 to-brand-2/25" />
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand/95 px-2.5 py-1 t-label text-white shadow-e2">
          <Zap className="h-3 w-3" />
          Breaking
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <NewsMeta item={item} />
        <div className="text-lg font-semibold leading-snug text-fg md:text-xl">{item.title}</div>
        {item.description && (
          <p className="line-clamp-3 text-[13px] leading-relaxed t-muted">{item.description}</p>
        )}
        <div className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-medium text-brand">
          Read in-app
          <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}

function SubBreakingCard({ item }: { item: NewsFeedItem }) {
  const link = smartReaderHref(item.url, { publisherDomain: item.publisherDomain, title: item.title });
  return (
    <Link
      href={link.href}
      className="group/sub surface relative flex overflow-hidden transition-colors duration-fast ease-out hover:border-brand/40"
    >
      <div className="relative aspect-square w-32 shrink-0 overflow-hidden">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover/sub:scale-[1.06]"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-brand/20 via-accent/15 to-brand-2/20" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3">
        <div className="line-clamp-3 text-sm font-semibold leading-snug text-fg group-hover/sub:text-brand">
          {item.title}
        </div>
        <NewsMeta item={item} />
      </div>
    </Link>
  );
}

function ConnectCard({ item }: { item: NewsFeedItem }) {
  const link = smartReaderHref(item.url, { publisherDomain: item.publisherDomain, title: item.title });
  return (
    <Link
      href={link.href}
      className="group/card surface relative flex overflow-hidden transition-colors duration-fast ease-out hover:border-brand/40"
    >
      <span className="shine" />
      <div className="relative aspect-square w-28 shrink-0 overflow-hidden sm:w-32">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover/card:scale-[1.05]"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-brand/20 via-accent/15 to-brand-2/20" />
        )}
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col justify-between gap-2 p-3">
        <div className="line-clamp-3 text-sm font-semibold leading-snug text-fg/95 group-hover/card:text-fg">
          {item.title}
        </div>
        <NewsMeta item={item} />
      </div>
    </Link>
  );
}

function NewsCard({ item }: { item: NewsFeedItem }) {
  const link = smartReaderHref(item.url, { publisherDomain: item.publisherDomain, title: item.title });
  return (
    <Link
      href={link.href}
      className="group/card surface relative flex items-start gap-3 overflow-hidden p-3.5 transition-colors duration-fast ease-out hover:border-brand/40"
    >
      <span className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-brand via-accent to-brand-2 opacity-0 transition-opacity group-hover/card:opacity-100" />

      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          className="relative h-14 w-14 shrink-0 rounded-md border border-hairline object-cover sm:h-16 sm:w-16"
          loading="lazy"
        />
      ) : item.symbol ? (
        <span className="relative shrink-0">
          <StockLogo symbol={item.symbol} sector={item.sector} size="sm" />
        </span>
      ) : (
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand/20 via-accent/15 to-brand-2/20 ring-1 ring-hairline">
          <Newspaper className="h-4 w-4 text-brand" />
        </span>
      )}

      <div className="relative min-w-0 flex-1">
        <NewsMeta item={item} />
        <div className="mt-1.5 line-clamp-3 text-sm font-semibold leading-snug text-fg/95 transition-colors group-hover/card:text-fg">
          {item.title}
        </div>
      </div>

      <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 t-muted transition-colors duration-fast ease-out group-hover/card:text-brand" />
    </Link>
  );
}
