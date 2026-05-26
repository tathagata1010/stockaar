import type { Quote } from "./upstox";
import type { Fundamentals } from "./fundamentals";

export type PillarScore = { name: string; score: number; notes: string[] };
export type Scorecard = {
  composite: number;
  pillars: { valuation: PillarScore; growth: PillarScore; quality: PillarScore; momentum: PillarScore };
};

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreValuation(f: Fundamentals): PillarScore {
  const notes: string[] = [];
  let score = 50;
  const pe = f.trailingPE ?? f.forwardPE;
  if (pe && pe > 0) {
    if (pe < 15) { score += 25; notes.push(`Low P/E ${pe.toFixed(1)}`); }
    else if (pe < 25) { score += 10; notes.push(`Reasonable P/E ${pe.toFixed(1)}`); }
    else if (pe < 40) { score -= 5; notes.push(`Elevated P/E ${pe.toFixed(1)}`); }
    else { score -= 20; notes.push(`High P/E ${pe.toFixed(1)}`); }
  }
  if (f.priceToBook && f.priceToBook > 0) {
    if (f.priceToBook < 2) { score += 10; notes.push(`P/B ${f.priceToBook.toFixed(2)}`); }
    else if (f.priceToBook > 6) { score -= 10; notes.push(`P/B ${f.priceToBook.toFixed(2)}`); }
  }
  if (f.dividendYield && f.dividendYield > 0.02) {
    score += 5;
    notes.push(`Dividend yield ${(f.dividendYield * 100).toFixed(2)}%`);
  }
  return { name: "Valuation", score: clamp(score), notes };
}

function scoreGrowth(f: Fundamentals): PillarScore {
  const notes: string[] = [];
  let score = 50;
  if (f.revenueGrowth !== undefined) {
    const g = f.revenueGrowth * 100;
    if (g > 25) { score += 25; notes.push(`Revenue growth ${g.toFixed(1)}%`); }
    else if (g > 10) { score += 15; notes.push(`Revenue growth ${g.toFixed(1)}%`); }
    else if (g > 0) { score += 5; notes.push(`Revenue growth ${g.toFixed(1)}%`); }
    else { score -= 15; notes.push(`Revenue declining ${g.toFixed(1)}%`); }
  }
  if (f.earningsGrowth !== undefined) {
    const g = f.earningsGrowth * 100;
    if (g > 25) { score += 20; notes.push(`Earnings growth ${g.toFixed(1)}%`); }
    else if (g > 0) { score += 10; notes.push(`Earnings growth ${g.toFixed(1)}%`); }
    else { score -= 15; notes.push(`Earnings declining ${g.toFixed(1)}%`); }
  }
  return { name: "Growth", score: clamp(score), notes };
}

function scoreQuality(f: Fundamentals): PillarScore {
  const notes: string[] = [];
  let score = 50;
  if (f.returnOnEquity !== undefined) {
    const r = f.returnOnEquity * 100;
    if (r > 20) { score += 25; notes.push(`ROE ${r.toFixed(1)}%`); }
    else if (r > 12) { score += 15; notes.push(`ROE ${r.toFixed(1)}%`); }
    else if (r > 5) { score += 5; notes.push(`ROE ${r.toFixed(1)}%`); }
    else { score -= 10; notes.push(`Low ROE ${r.toFixed(1)}%`); }
  }
  if (f.profitMargin !== undefined) {
    const m = f.profitMargin * 100;
    if (m > 20) { score += 15; notes.push(`Profit margin ${m.toFixed(1)}%`); }
    else if (m > 10) { score += 8; notes.push(`Profit margin ${m.toFixed(1)}%`); }
    else if (m < 0) { score -= 20; notes.push(`Loss-making (${m.toFixed(1)}%)`); }
  }
  if (f.debtToEquity !== undefined) {
    if (f.debtToEquity < 50) { score += 10; notes.push(`Low debt (D/E ${f.debtToEquity.toFixed(0)})`); }
    else if (f.debtToEquity > 150) { score -= 15; notes.push(`High debt (D/E ${f.debtToEquity.toFixed(0)})`); }
  }
  return { name: "Quality", score: clamp(score), notes };
}

function scoreMomentum(f: Fundamentals, q: Quote | null): PillarScore {
  const notes: string[] = [];
  let score = 50;
  if (q && f.yearHigh && f.yearLow) {
    const range = f.yearHigh - f.yearLow;
    const pos = range > 0 ? ((q.lastPrice - f.yearLow) / range) * 100 : 50;
    notes.push(`${pos.toFixed(0)}% of 52W range`);
    if (pos > 80) score += 20;
    else if (pos > 60) score += 12;
    else if (pos < 25) score -= 10;
  }
  if (q) {
    if (q.changePct > 2) { score += 10; notes.push(`Up ${q.changePct.toFixed(2)}% today`); }
    else if (q.changePct < -2) { score -= 10; notes.push(`Down ${q.changePct.toFixed(2)}% today`); }
  }
  return { name: "Momentum", score: clamp(score), notes };
}

export function buildScorecard(f: Fundamentals, q: Quote | null): Scorecard {
  const valuation = scoreValuation(f);
  const growth = scoreGrowth(f);
  const quality = scoreQuality(f);
  const momentum = scoreMomentum(f, q);
  const composite = Math.round((valuation.score + growth.score + quality.score + momentum.score) / 4);
  return { composite, pillars: { valuation, growth, quality, momentum } };
}

export type Signal = "BUY" | "HOLD" | "SELL";

export function deriveSignal(sc: Scorecard): { signal: Signal; reasons: string[] } {
  const { composite, pillars } = sc;
  const reasons: string[] = [];
  if (pillars.valuation.notes[0]) reasons.push(pillars.valuation.notes[0]);
  if (pillars.growth.notes[0]) reasons.push(pillars.growth.notes[0]);
  if (pillars.quality.notes[0]) reasons.push(pillars.quality.notes[0]);
  let signal: Signal = "HOLD";
  if (composite >= 70 && pillars.quality.score >= 55) signal = "BUY";
  else if (composite < 40) signal = "SELL";
  return { signal, reasons };
}
