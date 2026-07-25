import Link from "next/link";
import { getMarketNews } from "@/lib/news";
import { smartReaderHref, externalLinkProps } from "@/lib/news/href";
import { FreshnessStamp } from "@/components/ui/FreshnessStamp";

const MAX = 8;

export async function TodayColumn({ excludeUrl }: { excludeUrl?: string }) {
  const items = await getMarketNews(20).catch(() => []);
  const filtered = items.filter((n) => n.url !== excludeUrl).slice(0, MAX);
  if (filtered.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">Today</div>
      <ul className="space-y-2.5">
        {filtered.map((n) => {
          const link = smartReaderHref(n.url, { publisherDomain: n.publisherDomain, title: n.title });
          return (
            <li key={n.url}>
              <Link
                href={link.href}
                {...externalLinkProps(link)}
                className="group block rounded-lg border border-transparent px-2 py-2 transition hover:border-border hover:bg-bg-2/40"
              >
                <div className="line-clamp-3 text-[13px] font-medium leading-snug text-fg/90 group-hover:text-fg">
                  {n.title}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted">
                  <span>{n.publisher}</span>
                  <span>·</span>
                  <FreshnessStamp ts={n.publishedAt} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
