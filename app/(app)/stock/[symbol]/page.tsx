import Link from "next/link";
import { Suspense, cache } from "react";
import { notFound } from "next/navigation";
import { getQuote } from "@/lib/upstox";
import { getFundamentals } from "@/lib/fundamentals";
import { fetchBrokerReports } from "@/lib/trendlyne-brokers";
import { getShareholdingTimeline } from "@/lib/xbrl-shp";
import { fetchYahooHistory } from "@/lib/history";
import { fetchCorporateActions } from "@/lib/events";
import { buildScorecard } from "@/lib/scorecard";
import { NSE_SYMBOLS } from "@/lib/nse-symbols";
import { formatINR, cn } from "@/lib/utils";
import { siteUrl } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { AddStockDetailButton } from "@/components/AddStockDetailButton";
import { PriceChartAdvanced } from "@/components/PriceChartAdvanced";
import { RangeBar } from "@/components/RangeBar";
import { PerformanceReturns } from "@/components/PerformanceReturns";
import { ScorecardView } from "@/components/ScorecardView";
import { KeyStats } from "@/components/KeyStats";
import { WhyCareToday } from "@/components/WhyCareToday";
import { AnalystRatings } from "@/components/AnalystRatings";
import { Financials } from "@/components/Financials";
import { Shareholding } from "@/components/Shareholding";
import { AIBrief } from "@/components/AIBrief";
import { AboutCompany } from "@/components/AboutCompany";
import { Disclaimer } from "@/components/Disclaimer";
import { StockLogo } from "@/components/StockLogo";
import { LiveHeroPrice } from "@/components/LiveHeroPrice";
import { StickyScrollLayout, StickySection, type StickySection as TS } from "@/components/StickyScrollLayout";
import { LazyMount } from "@/components/LazyMount";
import { NewsSection } from "@/components/NewsSection";
import { RelatedSurfaces } from "@/components/RelatedSurfaces";
import { HeroSparkline } from "@/components/stock/HeroSparkline";
import { HeroRangeMini } from "@/components/stock/HeroRangeMini";
import { HeroMetrics } from "@/components/stock/HeroMetrics";
import { ShareButton } from "@/components/stock/ShareButton";
import { MobileActionBar } from "@/components/stock/MobileActionBar";
import { PeerComparison } from "@/components/stock/PeerComparison";
import { CorporateActions } from "@/components/stock/CorporateActions";
import { StockRightRail } from "@/components/stock/StockRightRail";
import { getPeers } from "@/lib/peers";
import { getAIBrief } from "@/lib/ai-brief";
import {
  LineChart, Activity, Award, BarChart3, Sparkles, Building2, Users,
  Bell, Newspaper, PieChart, Calendar, GitCompare,
} from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  // No build-time prerender — page is force-dynamic. Returning [] avoids
  // fanning out to 100 symbols × ~10 upstream fetches at build time.
  return [];
}

export async function generateMetadata(props: { params: Promise<{ symbol: string }> }) {
  const params = await props.params;
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

export default async function StockDetailPage(props: { params: Promise<{ symbol: string }> }) {
  const params = await props.params;
  const symbol = params.symbol.toUpperCase();
  const meta = NSE_SYMBOLS.find((s) => s.symbol === symbol);
  if (!meta) notFound();

  const heroShell = (
    <>
      <div className="flex items-center gap-3">
        <StockLogo symbol={symbol} sector={meta.sector} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate t-hero">{symbol}</h1>
            <span className="chip chip--brand text-[10px]">{meta.exchange}</span>
          </div>
          <p className="truncate t-caption t-muted">{meta.name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="chip chip--muted text-[10px]">{meta.sector}</span>
            {meta.industry && <span className="chip chip--muted text-[10px]">{meta.industry}</span>}
          </div>
        </div>
      </div>

      <div className="divider-soft my-4" />

      <Suspense fallback={<HeroBlockSkeleton />}>
        <HeroBlock symbol={symbol} exchange={meta.exchange} />
      </Suspense>

      <div className="mt-3">
        <HeroSparkline symbol={symbol} exchange={meta.exchange} />
      </div>

      <div className="divider-soft my-4" />

      <div className="flex flex-col gap-2">
        <Suspense fallback={<div className="h-10 shimmer rounded-lg" />}>
          <HeroActions symbol={symbol} exchange={meta.exchange} />
        </Suspense>
        <ShareButton symbol={symbol} name={meta.name} />
      </div>

      <Link href="/dashboard" className="mt-4 inline-block t-caption t-muted transition-colors duration-fast ease-out hover:text-brand">
        ← Back to dashboard
      </Link>
    </>
  );

  const sections: TS[] = [
    { id: "overview", label: "Overview", icon: <LineChart className="h-3.5 w-3.5" /> },
    { id: "about", label: "About", icon: <Building2 className="h-3.5 w-3.5" /> },
    { id: "peers", label: "Peers", icon: <GitCompare className="h-3.5 w-3.5" /> },
    { id: "performance", label: "Performance", icon: <Activity className="h-3.5 w-3.5" /> },
    { id: "ai-brief", label: "AI Brief", icon: <Sparkles className="h-3.5 w-3.5" />, badge: "Pro" },
    { id: "news", label: "News", icon: <Newspaper className="h-3.5 w-3.5" /> },
    { id: "scorecard", label: "Scorecard", icon: <Award className="h-3.5 w-3.5" /> },
    { id: "fundamentals", label: "Fundamentals", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: "shareholding", label: "Shareholding", icon: <PieChart className="h-3.5 w-3.5" /> },
    { id: "corporate-actions", label: "Actions", icon: <Calendar className="h-3.5 w-3.5" /> },
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
      <StickyScrollLayout
        hero={heroShell}
        sections={sections}
        rightRail={<StockRightRail symbol={symbol} exchange={meta.exchange} sector={meta.sector} />}
      >
        <StickySection id="overview">
          <SectionHeader title="Overview" subtitle="Live chart with moving averages, volume, and RSI" />
          <PriceChartAdvanced symbol={symbol} exchange={meta.exchange} />
          <Suspense fallback={<SectionSkeleton h={140} />}>
            <DayStats symbol={symbol} exchange={meta.exchange} />
          </Suspense>
        </StickySection>

        <StickySection id="about">
          <SectionHeader title={`About ${meta.name}`} subtitle="Business summary and company profile" />
          <Suspense fallback={<SectionSkeleton h={200} />}>
            <AboutSection
              symbol={symbol}
              exchange={meta.exchange}
              name={meta.name}
              sector={meta.sector}
              industry={meta.industry}
            />
          </Suspense>
        </StickySection>

        <StickySection id="peers">
          <SectionHeader title="Peer comparison" subtitle={`Top ${meta.sector} stocks by market cap`} />
          <Suspense fallback={<SectionSkeleton h={320} />}>
            <PeersSection symbol={symbol} sector={meta.sector} />
          </Suspense>
        </StickySection>

        <StickySection id="performance">
          <SectionHeader title="Performance" subtitle="Returns across timeframes" />
          <Suspense fallback={<SectionSkeleton h={180} />}>
            <PerformanceSection symbol={symbol} exchange={meta.exchange} />
          </Suspense>
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
          <SectionHeader title={`News about ${symbol}`} subtitle="Filtered to headlines that mention this stock" />
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
          <ShareholdingSection symbol={symbol} exchange={meta.exchange} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <CorporateActionsSection symbol={symbol} exchange={meta.exchange} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <FinancialsSection symbol={symbol} exchange={meta.exchange} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <AnalystSection symbol={symbol} exchange={meta.exchange} />
        </Suspense>
      </StickyScrollLayout>

      <Suspense fallback={null}>
        <MobileActionBarWrapper symbol={symbol} exchange={meta.exchange} name={meta.name} />
      </Suspense>

      <div className="mt-10 pb-24 lg:pb-0">
        <Disclaimer variant="bold" />
      </div>
      <RelatedSurfaces
        kind="stock"
        contextSymbol={symbol}
        contextName={meta.name}
        sector={meta.sector}
      />
    </main>
  );
}

// --- Streamed hero sub-blocks ---

async function HeroBlock({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const [quote, fundamentals] = await Promise.all([
    getQuote(symbol, exchange),
    getFundamentals(symbol, exchange),
  ]);
  if (!quote) return null;
  return (
    <div className="space-y-4">
      <LiveHeroPrice initial={quote} symbol={symbol} exchange={exchange} />
      <HeroRangeMini initial={quote} symbol={symbol} exchange={exchange} />
      <HeroMetrics fundamentals={fundamentals} quote={quote} />
    </div>
  );
}

const isOnWatchlist = cache(async (symbol: string): Promise<boolean> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("watchlist_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("symbol", symbol)
    .maybeSingle();
  return !!data;
});

async function MobileActionBarWrapper({ symbol, exchange, name }: { symbol: string; exchange: "NSE" | "BSE"; name: string }) {
  const alreadyAdded = await isOnWatchlist(symbol);
  return <MobileActionBar symbol={symbol} exchange={exchange} alreadyAdded={alreadyAdded} name={name} />;
}

function HeroBlockSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-9 w-32 shimmer rounded" />
        <div className="h-6 w-28 shimmer rounded" />
        <div className="h-3 w-40 shimmer rounded" />
      </div>
      <div className="h-3 w-full shimmer rounded" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-12 shimmer rounded-lg" />
        <div className="h-12 shimmer rounded-lg" />
        <div className="h-12 shimmer rounded-lg" />
        <div className="h-12 shimmer rounded-lg" />
      </div>
    </div>
  );
}

async function HeroActions({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const alreadyAdded = await isOnWatchlist(symbol);
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
  const prevClose = quote.lastPrice - quote.change;
  const changeColor = quote.change >= 0 ? "accent" : "danger";
  return (
    <div className="surface mt-5 p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Prev Close" value={formatINR(prevClose)} />
        <Stat label="Day High" value={formatINR(quote.dayHigh)} />
        <Stat label="Day Low" value={formatINR(quote.dayLow)} />
        <Stat
          label="Change"
          value={`${quote.change >= 0 ? "+" : ""}${formatINR(quote.change)}`}
          color={changeColor}
        />
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
          <LazyMount minHeight={180}>
            <WhyCareToday symbol={symbol} exchange={exchange} quote={quote} fundamentals={fundamentals} />
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

async function ShareholdingSection({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  // FII/DII/MF/Retail timeline only available for NSE-listed names.
  const timeline = exchange === "NSE" ? await getShareholdingTimeline(symbol) : null;
  return (
    <StickySection id="shareholding">
      <SectionHeader title="Shareholding" subtitle="Promoter / FII / DII split and quarterly trend" />
      <Shareholding timeline={timeline} />
    </StickySection>
  );
}

async function PerformanceSection({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const history = await fetchYahooHistory(symbol, exchange, "1y");
  return <PerformanceReturns points={history?.points ?? []} />;
}

async function PeersSection({ symbol, sector }: { symbol: string; sector: import("@/lib/nse-symbols").Sector }) {
  const peers = await getPeers(symbol, sector, 5);
  return <PeerComparison currentSymbol={symbol} peers={peers} />;
}

async function CorporateActionsSection({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const actions = await fetchCorporateActions(symbol, exchange);
  return (
    <StickySection id="corporate-actions">
      <SectionHeader title="Corporate Actions" subtitle="Dividends, splits, and bonuses over the last 5 years" />
      <CorporateActions actions={actions} />
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
  const [fundamentals, brokerReports] = await Promise.all([
    getFundamentals(symbol, exchange),
    exchange === "NSE" ? fetchBrokerReports(symbol) : Promise.resolve([]),
  ]);
  const hasData = (fundamentals?.analystCounts?.buy ?? 0) + (fundamentals?.analystCounts?.strongBuy ?? 0)
    + (fundamentals?.analystCounts?.hold ?? 0) + (fundamentals?.analystCounts?.sell ?? 0)
    + (fundamentals?.analystCounts?.strongSell ?? 0) > 0 || brokerReports.length > 0;
  return (
    <StickySection id="analyst">
      <SectionHeader title="Analyst Ratings" subtitle="Street recommendations" />
      {hasData ? (
        <LazyMount minHeight={160}>
          <AnalystRatings f={fundamentals} reports={brokerReports} />
        </LazyMount>
      ) : <Empty>No analyst ratings available.</Empty>}
    </StickySection>
  );
}

async function AIBriefBlock({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const brief = await getAIBrief(symbol, exchange);
  return <AIBrief brief={brief} />;
}

async function AboutSection({
  symbol,
  exchange,
  name,
  sector,
  industry,
}: {
  symbol: string;
  exchange: "NSE" | "BSE";
  name: string;
  sector?: string;
  industry?: string;
}) {
  const fundamentals = await getFundamentals(symbol, exchange);
  return (
    <AboutCompany
      name={name}
      symbol={symbol}
      fundamentals={fundamentals}
      fallbackSector={sector}
      fallbackIndustry={industry}
    />
  );
}

function SectionHeader({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        <h2 className="t-h1">{title}</h2>
        {subtitle && <p className="t-caption t-muted">{subtitle}</p>}
      </div>
      {badge && <span className="chip chip--brand text-[10px]"><Sparkles className="h-3 w-3" /> {badge}</span>}
    </div>
  );
}

function SectionSkeleton({ h = 256 }: { h?: number }) {
  return <div className="shimmer rounded-lg" style={{ height: h }} />;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface-outline rounded-lg border-dashed p-6 t-body t-muted">
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: "accent" | "danger" }) {
  return (
    <div>
      <div className="t-label">{label}</div>
      <div className={cn(
        "mt-1 t-num text-lg font-bold",
        color === "accent" && "text-accent",
        color === "danger" && "text-danger",
      )}>
        {value}
      </div>
    </div>
  );
}
