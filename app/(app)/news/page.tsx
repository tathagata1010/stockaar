import { getMarketNews } from "@/lib/news";
import { Disclaimer } from "@/components/Disclaimer";
import { NewsFeedClient, type NewsFeedItem } from "@/components/NewsFeedClient";
import { Newspaper, Sparkles } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";

export const revalidate = 900;

export default async function NewsPage() {
  const news = await getMarketNews(60);

  const items: NewsFeedItem[] = news.map((n) => ({
    symbol: "",
    name: "Indian markets",
    sector: "Other",
    title: n.title,
    url: n.url,
    publisher: n.publisher,
    publishedAt: n.publishedAt,
  }));

  const freshest = items[0]?.publishedAt;
  const freshness = freshest
    ? new Date(freshest).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <AppShell>
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-4 shadow-glow sm:p-6 md:p-8 lg:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="chip chip-brand mb-3">
              <Sparkles className="h-3 w-3" />
              Indian markets · multi-source
            </div>
            <h1 className="num-display text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
              Market <span className="text-gradient-animate">News Feed</span>
            </h1>
            <p className="mt-3 text-xs text-muted sm:text-sm md:text-base">
              Headlines on Nifty, Sensex, IPOs, and the Indian economy. For stock-specific news, open any stock page.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 rounded-xl border border-border bg-card/60 px-4 py-2 backdrop-blur">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Newspaper className="h-3.5 w-3.5" />
              Stories
            </div>
            <div className="num-display text-2xl font-bold tabular-nums text-gradient-static">
              {items.length}
            </div>
            <div className="text-[10px] text-muted">Latest at {freshness} IST</div>
          </div>
        </div>
      </section>

      <NewsFeedClient items={items} />

      <Disclaimer className="mt-10" />
    </AppShell>
  );
}
