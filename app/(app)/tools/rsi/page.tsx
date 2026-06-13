import Link from "next/link";
import { Suspense } from "react";
import { getUniverse } from "@/lib/universe";
import { redis } from "@/lib/redis";
import { computeRSI } from "@/lib/rsi";
import { Disclaimer } from "@/components/Disclaimer";
import { StockLogo } from "@/components/StockLogo";
import { cn, formatINR, formatPct } from "@/lib/utils";
import { Activity, Gauge, TrendingDown, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";
export const revalidate = 900;

type RsiRow = {
  symbol: string;
  name: string;
  sector: import("@/lib/nse-symbols").Sector;
  rsi: number;
  lastPrice: number | null;
  changePct: number | null;
};

const RSI_TTL = 60 * 60; // 1h per symbol
const SCAN_LIMIT = 80;   // cap for cold-start friendliness

async function fetchCloses(symbol: string, exchange: "NSE" | "BSE"): Promise<number[] | null> {
  const cacheKey = `rsi-closes:${exchange}:${symbol}:v1`;
  const cached = await redis.get<number[]>(cacheKey).catch(() => null);
  if (cached) return cached;

  const suffix = exchange === "BSE" ? ".BO" : ".NS";
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + suffix)}?interval=1d&range=2mo`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; StocksbrewBot/1.0)", Accept: "application/json" },
        next: { revalidate: 0 },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const r = data.chart?.result?.[0];
    const closes: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? [];
    const out = closes.filter((c): c is number => typeof c === "number");
    if (out.length === 0) return null;
    await redis.set(cacheKey, out, { ex: RSI_TTL }).catch(() => {});
    return out;
  } catch {
    return null;
  }
}

async function scan(): Promise<RsiRow[]> {
  const universe = await getUniverse();
  // Limit to first SCAN_LIMIT by market cap for performance
  const top = [...universe]
    .filter((r) => r.fundamentals?.marketCap)
    .sort((a, b) => (b.fundamentals?.marketCap ?? 0) - (a.fundamentals?.marketCap ?? 0))
    .slice(0, SCAN_LIMIT);

  const BATCH = 8;
  const results: RsiRow[] = [];
  for (let i = 0; i < top.length; i += BATCH) {
    const batch = top.slice(i, i + BATCH);
    const out = await Promise.all(
      batch.map(async (r) => {
        const closes = await fetchCloses(r.entry.symbol, r.entry.exchange);
        if (!closes) return null;
        const rsi = computeRSI(closes, 14);
        if (rsi == null) return null;
        return {
          symbol: r.entry.symbol,
          name: r.entry.name,
          sector: r.entry.sector,
          rsi,
          lastPrice: r.quote?.lastPrice ?? null,
          changePct: r.quote?.changePct ?? null,
        } satisfies RsiRow;
      }),
    );
    for (const v of out) if (v) results.push(v);
  }
  return results;
}

async function RsiTables() {
  const rows = await scan();
  const oversold = rows.filter((r) => r.rsi < 30).sort((a, b) => a.rsi - b.rsi);
  const overbought = rows.filter((r) => r.rsi > 70).sort((a, b) => b.rsi - a.rsi);
  const neutral = rows.length - oversold.length - overbought.length;

  return (
    <>
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <KPI label="Scanned" value={rows.length} tone="brand" />
        <KPI label="Oversold (RSI<30)" value={oversold.length} tone="accent" icon={<TrendingDown className="h-4 w-4" />} />
        <KPI label="Overbought (RSI>70)" value={overbought.length} tone="danger" icon={<TrendingUp className="h-4 w-4" />} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <RsiTable
          title="Oversold — RSI below 30"
          description="Potentially undervalued / due for a bounce. Confirm with fundamentals."
          rows={oversold}
          tone="accent"
        />
        <RsiTable
          title="Overbought — RSI above 70"
          description="Potentially overextended / due for a pullback. Caution on entries."
          rows={overbought}
          tone="danger"
        />
      </section>

      <p className="mt-4 text-xs text-muted">
        {neutral} stocks in the neutral 30–70 zone.
      </p>
    </>
  );
}

function Skeleton() {
  return (
    <>
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <SectionSkeleton h={92} />
        <SectionSkeleton h={92} />
        <SectionSkeleton h={92} />
      </section>
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <SectionSkeleton h={420} />
        <SectionSkeleton h={420} />
      </section>
    </>
  );
}

function SectionSkeleton({ h = 256 }: { h?: number }) {
  return <div className="shimmer rounded-2xl" style={{ height: h }} />;
}

export default function RsiPage() {
  return (
    <AppShell>
      <section className="mesh-hero relative overflow-hidden rounded-3xl border border-border-strong bg-card/40 p-4 shadow-glow sm:p-6 md:p-8 lg:p-10">
        <div className="chip chip-brand mb-3">
          <Activity className="h-3 w-3" />
          Scanned {SCAN_LIMIT} stocks · Wilder RSI(14)
        </div>
        <h1 className="num-display text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
          RSI <span className="text-gradient-animate">Scanner</span>
        </h1>
        <p className="mt-3 max-w-2xl text-xs text-muted sm:text-sm md:text-base">
          14-day Relative Strength Index across India&apos;s top {SCAN_LIMIT} stocks. Spot oversold bounces and overbought pullbacks.
        </p>
      </section>

      <Suspense fallback={<Skeleton />}>
        <RsiTables />
      </Suspense>

      <Disclaimer className="mt-10" />
    </AppShell>
  );
}

function KPI({ label, value, tone, icon }: {
  label: string; value: number; tone: "brand" | "accent" | "danger"; icon?: React.ReactNode;
}) {
  const ring = tone === "accent" ? "bg-accent/15 text-accent ring-accent/30"
    : tone === "danger" ? "bg-danger/15 text-danger ring-danger/30"
    : "bg-brand/15 text-brand ring-brand/30";
  return (
    <div className="surface-strong rounded-2xl p-5 shadow-soft">
      <div className="flex items-center gap-2">
        {icon && <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg ring-1", ring)}>{icon}</span>}
        <div className="text-[10px] uppercase text-muted">{label}</div>
      </div>
      <div className="num-display mt-2 text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function RsiTable({ title, description, rows, tone }: {
  title: string; description: string; rows: RsiRow[]; tone: "accent" | "danger";
}) {
  return (
    <div className="surface overflow-hidden rounded-2xl shadow-soft">
      <div className="border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg ring-1",
            tone === "accent" ? "bg-accent/15 text-accent ring-accent/30" : "bg-danger/15 text-danger ring-danger/30",
          )}>
            <Gauge className="h-4 w-4" />
          </span>
          {title}
        </div>
        <p className="mt-1 text-[11px] text-muted">{description}</p>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-sm text-muted">No matches right now.</div>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((r) => (
            <li key={r.symbol}>
              <Link href={`/stock/${r.symbol}`} className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-bg/60">
                <div className="flex min-w-0 items-center gap-3">
                  <StockLogo symbol={r.symbol} sector={r.sector} size="sm" />
                  <div className="min-w-0">
                    <div className="font-semibold">{r.symbol}</div>
                    <div className="text-[11px] text-muted line-clamp-1">{r.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {r.lastPrice != null && (
                    <span className="hidden sm:inline tabular-nums text-xs text-muted">{formatINR(r.lastPrice)}</span>
                  )}
                  {r.changePct != null && (
                    <span className={cn(
                      "hidden sm:inline rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                      r.changePct >= 0 ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger",
                    )}>
                      {formatPct(r.changePct)}
                    </span>
                  )}
                  <span className={cn(
                    "num-display min-w-[56px] rounded-md px-2 py-1 text-center text-sm font-bold tabular-nums ring-1",
                    tone === "accent" ? "bg-accent/10 text-accent ring-accent/30" : "bg-danger/10 text-danger ring-danger/30",
                  )}>
                    {r.rsi.toFixed(1)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
