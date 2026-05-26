"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Search, Newspaper } from "lucide-react";
import { StockLogo } from "@/components/StockLogo";
import type { Sector } from "@/lib/nse-symbols";

export type NewsFeedItem = {
  symbol: string;
  name: string;
  sector: Sector;
  title: string;
  url: string;
  publisher: string;
  publishedAt: number;
};

function startOfDayIST(ts: number): number {
  // approx — IST is UTC+5:30
  const d = new Date(ts + 5.5 * 60 * 60 * 1000);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - 5.5 * 60 * 60 * 1000;
}

function bucket(ts: number): "today" | "yesterday" | "thisweek" | "earlier" {
  const today = startOfDayIST(Date.now());
  const itemDay = startOfDayIST(ts);
  const diffDays = Math.round((today - itemDay) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays <= 7) return "thisweek";
  return "earlier";
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const SECTION_LABELS: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisweek: "Earlier this week",
  earlier: "Older",
};

export function NewsFeedClient({ items }: { items: NewsFeedItem[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return items;
    return items.filter(
      (i) =>
        i.symbol.toLowerCase().includes(ql) ||
        i.name.toLowerCase().includes(ql) ||
        i.title.toLowerCase().includes(ql) ||
        i.publisher.toLowerCase().includes(ql),
    );
  }, [q, items]);

  const groups = useMemo(() => {
    const g: Record<string, NewsFeedItem[]> = { today: [], yesterday: [], thisweek: [], earlier: [] };
    for (const n of filtered) g[bucket(n.publishedAt)].push(n);
    return g;
  }, [filtered]);

  return (
    <div>
      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by symbol, company, headline or publisher…"
          className="w-full rounded-xl border border-border bg-card/60 py-3 pl-10 pr-4 text-sm shadow-soft focus:border-brand focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted">
          No news matches “{q}”.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {(["today", "yesterday", "thisweek", "earlier"] as const).map((k) =>
            groups[k].length === 0 ? null : (
              <section key={k}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted">
                  {SECTION_LABELS[k]}
                  <span className="rounded-md bg-card px-1.5 py-0.5 text-[10px] text-muted ring-1 ring-border">
                    {groups[k].length}
                  </span>
                </h2>
                <ul className="space-y-2.5">
                  {groups[k].map((n, i) => {
                    const hasSymbol = !!n.symbol;
                    return (
                      <li key={`${n.symbol}-${n.url}-${i}`}>
                        <a
                          href={n.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="surface group/card relative flex items-start gap-3 overflow-hidden rounded-2xl border border-border bg-card/60 p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-pop"
                        >
                          <span className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-brand via-accent to-brand-2 opacity-0 transition-opacity group-hover/card:opacity-100" />
                          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent transition-transform duration-700 group-hover/card:translate-x-full" />

                          {hasSymbol ? (
                            <Link
                              href={`/stock/${n.symbol}`}
                              onClick={(e) => e.stopPropagation()}
                              className="relative shrink-0"
                            >
                              <StockLogo symbol={n.symbol} sector={n.sector} size="sm" />
                            </Link>
                          ) : (
                            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand/20 via-accent/15 to-brand-2/20 ring-1 ring-border">
                              <Newspaper className="h-4 w-4 text-brand" />
                            </span>
                          )}

                          <div className="relative min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {hasSymbol ? (
                                <Link
                                  href={`/stock/${n.symbol}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-brand ring-1 ring-brand/30 transition hover:bg-brand/25"
                                >
                                  {n.symbol}
                                </Link>
                              ) : (
                                <span className="inline-flex items-center rounded-md bg-bg-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted ring-1 ring-border">
                                  Market
                                </span>
                              )}
                              <span className="inline-flex items-center rounded-md bg-bg-2/60 px-1.5 py-0.5 text-[10px] font-medium text-fg/80 ring-1 ring-border">
                                {n.publisher}
                              </span>
                              <span className="text-[10px] tabular-nums text-muted">·</span>
                              <span className="text-[10px] tabular-nums text-muted">{timeAgo(n.publishedAt)}</span>
                            </div>
                            <div className="mt-1.5 text-sm font-semibold leading-snug text-fg/95 transition-colors group-hover/card:text-fg">
                              {n.title}
                            </div>
                          </div>

                          <span className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bg-2/60 text-muted ring-1 ring-border transition group-hover/card:bg-brand/10 group-hover/card:text-brand group-hover/card:ring-brand/30">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ),
          )}
        </div>
      )}
    </div>
  );
}
