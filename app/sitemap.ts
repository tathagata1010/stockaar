import type { MetadataRoute } from "next";
import { NSE_SYMBOLS } from "@/lib/nse-symbols";
import { INDICES } from "@/lib/market";
import { getAllArticles } from "@/lib/learn";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stockaar.vercel.app";

const STATIC_ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1.0 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
  { path: "/learn", changeFrequency: "weekly", priority: 0.9 },
  { path: "/dashboard", changeFrequency: "hourly", priority: 0.8 },
  { path: "/hot-stocks", changeFrequency: "hourly", priority: 0.8 },
  { path: "/screener", changeFrequency: "daily", priority: 0.7 },
  { path: "/calls", changeFrequency: "daily", priority: 0.7 },
  { path: "/anomalies", changeFrequency: "hourly", priority: 0.6 },
  { path: "/sectors", changeFrequency: "daily", priority: 0.6 },
  { path: "/news", changeFrequency: "hourly", priority: 0.6 },
  { path: "/calendar", changeFrequency: "daily", priority: 0.5 },
  { path: "/trending", changeFrequency: "hourly", priority: 0.6 },
  { path: "/tools/portfolio", changeFrequency: "monthly", priority: 0.5 },
  { path: "/tools/rsi", changeFrequency: "monthly", priority: 0.5 },
  { path: "/tools/should-i-buy", changeFrequency: "monthly", priority: 0.5 },
  { path: "/about", changeFrequency: "monthly", priority: 0.4 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.4 },
  { path: "/disclaimer", changeFrequency: "yearly", priority: 0.2 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
  { path: "/refund-policy", changeFrequency: "yearly", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const stockEntries: MetadataRoute.Sitemap = NSE_SYMBOLS.map((s) => ({
    url: `${SITE_URL}/stock/${s.symbol}`,
    lastModified: now,
    changeFrequency: "hourly",
    priority: 0.7,
  }));

  const indexEntries: MetadataRoute.Sitemap = INDICES.map((i) => ({
    url: `${SITE_URL}/indices/${i.slug}`,
    lastModified: now,
    changeFrequency: "hourly",
    priority: 0.8,
  }));

  let learnEntries: MetadataRoute.Sitemap = [];
  try {
    const articles = await getAllArticles();
    learnEntries = articles.map((a) => ({
      url: `${SITE_URL}/learn/${a.slug}`,
      lastModified: a.publishedAt ? new Date(a.publishedAt) : now,
      changeFrequency: "monthly",
      priority: 0.6,
    }));
  } catch {}

  return [...staticEntries, ...indexEntries, ...stockEntries, ...learnEntries];
}
