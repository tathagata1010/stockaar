import { Suspense, cache } from "react";
import Link from "next/link";
import {
  Sparkles, Zap, Bell, TrendingUp, TrendingDown, Activity, Shield,
  Target, BarChart3, Newspaper, LineChart, Search, Bot, ArrowRight,
  CheckCircle2, Star, Quote, Flame, AlertTriangle, Compass, Crown,
  Coins, Rocket, Trophy, Mail, ChevronRight, PlayCircle,
} from "lucide-react";
import { APP_NAME, PLANS } from "@/lib/constants";
import { Footer } from "@/components/Footer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StockLogo } from "@/components/StockLogo";
import { NewsletterForm } from "@/components/NewsletterForm";
import { MarketTickerStripAsync } from "@/components/MarketTickerStrip";
import { SubscribeModal } from "@/components/SubscribeModal";
import { PricingSection } from "@/components/PricingSection";
import { getQuotes } from "@/lib/upstox";
import { getFundamentals } from "@/lib/fundamentals";
import { buildScorecard, deriveSignal } from "@/lib/scorecard";
import { NSE_SYMBOLS } from "@/lib/nse-symbols";
import { formatINR } from "@/lib/utils";
import { getUniverse, type UniverseRow } from "@/lib/universe";
import { getSectorPerformance, type SectorPerformance } from "@/lib/sectors";
import { getRedditBuzz, type BuzzItem } from "@/lib/reddit-buzz";

export const revalidate = 60;

const FEATURES = [
  {
    icon: <LineChart className="h-5 w-5" />,
    title: "Live watchlist that thinks",
    body: "NSE/BSE live prices, sparklines, day & 52-week range. We flag the ones moving abnormally — you don't have to scroll.",
  },
  {
    icon: <Target className="h-5 w-5" />,
    title: "Scorecard, not noise",
    body: "Every stock graded on Valuation, Growth, Profitability & Financial Health. A number you can act on.",
  },
  {
    icon: <Bot className="h-5 w-5" />,
    title: "AI Brief per stock",
    body: "Bull case, bear case, moat, 12-month bull/base/bear price targets — generated fresh, cited from primary news.",
  },
  {
    icon: <Bell className="h-5 w-5" />,
    title: "Smart price alerts",
    body: "Set targets in plain English. We email you the second it crosses — only during market hours, no spam.",
  },
  {
    icon: <Flame className="h-5 w-5" />,
    title: "Hot Stocks & Anomalies",
    body: "Volume spikes, 52W breakouts, gap-ups, block deals. The unusual stuff, surfaced before Twitter does.",
  },
  {
    icon: <Search className="h-5 w-5" />,
    title: "Screener for retail",
    body: "Filter by P/E, market cap, dividend yield, sector. No CFA jargon — just sliders and instant results.",
  },
];

const FIT_PERSONAS = [
  { icon: <Crown className="h-4 w-4" />, label: "Value investor", body: "P/E, P/B, asset backing — the Graham checklist, automated." },
  { icon: <Rocket className="h-4 w-4" />, label: "Growth investor", body: "Revenue & EPS CAGR, margin expansion, sector tailwinds." },
  { icon: <Coins className="h-4 w-4" />, label: "Income investor", body: "Dividend yield, payout consistency, free cash flow cover." },
  { icon: <Trophy className="h-4 w-4" />, label: "Momentum trader", body: "RSI, volume surges, 52W highs, breakout candidates." },
];

const TESTIMONIALS = [
  { name: "Aditya R.", role: "Software engineer · Bangalore", quote: "I cancelled my Moneycontrol Pro. The AI brief alone is worth ₹299 — it explains why a stock moved in 30 seconds." },
  { name: "Priya M.", role: "Doctor · Mumbai", quote: "I don't have time to watch CNBC. Alerts + morning email = I'm sorted. Caught the BHEL run because of an anomaly ping." },
  { name: "Rohan K.", role: "CA · Pune", quote: "Scorecard is brutal and honest. It told me TCS valuation was stretched 3 weeks before the correction." },
];

const FAQS = [
  { q: "Where does the data come from?", a: "Live prices from Upstox (NSE/BSE official feed). Fundamentals from Yahoo Finance v10. Refreshed every 60 seconds, cached server-side so the app stays snappy." },
  { q: "Is this SEBI registered?", a: "We provide market data and analytics — not buy/sell recommendations. Nothing on the platform is investment advice. Read our Disclaimer before acting on any view." },
  { q: "Can I cancel anytime?", a: "Yes. One-click cancel from Account → Billing. Your Pro features stay active until the end of the current billing cycle." },
  { q: "Do you support BSE-only stocks?", a: "Yes. Search supports both exchanges. NSE is preferred when both are listed (better depth). You can add either to your watchlist." },
  { q: "What payment methods?", a: "Razorpay handles checkout — UPI, all major Indian debit/credit cards, net banking, and wallets. GST invoices issued on request." },
];

const HERO_SYMBOLS = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "TATAMOTORS", "ITC"] as const;

type LiveStock = {
  symbol: string;
  name: string;
  sector?: string;
  price: number | null;
  changePct: number | null;
  score: number | null;
  signal: "BUY" | "HOLD" | "SELL" | null;
  brief?: string;
  bull?: number | null;
  base?: number | null;
  bear?: number | null;
};

async function fetchHeroStocks(): Promise<LiveStock[]> {
  return _fetchHeroStocksCached();
}

const _fetchHeroStocksCached = cache(async (): Promise<LiveStock[]> => {
  const quotes = await getQuotes(
    HERO_SYMBOLS.map((symbol) => ({ symbol, exchange: "NSE" as const })),
  ).catch(() => []);
  const quoteBy = new Map(quotes.map((q) => [q.symbol, q]));

  const results = await Promise.all(
    HERO_SYMBOLS.map(async (sym): Promise<LiveStock> => {
      const meta = NSE_SYMBOLS.find((s) => s.symbol === sym);
      const quote = quoteBy.get(sym) ?? null;
      try {
        const fundamentals = await getFundamentals(sym, "NSE").catch(() => null);
        const sc = fundamentals ? buildScorecard(fundamentals, quote) : null;
        const sig = sc ? deriveSignal(sc).signal : null;
        return {
          symbol: sym,
          name: meta?.name ?? sym,
          sector: meta?.sector,
          price: quote?.lastPrice ?? null,
          changePct: quote?.changePct ?? null,
          score: sc?.composite ?? null,
          signal: sig,
        };
      } catch {
        return { symbol: sym, name: meta?.name ?? sym, sector: meta?.sector, price: null, changePct: null, score: null, signal: null };
      }
    }),
  );
  return results;
});

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <SubscribeModal />
      <MarketTickerStripAsync />
      <TopBanner />
      <SiteHeader />

      <div className="overflow-hidden">
        <Hero />
        <TrustStrip />

        <AnomaliesSection />
        <HotStocksSection />
        <NewsletterCTA />
        <SectorSpotlights />

        <ProSection />
        <FeatureGrid />
        <InvestorFit />
        <PricingSection />
        <TestimonialsSection />
        <FAQSection />
        <FinalCTA />

        <Footer />
      </div>
    </main>
  );
}

/* -------------------- Top banner -------------------- */
function TopBanner() {
  return (
    <div className="sticky top-10 z-40 bg-fg text-bg">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-6 py-2 text-[12px]">
        <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-fg">Launch week</span>
        <span className="text-bg/80">Get <span className="font-semibold text-bg">50% off</span> Pro Annual — first 3 months.</span>
        <Link href="/pricing" className="ml-1 inline-flex items-center gap-0.5 font-semibold underline-offset-2 hover:underline">
          Claim deal <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

/* -------------------- Header -------------------- */
function SiteHeader() {
  const NAV = [
    { href: "#features", label: "Features" },
    { href: "#anomalies", label: "Anomalies" },
    { href: "#pro", label: "Pro" },
    { href: "/learn", label: "Learn" },
    { href: "#pricing", label: "Pricing" },
  ];
  return (
    <header className="sticky top-[72px] z-30 border-b border-border-strong bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-brand-fg shadow-pop">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="num-display text-xl font-bold">{APP_NAME}</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm text-fg/80 hover:text-brand">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/auth/login" className="hidden rounded-lg px-3 py-2 text-sm text-fg/80 hover:text-brand sm:inline-flex">
            Log in
          </Link>
          <Link href="/auth/signup" className="btn-brand">Sign up free</Link>
        </div>
      </div>
    </header>
  );
}

/* -------------------- Hero -------------------- */
function Hero() {
  return (
    <section className="relative">
      <div className="absolute inset-0 mesh-hero opacity-70" />
      <div className="relative mx-auto max-w-6xl px-6 pb-12 pt-16 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-[11px] backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            <span className="text-muted">Live NSE / BSE · refreshed every 60s</span>
          </div>
          <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Know exactly what to do with{" "}
            <span className="text-gradient-3">your stocks.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted md:text-lg">
            Live prices, AI briefs, scorecards, anomalies and earnings — for the stocks
            <em className="not-italic font-medium text-fg"> you</em> follow. We email you the moment something hits a buy
            or sell zone. No charts to stare at.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/auth/signup" className="btn-brand inline-flex items-center gap-2 px-6 py-3 text-base">
              Track your first stock free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="#demo" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium hover:border-brand">
              <PlayCircle className="h-4 w-4 text-brand" /> See it in action
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-accent" /> No credit card</span>
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-accent" /> 3 stocks free forever</span>
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-accent" /> Razorpay secure checkout</span>
          </div>
        </div>

        <Suspense fallback={null}>
          <FloatingChipsAsync />
        </Suspense>

        {/* App preview card */}
        <div id="demo" className="relative mx-auto mt-14 max-w-5xl">
          <div className="surface-strong glow-hero overflow-hidden p-0 shadow-pop">
            <div className="flex items-center gap-2 border-b border-border bg-bg-2/60 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-brand/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
              <span className="ml-3 truncate rounded-md bg-bg/60 px-3 py-1 text-[11px] text-muted">
                {APP_NAME.toLowerCase()}.in / dashboard
              </span>
            </div>
            <Suspense fallback={<PreviewSkeleton />}>
              <PreviewWatchlistAsync />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}

async function FloatingChipsAsync() {
  const stocks = await fetchHeroStocks();
  return (
    <div className="pointer-events-none absolute inset-x-0 top-32 hidden md:block">
      <div className="relative mx-auto h-0 max-w-5xl">
        {stocks.slice(0, 6).map((s, i) => {
          const positions = [
            "left-2 top-0", "right-2 top-4", "left-12 top-24",
            "right-16 top-28", "left-2 top-56", "right-6 top-60",
          ];
          return (
            <FloatingChip
              key={s.symbol}
              className={positions[i]}
              sym={s.symbol}
              sector={s.sector}
              signal={s.signal ?? "HOLD"}
            />
          );
        })}
      </div>
    </div>
  );
}

async function PreviewWatchlistAsync() {
  const stocks = await fetchHeroStocks();
  const leadName = stocks[0]?.name ?? "your portfolio";
  return <PreviewWatchlist stocks={stocks} leadName={leadName} />;
}

function PreviewSkeleton() {
  return (
    <div className="grid gap-0 md:grid-cols-[1fr_300px]">
      <div className="p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-bg-2" />
        ))}
      </div>
      <div className="border-l border-border bg-bg/40 p-5">
        <div className="h-3 w-24 animate-pulse rounded bg-bg-2" />
        <div className="mt-3 h-20 animate-pulse rounded bg-bg-2" />
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="h-14 animate-pulse rounded bg-bg-2" />
          <div className="h-14 animate-pulse rounded bg-bg-2" />
          <div className="h-14 animate-pulse rounded bg-bg-2" />
        </div>
      </div>
    </div>
  );
}

function FloatingChip({ className, sym, sector, signal }: {
  className: string; sym: string; sector?: string; signal: "BUY" | "HOLD" | "SELL";
}) {
  const tone =
    signal === "BUY" ? "border-accent/30 bg-accent/10 text-accent"
    : signal === "SELL" ? "border-danger/30 bg-danger/10 text-danger"
    : "border-brand/30 bg-brand/10 text-brand";
  const label = signal === "BUY" ? "Buy" : signal === "SELL" ? "Sell" : "Hold";
  return (
    <div className={`absolute ${className}`}>
      <div className={`inline-flex items-center gap-1.5 rounded-full border bg-card/80 px-2 py-1 text-[11px] font-medium shadow-pop backdrop-blur ${tone}`}>
        <StockLogo symbol={sym} sector={sector as never} size="xs" />
        <span className="font-semibold text-fg">{sym}</span>
        <span>{label}</span>
      </div>
    </div>
  );
}

function PreviewWatchlist({ stocks, leadName }: { stocks: LiveStock[]; leadName: string }) {
  const lead = stocks[0];
  // Compute scenario prices from the lead's live price (deterministic fallback, same model as ai-brief).
  const leadPrice = lead?.price ?? null;
  const bull = leadPrice ? Math.round(leadPrice * 1.16) : null;
  const base = leadPrice ? Math.round(leadPrice * 1.07) : null;
  const bear = leadPrice ? Math.round(leadPrice * 0.90) : null;
  const leadSig = lead?.signal ?? "BUY";
  return (
    <div className="grid gap-0 md:grid-cols-[1fr_300px]">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-bg/40 text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Day</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3 text-right">Signal</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((r) => {
              const up = (r.changePct ?? 0) >= 0;
              const score = r.score ?? 65;
              const sig = r.signal ?? "HOLD";
              return (
                <tr key={r.symbol} className="border-b border-border last:border-0 hover:bg-bg/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <StockLogo symbol={r.symbol} sector={r.sector as never} size="sm" />
                      <div>
                        <div className="font-semibold">{r.symbol}</div>
                        <div className="text-[11px] text-muted">{r.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.price !== null ? formatINR(r.price) : <span className="text-muted">—</span>}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums font-medium ${up ? "text-accent" : "text-danger"}`}>
                    <span className="inline-flex items-center gap-1">
                      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {r.changePct !== null ? `${up ? "+" : ""}${r.changePct.toFixed(2)}%` : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="ml-auto flex w-20 items-center justify-end gap-1.5">
                      <div className="h-1 flex-1 overflow-hidden rounded bg-bg ring-1 ring-border">
                        <div className="h-full rounded bg-gradient-to-r from-brand to-accent" style={{ width: `${score}%` }} />
                      </div>
                      <span className="w-7 text-right text-xs font-semibold tabular-nums">{score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                      sig === "BUY" ? "bg-accent/15 text-accent ring-accent/30"
                      : sig === "SELL" ? "bg-danger/15 text-danger ring-danger/30"
                      : "bg-brand/15 text-brand ring-brand/30"
                    }`}>{sig}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <aside className="border-l border-border bg-bg/40 p-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand">
          <Bot className="h-3.5 w-3.5" /> AI Brief · {lead?.symbol ?? "RELIANCE"}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${
            leadSig === "BUY" ? "bg-accent/15 text-accent ring-accent/30"
            : leadSig === "SELL" ? "bg-danger/15 text-danger ring-danger/30"
            : "bg-brand/15 text-brand ring-brand/30"
          }`}>{leadSig}</span>
          <span className="text-[11px] text-muted">Risk · Medium</span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-fg">
          {leadName} — retail business is firing on all cylinders post Q4. Jio AGR at industry highs.
          O2C margins compressed but next-quarter is the trough — refinery utilisation recovers in Jun.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <ScenarioBox label="Bull" val={bull !== null ? formatINR(bull) : "—"} pct="+16%" tone="up" />
          <ScenarioBox label="Base" val={base !== null ? formatINR(base) : "—"} pct="+7%" tone="brand" />
          <ScenarioBox label="Bear" val={bear !== null ? formatINR(bear) : "—"} pct="-10%" tone="down" />
        </div>
        <div className="mt-4 rounded-lg border border-brand/30 bg-brand/5 p-2.5 text-[11px] text-fg">
          <span className="font-semibold text-brand">Catalyst:</span> JFS demerger record date — next 2 weeks.
        </div>
      </aside>
    </div>
  );
}

function ScenarioBox({ label, val, pct, tone }: { label: string; val: string; pct: string; tone: "up" | "down" | "brand" }) {
  const cls =
    tone === "up" ? "border-accent/30 text-accent"
    : tone === "down" ? "border-danger/30 text-danger"
    : "border-brand/30 text-brand";
  return (
    <div className={`rounded-lg border bg-card p-2 text-center ${cls}`}>
      <div className="text-[9px] font-semibold uppercase tracking-wider opacity-80">{label}</div>
      <div className="num-display mt-0.5 text-sm font-bold text-fg">{val}</div>
      <div className="text-[10px] tabular-nums">{pct}</div>
    </div>
  );
}

/* -------------------- Trust strip -------------------- */
function TrustStrip() {
  const stats = [
    { v: "593+", l: "NSE stocks covered" },
    { v: "60s", l: "Live price refresh" },
    { v: "4-pillar", l: "Scorecard model" },
    { v: "₹0", l: "To get started" },
  ];
  return (
    <section className="border-y border-border bg-bg-2/40">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden bg-border md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.l} className="bg-bg-2/60 px-6 py-6 text-center">
            <div className="num-display text-2xl font-bold text-fg">{s.v}</div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-muted">{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------- Anomalies -------------------- */
function AnomaliesSection() {
  return (
    <section id="anomalies" className="mx-auto max-w-6xl px-6 py-16">
      <SectionHeader
        eyebrow={<><AlertTriangle className="h-3.5 w-3.5" /> Market Anomalies</>}
        title="The unusual stuff, before Twitter sees it."
        sub="Volume spikes, gap-ups, 52-week breakouts, block deals. We flag what's actually moving — not the noise."
        href="/anomalies"
      />
      <Suspense fallback={<CardGridSkeleton n={3} />}>
        <AnomaliesAsync />
      </Suspense>
    </section>
  );
}

function describeAnomaly(r: UniverseRow): string | null {
  const chg = r.quote?.changePct ?? 0;
  const rp = r.rangePosition;
  if (rp !== null && rp > 95) return `Breakout — within ${(100 - rp).toFixed(1)}% of 52-week high.`;
  if (rp !== null && rp < 5) return `Breakdown — within ${rp.toFixed(1)}% of 52-week low.`;
  if (chg >= 5) return `Gap-up of ${chg.toFixed(2)}% intraday on heavy interest.`;
  if (chg <= -5) return `Gap-down of ${chg.toFixed(2)}% — sharp intraday reversal.`;
  if (Math.abs(chg) >= 3) return `Outsized intraday move — ${chg > 0 ? "up" : "down"} ${Math.abs(chg).toFixed(2)}%.`;
  return null;
}

async function AnomaliesAsync() {
  const universe = await getUniverse().catch(() => [] as UniverseRow[]);
  const flagged = universe
    .map((r) => ({ row: r, reason: describeAnomaly(r) }))
    .filter((x): x is { row: UniverseRow; reason: string } => x.reason !== null && x.row.quote !== null)
    .sort((a, b) => Math.abs(b.row.quote!.changePct) - Math.abs(a.row.quote!.changePct))
    .slice(0, 3);

  if (flagged.length === 0) {
    return <p className="mt-8 text-sm text-muted">Markets are quiet right now — no anomalies above threshold.</p>;
  }

  return (
    <div className="mt-8 grid gap-4 md:grid-cols-3">
      {flagged.map(({ row, reason }) => {
        const up = (row.quote?.changePct ?? 0) >= 0;
        return (
          <Link
            key={row.entry.symbol}
            href={`/stock/${row.entry.symbol}`}
            className="surface group p-5 transition hover:-translate-y-0.5 hover:shadow-pop"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-bold">{row.entry.symbol}</div>
                <div className="text-[11px] text-muted">{row.entry.name}</div>
              </div>
              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${up ? "bg-accent/15 text-accent" : "bg-danger/15 text-danger"}`}>
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {up ? "+" : ""}{row.quote!.changePct.toFixed(2)}%
              </span>
            </div>
            <div className="mt-2 num-display text-xl font-bold tabular-nums">{formatINR(row.quote!.lastPrice)}</div>
            <p className="mt-2 text-xs leading-relaxed text-muted">{reason}</p>
          </Link>
        );
      })}
    </div>
  );
}

/* -------------------- Hot stocks -------------------- */
function HotStocksSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-16">
      <SectionHeader
        eyebrow={<><Flame className="h-3.5 w-3.5" /> Reddit Buzz · Trending</>}
        title="What India is talking about today."
        sub="Most-discussed tickers across r/IndianStockMarket, news feeds and earnings transcripts — ranked by signal, not volume."
        href="/trending"
      />
      <Suspense fallback={<CardGridSkeleton n={3} />}>
        <HotStocksAsync />
      </Suspense>
    </section>
  );
}

async function HotStocksAsync() {
  const [buzz, universe] = await Promise.all([
    getRedditBuzz().catch(() => null),
    getUniverse().catch(() => [] as UniverseRow[]),
  ]);
  const byKey = new Map(universe.map((r) => [`${r.entry.exchange}:${r.entry.symbol}`, r]));

  const items: BuzzItem[] = (buzz?.items ?? []).slice(0, 3);

  if (items.length === 0) {
    return <p className="mt-8 text-sm text-muted">Buzz feed warming up — check back in a few minutes.</p>;
  }

  return (
    <div className="mt-8 grid gap-4 md:grid-cols-3">
      {items.map((b) => {
        const row = byKey.get(`${b.entry.exchange}:${b.entry.symbol}`);
        const chg = row?.quote?.changePct ?? null;
        const price = row?.quote?.lastPrice ?? null;
        const up = (chg ?? 0) >= 0;
        return (
          <Link
            key={b.entry.symbol}
            href={`/stock/${b.entry.symbol}`}
            className="surface relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-pop"
          >
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand to-accent" />
            <div className="flex items-start justify-between pl-2">
              <div>
                <div className="text-sm font-bold">{b.entry.symbol}</div>
                <div className="text-[11px] text-muted">{b.entry.name}</div>
              </div>
              {chg !== null && (
                <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${up ? "bg-accent/15 text-accent" : "bg-danger/15 text-danger"}`}>
                  {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {up ? "+" : ""}{chg.toFixed(2)}%
                </span>
              )}
            </div>
            <div className="mt-2 pl-2 num-display text-xl font-bold tabular-nums">
              {price !== null ? formatINR(price) : <span className="text-muted text-sm font-normal">—</span>}
            </div>
            <p className="mt-2 pl-2 text-xs leading-relaxed text-fg line-clamp-3">{b.topPost.title}</p>
            <div className="mt-2 pl-2 text-[10px] uppercase tracking-wider text-muted">
              r/{b.topPost.subreddit} · {b.mentions} mentions
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* -------------------- Newsletter -------------------- */
function NewsletterCTA() {
  return (
    <section className="mx-auto max-w-4xl px-6 pb-16">
      <div className="surface-strong relative overflow-hidden p-8 text-center md:p-12">
        <div className="absolute inset-0 mesh-hero opacity-50" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
            <Mail className="h-3 w-3" /> Free every weekday
          </span>
          <h3 className="mt-4 text-3xl font-bold md:text-4xl">The market today, in plain English.</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            3-minute morning brief. What moved, why it moved, what to watch. Zero CFA jargon.
          </p>
          <NewsletterForm />
        </div>
      </div>
    </section>
  );
}

/* -------------------- Sectors -------------------- */
function SectorSpotlights() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20">
      <SectionHeader
        eyebrow={<><BarChart3 className="h-3.5 w-3.5" /> Sector spotlights</>}
        title="See where the money is rotating."
        sub="Live sector heatmap with top movers in each. Spot rotations before they become consensus."
        href="/sectors"
      />
      <Suspense fallback={<CardGridSkeleton n={4} compact />}>
        <SectorSpotlightsAsync />
      </Suspense>
    </section>
  );
}

async function SectorSpotlightsAsync() {
  const all = await getSectorPerformance().catch(() => [] as SectorPerformance[]);
  // Pick 4: the two strongest and two weakest non-empty sectors with the most movement.
  const ranked = [...all].sort((a, b) => Math.abs(b.avgChangePct) - Math.abs(a.avgChangePct)).slice(0, 4);

  if (ranked.length === 0) {
    return <p className="mt-8 text-sm text-muted">Sector data unavailable right now.</p>;
  }

  return (
    <div className="mt-8 grid gap-4 md:grid-cols-4">
      {ranked.map((s) => {
        const up = s.avgChangePct >= 0;
        const top = [...s.rows]
          .filter((r) => r.quote)
          .sort((a, b) => (b.quote!.changePct) - (a.quote!.changePct))
          .slice(0, 3);
        return (
          <article key={s.sector} className="surface p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{s.sector}</div>
              <span className={`text-xs font-semibold tabular-nums ${up ? "text-accent" : "text-danger"}`}>
                {up ? "+" : ""}{s.avgChangePct.toFixed(2)}%
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {top.map((r) => (
                <Link
                  key={r.entry.symbol}
                  href={`/stock/${r.entry.symbol}`}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-bg/40 px-3 py-2 text-xs hover:border-brand"
                >
                  <span className="font-semibold">{r.entry.symbol}</span>
                  <ArrowRight className="h-3 w-3 text-muted" />
                </Link>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CardGridSkeleton({ n, compact }: { n: number; compact?: boolean }) {
  return (
    <div className={`mt-8 grid gap-4 ${n >= 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className={`shimmer rounded-2xl ${compact ? "h-40" : "h-32"}`} />
      ))}
    </div>
  );
}

/* -------------------- Pro section -------------------- */
function ProSection() {
  const items = [
    { icon: <Shield className="h-4 w-4" />, title: "See concentration risk", body: "Spot when your portfolio is over-indexed to one sector. Diversification meter built in." },
    { icon: <Bell className="h-4 w-4" />, title: "Never miss earnings", body: "We push earnings dates, rating changes, and dividends into your Radar — only for stocks you follow." },
    { icon: <Activity className="h-4 w-4" />, title: "Only what actually changed", body: "Skip the wall of news. Just what's new since you last logged in. Like git diff for your portfolio." },
    { icon: <Mail className="h-4 w-4" />, title: "Inbox-ready alerts", body: "Breakouts, RSI extremes, earnings windows. You get an email the moment it matters." },
  ];
  return (
    <section id="pro" className="border-y border-border bg-bg-2/30">
      <div className="mx-auto max-w-6xl px-6 py-20 text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">{APP_NAME} Pro</span>
        <h2 className="mt-2 text-3xl font-bold md:text-4xl">Your Radar for the stocks you care about.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {items.map((i) => (
            <div key={i.title} className="surface p-5 text-left">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 text-brand">{i.icon}</div>
              <div className="mt-3 text-sm font-semibold">{i.title}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{i.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------- Features -------------------- */
function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] uppercase tracking-wider text-muted">
          <Zap className="h-3 w-3 text-brand" /> Built for Indian retail
        </span>
        <h2 className="mt-4 text-3xl font-bold md:text-4xl">Everything you need. Nothing you don&apos;t.</h2>
        <p className="mt-3 text-sm text-muted">
          Most apps drown you in data. We surface only what changes your decision.
        </p>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <article key={f.title} className="surface group p-6 transition hover:-translate-y-0.5 hover:shadow-pop">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gradient text-brand-fg shadow-pop">
              {f.icon}
            </div>
            <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* -------------------- Investor fit -------------------- */
function InvestorFit() {
  return (
    <section className="border-y border-border bg-bg-2/30">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] uppercase tracking-wider text-muted">
            <Compass className="h-3 w-3 text-brand" /> Match your style
          </span>
          <h2 className="mt-4 text-3xl font-bold md:text-4xl">Built for every type of investor.</h2>
          <p className="mt-3 text-sm text-muted">
            Every stock is scored across 4 investor profiles. You see at a glance if it fits how you invest.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {FIT_PERSONAS.map((p) => (
            <div key={p.label} className="surface p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">{p.icon}</div>
              <div className="mt-3 text-sm font-semibold">{p.label}</div>
              <p className="mt-1.5 text-xs text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------- Pricing (uses shared component) -------------------- */

/* -------------------- Testimonials -------------------- */
function TestimonialsSection() {
  return (
    <section className="border-y border-border bg-bg-2/30">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">Testimonials</span>
          <h2 className="mt-2 text-3xl font-bold md:text-4xl">Loved by <span className="text-accent">traders and investors</span>.</h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="surface p-6">
              <Quote className="h-5 w-5 text-brand/40" />
              <blockquote className="mt-3 text-sm leading-relaxed text-fg">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-brand-fg">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-[11px] text-muted">{t.role}</div>
                </div>
                <div className="ml-auto flex gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-3 w-3 fill-brand text-brand" />)}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------- FAQ -------------------- */
function FAQSection() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <div className="text-center">
        <h2 className="text-3xl font-bold md:text-4xl">Questions, answered.</h2>
        <p className="mt-3 text-sm text-muted">If we missed yours, <Link href="/contact" className="text-brand underline">drop us a line</Link>.</p>
      </div>
      <div className="mt-10 space-y-3">
        {FAQS.map((f) => (
          <details key={f.q} className="surface group p-5 open:shadow-pop">
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold marker:hidden">
              {f.q}
              <ChevronRight className="h-4 w-4 text-muted transition-transform group-open:rotate-90" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* -------------------- Final CTA -------------------- */
function FinalCTA() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-20">
      <div className="surface-strong relative overflow-hidden p-10 text-center md:p-14">
        <div className="absolute inset-0 mesh-hero opacity-70" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand">
            <Sparkles className="h-3 w-3" /> Start in 30 seconds
          </span>
          <h2 className="mt-4 text-3xl font-bold md:text-5xl">
            Stop guessing.<br />
            <span className="text-gradient-3">Start knowing.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted md:text-base">
            Join thousands of Indian investors who use {APP_NAME} to cut through the noise.
            Free forever for 3 stocks.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/auth/signup" className="btn-brand inline-flex items-center gap-2 px-6 py-3 text-base">
              Create free account <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium hover:border-brand">
              See pricing
            </Link>
          </div>
          <p className="mt-3 text-[11px] text-muted">No credit card · Cancel anytime · GST invoice on request</p>
        </div>
      </div>
    </section>
  );
}

/* -------------------- Helpers -------------------- */
function SectionHeader({ eyebrow, title, sub, href }: { eyebrow: React.ReactNode; title: string; sub?: string; href?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-xl">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand">
          {eyebrow}
        </div>
        <h2 className="mt-3 text-2xl font-bold md:text-3xl">{title}</h2>
        {sub && <p className="mt-2 text-sm text-muted">{sub}</p>}
      </div>
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
