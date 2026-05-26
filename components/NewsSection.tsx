import { getStockNews } from "@/lib/news";
import { Newspaper, ExternalLink } from "lucide-react";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

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

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/15 text-brand">
            <Newspaper className="h-4 w-4" />
          </span>
          Recent News
        </div>
        <span className="text-[11px] text-muted">{items.length} stories</span>
      </div>
      {items.length === 0 ? (
        <div className="p-5 text-sm text-muted">No recent news for {symbol}.</div>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((n) => (
            <li key={n.url}>
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-bg/60 sm:px-5 sm:py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-medium leading-snug">{n.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                    <span>{n.publisher}</span>
                    <span>·</span>
                    <span className="tabular-nums">{timeAgo(n.publishedAt)}</span>
                  </div>
                </div>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
