import Link from "next/link";
import { Building2, Globe2, Zap, TrendingUp } from "lucide-react";
import type { NewsItem } from "@/lib/news";
import { smartReaderHref } from "@/lib/news/href";
import { FreshnessStamp } from "@/components/ui/FreshnessStamp";

type Bucket = "markets" | "earnings" | "ipos" | "global";

function classify(title: string): Bucket {
  const t = title.toLowerCase();
  if (/\bipo\b|listing|dr?hp|red herring|price band|subscribed|lot size/.test(t)) return "ipos";
  if (/q[1-4]\b|earnings|results|profit|revenue|ebitda|guidance|consensus|beats|misses/.test(t)) return "earnings";
  if (/\b(us|fed|china|europe|global|dollar|opec|treasury|imf|world bank|crude|brent|nasdaq|dow)\b/.test(t)) return "global";
  return "markets";
}

const RAIL_CONFIG: {
  key: Bucket;
  title: string;
  Icon: typeof Zap;
  accent: string;
}[] = [
  { key: "markets", title: "Markets by fuzz", Icon: TrendingUp, accent: "from-brand/20 to-brand/5" },
  { key: "earnings", title: "Earnings", Icon: Building2, accent: "from-accent/20 to-accent/5" },
  { key: "ipos", title: "IPO Corner", Icon: Zap, accent: "from-brand-2/20 to-brand-2/5" },
  { key: "global", title: "Global News", Icon: Globe2, accent: "from-warn/20 to-warn/5" },
];

export function NewsSideRail({ items }: { items: NewsItem[] }) {
  const buckets: Record<Bucket, NewsItem[]> = { markets: [], earnings: [], ipos: [], global: [] };
  for (const n of items) buckets[classify(n.title)].push(n);

  return (
    <div className="space-y-4">
      {RAIL_CONFIG.map(({ key, title, Icon, accent }) => {
        const list = buckets[key].slice(0, 3);
        if (list.length === 0) return null;
        return (
          <div
            key={key}
            className={`rounded-2xl border border-border bg-gradient-to-br ${accent} shadow-soft`}
          >
            <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-card/80 text-brand ring-1 ring-border">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="text-xs font-semibold">{title}</div>
            </div>
            <ul className="divide-y divide-border/50">
              {list.map((n) => {
                const link = smartReaderHref(n.url, { publisherDomain: n.publisherDomain, title: n.title });
                return (
                  <li key={n.url}>
                    <Link
                      href={link.href}
                      className="group flex items-start gap-2.5 px-3 py-2.5 transition hover:bg-card/60"
                    >
                      {n.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={n.imageUrl}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card/80 ring-1 ring-border">
                          <Icon className="h-4 w-4 text-brand/70" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[12px] font-medium leading-snug text-fg/95 group-hover:text-fg">
                          {n.title}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted">
                          <span className="truncate">{n.publisher}</span>
                          <span>·</span>
                          <FreshnessStamp ts={n.publishedAt} />
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
