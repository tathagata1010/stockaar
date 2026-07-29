import { cache } from "react";
import { redis } from "./redis";
import { getQuotes, type Quote } from "./upstox";
import { getFundamentalsMany, type Fundamentals } from "./fundamentals";
import { NSE_SYMBOLS, type SymbolEntry } from "./nse-symbols";
import { buildScorecard, deriveSignal, type Scorecard, type Signal } from "./scorecard";

export type UniverseRow = {
  entry: SymbolEntry;
  quote: Quote | null;
  fundamentals: Fundamentals | null;
  scorecard: Scorecard | null;
  signal: Signal | null;
  rangePosition: number | null;
};

const UNIVERSE_KEY = "universe:v5";
// Long soft TTL + generous jitter → very few background rebuilds/day.
// Fundamentals barely change intraday; quote freshness is handled by the quote
// cache separately (so a row's price column refreshes via getQuotes on read).
const SOFT_TTL_MS = 2 * 60 * 60 * 1000;
const SOFT_TTL_JITTER_MS = 15 * 60 * 1000;
const HARD_TTL_SEC = 24 * 60 * 60;
const FUNDAMENTALS_CONCURRENCY = 24;
// Hard wall-clock budget for a full rebuild. Kept comfortably under the
// warm-universe route's `maxDuration` (300s) so the function always returns
// a valid (possibly partial) response instead of being force-killed by the
// platform with nothing saved. Partial fundamentals misses simply aren't
// cached, so the next cron tick resumes and fills them in — the rebuild
// self-heals across runs instead of retrying the same 250+ symbols forever
// whenever Yahoo is slow/unreachable.
const REBUILD_BUDGET_MS = 240_000;
// If a cold rebuild (no cache) doesn't finish quickly, we don't want to
// block SSR for minutes. Callers get an empty universe; the rebuild keeps
// running in the background and populates the LRU/Redis for the next request.
const COLD_REBUILD_WAIT_MS = 12_000;

type Envelope = { builtAt: number; rows: UniverseRow[] };

let inflight: Promise<UniverseRow[]> | null = null;

function buildRowFromParts(
  entry: SymbolEntry,
  quote: Quote | null,
  fundamentals: Fundamentals | null,
): UniverseRow {
  const scorecard = fundamentals ? buildScorecard(fundamentals, quote) : null;
  const signal = scorecard ? deriveSignal(scorecard).signal : null;

  const yHigh = quote?.yearHigh ?? fundamentals?.yearHigh;
  const yLow = quote?.yearLow ?? fundamentals?.yearLow;
  const rangePosition =
    quote && yHigh && yLow && yHigh > yLow
      ? ((quote.lastPrice - yLow) / (yHigh - yLow)) * 100
      : null;

  return { entry, quote, fundamentals, scorecard, signal, rangePosition };
}

async function rebuild(): Promise<UniverseRow[]> {
  const deadline = Date.now() + REBUILD_BUDGET_MS;

  // 1. Bulk-fetch ALL quotes in one go (mget + Yahoo v7 bulk).
  const quotes = await getQuotes(
    NSE_SYMBOLS.map((s) => ({ symbol: s.symbol, exchange: s.exchange })),
    { deadline },
  ).catch(() => [] as Quote[]);
  const quoteBy = new Map(quotes.map((q) => [`${q.exchange}:${q.symbol}`, q]));

  // 2. Fundamentals: single mget for all cache keys (~1 Redis command vs. 4000
  //    in the per-symbol path), then bounded fan-out to Yahoo only for misses.
  const fundsBy = await getFundamentalsMany(
    NSE_SYMBOLS.map((s) => ({ symbol: s.symbol, exchange: s.exchange })),
    FUNDAMENTALS_CONCURRENCY,
    deadline,
  );

  const rows: UniverseRow[] = NSE_SYMBOLS.map((entry) => {
    const key = `${entry.exchange}:${entry.symbol}`;
    return buildRowFromParts(entry, quoteBy.get(key) ?? null, fundsBy.get(key) ?? null);
  });

  const envelope: Envelope = { builtAt: Date.now(), rows };
  await redis.set(UNIVERSE_KEY, envelope, { ex: HARD_TTL_SEC }).catch(() => {});
  return rows;
}

function startRebuild(): Promise<UniverseRow[]> {
  if (inflight) return inflight;
  inflight = rebuild().finally(() => { inflight = null; });
  return inflight;
}

export const getUniverse = cache(async (): Promise<UniverseRow[]> => {
  const cached = await redis.get<Envelope | UniverseRow[]>(UNIVERSE_KEY).catch(() => null);

  const envelope: Envelope | null =
    Array.isArray(cached) ? { builtAt: 0, rows: cached }
    : cached && typeof cached === "object" && "rows" in cached ? cached
    : null;

  if (envelope && envelope.rows.length) {
    // Self-heal: if a previous build produced zero quotes (e.g. parser bug, token expiry),
    // treat the envelope as cold so the user doesn't stare at empty cards for 24h.
    const hasQuotes = envelope.rows.some((r) => r?.quote?.lastPrice);
    if (!hasQuotes) {
      await redis.del(UNIVERSE_KEY).catch(() => {});
      return waitForBuildOrEmpty();
    }
    const age = Date.now() - envelope.builtAt;
    // Jitter the soft-TTL so many concurrent SSR calls don't all trigger a
    // rebuild at the same second (thundering herd on Yahoo + Redis).
    const softExpiry = SOFT_TTL_MS + Math.floor(Math.random() * SOFT_TTL_JITTER_MS);
    if (age > softExpiry) {
      startRebuild().catch(() => {});
    }
    return envelope.rows;
  }

  return waitForBuildOrEmpty();
});

async function waitForBuildOrEmpty(): Promise<UniverseRow[]> {
  const build = startRebuild();
  const timeout = new Promise<UniverseRow[]>((resolve) => {
    setTimeout(() => resolve([]), COLD_REBUILD_WAIT_MS);
  });
  return Promise.race([build.catch(() => [] as UniverseRow[]), timeout]);
}

export async function warmUniverse(): Promise<number> {
  const rows = await startRebuild();
  return rows.length;
}
