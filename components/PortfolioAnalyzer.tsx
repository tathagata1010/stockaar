"use client";

import { useMemo, useState } from "react";
import { cn, formatINR, formatPct, formatCompactINR } from "@/lib/utils";
import { AlertTriangle, BarChart3, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { StockLogo } from "@/components/StockLogo";
import type { Sector } from "@/lib/nse-symbols";

type Holding = { symbol: string; qty: number; avg: number };
type Quote = { symbol: string; lastPrice: number; changePct: number };

const SAMPLE = `RELIANCE,10,2400
TCS,5,3500
HDFCBANK,15,1450
INFY,8,1600`;

function parseHoldings(text: string): { holdings: Holding[]; errors: string[] } {
  const errors: string[] = [];
  const holdings: Holding[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = trimmed.split(",").map((p) => p.trim());
    if (parts.length < 3) {
      errors.push(`Line ${i + 1}: expected SYMBOL,QTY,AVG_PRICE`);
      return;
    }
    const [sym, qtyStr, avgStr] = parts;
    const qty = Number(qtyStr);
    const avg = Number(avgStr);
    if (!sym || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(avg) || avg <= 0) {
      errors.push(`Line ${i + 1}: invalid numbers`);
      return;
    }
    holdings.push({ symbol: sym.toUpperCase(), qty, avg });
  });
  return { holdings, errors };
}

export function PortfolioAnalyzer({ sectorBySymbol }: { sectorBySymbol: Record<string, string> }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [submittedHoldings, setSubmittedHoldings] = useState<Holding[] | null>(null);

  const { holdings: parsed, errors: parseErrors } = useMemo(() => parseHoldings(text), [text]);

  async function analyze() {
    setError(null);
    if (parsed.length === 0) {
      setError("Add at least one holding.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/tools/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: parsed.map((h) => h.symbol) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      const map: Record<string, Quote> = {};
      for (const q of body.data ?? []) {
        map[q.symbol] = { symbol: q.symbol, lastPrice: q.lastPrice, changePct: q.changePct };
      }
      setQuotes(map);
      setSubmittedHoldings(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch quotes");
    } finally {
      setLoading(false);
    }
  }

  const analysis = useMemo(() => {
    if (!submittedHoldings) return null;
    let invested = 0;
    let current = 0;
    const baseRows = submittedHoldings.map((h) => {
      const q = quotes[h.symbol];
      const cur = q ? q.lastPrice * h.qty : 0;
      const inv = h.avg * h.qty;
      invested += inv;
      current += cur;
      const pl = cur - inv;
      const plPct = inv > 0 ? (pl / inv) * 100 : 0;
      return {
        ...h,
        currentPrice: q?.lastPrice,
        currentValue: cur,
        invested: inv,
        pl,
        plPct,
        sector: sectorBySymbol[h.symbol] ?? "Unknown",
        priceMissing: !q,
      };
    });
    const rows = baseRows.map((r) => ({
      ...r,
      conc: current > 0 ? (r.currentValue / current) * 100 : 0,
    }));
    const pl = current - invested;
    const plPct = invested > 0 ? (pl / invested) * 100 : 0;

    const bySector: Record<string, number> = {};
    for (const r of rows) bySector[r.sector] = (bySector[r.sector] ?? 0) + r.currentValue;
    const sectorBreakdown = Object.entries(bySector)
      .map(([sector, value]) => ({ sector, value, pct: current > 0 ? (value / current) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);

    const warnings: string[] = [];
    for (const r of rows) {
      if (r.conc > 25) warnings.push(`${r.symbol} is ${r.conc.toFixed(1)}% of portfolio — consider trimming below 25%.`);
    }
    for (const s of sectorBreakdown) {
      if (s.pct > 40) warnings.push(`${s.sector} sector is ${s.pct.toFixed(1)}% of portfolio — consider diversifying below 40%.`);
    }

    return { rows, invested, current, pl, plPct, sectorBreakdown, warnings };
  }, [submittedHoldings, quotes, sectorBySymbol]);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[400px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="surface-strong rounded-2xl border border-border p-5 shadow-soft">
          <h2 className="text-sm font-semibold">Paste your holdings</h2>
          <p className="mt-1 text-[11px] text-muted">
            Format: <code className="rounded bg-card px-1.5 py-0.5">SYMBOL,QTY,AVG_PRICE</code> · one per line.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={SAMPLE}
            className="mt-3 w-full rounded-lg border border-border bg-bg/40 p-3 font-mono text-sm focus:border-brand focus:outline-none"
          />
          {parseErrors.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-danger">
              {parseErrors.map((e, i) => <li key={i}>· {e}</li>)}
            </ul>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={analyze}
              disabled={loading || parsed.length === 0}
              className="btn-brand inline-flex items-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Analyze {parsed.length > 0 && `(${parsed.length})`}
            </button>
            <button
              onClick={() => setText(SAMPLE)}
              className="btn-ghost"
            >
              Try sample
            </button>
          </div>
          {error && (
            <div className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}
        </div>
      </aside>

      <div className="min-w-0 space-y-6">
        {!analysis ? (
          <div className="rounded-2xl border border-border bg-card/60 p-10 text-center text-sm text-muted">
            <BarChart3 className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-3">Paste holdings and click <strong>Analyze</strong> to see live P/L, sector allocation and concentration warnings.</p>
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <SummaryCard label="Invested" value={formatCompactINR(analysis.invested)} />
              <SummaryCard label="Current value" value={formatCompactINR(analysis.current)} />
              <SummaryCard
                label="Profit / Loss"
                value={`${analysis.pl >= 0 ? "+" : ""}${formatCompactINR(analysis.pl)}`}
                sub={formatPct(analysis.plPct)}
                tone={analysis.pl >= 0 ? "accent" : "danger"}
                icon={analysis.pl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              />
            </section>

            {analysis.warnings.length > 0 && (
              <section className="rounded-2xl border border-warning/40 bg-gradient-to-br from-warning/10 to-warning/5 p-4 sm:p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  Concentration warnings
                </div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {analysis.warnings.map((w, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-warning/20 bg-bg/40 px-3 py-2 text-xs text-fg/90"
                    >
                      <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                      <span className="leading-snug">{w}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="surface overflow-hidden rounded-2xl shadow-soft">
              <div className="overflow-x-auto">
                <div className="min-w-[820px]">
                  {/* Header */}
                  <div className="grid grid-cols-[minmax(0,2.2fr)_60px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1.3fr)] items-center gap-x-3 border-b border-border bg-card/60 px-4 py-3 text-[10px] uppercase tracking-[0.12em] text-muted">
                    <div className="text-left font-semibold">Symbol</div>
                    <div className="text-right font-semibold">Qty</div>
                    <div className="text-right font-semibold">Avg</div>
                    <div className="text-right font-semibold">LTP</div>
                    <div className="text-right font-semibold">Value</div>
                    <div className="text-right font-semibold">P/L</div>
                    <div className="text-right font-semibold">% Port</div>
                  </div>
                  {/* Rows */}
                  {analysis.rows.map((r) => {
                    const up = r.pl >= 0;
                    return (
                      <div
                        key={r.symbol}
                        className="row-hover grid grid-cols-[minmax(0,2.2fr)_60px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1.3fr)] items-center gap-x-3 border-t border-border/50 px-4 py-3 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <StockLogo symbol={r.symbol} sector={r.sector as Sector} size="sm" animated={false} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold leading-tight">{r.symbol}</div>
                            <div className="truncate text-[11px] text-muted leading-tight">{r.sector}</div>
                          </div>
                        </div>
                        <div className="text-right tabular-nums">{r.qty}</div>
                        <div className="text-right tabular-nums text-muted">{formatINR(r.avg)}</div>
                        <div className="text-right tabular-nums">
                          {r.currentPrice ? formatINR(r.currentPrice) : <span className="text-muted">—</span>}
                        </div>
                        <div className="num-display text-right font-semibold tabular-nums">
                          {formatCompactINR(r.currentValue)}
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <div className={cn("tabular-nums font-semibold leading-tight", up ? "text-accent" : "text-danger")}>
                            {up ? "+" : ""}{formatCompactINR(r.pl)}
                          </div>
                          <div className={cn("text-[11px] tabular-nums leading-tight", up ? "text-accent/80" : "text-danger/80")}>
                            {up ? "▲" : "▼"} {formatPct(r.plPct)}
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-bg ring-1 ring-border">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                r.conc > 25 ? "bg-warning" : "bg-brand",
                              )}
                              style={{ width: `${Math.min(100, r.conc)}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-xs font-semibold">{r.conc.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="surface rounded-2xl p-5 shadow-soft">
              <h3 className="text-sm font-semibold">Sector allocation</h3>
              <ul className="mt-4 space-y-2.5">
                {analysis.sectorBreakdown.map((s) => (
                  <li key={s.sector}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{s.sector}</span>
                      <span className="tabular-nums text-muted">{s.pct.toFixed(1)}% · {formatCompactINR(s.value)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg/60">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          s.pct > 40 ? "bg-warning" : "bg-brand-gradient",
                        )}
                        style={{ width: `${Math.min(s.pct, 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, tone, icon }: {
  label: string;
  value: string;
  sub?: string;
  tone?: "accent" | "danger";
  icon?: React.ReactNode;
}) {
  const color = tone === "accent" ? "text-accent" : tone === "danger" ? "text-danger" : "text-fg";
  return (
    <div className="surface-strong rounded-2xl p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase text-muted">{label}</div>
        {icon && (
          <span className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg ring-1",
            tone === "accent" ? "bg-accent/15 text-accent ring-accent/30" : "bg-danger/15 text-danger ring-danger/30",
          )}>{icon}</span>
        )}
      </div>
      <div className={cn("num-display mt-2 text-2xl font-bold tabular-nums", color)}>{value}</div>
      {sub && <div className={cn("text-xs font-semibold tabular-nums", color)}>{sub}</div>}
    </div>
  );
}
