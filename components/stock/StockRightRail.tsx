import { Suspense } from "react";
import Link from "next/link";
import {
  Award, Users, Activity, Calendar, Sparkles, GitCompare, TrendingUp, MessageCircle,
} from "lucide-react";
import { getQuote } from "@/lib/upstox";
import { getFundamentals, type Fundamentals } from "@/lib/fundamentals";
import { fetchCorporateActions } from "@/lib/events";
import { buildScorecard } from "@/lib/scorecard";
import { getPeers } from "@/lib/peers";
import { getAIBrief } from "@/lib/ai-brief";
import { getRecentGuidance } from "@/lib/guidance";
import { StockLogo } from "@/components/StockLogo";
import { cn, formatCompactINR, formatINR } from "@/lib/utils";
import type { Sector } from "@/lib/nse-symbols";

type Props = {
  symbol: string;
  exchange: "NSE" | "BSE";
  sector: Sector;
};

export function StockRightRail({ symbol, exchange, sector }: Props) {
  return (
    <div className="space-y-3">
      <Suspense fallback={<CardSkeleton h={200} />}>
        <ScoreAnalystCard symbol={symbol} exchange={exchange} />
      </Suspense>
      <Suspense fallback={<CardSkeleton h={160} />}>
        <RangeAndActionCard symbol={symbol} exchange={exchange} />
      </Suspense>
      <Suspense fallback={<CardSkeleton h={120} />}>
        <GuidanceCard symbol={symbol} />
      </Suspense>
      <Suspense fallback={<CardSkeleton h={140} />}>
        <AIBriefTeaserCard symbol={symbol} exchange={exchange} />
      </Suspense>
      <Suspense fallback={<CardSkeleton h={200} />}>
        <PeersCard symbol={symbol} sector={sector} />
      </Suspense>
    </div>
  );
}

/* ------------------------------- Shared shell ------------------------------ */

function RailCard({
  title,
  icon,
  href,
  badge,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  href?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const inner = (
    <div className="surface hover-lift group relative overflow-hidden p-3.5 shadow-soft">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-brand via-brand-2 to-transparent opacity-70"
      />
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/10 text-brand ring-1 ring-brand/25">
            {icon}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-fg">{title}</span>
        </div>
        {badge && <span className="chip chip-brand text-[9px]">{badge}</span>}
      </div>
      {children}
    </div>
  );
  if (!href) return inner;
  return (
    <a href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-2xl">
      {inner}
    </a>
  );
}

function CardSkeleton({ h }: { h: number }) {
  return <div className="shimmer rounded-2xl" style={{ height: h }} />;
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-muted">{children}</div>;
}

/* ------------------------- 1. Scorecard + Analyst ------------------------- */

async function ScoreAnalystCard({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const [fundamentals, quote] = await Promise.all([
    getFundamentals(symbol, exchange).catch(() => null),
    getQuote(symbol, exchange).catch(() => null),
  ]);
  const scorecard = fundamentals ? buildScorecard(fundamentals, quote) : null;
  const target = fundamentals?.targetMeanPrice ?? null;
  const price = quote?.lastPrice ?? null;
  const upside = target && price && price > 0 ? ((target - price) / price) * 100 : null;

  const counts = fundamentals?.analystCounts;
  const totalBuy = (counts?.strongBuy ?? 0) + (counts?.buy ?? 0);
  const totalHold = counts?.hold ?? 0;
  const totalSell = (counts?.sell ?? 0) + (counts?.strongSell ?? 0);
  const totalAnalysts = totalBuy + totalHold + totalSell;

  return (
    <RailCard title="Scorecard & Street" icon={<Award className="h-3.5 w-3.5" />} href="#scorecard">
      {scorecard ? (
        <div className="flex items-center gap-3">
          <ScoreDial value={scorecard.composite} />
          <div className="min-w-0 flex-1 space-y-1">
            {Object.values(scorecard.pillars).map((p) => (
              <PillarBar key={p.name} name={p.name} score={p.score} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyLine>Scorecard unavailable.</EmptyLine>
      )}

      <div className="my-2.5 h-px bg-border/60" />

      {totalAnalysts > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {totalAnalysts} analysts</span>
            {upside != null && (
              <span className={cn("font-semibold tabular-nums", upside >= 0 ? "text-accent" : "text-danger")}>
                {upside >= 0 ? "+" : ""}{upside.toFixed(1)}% target
              </span>
            )}
          </div>
          <ConsensusBar buy={totalBuy} hold={totalHold} sell={totalSell} />
        </div>
      ) : (
        <EmptyLine>No analyst coverage yet.</EmptyLine>
      )}
    </RailCard>
  );
}

function ScoreDial({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  const tone = value >= 70 ? "text-accent" : value >= 50 ? "text-brand" : value >= 35 ? "text-amber-400" : "text-danger";
  return (
    <div className="relative shrink-0">
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} stroke="currentColor" className="text-border" strokeWidth="5" fill="none" />
        <circle
          cx="30" cy="30" r={r}
          stroke="currentColor" className={tone} strokeWidth="5" fill="none"
          strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={c / 4} strokeLinecap="round"
          transform="rotate(-90 30 30)"
        />
      </svg>
      <div className={cn("absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums", tone)}>
        {value}
      </div>
    </div>
  );
}

function PillarBar({ name, score }: { name: string; score: number }) {
  const tone = score >= 70 ? "bg-accent" : score >= 50 ? "bg-brand" : score >= 35 ? "bg-amber-400" : "bg-danger";
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-14 truncate text-[9px] uppercase tracking-wide text-muted">{name}</span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-border/60">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${score}%` }} />
      </div>
      <span className="w-5 text-right text-[9px] font-semibold tabular-nums text-muted">{score}</span>
    </div>
  );
}

function ConsensusBar({ buy, hold, sell }: { buy: number; hold: number; sell: number }) {
  const total = buy + hold + sell || 1;
  return (
    <>
      <div className="flex h-2 overflow-hidden rounded-full bg-border/60">
        {buy > 0 && <div className="bg-accent" style={{ width: `${(buy / total) * 100}%` }} />}
        {hold > 0 && <div className="bg-amber-400" style={{ width: `${(hold / total) * 100}%` }} />}
        {sell > 0 && <div className="bg-danger" style={{ width: `${(sell / total) * 100}%` }} />}
      </div>
      <div className="flex justify-between text-[10px] tabular-nums">
        <span className="text-accent">Buy {buy}</span>
        <span className="text-amber-400">Hold {hold}</span>
        <span className="text-danger">Sell {sell}</span>
      </div>
    </>
  );
}

/* -------------------- 2. 52W Range + Next Corp Action -------------------- */

async function RangeAndActionCard({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const [quote, fundamentals, actions] = await Promise.all([
    getQuote(symbol, exchange).catch(() => null),
    getFundamentals(symbol, exchange).catch(() => null),
    fetchCorporateActions(symbol, exchange).catch(() => ({ dividends: [], splits: [], updatedAt: 0 })),
  ]);
  const high = quote?.yearHigh ?? fundamentals?.yearHigh ?? null;
  const low = quote?.yearLow ?? fundamentals?.yearLow ?? null;
  const price = quote?.lastPrice ?? null;
  const pct = high && low && price && high > low ? ((price - low) / (high - low)) * 100 : null;

  const now = Date.now();
  const upcomingDiv = actions.dividends
    .filter((d) => d.date * 1000 >= now)
    .sort((a, b) => a.date - b.date)[0];
  const upcomingSplit = actions.splits
    .filter((s) => s.date * 1000 >= now)
    .sort((a, b) => a.date - b.date)[0];
  const lastDiv = actions.dividends
    .filter((d) => d.date * 1000 < now)
    .sort((a, b) => b.date - a.date)[0];

  return (
    <RailCard title="Range & Actions" icon={<Activity className="h-3.5 w-3.5" />} href="#corporate-actions">
      {price != null && high != null && low != null && pct != null ? (
        <>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted">
            <span>52W Low</span>
            <span>{Math.round(pct)}%</span>
            <span>52W High</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] font-semibold tabular-nums">
            <span>{formatINR(low)}</span>
            <span className="text-fg">{formatINR(price)}</span>
            <span>{formatINR(high)}</span>
          </div>
          <div className="relative mt-2 h-1.5 rounded-full bg-border/60">
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand to-brand-2" style={{ width: `${pct}%` }} />
            <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg ring-2 ring-card" style={{ left: `${pct}%` }} />
          </div>
        </>
      ) : (
        <EmptyLine>Range unavailable.</EmptyLine>
      )}

      <div className="my-2.5 h-px bg-border/60" />

      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted">
        <Calendar className="h-3 w-3" />
        Corporate action
      </div>
      <div className="mt-1 text-[11px]">
        {upcomingDiv ? (
          <div className="flex items-center justify-between">
            <span className="text-fg">Dividend {formatINR(upcomingDiv.amount)}</span>
            <span className="tabular-nums text-muted">{formatDate(upcomingDiv.date)}</span>
          </div>
        ) : upcomingSplit ? (
          <div className="flex items-center justify-between">
            <span className="text-fg">Split {upcomingSplit.numerator}:{upcomingSplit.denominator}</span>
            <span className="tabular-nums text-muted">{formatDate(upcomingSplit.date)}</span>
          </div>
        ) : lastDiv ? (
          <div className="flex items-center justify-between">
            <span className="text-muted">Last div {formatINR(lastDiv.amount)}</span>
            <span className="tabular-nums text-muted">{formatDate(lastDiv.date)}</span>
          </div>
        ) : (
          <EmptyLine>No recent actions.</EmptyLine>
        )}
      </div>
    </RailCard>
  );
}

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

/* --------------------------- 3. Guidance signal --------------------------- */

async function GuidanceCard({ symbol }: { symbol: string }) {
  const rows = await getRecentGuidance({ symbol, limit: 1 }).catch(() => []);
  const g = rows[0];
  return (
    <RailCard title="Management Guidance" icon={<MessageCircle className="h-3.5 w-3.5" />} href="/guidance">
      {g ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <DirectionChip dir={g.direction} />
            <span className="text-[11px] font-semibold text-fg">{g.metric}</span>
            {g.timeframe && <span className="text-[10px] text-muted">· {g.timeframe}</span>}
          </div>
          {g.value_text && <div className="text-[11px] tabular-nums text-fg">{g.value_text}</div>}
          <p className="line-clamp-2 text-[10.5px] italic leading-snug text-muted">&ldquo;{g.quote}&rdquo;</p>
          <div className="text-[10px] text-muted">{formatDate(new Date(g.filed_at).getTime() / 1000)}</div>
        </div>
      ) : (
        <EmptyLine>No recent guidance filings.</EmptyLine>
      )}
    </RailCard>
  );
}

function DirectionChip({ dir }: { dir: "up" | "down" | "flat" | "mixed" }) {
  const styles = {
    up: "text-accent bg-accent/10 ring-accent/30",
    down: "text-danger bg-danger/10 ring-danger/30",
    flat: "text-muted bg-bg/60 ring-border",
    mixed: "text-amber-400 bg-amber-400/10 ring-amber-400/30",
  }[dir];
  const label = { up: "↑", down: "↓", flat: "→", mixed: "↔" }[dir];
  return (
    <span className={cn("inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold ring-1", styles)}>
      {label}
    </span>
  );
}

/* ----------------------------- 4. AI Brief teaser ----------------------------- */

async function AIBriefTeaserCard({ symbol, exchange }: { symbol: string; exchange: "NSE" | "BSE" }) {
  const brief = await getAIBrief(symbol, exchange).catch(() => null);
  const line = brief?.takeaway || brief?.summary || "";
  return (
    <RailCard title="AI Brief" icon={<Sparkles className="h-3.5 w-3.5" />} href="#ai-brief" badge="Pro">
      {line ? (
        <>
          <p className="line-clamp-3 text-[11.5px] leading-snug text-fg">{line}</p>
          {brief?.riskLevel && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted">
              <span>Risk</span>
              <span className={cn(
                "chip text-[9px]",
                brief.riskLevel === "Low" && "chip-accent",
                brief.riskLevel === "Medium" && "chip-warning",
                brief.riskLevel === "High" && "chip-danger",
              )}>{brief.riskLevel}</span>
              {brief.horizon && <span className="chip text-[9px]">{brief.horizon}-term</span>}
            </div>
          )}
          <div className="mt-2 text-[10px] font-semibold text-brand">Read full brief →</div>
        </>
      ) : (
        <EmptyLine>AI Brief not generated yet.</EmptyLine>
      )}
    </RailCard>
  );
}

/* ------------------------------ 5. Peer snapshot ------------------------------ */

async function PeersCard({ symbol, sector }: { symbol: string; sector: Sector }) {
  const peers = await getPeers(symbol, sector, 3).catch(() => []);
  return (
    <RailCard title={`${sector} peers`} icon={<GitCompare className="h-3.5 w-3.5" />} href="#peers">
      {peers.length > 0 ? (
        <ul className="space-y-1.5">
          {peers.map((row) => {
            const q = row.quote;
            const chg = q?.changePct ?? null;
            const up = chg != null && chg >= 0;
            return (
              <li key={row.entry.symbol}>
                <Link
                  href={`/stock/${row.entry.symbol}`}
                  className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-card/70"
                >
                  <StockLogo symbol={row.entry.symbol} sector={row.entry.sector} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-semibold text-fg">{row.entry.symbol}</div>
                    <div className="truncate text-[9px] text-muted">{formatCompactINR(row.fundamentals?.marketCap ?? 0)}</div>
                  </div>
                  {q ? (
                    <div className="text-right">
                      <div className="text-[11px] font-semibold tabular-nums text-fg">{formatINR(q.lastPrice)}</div>
                      {chg != null && (
                        <div className={cn("text-[10px] font-semibold tabular-nums", up ? "text-accent" : "text-danger")}>
                          {up ? "+" : ""}{chg.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  ) : (
                    <TrendingUp className="h-3 w-3 text-muted" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyLine>No peers found.</EmptyLine>
      )}
    </RailCard>
  );
}
