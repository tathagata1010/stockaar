import Link from "next/link";
import { getAllArticles } from "@/lib/learn";
import { Disclaimer } from "@/components/Disclaimer";
import { BookOpen, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const revalidate = 3600;

const CATEGORY_TINTS: Record<string, string> = {
  Basics: "chip-brand",
  Markets: "chip-accent",
  Valuation: "chip-warning",
  Strategy: "chip-brand",
  Tax: "chip-warning",
  Fundamentals: "chip-accent",
};

export default async function LearnIndexPage() {
  const articles = await getAllArticles();

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-6 shadow-glow md:p-10">
        <div className="chip chip-brand mb-3">
          <BookOpen className="h-3 w-3" />
          Learn Hub
        </div>
        <h1 className="num-display text-4xl font-bold tracking-tight md:text-5xl">
          Investing, <span className="text-gradient-animate">explained simply</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted md:text-base">
          Plain-English guides for Indian retail investors. From opening your first demat account to reading a balance sheet.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((a, i) => (
          <Link
            key={a.slug}
            href={`/learn/${a.slug}`}
            className={cn(
              "group surface-strong hover-lift fade-up rounded-2xl border border-border p-5 shadow-soft transition",
              `fade-up-${(i % 4) + 1}`,
            )}
          >
            <div className="flex items-center justify-between">
              <span className={cn("chip", CATEGORY_TINTS[a.category] ?? "chip-brand")}>{a.category}</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                <Clock className="h-3 w-3" />
                {a.readTime}
              </span>
            </div>
            <h2 className="mt-3 text-lg font-bold leading-snug tracking-tight">{a.title}</h2>
            <p className="mt-2 line-clamp-3 text-sm text-muted">{a.description}</p>
            <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand group-hover:gap-2 transition-all">
              Read article <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        ))}
      </section>

      {articles.length === 0 && (
        <p className="mt-8 rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted">
          No articles published yet.
        </p>
      )}

      <Disclaimer className="mt-10" />
    </main>
  );
}
