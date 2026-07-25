import { getServiceClient } from "@/lib/supabase/service";
import { slugifyTitle } from "@/lib/news/href";

export type StoredArticle = {
  url: string;
  title: string;
  publisher: string;
  publisherDomain: string | null;
  publishedAt: number;
  imageUrl: string | null;
  description: string | null;
  contentHtml: string | null;
  tickers: string[];
};

type Row = {
  url: string;
  canonical_url: string | null;
  title: string;
  publisher: string;
  publisher_domain: string | null;
  published_at: string;
  image_url: string | null;
  description: string | null;
  content_html: string | null;
  tickers: string[] | null;
};

function rowToStored(r: Row): StoredArticle {
  return {
    url: r.url,
    title: r.title,
    publisher: r.publisher,
    publisherDomain: r.publisher_domain,
    publishedAt: new Date(r.published_at).getTime(),
    imageUrl: r.image_url,
    description: r.description,
    contentHtml: r.content_html,
    tickers: r.tickers ?? [],
  };
}

export async function getStoredArticle(url: string): Promise<StoredArticle | null> {
  const supa = getServiceClient();
  if (!supa) return null;
  const { data, error } = await supa
    .from("news_articles")
    .select("url,canonical_url,title,publisher,publisher_domain,published_at,image_url,description,content_html,tickers")
    .eq("url", url)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return rowToStored(data as Row);
}

export async function getStoredArticleBySlug(
  publisherDomain: string,
  slug: string,
): Promise<StoredArticle | null> {
  const supa = getServiceClient();
  if (!supa) return null;
  const domain = publisherDomain.toLowerCase().replace(/^www\./, "");
  const cutoff = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supa
    .from("news_articles")
    .select("url,canonical_url,title,publisher,publisher_domain,published_at,image_url,description,content_html,tickers")
    .eq("publisher_domain", domain)
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false })
    .limit(500);
  if (error || !data) return null;
  const match = (data as Row[]).find((r) => slugifyTitle(r.title) === slug);
  return match ? rowToStored(match) : null;
}
