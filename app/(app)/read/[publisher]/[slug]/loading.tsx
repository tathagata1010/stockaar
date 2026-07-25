import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function ReaderLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 sm:py-6">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-[11px] text-muted">
        <Link href="/news" className="inline-flex items-center gap-1 hover:text-fg">
          <ArrowLeft className="h-3 w-3" /> News
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="h-3 w-24 animate-pulse rounded bg-white/10" />
      </nav>
      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_360px]">
        <aside className="hidden xl:block">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        </aside>
        <main className="min-w-0">
          <article className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="h-[240px] w-full animate-pulse bg-white/5 sm:h-[320px]" />
            <div className="space-y-4 p-5 sm:p-8">
              <div className="h-8 w-4/5 animate-pulse rounded bg-white/10" />
              <div className="h-8 w-2/3 animate-pulse rounded bg-white/10" />
              <div className="mt-6 rounded-xl border border-border bg-card/60 p-5">
                <div className="mb-3 h-3 w-24 animate-pulse rounded-full bg-white/10" />
                <div className="space-y-2">
                  <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                  <div className="h-3 w-11/12 animate-pulse rounded bg-white/5" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-white/5" />
                </div>
              </div>
              <div className="space-y-2 pt-6">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-3 animate-pulse rounded bg-white/5 ${i % 3 === 2 ? "w-3/4" : "w-full"}`}
                  />
                ))}
              </div>
            </div>
          </article>
        </main>
        <aside className="hidden lg:block">
          <div className="flex h-full flex-col gap-4">
            <div className="rounded-2xl border border-border bg-card/60 p-4">
              <div className="mb-3 h-3 w-32 animate-pulse rounded-full bg-white/10" />
              <div className="space-y-2">
                <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                <div className="h-3 w-11/12 animate-pulse rounded bg-white/5" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
              </div>
            </div>
            <div className="flex-1 min-h-[520px] rounded-2xl border border-border bg-card/60 p-4">
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-3 w-full animate-pulse rounded bg-white/5" />
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
