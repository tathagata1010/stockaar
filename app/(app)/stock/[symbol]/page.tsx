import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getQuote } from "@/lib/upstox";
import { getFundamentals } from "@/lib/fundamentals";
import { buildScorecard } from "@/lib/scorecard";
import { NSE_SYMBOLS } from "@/lib/nse-symbols";
import { formatINR, cn } from "@/lib/utils";
import { siteUrl } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { AddStockDetailButton } from "@/components/AddStockDetailButton";
import { PriceChart } from "@/components/PriceChart";
import { RangeBar } from "@/components/RangeBar";
import { PerformanceReturns } from "@/components/PerformanceReturns";
import { ScorecardView } from "@/components/ScorecardView";
import { KeyStats } from "@/components/KeyStats";
import { WhyCareToday } from "@/components/WhyCareToday";
import { AnalystRatings } from "@/components/AnalystRatings";
import { Financials } from "@/components/Financials";
import { AIBrief } from "@/components/AIBrief";
import { Disclaimer } from "@/components/Disclaimer";
import { StockLogo } from "@/components/StockLogo";
import { LiveHeroPrice } from "@/components/LiveHeroPrice";
import { StickyScrollLayout, StickySection, type StickySection as TS } from "@/components/StickyScrollLayout";
import { LazyMount } from "@/components/LazyMount";
import { NewsSection } from "@/components/NewsSection";
import { getAIBrief } from "@/lib/ai-brief";
import {
  LineChart, Activity, Award, BarChart3, Sparkles, Building2, Users,
  Bell, Newspaper,
} from "lucide-react";

export const revalidate = 60;

export async function generateStaticParams() {
  // Pre-render top tickers for instant nav. Others use ISR on-demand.
  return NSE_SYMBOLS.slice(0, 100).map((s) => ({ symbol: s.symbol }));
}

export async function generateMetadata({ params }: { params: { symbol: string } }) {
  const symbol = params.symbol.toUpperCase();
  const meta = NSE_SYMBOLS.find((s) => s.symbol === symbol);
  if (!meta) return { title: symbol };
  const title = `${meta.name} (${symbol}) Share Price · Live ${meta.exchange}`;
  const description = `Live ${meta.name} (${symbol}) share price on ${meta.exchange}. Charts, scorecard, key stats, financials, analyst ratings, and news. Sector: ${meta.sector}.`;
  const url = `/stock/${symbol}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary_large_image", title, description },
    keywords: [
      `${symbol} share price`,
      `${meta.name} share price`,
      `${symbol} stock`,
      `${meta.name} stock analysis`,
      `${symbol} ${meta.exchange}`,
      `${meta.sector} stocks India`,
    ],
  };
}

export default function StockDetailPage({ params }: { params: { symbol: string } }) {
  const symbol = params.symbol.toUpperCase();
  const meta = NSE_SYMBOLS.find((s) => s.symbol === symbol);
  if (!meta) notFound();

  const heroShell = (
    <>
      <div className="flex items-center gap-3">
        <StockLogo symbol={symbol} sector={meta.sector} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-bold tracking-tight">{symbol}</h1>
            <span className="chip chip-brand text-[10px]">{meta.exchange}</span>
          </div>
          <p className="truncate text-xs text-muted">{meta.name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="chip text-[10px]">{meta.sector}</span>
            {meta.industry && <span className="chip text-[10px]">{meta.industry}</span>}
          </div>
        </div>
      </div>

      <div className="divider-soft my-4" />

      <Suspense fallback={<HeroPriceSkeleton />}>
        <HeroPrice symbol={symbol} exchange={meta.exchange} />
      </Suspense>

      <div className="divider-soft my-4" />

      <div className="flex flex-col gap-2">
        <Suspense fallback={<div className="h-10 shimmer rounded-lg" />}>
          <HeroActions symbol={symbol} exchange={meta.exchange} />
        </Suspense>
      </div>

      <Link href="/dashboard" className="mt-4 inline-block text-[11px] text-muted hover:text-brand">
        ← Back to dashboard
      </Link>
    </>
  );

  const sections: TS[] = [
    { id: "overview", label: "Overview", icon: <LineChart className="h-3.5 w-3.5" /> },
    { id: "performance", label: "Performance", icon: <Activity className="h-3.5 w-3.5" /> },
    { id: "ai-brief", label: "AI Brief", icon: <Sparkles className="h-3.5 w-3.5" />, badge: "Pro" },
    { id: "news", label: "News", icon: <Newspaper className="h-3.5 w-3.5" /> },
    { id: "scorecard", label: "Scorecard", icon: <Award className="h-3.5 w-3.5" /> },
    { id: "fundamentals", label: "Fundamentals", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: "financials", label: "Financials", icon: <Building2 className="h-3.5 w-3.5" /> },
    { id: "analyst", label: "Analyst", icon: <Users className="h-3.5 w-3.5" /> },
  ];

  const site = siteUrl();
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site },
        { "@type": "ListItem", position: 2, name: "Stocks", item: `${site}/dashboard` },
        { "@type": "ListItem", position: 3, name: symbol, item: `${site}/stock/${symbol}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FinancialProduct",
      name: `${meta.name} (${symbol})`,
      description: `${meta.name} share price and analysis on ${meta.exchange}.`,
      url: `${site}/stock/${symbol}`,
      category: meta.sector,
      provider: { "@type": "Organization", name: "stocकaar" },
    },
  ];

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StickyScrollLayout hero={heroShell} sections={sections}>
        <StickySection id="overview">
          <SectionHeader title="Overview" subtitle="Live chart and day statistics" />
          <PriceChart symbol={symbol} exchange={meta.exchange} />
          <Suspense fallback={<SectionSkeleton h={140} />}>
            <DayStats symbol={symbol} exchange={meta.exchange} />
          </Suspense>
        </StickySection>

        <StickySection id="performance">
          <SectionHeader title="Performance" subtitle="Returns across timeframes" />
          <LazyMount>
            <PerformanceReturns symbol={symbol} exchange={meta.exchange} />
          </LazyMount>
        </StickySection>

        <StickySection id="ai-brief">
          <SectionHeader
            title="AI Brief & Latest Updates"
            subtitle="Generated insights synthesised with the latest news"
            badge="Pro"
          />
          <LazyMount>
            <Suspense fallback={<SectionSkeleton h={320} />}>
              <AIBriefBlock symbol={symbol} exchange={meta.exchange} />
            </Suspense>
          </LazyMount>
        </StickySection>

        <StickySection id="news">
          <SectionHeader title={`News about ${symbol}`} subtitle="Multi-source: Yahoo, Google News, Bing" />
          <LazyMount minHeight={200}>
            <Suspense fallback={<SectionSkeleton h={300} />}>
              <NewsSection symbol={symbol} exchange={meta.exchange} limit={12} />
            </Suspense>
          </LazyMount>
        </StickySection>

        <Suspense fallback={<SectionSkeleton />}>
          <ScorecardSection symbol={symbol} exchange={meta.exchange} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <FundamentalsSection symbol={symbol} exchange={meta.exchange} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <FinancialsSection symbol={symbol} exchange={meta.exchange} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <AnalystSection symbol={symbol} exchange={meta.exchange} />
        </Suspense>
      </StickyScrollLayout>

      <div className="mt-10">
        <Disclaimer variant="bold" />
      </div>
      <Disclaimer className="mt-4" />
    </main>
  );
}

// --- Streamed hero sub-blocks ---

async function HeroPrice({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const quote = await getQuote(symbol, exchange);
  if (!quote) return null;
  return <LiveHeroPrice initial={quote} symbol={symbol} exchange={exchange} />;
}

function HeroPriceSkeleton() {
  return (
    <div className="mt-5 space-y-2">
      <div className="h-9 w-32 shimmer rounded" />
      <div className="h-6 w-28 shimmer rounded" />
      <div className="h-3 w-40 shimmer rounded" />
    </div>
  );
}

async function HeroActions({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let alreadyAdded = false;
  if (user) {
    const { data } = await supabase
      .from("watchlist_items")
      .select("id")
      .eq("user_id", user.id)
      .eq("symbol", symbol)
      .maybeSingle();
    alreadyAdded = !!data;
  }
  return (
    <>
      <AddStockDetailButton symbol={symbol} exchange={exchange} alreadyAdded={alreadyAdded} />
      <Link
        href={`/alerts?symbol=${symbol}`}
        className="btn-ghost w-full justify-center"
      >
        <Bell className="h-3.5 w-3.5" /> Set price alert
      </Link>
    </>
  );
}

async function DayStats({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const quote = await getQuote(symbol, exchange);
  if (!quote) return null;
  return (
    <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Open" value={formatINR(quote.lastPrice - quote.change)} />
        <Stat label="Day High" value={formatINR(quote.dayHigh)} />
        <Stat label="Day Low" value={formatINR(quote.dayLow)} />
        <Stat label="Prev Close" value={formatINR(quote.lastPrice - quote.change)} />
      </div>
    </div>
  );
}

async function ScorecardSection({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const [fundamentals, quote] = await Promise.all([
    getFundamentals(symbol, exchange),
    getQuote(symbol, exchange),
  ]);
  const scorecard = fundamentals ? buildScorecard(fundamentals, quote) : null;
  return (
    <StickySection id="scorecard">
      <SectionHeader title="Scorecard" subtitle="4-pillar composite score" />
      {scorecard ? (
        <ScorecardView scorecard={scorecard} />
      ) : (
        <Empty>Scorecard unavailable for this stock.</Empty>
      )}
    </StickySection>
  );
}

async function FundamentalsSection({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const [fundamentals, quote] = await Promise.all([
    getFundamentals(symbol, exchange),
    getQuote(symbol, exchange),
  ]);
  const yearHigh = quote?.yearHigh ?? fundamentals?.yearHigh;
  const yearLow = quote?.yearLow ?? fundamentals?.yearLow;
  return (
    <StickySection id="fundamentals">
      <SectionHeader title="Fundamentals" subtitle="Key metrics and 52-week range" />
      <div className="space-y-5">
        {quote && (
          <LazyMount minHeight={120}>
            <WhyCareToday quote={quote} fundamentals={fundamentals} />
          </LazyMount>
        )}
        {quote && yearHigh && yearLow && (
          <LazyMount minHeight={80}>
            <RangeBar low={yearLow} high={yearHigh} current={quote.lastPrice} />
          </LazyMount>
        )}
        {fundamentals && (
          <LazyMount minHeight={200}>
            <KeyStats f={fundamentals} />
          </LazyMount>
        )}
      </div>
    </StickySection>
  );
}

async function FinancialsSection({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const fundamentals = await getFundamentals(symbol, exchange);
  return (
    <StickySection id="financials">
      <SectionHeader title="Financials" subtitle="Income, balance sheet, cash flow" />
      {fundamentals ? (
        <LazyMount>
          <Financials f={fundamentals} />
        </LazyMount>
      ) : <Empty>No financial data available.</Empty>}
    </StickySection>
  );
}

async function AnalystSection({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const fundamentals = await getFundamentals(symbol, exchange);
  return (
    <StickySection id="analyst">
      <SectionHeader title="Analyst Ratings" subtitle="Street recommendations" />
      {fundamentals?.analystCounts ? (
        <LazyMount minHeight={160}>
          <AnalystRatings f={fundamentals} />
        </LazyMount>
      ) : <Empty>No analyst ratings available.</Empty>}
    </StickySection>
  );
}

async function AIBriefBlock({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const brief = await getAIBrief(symbol, exchange);
  return <AIBrief brief={brief} />;
}

function SectionHeader({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        <h2 className="text-lg font-bold tracking-tight sm:text-xl md:text-2xl">{title}</h2>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
      {badge && <span className="chip chip-brand text-[10px]"><Sparkles className="h-3 w-3" /> {badge}</span>}
    </div>
  );
}

function SectionSkeleton({ h = 256 }: { h?: number }) {
  return <div className="shimmer rounded-2xl" style={{ height: h }} />;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted">
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: "accent" | "danger" }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted">{label}</div>
      <div className={cn(
        "mt-1 text-lg font-bold tabular-nums",
        color === "accent" && "text-accent",
        color === "danger" && "text-danger",
      )}>
        {value}
      </div>
    </div>
  );
}
