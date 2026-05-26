import { NSE_SYMBOLS } from "@/lib/nse-symbols";

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const pct = (n: number) =>
  `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const nameFor = (sym: string): string =>
  NSE_SYMBOLS.find((s) => s.symbol === sym)?.name ?? sym;

export type BriefMover = { symbol: string; lastPrice: number; changePct: number };
export type BriefIndex = { name: string; price: number; changePct: number };

export function buildBriefHtml({
  dateStr,
  indices,
  gainers,
  losers,
  siteUrl,
  unsubscribeUrl,
  isDemo = false,
}: {
  dateStr: string;
  indices: BriefIndex[];
  gainers: BriefMover[];
  losers: BriefMover[];
  siteUrl: string;
  unsubscribeUrl?: string;
  isDemo?: boolean;
}): string {
  const topGainer = gainers[0];
  const topLoser = losers[0];
  const upIndices = indices.filter((i) => i.changePct >= 0).length;
  const breadth = indices.length ? Math.round((upIndices / indices.length) * 100) : 50;
  const sentiment =
    breadth >= 67 ? { label: "Risk-on", color: "#16a34a", bg: "#dcfce7" }
    : breadth <= 33 ? { label: "Risk-off", color: "#dc2626", bg: "#fee2e2" }
    : { label: "Mixed tape", color: "#a16207", bg: "#fef3c7" };

  const demoBanner = isDemo
    ? `<div style="background:linear-gradient(90deg,#fef3c7,#fde68a);border:1px solid #fbbf24;border-radius:10px;padding:10px 14px;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:18px;text-align:center">⚡ Demo preview · This is what subscribers wake up to every weekday at 8 AM IST</div>`
    : "";

  const idxRow = indices
    .map((i) => {
      const color = i.changePct >= 0 ? "#16a34a" : "#dc2626";
      const arrow = i.changePct >= 0 ? "▲" : "▼";
      return `<td style="padding:14px;border:1px solid #e2e7f0;border-radius:12px;background:#fafbff;width:33%;vertical-align:top">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#5a6478;font-weight:700">${i.name}</div>
        <div style="font-size:20px;font-weight:800;margin-top:6px;color:#0e1525;font-variant-numeric:tabular-nums">${i.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
        <div style="font-size:12px;color:${color};font-weight:700;margin-top:3px;font-variant-numeric:tabular-nums">${arrow} ${pct(i.changePct)}</div>
      </td>`;
    })
    .join("");

  const moverRows = (rows: BriefMover[], up: boolean) =>
    rows
      .map((r, idx) => {
        const color = up ? "#16a34a" : "#dc2626";
        const bg = up ? "#dcfce7" : "#fee2e2";
        const rank = idx + 1;
        return `<tr>
        <td style="padding:12px 6px;border-bottom:1px solid #eef1f8;width:24px;color:#8b95ae;font-size:11px;font-weight:700;font-variant-numeric:tabular-nums">${rank}</td>
        <td style="padding:12px 6px;border-bottom:1px solid #eef1f8">
          <div style="font-weight:700;color:#0e1525;font-size:13px">${r.symbol}</div>
          <div style="font-size:11px;color:#5a6478;margin-top:1px">${nameFor(r.symbol)}</div>
        </td>
        <td style="padding:12px 6px;border-bottom:1px solid #eef1f8;text-align:right;font-variant-numeric:tabular-nums;color:#0e1525;font-size:13px">${inr(r.lastPrice)}</td>
        <td style="padding:12px 6px;border-bottom:1px solid #eef1f8;text-align:right;font-variant-numeric:tabular-nums">
          <span style="display:inline-block;background:${bg};color:${color};font-weight:800;padding:3px 8px;border-radius:6px;font-size:12px">${pct(r.changePct)}</span>
        </td>
        <td style="padding:12px 6px 12px 10px;border-bottom:1px solid #eef1f8;text-align:right">
          <a href="${siteUrl}/stock/${r.symbol}" style="font-size:11px;font-weight:700;color:#4f46e5;text-decoration:none;white-space:nowrap">Analyze →</a>
        </td>
      </tr>`;
      })
      .join("");

  const heroNarrative = topGainer && topLoser
    ? `<strong style="color:#16a34a">${topGainer.symbol}</strong> led the tape with <strong style="color:#16a34a">${pct(topGainer.changePct)}</strong>, while <strong style="color:#dc2626">${topLoser.symbol}</strong> dragged at <strong style="color:#dc2626">${pct(topLoser.changePct)}</strong>. Sentiment reads <strong style="color:${sentiment.color}">${sentiment.label.toLowerCase()}</strong>.`
    : `Markets are settling in. Open the dashboard for the freshest tape.`;

  const featureTile = (emoji: string, title: string, desc: string, cta: string, href: string, tone: string) =>
    `<td style="padding:6px;width:33.33%;vertical-align:top">
      <div style="border:1px solid #e2e7f0;border-radius:12px;padding:14px;background:#fff;height:100%">
        <div style="font-size:22px;line-height:1">${emoji}</div>
        <div style="font-size:13px;font-weight:800;color:#0e1525;margin-top:8px">${title}</div>
        <div style="font-size:11px;color:#5a6478;margin-top:4px;line-height:1.5">${desc}</div>
        <a href="${href}" style="display:inline-block;margin-top:10px;font-size:11px;font-weight:700;color:${tone};text-decoration:none">${cta} →</a>
      </div>
    </td>`;

  const unsubscribeLine = unsubscribeUrl
    ? `<br/>Don't want these? <a href="${unsubscribeUrl}" style="color:#8b95ae">Unsubscribe in one click</a>.`
    : isDemo
      ? `<br/>This is a one-off preview send — you are not subscribed yet. <a href="${siteUrl}/pricing" style="color:#4f46e5;font-weight:700">Subscribe →</a>`
      : "";

  return `<!doctype html><html><body style="font-family:Inter,system-ui,-apple-system,sans-serif;background:#eef2f9;margin:0;padding:24px 12px;color:#0e1525">
  <div style="max-width:620px;margin:0 auto">

    ${demoBanner}

    <!-- HERO CARD -->
    <div style="background:#fff;border:1px solid #e2e7f0;border-radius:18px;padding:28px;box-shadow:0 1px 3px rgba(15,23,42,0.04)">
      <table style="width:100%;border-collapse:collapse"><tr>
        <td style="vertical-align:middle">
          <div style="display:inline-block;background:linear-gradient(90deg,#4f46e5,#7c3aed);color:#fff;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;padding:5px 10px;border-radius:6px">stocक aar</div>
        </td>
        <td style="vertical-align:middle;text-align:right">
          <span style="display:inline-block;background:${sentiment.bg};color:${sentiment.color};font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;padding:4px 9px;border-radius:6px">${sentiment.label}</span>
          <div style="font-size:11px;color:#8b95ae;margin-top:6px">${dateStr}</div>
        </td>
      </tr></table>
      <h1 style="margin:18px 0 8px;font-size:28px;line-height:1.2;letter-spacing:-0.01em;color:#0e1525">The market today, in plain English.</h1>
      <p style="margin:0;color:#5a6478;font-size:14px;line-height:1.6">${heroNarrative}</p>
      <p style="margin:14px 0 0;color:#8b95ae;font-size:12px">⏱ 3-minute read · ${gainers.length + losers.length} movers worth knowing · Breadth ${breadth}%</p>
    </div>

    <!-- INDICES -->
    <div style="background:#fff;border:1px solid #e2e7f0;border-radius:18px;padding:24px;margin-top:14px">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#4f46e5;margin-bottom:14px">📍 Where we are</div>
      <table style="width:100%;border-collapse:separate;border-spacing:8px 0"><tr>${idxRow}</tr></table>
    </div>

    <!-- GAINERS -->
    <div style="background:#fff;border:1px solid #e2e7f0;border-radius:18px;padding:24px;margin-top:14px">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#16a34a;margin-bottom:6px">↑ Top gainers</div>
      <div style="font-size:12px;color:#5a6478;margin-bottom:14px">Who ran today, and by how much.</div>
      <table style="width:100%;border-collapse:collapse">${moverRows(gainers, true)}</table>
    </div>

    <!-- LOSERS -->
    <div style="background:#fff;border:1px solid #e2e7f0;border-radius:18px;padding:24px;margin-top:14px">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#dc2626;margin-bottom:6px">↓ Top losers</div>
      <div style="font-size:12px;color:#5a6478;margin-bottom:14px">Who got punched in the face.</div>
      <table style="width:100%;border-collapse:collapse">${moverRows(losers, false)}</table>
    </div>

    <!-- PRO UPSELL -->
    <div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 60%,#06b6d4 100%);border-radius:18px;padding:28px;margin-top:14px;color:#fff">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;opacity:0.9">⚡ Unlock the full edge</div>
      <h2 style="margin:8px 0 6px;font-size:22px;line-height:1.25;color:#fff">Stock Calls. Scorecards. AI Briefs. Anomalies.</h2>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;opacity:0.92">Every NSE/BSE stock scored across <strong>Valuation, Growth, Quality, Momentum</strong>. Real-time anomaly feed. Personalized "Should I Buy?" verdicts. The AI brief that reads the 100-page annual report for you.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px"><tr>
        <td style="vertical-align:top;width:50%;padding-right:8px">
          <div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:14px">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85">Pro · Monthly</div>
            <div style="font-size:26px;font-weight:800;margin-top:6px;font-variant-numeric:tabular-nums">₹299<span style="font-size:13px;font-weight:500;opacity:0.8">/mo</span></div>
            <div style="font-size:11px;opacity:0.85;margin-top:4px">Cancel anytime</div>
          </div>
        </td>
        <td style="vertical-align:top;width:50%;padding-left:8px">
          <div style="background:rgba(255,255,255,0.22);border:1px solid rgba(255,255,255,0.45);border-radius:12px;padding:14px;position:relative">
            <div style="position:absolute;top:-9px;right:10px;background:#fde047;color:#713f12;font-size:9px;font-weight:800;letter-spacing:0.08em;padding:3px 7px;border-radius:5px;text-transform:uppercase">Best value</div>
            <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.95">Pro · Annual</div>
            <div style="font-size:26px;font-weight:800;margin-top:6px;font-variant-numeric:tabular-nums">₹2,999<span style="font-size:13px;font-weight:500;opacity:0.85">/yr</span></div>
            <div style="font-size:11px;opacity:0.95;margin-top:4px">Save ₹589 · ~17% off</div>
          </div>
        </td>
      </tr></table>
      <a href="${siteUrl}/pricing" style="display:inline-block;background:#fff;color:#4f46e5;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:800;font-size:14px;letter-spacing:0.01em">Start Pro — first 7 days free →</a>
      <div style="margin-top:14px;font-size:11px;opacity:0.85">UPI · cards · netbanking via Razorpay. Built for Indian retail investors.</div>
    </div>

    <!-- FEATURE TRIO -->
    <div style="background:#fff;border:1px solid #e2e7f0;border-radius:18px;padding:24px;margin-top:14px">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#0e1525;margin-bottom:14px">🎯 Try these next</div>
      <table style="width:100%;border-collapse:separate;border-spacing:0"><tr>
        ${featureTile("🎯", "Should I Buy?", "5-tier verdict in 10 seconds. Risk, horizon, position size.", "Get verdict", `${siteUrl}/tools/should-i-buy`, "#4f46e5")}
        ${featureTile("🎮", "Live Screener", "Drag sliders, click presets, watch the universe narrow.", "Open screener", `${siteUrl}/screener`, "#06b6d4")}
        ${featureTile("🔥", "Hot Stocks", "What is unusual today — volume spikes, breakouts.", "See picks", `${siteUrl}/hot-stocks`, "#dc2626")}
      </tr></table>
    </div>

    <!-- WHY STOCK AAR -->
    <div style="background:#0e1525;border-radius:18px;padding:28px;margin-top:14px;color:#fff">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#a5b4fc;margin-bottom:10px">Why traders pick stocक aar</div>
      <table style="width:100%;border-collapse:collapse"><tr>
        <td style="vertical-align:top;width:50%;padding-right:10px">
          <div style="font-size:14px;font-weight:700;color:#fff">⚡ Built for Indian markets</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px;line-height:1.55">Every NSE/BSE listing, every sector, INR-native everywhere.</div>
          <div style="margin-top:14px;font-size:14px;font-weight:700;color:#fff">🧠 Algorithmic, not opinion</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px;line-height:1.55">Four-pillar Scorecards beat finfluencer takes.</div>
        </td>
        <td style="vertical-align:top;width:50%;padding-left:10px">
          <div style="font-size:14px;font-weight:700;color:#fff">📬 3 minutes a day</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px;line-height:1.55">No noise. Just the brief you needed before the bell.</div>
          <div style="margin-top:14px;font-size:14px;font-weight:700;color:#fff">🔒 Privacy first</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px;line-height:1.55">Your watchlist is yours. No data sold. Ever.</div>
        </td>
      </tr></table>
    </div>

    <!-- FOOTER -->
    <div style="padding:24px 8px 8px;text-align:center;font-size:11px;color:#8b95ae;line-height:1.7">
      <div style="font-weight:700;color:#5a6478">stocक aar — India's most intuitive stock intelligence platform</div>
      <div style="margin-top:6px">
        <a href="${siteUrl}/dashboard" style="color:#4f46e5;text-decoration:none;font-weight:600">Dashboard</a> ·
        <a href="${siteUrl}/screener" style="color:#4f46e5;text-decoration:none;font-weight:600">Screener</a> ·
        <a href="${siteUrl}/hot-stocks" style="color:#4f46e5;text-decoration:none;font-weight:600">Hot Stocks</a> ·
        <a href="${siteUrl}/pricing" style="color:#4f46e5;text-decoration:none;font-weight:600">Pricing</a>
      </div>
      <p style="margin:16px 0 0">
        For informational purposes only. Not investment advice. Prices shown are last available; markets are open 9:15–15:30 IST, Mon–Fri.${unsubscribeLine}
      </p>
    </div>
  </div>
</body></html>`;
}
