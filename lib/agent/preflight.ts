import { getQuote } from "@/lib/upstox";
import { getFundamentals } from "@/lib/fundamentals";
import { getStockNews } from "@/lib/news";
import { getInstFlows } from "@/lib/inst-flows";
import { getPeers } from "@/lib/peers";
import { buildScorecard, deriveSignal } from "@/lib/scorecard";
import { getRecentGuidance } from "@/lib/guidance";
import { scoreHeadlines } from "@/lib/alerts/materiality";
import { SYMBOL_META_BY_SYMBOL, type Sector } from "@/lib/nse-symbols";
import { fetchYahooHistory } from "@/lib/history";
import { computeSMA, computeRsiSeries } from "@/lib/technicals";

import { ALL_KINDS, type PreflightKind } from "./route";

// The single biggest quality lever for the agent: instead of trusting the
// LLM to obey "call these 8 tools in parallel," we do it ourselves before
// the LLM ever sees the question. Guarantees fresh data, kills the "1 tool
// came back empty → hallucinate the template" failure mode.

export type PreflightEvent =
  | { kind: "start"; name: string; args: Record<string, unknown> }
  | { kind: "end"; name: string; preview: string };

export type PreflightBundle = {
  symbol: string;
  fetchedAt: string; // IST HH:mm
  blocks: Array<{ label: string; text: string }>;
};

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function fmtNum(v: unknown, digits = 2): string {
  return isFiniteNum(v) ? v.toFixed(digits) : "—";
}
function fmtPct(v: unknown, digits = 2): string {
  return isFiniteNum(v) ? `${v.toFixed(digits)}%` : "—";
}
function fmtCrore(v: unknown): string {
  if (!isFiniteNum(v)) return "—";
  const cr = v / 1e7;
  if (cr >= 1e5) return `${(cr / 1e5).toFixed(2)} L Cr`;
  if (cr >= 1e3) return `${(cr / 1e3).toFixed(1)}k Cr`;
  return `${cr.toFixed(0)} Cr`;
}

async function safe<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[preflight] ${name} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function runPreflight(
  symbol: string,
  ist: string,
  onEvent: (ev: PreflightEvent) => void,
  kinds: PreflightKind[] = ALL_KINDS,
): Promise<PreflightBundle> {
  const want = new Set(kinds);
  const meta = SYMBOL_META_BY_SYMBOL[symbol];
  const sector = (meta?.sector ?? "Other") as Sector;

  const kick = (name: string, args: Record<string, unknown>) => {
    onEvent({ kind: "start", name, args });
  };
  const done = (name: string, preview: string) => {
    onEvent({ kind: "end", name, preview });
  };

  if (want.has("quote")) kick("get_quote", { symbol });
  if (want.has("fundamentals")) kick("get_fundamentals", { symbol });
  if (want.has("news")) kick("get_news", { symbol, materialOnly: true });
  if (want.has("history")) kick("get_history_stats", { symbol, range: "1y" });
  if (want.has("technicals")) kick("get_technicals", { symbol });
  if (want.has("flows")) kick("get_inst_flows", { symbol });
  if (want.has("peers")) kick("get_peers", { symbol });
  if (want.has("guidance")) kick("get_guidance", { symbol, quarters: 4 });

  // Technicals + history share the same 1y Yahoo pull — fetch history if either
  // is requested. Scorecard needs quote + fundamentals, so ensure those flow
  // through when scorecard is asked for even if the user didn't name them.
  const needHistory = want.has("history") || want.has("technicals");
  const needQuoteForScorecard = want.has("scorecard");
  const needFundForScorecard = want.has("scorecard");

  const [quote, fund, news, hist, flows, peers, guidance] = await Promise.all([
    want.has("quote") || needQuoteForScorecard ? safe("quote", () => getQuote(symbol, "NSE")) : Promise.resolve(null),
    want.has("fundamentals") || needFundForScorecard ? safe("fundamentals", () => getFundamentals(symbol)) : Promise.resolve(null),
    want.has("news") ? safe("news", () => getStockNews(symbol, "NSE", 10)) : Promise.resolve(null),
    needHistory ? safe("history", () => fetchYahooHistory(symbol, "NSE", "1y")) : Promise.resolve(null),
    want.has("flows") ? safe("flows", () => getInstFlows()) : Promise.resolve(null),
    want.has("peers") ? safe("peers", () => getPeers(symbol, sector, 5)) : Promise.resolve(null),
    want.has("guidance") ? safe("guidance", () => getRecentGuidance({ symbol, limit: 4 })) : Promise.resolve(null),
  ]);

  const blocks: PreflightBundle["blocks"] = [];

  // Quote
  if (want.has("quote")) {
    if (quote) {
      const line = `₹${fmtNum(quote.lastPrice)} · ${quote.changePct !== null && quote.changePct !== undefined ? (quote.changePct >= 0 ? "+" : "") + fmtPct(quote.changePct) : "—"} today · vol ${isFiniteNum(quote.volume) ? quote.volume.toLocaleString("en-IN") : "—"} · 52w [${fmtNum(quote.yearLow)} – ${fmtNum(quote.yearHigh)}] [Yahoo · ${ist} IST]`;
      blocks.push({ label: "Quote", text: line });
      done("get_quote", `₹${fmtNum(quote.lastPrice)} · ${(quote.changePct ?? 0) >= 0 ? "+" : ""}${fmtPct(quote.changePct)}`);
    } else {
      blocks.push({ label: "Quote", text: "unavailable" });
      done("get_quote", "unavailable");
    }
  }

  // Fundamentals
  if (want.has("fundamentals")) {
    if (fund) {
      const line = `Market cap ${fmtCrore(fund.marketCap)} · P/E ${fmtNum(fund.trailingPE)} · P/B ${fmtNum(fund.priceToBook)} · ROE ${fmtPct((fund.returnOnEquity ?? 0) * 100)} · D/E ${fmtNum(fund.debtToEquity)} · Op margin ${fmtPct((fund.operatingMargin ?? 0) * 100)} · Div yield ${fmtPct((fund.dividendYield ?? 0) * 100)} [Fundamentals]`;
      blocks.push({ label: "Fundamentals", text: line });
      done("get_fundamentals", `P/E ${fmtNum(fund.trailingPE)} · ROE ${fmtPct((fund.returnOnEquity ?? 0) * 100)}`);
    } else {
      blocks.push({ label: "Fundamentals", text: "unavailable" });
      done("get_fundamentals", "unavailable");
    }
  }

  // Scorecard (needs quote + fund)
  if (want.has("scorecard")) {
    kick("get_scorecard", { symbol });
    if (fund) {
      try {
        const scorecard = buildScorecard(fund, quote ?? null);
        const derived = deriveSignal(scorecard);
        // Map SEBI-safe internal signal keys to prompt-friendly tilt labels.
        const tilt = derived.signal === "POSITIVE" ? "positive tilt" : derived.signal === "CAUTION" ? "caution" : "neutral";
        const reasons = derived.reasons.slice(0, 2).join("; ");
        const p = scorecard.pillars;
        const line = `Composite ${scorecard.composite}/100 · valuation ${p.valuation.score} · growth ${p.growth.score} · quality ${p.quality.score} · momentum ${p.momentum.score} · signal: ${tilt}${reasons ? ` — ${reasons}` : ""} [Scorecard]`;
        blocks.push({ label: "Scorecard", text: line });
        done("get_scorecard", `${scorecard.composite}/100 · ${tilt}`);
      } catch {
        blocks.push({ label: "Scorecard", text: "unavailable" });
        done("get_scorecard", "unavailable");
      }
    } else {
      blocks.push({ label: "Scorecard", text: "unavailable (fundamentals missing)" });
      done("get_scorecard", "unavailable");
    }
  }

  // News (materiality-scored)
  if (want.has("news")) {
    if (news && news.length > 0) {
      const scored = await safe("materiality", () => scoreHeadlines(symbol, news));
      const enriched = news.map((n) => ({ ...n, materiality: scored?.get(n.url)?.score ?? 0 }));
      const material = enriched.filter((n) => n.materiality >= 7);
      const shown = material.length > 0 ? material : enriched.sort((a, b) => b.materiality - a.materiality).slice(0, 3);
      const lines = shown.slice(0, 3).map((n) => {
        const d = n.publishedAt ? new Date(n.publishedAt).toISOString().slice(0, 10) : "";
        return `- [${n.materiality}/10] "${n.title.slice(0, 140)}" — ${n.publisher} ${d}${n.url ? ` (${n.url})` : ""}`;
      });
      const header = material.length > 0
        ? `${material.length} material headline${material.length === 1 ? "" : "s"} (materiality ≥7/10)${enriched.length - material.length > 0 ? `, ${enriched.length - material.length} fluff filtered` : ""}`
        : `no headline scored ≥7/10 — showing top raw items by score so you can characterise the flow honestly`;
      blocks.push({ label: "News", text: `${header}\n${lines.join("\n")}` });
      done("get_news", `${material.length}/${enriched.length} material`);
    } else {
      blocks.push({ label: "News", text: "no fresh headlines in last window" });
      done("get_news", "empty");
    }
  }

  // History stats + technicals from the same 1y series
  if (needHistory) {
    if (hist && hist.points.length >= 5) {
      const closes = hist.points.map((p) => p.p);
      const first = closes[0];
      const last = closes[closes.length - 1];
      let high = first, low = first, sumRet = 0, retCount = 0;
      const rets: number[] = [];
      for (let i = 0; i < closes.length; i++) {
        const c = closes[i];
        if (c > high) high = c;
        if (c < low) low = c;
        if (i > 0) {
          const r = ((c - closes[i - 1]) / closes[i - 1]) * 100;
          if (Number.isFinite(r)) { rets.push(r); sumRet += r; retCount++; }
        }
      }
      const mean = retCount > 0 ? sumRet / retCount : 0;
      let variance = 0;
      for (const r of rets) variance += (r - mean) ** 2;
      variance = retCount > 0 ? variance / retCount : 0;
      const stdev = Math.sqrt(variance);
      const returnPct = first !== 0 ? ((last - first) / first) * 100 : 0;
      const drawdown = high !== 0 ? ((last - high) / high) * 100 : 0;
      if (want.has("history")) {
        blocks.push({
          label: "History (1y)",
          text: `Return ${fmtPct(returnPct)} · period high ₹${fmtNum(high)} · low ₹${fmtNum(low)} · drawdown from high ${fmtPct(drawdown)} · daily vol ${fmtPct(stdev)} [Yahoo 1y]`,
        });
        done("get_history_stats", `${fmtPct(returnPct)} · drawdown ${fmtPct(drawdown)}`);
      }

      if (want.has("technicals")) {
        const sma20 = computeSMA(closes, 20).at(-1) ?? null;
        const sma50 = computeSMA(closes, 50).at(-1) ?? null;
        const sma200 = computeSMA(closes, 200).at(-1) ?? null;
        const rsi14 = computeRsiSeries(closes, 14).at(-1) ?? null;
        const vsSma50 = sma50 !== null && sma50 !== 0 ? ((last - sma50) / sma50) * 100 : null;
        const vsSma200 = sma200 !== null && sma200 !== 0 ? ((last - sma200) / sma200) * 100 : null;
        blocks.push({
          label: "Technicals",
          text: `Last ₹${fmtNum(last)} · SMA20 ${sma20 !== null ? "₹" + fmtNum(sma20) : "—"} · SMA50 ${sma50 !== null ? "₹" + fmtNum(sma50) : "—"} · SMA200 ${sma200 !== null ? "₹" + fmtNum(sma200) : "—"} · vs SMA50 ${vsSma50 !== null ? fmtPct(vsSma50) : "—"} · vs SMA200 ${vsSma200 !== null ? fmtPct(vsSma200) : "—"} · RSI(14) ${rsi14 !== null ? rsi14.toFixed(1) : "—"} [Technicals]`,
        });
        done("get_technicals", `RSI ${rsi14 !== null ? rsi14.toFixed(1) : "—"} · vs SMA200 ${vsSma200 !== null ? fmtPct(vsSma200) : "—"}`);
      }
    } else {
      if (want.has("history")) {
        blocks.push({ label: "History (1y)", text: "unavailable" });
        done("get_history_stats", "unavailable");
      }
      if (want.has("technicals")) {
        blocks.push({ label: "Technicals", text: "unavailable" });
        done("get_technicals", "unavailable");
      }
    }
  }

  // Institutional flows
  if (want.has("flows")) {
    if (flows) {
      const agg = flows.bySymbol[symbol];
      if (agg) {
        blocks.push({
          label: "Inst flows (30d)",
          text: `FII net ₹${fmtCrore(agg.fiiNet)} · DII net ₹${fmtCrore(agg.diiNet)} · total inst net ₹${fmtCrore(agg.instNet)} · ${agg.dealCount} bulk/block deals · last ${agg.lastDealDate ?? "—"} [FII/DII · 30d]`,
        });
        done("get_inst_flows", `net ₹${fmtCrore(agg.instNet)} · ${agg.dealCount} deals`);
      } else {
        blocks.push({ label: "Inst flows (30d)", text: "no reported FII/DII bulk/block deals in the last 30 days [FII/DII · 30d]" });
        done("get_inst_flows", "no deals in 30d");
      }
    } else {
      blocks.push({ label: "Inst flows (30d)", text: "unavailable" });
      done("get_inst_flows", "unavailable");
    }
  }

  // Peers
  if (want.has("peers")) {
    if (peers && peers.length > 0) {
      const lines = peers.slice(0, 5).map((p) =>
        `- ${p.entry.symbol} (${p.entry.name}) — cap ${fmtCrore(p.fundamentals?.marketCap)} · P/E ${fmtNum(p.fundamentals?.trailingPE)} · ROE ${fmtPct((p.fundamentals?.returnOnEquity ?? 0) * 100)}`,
      );
      blocks.push({ label: `Peers (${sector})`, text: lines.join("\n") });
      done("get_peers", `${peers.length} peers`);
    } else {
      blocks.push({ label: "Peers", text: "unavailable" });
      done("get_peers", "unavailable");
    }
  }

  // Guidance
  if (want.has("guidance")) {
    if (guidance && guidance.length > 0) {
      const lines = guidance.slice(0, 4).map((g) => {
        const d = g.filed_at ? new Date(g.filed_at).toISOString().slice(0, 10) : "";
        const snip = (g.quote ?? "").replace(/\s+/g, " ").slice(0, 200);
        const url = g.filing?.pdf_url ? ` (${g.filing.pdf_url})` : "";
        return `- [${d} · ${g.metric} ${g.direction}] ${snip}${url}`;
      });
      blocks.push({ label: "Management guidance (last 4Q)", text: lines.join("\n") });
      done("get_guidance", `${guidance.length} snippets`);
    } else {
      blocks.push({ label: "Management guidance (last 4Q)", text: "no guidance snippets extracted from recent filings" });
      done("get_guidance", "empty");
    }
  }

  return { symbol, fetchedAt: ist, blocks };
}

export function formatBundleForLLM(bundle: PreflightBundle): string {
  const header = `## FRESH SIGNAL — ${bundle.symbol} (auto-fetched at ${bundle.fetchedAt} IST)\nUse ONLY these numbers for the Snapshot / What the data says sections. Do not emit template placeholders like ₹X, +Y%, N/100 — substitute the real numbers below. If a block says "unavailable", say so honestly instead of inventing.`;
  const body = bundle.blocks
    .map((b) => `### ${b.label}\n${b.text}`)
    .join("\n\n");
  return `${header}\n\n${body}`;
}
