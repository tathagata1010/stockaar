import { getMarketNews } from "@/lib/news";
import { NewsFeedClient, type NewsFeedItem } from "@/components/NewsFeedClient";
import { NewsSideRail } from "@/components/NewsSideRail";
import { PageFooter } from "@/components/PageFooter";

export const revalidate = 900;

export const metadata = {
  title: "Indian Market News — Latest NSE & BSE Headlines",
  description: "Latest news from Indian stock markets — NSE, BSE, earnings, IPOs, RBI policy, and global cues that move Indian stocks.",
  alternates: { canonical: "/news" },
  keywords: ["Indian stock market news", "NSE news", "BSE news today", "share market news India"],
};

export default async function NewsPage() {
  const news = await getMarketNews(200);

  const items: NewsFeedItem[] = news.map((n) => ({
    symbol: "",
    name: "Indian markets",
    sector: "Other",
    title: n.title,
    url: n.url,
    publisher: n.publisher,
    publisherDomain: n.publisherDomain,
    publishedAt: n.publishedAt,
    imageUrl: n.imageUrl,
    publisherIcon: n.publisherIcon,
    source: n.source,
    description: n.description,
  }));

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 sm:py-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0">
          <NewsFeedClient items={items} />
          <PageFooter kind="news" />
        </main>
        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
          <NewsSideRail items={news} />
        </aside>
      </div>
    </div>
  );
}
