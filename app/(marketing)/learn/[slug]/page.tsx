import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllArticles, getArticle } from "@/lib/learn";
import { Disclaimer } from "@/components/Disclaimer";
import { ArrowLeft, Clock, Calendar } from "lucide-react";

export const revalidate = 3600;

export async function generateStaticParams() {
  const all = await getAllArticles();
  return all.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const a = await getArticle(params.slug);
  if (!a) return {};
  return { title: `${a.title} · Stocksbrew Learn`, description: a.description };
}

export default async function LearnArticlePage({ params }: { params: { slug: string } }) {
  const article = await getArticle(params.slug);
  if (!article) notFound();

  const pretty = (s: string) => {
    if (!s) return "";
    try { return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }); }
    catch { return s; }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/learn" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-brand">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Learn
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span className="chip chip-brand">{article.category}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{article.readTime}</span>
          {article.publishedAt && (
            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{pretty(article.publishedAt)}</span>
          )}
        </div>
        <h1 className="num-display mt-4 text-4xl font-bold tracking-tight md:text-5xl">{article.title}</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">{article.description}</p>
      </header>

      <article
        className="learn-prose mt-10"
        dangerouslySetInnerHTML={{ __html: article.html }}
      />

      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card/60 p-5">
        <div>
          <div className="text-[10px] uppercase text-muted">Up next</div>
          <div className="mt-1 text-sm font-semibold">Explore more guides in the Learn Hub</div>
        </div>
        <Link href="/learn" className="btn-brand">All articles →</Link>
      </div>

      <Disclaimer className="mt-10" />

      {/* Inline scoped typography for the rendered markdown */}
      <style>{`
        .learn-prose { color: hsl(var(--fg, 0 0% 90%)); line-height: 1.75; font-size: 1.0625rem; }
        .learn-prose h2 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.01em; margin-top: 2.25rem; margin-bottom: 1rem; }
        .learn-prose h3 { font-size: 1.15rem; font-weight: 700; margin-top: 1.75rem; margin-bottom: 0.75rem; }
        .learn-prose p { margin-top: 1rem; margin-bottom: 1rem; }
        .learn-prose ul, .learn-prose ol { margin: 1rem 0 1rem 1.25rem; }
        .learn-prose ul { list-style: disc; }
        .learn-prose ol { list-style: decimal; }
        .learn-prose li { margin-top: 0.4rem; }
        .learn-prose li > p { margin: 0; }
        .learn-prose strong { font-weight: 700; color: inherit; }
        .learn-prose code { background: hsl(var(--card, 0 0% 12%)); padding: 0.15rem 0.4rem; border-radius: 0.35rem; font-size: 0.9em; }
        .learn-prose pre { background: hsl(var(--card, 0 0% 12%)); padding: 1rem; border-radius: 0.75rem; overflow-x: auto; margin: 1.25rem 0; font-size: 0.9rem; line-height: 1.5; }
        .learn-prose pre code { background: transparent; padding: 0; }
        .learn-prose table { width: 100%; border-collapse: collapse; margin: 1.25rem 0; font-size: 0.95rem; }
        .learn-prose th, .learn-prose td { text-align: left; padding: 0.6rem 0.75rem; border-bottom: 1px solid hsl(var(--border, 0 0% 20%)); }
        .learn-prose th { font-weight: 600; color: hsl(var(--muted, 0 0% 60%)); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .learn-prose blockquote { border-left: 3px solid hsl(var(--brand, 220 70% 60%)); padding-left: 1rem; margin: 1rem 0; color: hsl(var(--muted, 0 0% 60%)); font-style: italic; }
        .learn-prose a { color: hsl(var(--brand, 220 70% 60%)); text-decoration: underline; text-underline-offset: 2px; }
        .learn-prose hr { border: 0; border-top: 1px solid hsl(var(--border, 0 0% 20%)); margin: 2rem 0; }
      `}</style>
    </main>
  );
}
