import Link from "next/link";
import {
  Stethoscope, Bell, Newspaper, Layers3, Star, Flame,
  Sparkles, Target, LineChart, ShoppingCart, Compass,
} from "lucide-react";
import { NSE_SYMBOLS_LITE } from "@/lib/nse-symbols-lite";

type Kind =
  | "stock"     // a specific ticker page / stock context
  | "reader"    // reading an article; may or may not have a stock context
  | "news"      // /news market feed
  | "sector"    // /sectors/[sector]
  | "trending"  // /trending
  | "market";   // dashboard / general

export type RelatedSurfacesProps = {
  kind: Kind;
  contextSymbol?: string | null;
  contextName?: string | null;
  sector?: string | null;
  className?: string;
};

type Card = {
  href: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
};

function symbolMeta(sym?: string | null) {
  if (!sym) return null;
  return NSE_SYMBOLS_LITE.find((s) => s.symbol === sym) ?? null;
}

function buildCards({ kind, contextSymbol, contextName, sector }: RelatedSurfacesProps): Card[] {
  const meta = symbolMeta(contextSymbol);
  const name = contextName ?? meta?.name ?? contextSymbol ?? "";
  const sec = sector ?? meta?.sector ?? null;

  const cards: Card[] = [];

  if (contextSymbol) {
    if (kind !== "stock") {
      cards.push({
        href: `/stock/${contextSymbol}`,
        label: `${name || contextSymbol} page`,
        desc: "Price · fundamentals · scorecard",
        icon: LineChart,
      });
    }
    cards.push({
      href: `/tools/doctor?symbol=${contextSymbol}`,
      label: "Doctor verdict",
      desc: `Should you hold ${contextSymbol}?`,
      icon: Stethoscope,
    });
    cards.push({
      href: `/alerts?symbol=${contextSymbol}`,
      label: "Set an alert",
      desc: "Price · move · news · volume",
      icon: Bell,
    });
    cards.push({
      href: `/watchlist?add=${contextSymbol}`,
      label: "Add to watchlist",
      desc: "Track in one glance",
      icon: Star,
    });
    cards.push({
      href: `/tools/should-i-buy?symbol=${contextSymbol}`,
      label: "Should I buy?",
      desc: "Instant verdict",
      icon: ShoppingCart,
    });
  }

  if (sec) {
    cards.push({
      href: `/sectors/${encodeURIComponent(sec)}`,
      label: `${sec} sector`,
      desc: "Peers · momentum · leaders",
      icon: Layers3,
    });
  }

  if (kind !== "news") {
    cards.push({
      href: contextSymbol ? `/news?stock=${contextSymbol}` : "/news",
      label: contextSymbol ? `${contextSymbol} news` : "Market news",
      desc: "Fresh, filtered, sourced",
      icon: Newspaper,
    });
  }

  if (kind !== "trending") {
    cards.push({
      href: "/trending",
      label: "Trending on Reddit",
      desc: "What retail is buzzing about",
      icon: Flame,
    });
  }

  if (kind === "market" || kind === "reader" || kind === "news") {
    cards.push({
      href: "/hot-stocks",
      label: "Hot stocks",
      desc: "Volume + momentum picks",
      icon: Sparkles,
    });
    cards.push({
      href: "/calls",
      label: "Stock calls",
      desc: "Buy · Hold · Caution signals",
      icon: Target,
    });
  }

  if (kind !== "sector" && !contextSymbol) {
    cards.push({
      href: "/sectors",
      label: "Sector heatmap",
      desc: "Where money is flowing",
      icon: Layers3,
    });
  }

  // Cap so the strip stays tight — 6 cards fits nicely on a 2-3 col grid.
  return cards.slice(0, 6);
}

const HEADINGS: Record<Kind, { chip: string; title: string; sub: string }> = {
  stock: {
    chip: "Keep exploring",
    title: "Next moves for this stock",
    sub: "Turn this research into action — one click each.",
  },
  reader: {
    chip: "Related surfaces",
    title: "Where this fits in your workflow",
    sub: "Follow the thread — from headline to portfolio.",
  },
  news: {
    chip: "Related surfaces",
    title: "Turn news into a decision",
    sub: "Which stocks moved? What do the signals say?",
  },
  sector: {
    chip: "Related surfaces",
    title: "Zoom in from the sector",
    sub: "Drill into leaders, news and setups.",
  },
  trending: {
    chip: "Related surfaces",
    title: "From chatter to conviction",
    sub: "Cross-check the buzz with fundamentals.",
  },
  market: {
    chip: "Explore",
    title: "Everywhere else worth a look",
    sub: "Handpicked jumps into the rest of the app.",
  },
};

export function RelatedSurfaces(props: RelatedSurfacesProps) {
  const cards = buildCards(props);
  if (cards.length === 0) return null;
  const h = HEADINGS[props.kind];

  return (
    <section
      className={
        "mt-10 overflow-hidden rounded-3xl border border-border-strong bg-card/60 shadow-soft " +
        (props.className ?? "")
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="chip chip-brand mb-2">
            <Compass className="h-3 w-3" />
            {h.chip}
          </div>
          <h2 className="text-lg font-semibold tracking-tight">{h.title}</h2>
          <p className="mt-1 text-xs text-muted">{h.sub}</p>
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <li key={c.href + c.label} className="group border-b border-border last:border-b-0 sm:border-b sm:[&:nth-last-child(-n+2)]:border-b lg:[&:nth-last-child(-n+3)]:border-b-0 sm:odd:border-r sm:even:border-r-0 lg:sm:odd:border-r lg:[&:nth-child(3n)]:border-r-0 lg:[&:not(:nth-child(3n))]:border-r">
              <Link
                href={c.href}
                className="flex items-start gap-3 p-4 transition-colors hover:bg-card"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/20 transition group-hover:bg-brand/20">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight">{c.label}</div>
                  <div className="mt-0.5 text-[11px] text-muted">{c.desc}</div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
