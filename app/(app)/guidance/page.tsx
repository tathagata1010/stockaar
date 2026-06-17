import { Suspense } from "react";
import Link from "next/link";
import { getRecentGuidance, type GuidanceFeedRow } from "@/lib/guidance";
import { Disclaimer } from "@/components/Disclaimer";
import { InPageSearch } from "@/components/InPageSearch";
import { EmptySearchResult } from "@/components/empty/EmptySearchResult";
import { LiveGuidancePing } from "@/components/guidance/LiveGuidancePing";
import { Sparkles, TrendingUp, TrendingDown, Minus, Shuffle, ExternalLink, Clock, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 120;

export const metadata = {
  title: "Concall Guidance Tracker — What Indian CEOs Just Said",
  description:
    "Forward-looking management guidance from NSE & BSE concall transcripts and investor presentations — extracted verbatim and indexed for retail investors.",
  alternates: { canonical: "/guidance" },
  keywords: [
    "concall guidance India",
    "investor presentation tracker",
    "management guidance NSE",
    "BSE earnings call transcript",
    "stock guidance India",
  ],
};

type Direction = "up" | "down" | "flat" | "mixed";
const ALL_DIRECTIONS: Direction[] = ["up", "down", "flat", "mixed"];

const DIR_META: Record<Direction, { label: string; short: string; icon: typeof TrendingUp; tone: string }> = {
  up:    { label: "Guidance up",    short: "Up",    icon: TrendingUp,   tone: "text-accent border-accent/40 bg-accent/10" },
  down:  { label: "Guidance down",  short: "Down",  icon: TrendingDown, tone: "text-danger border-danger/40 bg-danger/10" },
  flat:  { label: "Flat",           short: "Flat",  icon: Minus,        tone: "text-muted border-border bg-bg-2" },
  mixed: { label: "Mixed",          short: "Mixed", icon: Shuffle,      tone: "text-warning border-warning/40 bg-warning/10" },
};

const CATEGORY_LABEL: Record<string, string> = {
  concall_transcript: "Concall transcript",
  investor_presentation: "Investor presentation",
  business_update: "Business update",
  press_release: "Press release",
};

type StockGroup = {
  symbol: string;
  companyName: string | null;
  signals: GuidanceFeedRow[];
  latestFiledAt: string;
  dominantDirection: Direction;
  counts: Record<Direction, number>;
};

export default async function GuidancePage(props: { searchParams: Promise<{ dir?: string; q?: string }> }) {
  const searchParams = await props.searchParams;
  const dirParam = (searchParams.dir ?? "").toLowerCase();
  const direction = (ALL_DIRECTIONS as string[]).includes(dirParam) ? (dirParam as Direction) : undefined;
  const query = (searchParams.q ?? "").trim();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <LiveGuidancePing />
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-[11px] font-semibold text-brand">
          <Sparkles className="h-3 w-3" />
          New · Star feature
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Guidance Tracker</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          What Indian listed-company management is <em className="not-italic font-semibold text-fg">actually saying</em> about the future — extracted verbatim from concall transcripts, investor presentations, and corporate filings. One card per stock; all recent signals merged.
        </p>
      </header>

      <div className="mb-4 max-w-xl">
        <InPageSearch
          placeholder="Filter by company, symbol, metric or quoted phrase…"
          hint="Tip: try “margin”, “capex”, or a ticker like RELIANCE."
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <FilterChip href={hrefWithQuery({ dir: undefined, q: query })} active={!direction} label="All" />
        {ALL_DIRECTIONS.map((d) => (
          <FilterChip
            key={d}
            href={hrefWithQuery({ dir: d, q: query })}
            active={direction === d}
            label={DIR_META[d].label}
            tone={DIR_META[d].tone}
          />
        ))}
      </div>

      <Suspense fallback={<Skeleton />} key={`${direction ?? ""}|${query}`}>
        <Feed direction={direction} query={query} />
      </Suspense>

      <div className="mt-8">
        <Disclaimer />
        <p className="mt-3 text-[11px] text-muted">
          Signals are AI-extracted from publicly filed corporate disclosures. Always verify against the linked source document before making any decision.
        </p>
      </div>
    </main>
  );
}

function hrefWithQuery({ dir, q }: { dir?: Direction; q?: string }): string {
  const params = new URLSearchParams();
  if (dir) params.set("dir", dir);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/guidance?${qs}` : "/guidance";
}

function FilterChip({ href, active, label, tone }: { href: string; active: boolean; label: string; tone?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-semibold transition",
        active
          ? tone ?? "border-brand/50 bg-brand/15 text-brand shadow-glow"
          : "border-border bg-card/60 text-muted hover:border-brand/40 hover:text-fg",
      )}
    >
      {label}
    </Link>
  );
}

async function Feed({ direction, query }: { direction?: Direction; query: string }) {
  // Pull a wide window so we get at least ~50 distinct stocks even after dir filter.
  const rows = await getRecentGuidance({ limit: 600, direction });
  const filtered = filterRows(rows, query);

  if (rows.length === 0) {
    return (
      <div className="surface relative overflow-hidden p-10 text-center">
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand via-brand-2 to-accent" />
        <FileText className="mx-auto mb-3 h-8 w-8 text-muted" />
        <p className="text-sm font-medium text-fg">No guidance signals yet</p>
        <p className="mt-1 text-xs text-muted">
          The first ingest cron will populate this feed within a few hours of the next earnings concall window.
        </p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return <EmptySearchResult query={query} noun="signals" suggestions={["RELIANCE", "INFY", "HDFCBANK"]} />;
  }

  const stocks = groupBySymbol(filtered);

  return (
    <>
      <p className="mb-3 text-xs text-muted tabular-nums">
        Showing <span className="font-semibold text-fg">{stocks.length}</span> stocks · <span className="font-semibold text-fg">{filtered.length}</span> signals
        {direction && <> · {DIR_META[direction].label}</>}
        {query && <> · matching <span className="font-semibold text-fg">&ldquo;{query}&rdquo;</span></>}
      </p>
      <ul className="max-h-[78vh] space-y-3 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
        {stocks.map((s) => (
          <li key={s.symbol}>
            <StockCard group={s} query={query} />
          </li>
        ))}
      </ul>
    </>
  );
}

function groupBySymbol(rows: GuidanceFeedRow[]): StockGroup[] {
  const map = new Map<string, StockGroup>();
  for (const r of rows) {
    let g = map.get(r.symbol);
    if (!g) {
      g = {
        symbol: r.symbol,
        companyName: r.filing?.company_name ?? null,
        signals: [],
        latestFiledAt: r.filed_at,
        dominantDirection: r.direction,
        counts: { up: 0, down: 0, flat: 0, mixed: 0 },
      };
      map.set(r.symbol, g);
    }
    g.signals.push(r);
    g.counts[r.direction]++;
    if (!g.companyName && r.filing?.company_name) g.companyName = r.filing.company_name;
    if (r.filed_at > g.latestFiledAt) g.latestFiledAt = r.filed_at;
  }
  for (const g of map.values()) g.dominantDirection = resolveDominant(g.counts);
  return [...map.values()].sort((a, b) => (a.latestFiledAt > b.latestFiledAt ? -1 : 1));
}

function resolveDominant(counts: Record<Direction, number>): Direction {
  const upDown = counts.up > 0 && counts.down > 0;
  if (upDown) return "mixed";
  if (counts.up >= counts.down && counts.up >= counts.flat && counts.up > 0) return "up";
  if (counts.down >= counts.flat && counts.down > 0) return "down";
  if (counts.mixed > 0) return "mixed";
  return "flat";
}

function filterRows(rows: GuidanceFeedRow[], query: string): GuidanceFeedRow[] {
  if (!query) return rows;
  const needle = query.toLowerCase();
  return rows.filter((r) => {
    if (r.symbol.toLowerCase().includes(needle)) return true;
    if (r.metric.toLowerCase().includes(needle)) return true;
    if (r.quote.toLowerCase().includes(needle)) return true;
    if (r.value_text && r.value_text.toLowerCase().includes(needle)) return true;
    if (r.timeframe && r.timeframe.toLowerCase().includes(needle)) return true;
    if (r.filing?.company_name && r.filing.company_name.toLowerCase().includes(needle)) return true;
    if (r.filing?.headline && r.filing.headline.toLowerCase().includes(needle)) return true;
    return false;
  });
}

function StockCard({ group, query }: { group: StockGroup; query: string }) {
  const meta = DIR_META[group.dominantDirection];
  const Icon = meta.icon;
  const breakdown = (["up", "down", "flat", "mixed"] as Direction[])
    .filter((d) => group.counts[d] > 0)
    .map((d) => `${group.counts[d]} ${DIR_META[d].short.toLowerCase()}`)
    .join(" · ");

  return (
    <article className="surface group relative overflow-hidden p-5 transition hover:-translate-y-0.5">
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand via-brand-2 to-accent" />
      <div className="relative flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/stock/${group.symbol}`}
            className="text-base font-semibold tracking-tight text-fg hover:text-brand"
          >
            {highlight(group.symbol, query)}
          </Link>
          {group.companyName && (
            <span className="truncate text-xs text-muted">· {highlight(group.companyName, query)}</span>
          )}
          <span className={cn("ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ring-white/5", meta.tone)}>
            <Icon className="h-3 w-3" />
            {meta.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span className="tabular-nums font-semibold text-fg">{group.signals.length} signal{group.signals.length === 1 ? "" : "s"}</span>
          {breakdown && <span>· {breakdown}</span>}
          <span className="ml-auto inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            latest {relative(group.latestFiledAt)}
          </span>
        </div>

        <ol className="space-y-2.5 border-l border-border/60 pl-3">
          {group.signals.map((s) => (
            <SignalLine key={s.id} row={s} query={query} />
          ))}
        </ol>
      </div>
    </article>
  );
}

function SignalLine({ row, query }: { row: GuidanceFeedRow; query: string }) {
  const meta = DIR_META[row.direction];
  const Icon = meta.icon;
  const category = row.filing?.category ? CATEGORY_LABEL[row.filing.category] ?? row.filing.category : "Filing";
  return (
    <li className="text-sm">
      <div className="flex items-baseline gap-2">
        <span className={cn("inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", meta.tone)}>
          <Icon className="h-2.5 w-2.5" />
        </span>
        <blockquote className="italic text-fg/90">&ldquo;{highlight(row.quote, query)}&rdquo;</blockquote>
      </div>
      <div className="mt-1 ml-6 flex flex-wrap items-center gap-1.5 text-[11px]">
        <Chip>{capital(row.metric)}</Chip>
        {row.value_text && <Chip>{row.value_text}</Chip>}
        {row.timeframe && <Chip>{row.timeframe}</Chip>}
        <Chip muted>{category}</Chip>
        <span className="ml-auto inline-flex items-center gap-1 text-muted">
          <Clock className="h-3 w-3" />
          {relative(row.filed_at)}
        </span>
        {row.filing?.pdf_url && (
          <a
            href={row.filing.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-1.5 py-0.5 text-muted transition hover:border-brand/40 hover:text-brand"
          >
            Source <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </li>
  );
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const needle = query.toLowerCase();
  const lower = text.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-brand/25 px-0.5 text-fg">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function Chip({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 ring-1",
        muted
          ? "bg-bg-2 text-muted ring-border"
          : "bg-brand/10 text-brand ring-brand/30",
      )}
    >
      {children}
    </span>
  );
}

function Skeleton() {
  return (
    <ul className="max-h-[78vh] space-y-3 overflow-y-auto pr-1">
      {[...Array(6)].map((_, i) => (
        <li key={i} className="surface relative h-40 animate-pulse overflow-hidden p-5">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand/40 via-brand-2/40 to-accent/40" />
        </li>
      ))}
    </ul>
  );
}

function capital(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
