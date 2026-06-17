// Hardened Yahoo Finance fetch wrapper. Used by every Yahoo call site instead
// of raw fetch(). Adds: token-bucket rate limit, per-host circuit breaker,
// retry+jitter on 429/5xx, auth refresh on 401/403.

import { getYahooCrumb, invalidateYahooCrumb, YAHOO_UA } from "../yahoo-auth";

const BURST_TOKENS = 60;
const REFILL_PER_SEC = 20;
const MAX_RETRIES = 3;
const CIRCUIT_FAIL_THRESHOLD = 5;
const CIRCUIT_OPEN_MS = 30_000;
const REQUEST_TIMEOUT_MS = 8000;

type CircuitState = "closed" | "open" | "half-open";
type Circuit = { state: CircuitState; failures: number; openedAt: number };

const circuits = new Map<string, Circuit>();

function getCircuit(host: string): Circuit {
  let c = circuits.get(host);
  if (!c) {
    c = { state: "closed", failures: 0, openedAt: 0 };
    circuits.set(host, c);
  }
  return c;
}

function recordSuccess(host: string) {
  const c = getCircuit(host);
  c.state = "closed";
  c.failures = 0;
  c.openedAt = 0;
}

function recordFailure(host: string) {
  const c = getCircuit(host);
  if (c.state === "open") return;
  c.failures += 1;
  if (c.failures >= CIRCUIT_FAIL_THRESHOLD) {
    c.state = "open";
    c.openedAt = Date.now();
    console.warn(`[yahoo/client] circuit OPEN for ${host} after ${c.failures} failures`);
  }
}

function canPass(host: string): boolean {
  const c = getCircuit(host);
  if (c.state === "closed") return true;
  if (c.state === "open" && Date.now() - c.openedAt >= CIRCUIT_OPEN_MS) {
    c.state = "half-open";
    return true;
  }
  return c.state === "half-open";
}

let tokens = BURST_TOKENS;
let lastRefill = Date.now();

async function takeToken(): Promise<void> {
  while (true) {
    const now = Date.now();
    const elapsed = (now - lastRefill) / 1000;
    if (elapsed > 0) {
      tokens = Math.min(BURST_TOKENS, tokens + elapsed * REFILL_PER_SEC);
      lastRefill = now;
    }
    if (tokens >= 1) {
      tokens -= 1;
      return;
    }
    const waitMs = Math.ceil(((1 - tokens) / REFILL_PER_SEC) * 1000) + Math.floor(Math.random() * 50);
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  const base = 200 * Math.pow(2, attempt);
  return base + Math.random() * 150;
}

export type YahooFetchOptions = {
  withAuth?: boolean;  // append crumb + Cookie header (default true)
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export async function yahooFetch(url: string, opts: YahooFetchOptions = {}): Promise<Response | null> {
  if (process.env.YAHOO_DISABLE === "1") return null;
  const host = new URL(url).host;
  if (!canPass(host)) return null;

  const withAuth = opts.withAuth ?? true;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await takeToken();

    let target = url;
    const headers: Record<string, string> = {
      "User-Agent": YAHOO_UA,
      Accept: "application/json",
      ...opts.headers,
    };

    if (withAuth) {
      const auth = await getYahooCrumb().catch(() => null);
      if (auth) {
        const u = new URL(target);
        if (!u.searchParams.has("crumb")) u.searchParams.set("crumb", auth.crumb);
        target = u.toString();
        headers.Cookie = auth.cookie;
      }
    }

    try {
      const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
      const signal = opts.signal
        ? AbortSignal.any([opts.signal, timeoutSignal])
        : timeoutSignal;
      const res = await fetch(target, {
        headers,
        signal,
        next: { revalidate: 0 },
      });

      if (res.status === 401 || res.status === 403) {
        await invalidateYahooCrumb();
        if (attempt < MAX_RETRIES) {
          await sleep(backoffMs(attempt));
          continue;
        }
      }

      if (res.status === 429 || res.status >= 500) {
        if (attempt < MAX_RETRIES) {
          await sleep(backoffMs(attempt));
          continue;
        }
        recordFailure(host);
        return null;
      }

      // 2xx, 3xx, 4xx other than auth = treat as definitive; don't burn retries.
      recordSuccess(host);
      return res;
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") throw e;
      if (attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt));
        continue;
      }
      recordFailure(host);
      return null;
    }
  }

  recordFailure(host);
  return null;
}

// Test helpers — exposed for unit tests in phase 5.
export function _resetCircuits() {
  circuits.clear();
}

export function _getCircuitState(host: string): CircuitState {
  return getCircuit(host).state;
}
