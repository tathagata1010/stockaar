import { Suspense } from "react";
import Link from "next/link";
import { getRecentGuidance } from "@/lib/guidance";
import { Disclaimer } from "@/components/Disclaimer";
import { Sparkles, TrendingUp, TrendingDown, Minus, Shuffle, ExternalLink, Clock, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

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

const DIR_META: Record<Direction, { label: string; icon: typeof TrendingUp; tone: string }> = {
  up:    { label: "Guidance up",    icon: TrendingUp,   tone: "text-accent border-accent/40 bg-accent/10" },
  down:  { label: "Guidance down",  icon: TrendingDown, tone: "text-danger border-danger/40 bg-danger/10" },
  flat:  { label: "Flat",           icon: Minus,        tone: "text-muted border-border bg-bg-2" },
  mixed: { label: "Mixed",          icon: Shuffle,      tone: "text-warning border-warning/40 bg-warning/10" },
};

const CATEGORY_LABEL: Record<string, string> = {
  concall_transcript: "Concall transcript",
  investor_presentation: "Investor presentation",
  business_update: "Business update",
  press_release: "Press release",
};

export default function GuidancePage({ searchParams }: { searchParams: { dir?: string } }) {
  const dirParam = (searchParams.dir ?? "").toLowerCase();
  const direction = (ALL_DIRECTIONS as string[]).includes(dirParam) ? (dirParam as Direction) : undefined;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-[11px] font-semibold text-brand">
          <Sparkles className="h-3 w-3" />
          New · Star feature
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Guidance Tracker</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          What Indian listed-company management is <em className="not-italic font-semibold text-fg">actually saying</em> about the future — extracted verbatim from concall transcripts, investor presentations, and corporate filings. Updated through the day.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        <FilterChip href="/guidance" active={!direction} label="All" />
        {ALL_DIRECTIONS.map((d) => (
          <FilterChip
            key={d}
            href={`/guidance?dir=${d}`}
            active={direction === d}
            label={DIR_META[d].label}
            tone={DIR_META[d].tone}
          />
        ))}
      </div>

      <Suspense fallback={<Skeleton />}>
        <Feed direction={direction} />
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

async function Feed({ direction }: { direction?: Direction }) {
  const rows = await getRecentGuidance({ limit: 80, direction });
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
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id}>
          <GuidanceRow row={r} />
        </li>
      ))}
    </ul>
  );
}

function GuidanceRow({ row }: { row: Awaited<ReturnType<typeof getRecentGuidance>>[number] }) {
  const meta = DIR_META[row.direction];
  const Icon = meta.icon;
  const category = row.filing?.category ? CATEGORY_LABEL[row.filing.category] ?? row.filing.category : "Filing";
  const filedAgo = relative(row.filed_at);
  return (
    <article className="surface group relative overflow-hidden p-5 transition hover:-translate-y-0.5">
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand via-brand-2 to-accent" />
      <div className="relative flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/stock/${row.symbol}`}
            className="text-base font-semibold tracking-tight text-fg hover:text-brand"
          >
            {row.symbol}
          </Link>
          {row.filing?.company_name && (
            <span className="truncate text-xs text-muted">· {row.filing.company_name}</span>
          )}
          <span className={cn("ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ring-white/5", meta.tone)}>
            <Icon className="h-3 w-3" />
            {meta.label}
          </span>
        </div>

        <blockquote className="border-l-2 border-brand/40 pl-3 text-sm italic text-fg/90">
          &ldquo;{row.quote}&rdquo;
        </blockquote>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <Chip>{capital(row.metric)}</Chip>
          {row.value_text && <Chip>{row.value_text}</Chip>}
          {row.timeframe && <Chip>{row.timeframe}</Chip>}
          <Chip muted>{category}</Chip>
          <span className="ml-auto inline-flex items-center gap-1 text-muted">
            <Clock className="h-3 w-3" />
            {filedAgo}
          </span>
          {row.filing?.pdf_url && (
            <a
              href={row.filing.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-muted transition hover:border-brand/40 hover:text-brand"
            >
              Source PDF <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </article>
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
    <ul className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <li key={i} className="surface relative h-32 animate-pulse overflow-hidden p-5">
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
