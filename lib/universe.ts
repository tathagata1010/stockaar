import { cache } from "react";
import { redis } from "./redis";
import { getQuotes, type Quote } from "./upstox";
import { getFundamentals, type Fundamentals } from "./fundamentals";
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
const SOFT_TTL_MS = 10 * 60 * 1000;
const HARD_TTL_SEC = 24 * 60 * 60;
const FUNDAMENTALS_CONCURRENCY = 24;

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
  // 1. Bulk-fetch ALL quotes in one go (mget + Yahoo v7 bulk).
  const quotes = await getQuotes(
    NSE_SYMBOLS.map((s) => ({ symbol: s.symbol, exchange: s.exchange })),
  ).catch(() => [] as Quote[]);
  const quoteBy = new Map(quotes.map((q) => [`${q.exchange}:${q.symbol}`, q]));

  // 2. Fundamentals: still per-symbol (Yahoo quoteSummary has no bulk endpoint),
  //    but cached 6h, so usually warm. Concurrency-limited fan-out.
  const rows: UniverseRow[] = new Array(NSE_SYMBOLS.length);
  for (let i = 0; i < NSE_SYMBOLS.length; i += FUNDAMENTALS_CONCURRENCY) {
    const batch = NSE_SYMBOLS.slice(i, i + FUNDAMENTALS_CONCURRENCY);
    await Promise.all(
      batch.map(async (entry, j) => {
        const fundamentals = await getFundamentals(entry.symbol, entry.exchange).catch(() => null);
        const quote = quoteBy.get(`${entry.exchange}:${entry.symbol}`) ?? null;
        rows[i + j] = buildRowFromParts(entry, quote, fundamentals);
      }),
    );
  }

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
      return startRebuild();
    }
    const age = Date.now() - envelope.builtAt;
    if (age > SOFT_TTL_MS) {
      startRebuild().catch(() => {});
    }
    return envelope.rows;
  }

  return startRebuild();
});

export async function warmUniverse(): Promise<number> {
  const rows = await startRebuild();
  return rows.length;
}
