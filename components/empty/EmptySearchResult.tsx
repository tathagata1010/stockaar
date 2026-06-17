import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";

export function EmptySearchResult({
  query,
  noun = "results",
  suggestions = [],
}: {
  query: string;
  noun?: string;
  suggestions?: string[];
}) {
  return (
    <div className="surface relative overflow-hidden p-8 text-center">
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand via-brand-2 to-accent" />
      <div className="relative mx-auto flex max-w-md flex-col items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/30">
          <Search className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-fg">
            No {noun} match &ldquo;{query}&rdquo;
          </p>
          <p className="mt-1 text-xs text-muted">
            Try a shorter phrase, or use the global header search to jump straight to a stock.
          </p>
        </div>
        {suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {suggestions.map((s) => (
              <Link
                key={s}
                href={`/stock/${s}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-brand/40 hover:text-brand"
              >
                {s} <ArrowRight className="h-3 w-3" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
