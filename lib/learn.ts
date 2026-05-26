import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkHtml from "remark-html";

export type LearnArticleMeta = {
  slug: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  publishedAt: string;
};

export type LearnArticle = LearnArticleMeta & {
  html: string;
};

const CONTENT_DIR = path.join(process.cwd(), "content", "learn");

function readArticleFile(slug: string): { data: any; content: string } | null {
  const file = path.join(CONTENT_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  return matter(raw);
}

function asMeta(slug: string, data: any): LearnArticleMeta {
  return {
    slug,
    title: String(data.title ?? slug),
    description: String(data.description ?? ""),
    category: String(data.category ?? "General"),
    readTime: String(data.readTime ?? "5 min"),
    publishedAt: String(data.publishedAt ?? ""),
  };
}

export async function getAllArticles(): Promise<LearnArticleMeta[]> {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));
  const out: LearnArticleMeta[] = [];
  for (const f of files) {
    const slug = f.replace(/\.md$/, "");
    const parsed = readArticleFile(slug);
    if (!parsed) continue;
    out.push(asMeta(slug, parsed.data));
  }
  return out.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export async function getArticle(slug: string): Promise<LearnArticle | null> {
  const parsed = readArticleFile(slug);
  if (!parsed) return null;
  const processed = await remark().use(remarkHtml).process(parsed.content);
  return { ...asMeta(slug, parsed.data), html: String(processed) };
}
