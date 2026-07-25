import Link from "next/link";
import { getStockNews, type NewsItem } from "@/lib/news";
import { Newspaper, ExternalLink } from "lucide-react";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { FreshnessStamp } from "@/components/ui/FreshnessStamp";
import { smartReaderHref, externalLinkProps } from "@/lib/news/href";
import { CollapsibleGroup } from "@/components/ui/CollapsibleGroup";

const INITIAL_REST = 4;

export async function NewsSection({
  symbol,
  exchange = "NSE",
  limit = 6,
}: {
  symbol: string;
  exchange?: "NSE" | "BSE";
  limit?: number;
}) {
  const items = await getStockNews(symbol, exchange, limit);
  const lead = items.find((n) => n.imageUrl);
  const rest = items.filter((n) => n !== lead);
  const leadLink = lead ? smartReaderHref(lead.url, { publisherDomain: lead.publisherDomain, title: lead.title }) : null;
  const restHead = rest.slice(0, INITIAL_REST);
  const restTail = rest.slice(INITIAL_REST);

  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand/15 text-brand">
            <Newspaper className="h-4 w-4" />
          </span>
          Recent News
        </div>
        <span className="t-caption t-muted">Fresh reads</span>
      </div>
      {items.length === 0 ? (
        <div className="p-5 t-body t-muted">No recent news for {symbol}.</div>
      ) : (
        <div>
          {lead && leadLink && (
            <Link
              href={leadLink.href}
              {...externalLinkProps(leadLink)}
              className="group/lead flex flex-col gap-3 border-b border-hairline p-4 transition-colors duration-fast ease-out hover:bg-bg/60 sm:flex-row sm:items-start sm:p-5"
            >
              {lead.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lead.imageUrl}
                  alt=""
                  className="aspect-[16/9] w-full shrink-0 rounded-md border border-hairline object-cover sm:aspect-square sm:h-28 sm:w-28"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="line-clamp-3 text-sm font-semibold leading-snug group-hover/lead:text-brand">
                  {lead.title}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <SourceBadge source={lead.source ?? "web"} label={lead.publisher} iconUrl={lead.publisherIcon} />
                  <FreshnessStamp ts={lead.publishedAt} />
                </div>
              </div>
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 t-muted" />
            </Link>
          )}
          <div className="divide-y divide-hairline">
            <CollapsibleGroup
              moreLabel={`Show ${restTail.length} more headline${restTail.length === 1 ? "" : "s"}`}
              head={<>{restHead.map((n) => <NewsRow key={n.url} item={n} />)}</>}
              tail={restTail.map((n) => <NewsRow key={n.url} item={n} />)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function NewsRow({ item: n }: { item: NewsItem }) {
  const link = smartReaderHref(n.url, { publisherDomain: n.publisherDomain, title: n.title });
  return (
    <Link
      href={link.href}
      {...externalLinkProps(link)}
      className="flex items-start justify-between gap-3 px-4 py-3 transition-colors duration-fast ease-out hover:bg-bg/60 sm:px-5 sm:py-3.5"
    >
      {n.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={n.imageUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-md border border-hairline object-cover"
          loading="lazy"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-sm font-medium leading-snug">{n.title}</div>
        <div className="mt-1 flex items-center gap-2">
          <SourceBadge source={n.source ?? "web"} label={n.publisher} iconUrl={n.publisherIcon} />
          <FreshnessStamp ts={n.publishedAt} />
        </div>
      </div>
      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 t-muted" />
    </Link>
  );
}
