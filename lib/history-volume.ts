import { cache } from "react";
import { redis } from "./redis";
import { fetchYahooHistory } from "./history";

const KEY = (symbol: string, exchange: "NSE" | "BSE") => `vol20d:${exchange}:${symbol}`;
const TTL_SEC = 60 * 60 * 24; // 24h — daily-bar derived, doesn't shift intraday

export const get20dAvgVolume = cache(async (
  symbol: string,
  exchange: "NSE" | "BSE" = "NSE",
): Promise<number | null> => {
  const key = KEY(symbol, exchange);
  const cached = await redis.get<number>(key).catch(() => null);
  if (typeof cached === "number" && cached > 0) return cached;

  const hist = await fetchYahooHistory(symbol, exchange, "1mo");
  if (!hist?.points?.length) return null;

  // Take the last 20 daily bars with usable volume; ignore today (in-progress).
  const daily = hist.points.filter((p) => typeof p.v === "number" && (p.v ?? 0) > 0);
  if (daily.length < 5) return null;
  const slice = daily.slice(-21, -1); // exclude latest (likely today)
  if (slice.length === 0) return null;
  const sum = slice.reduce((a, p) => a + (p.v ?? 0), 0);
  const avg = Math.round(sum / slice.length);

  await redis.set(key, avg, { ex: TTL_SEC }).catch(() => {});
  return avg;
});
