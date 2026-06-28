import type { TriggerKind, Triggers } from "@/lib/alerts/schema";
import type { NewsItem } from "@/lib/news";

export type SmartAlertEmailInput = {
  symbol: string;
  exchange: "NSE" | "BSE";
  label?: string | null;
  firedKinds: TriggerKind[];
  triggers: Triggers;
  snapshot: {
    price: number;
    changePct: number;
    volume?: number;
    avg20dVolume?: number;
  };
  brief: string;
  news?: NewsItem;
  llmAvailable: boolean;
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const KIND_BADGE: Record<TriggerKind, { label: string; emoji: string; color: string }> = {
  price: { label: "Price", emoji: "🎯", color: "#4f46e5" },
  move: { label: "Big move", emoji: "📈", color: "#0ea5e9" },
  volume: { label: "Volume spike", emoji: "🔊", color: "#7c3aed" },
  news: { label: "Material news", emoji: "📰", color: "#0d9488" },
};

export function smartAlertEmailSubject(i: SmartAlertEmailInput): string {
  const primary = i.firedKinds[0];
  const extra = i.firedKinds.length - 1;
  const base = (() => {
    switch (primary) {
      case "price": {
        const tgt = i.triggers.price?.target;
        return `${i.symbol} — price hit${tgt ? ` ${inr(tgt)}` : ""}`;
      }
      case "move":
        return `${i.symbol} — ${pct(i.snapshot.changePct)} day move`;
      case "volume": {
        const m = i.snapshot.volume && i.snapshot.avg20dVolume
          ? (i.snapshot.volume / i.snapshot.avg20dVolume).toFixed(1)
          : "high";
        return `${i.symbol} — ${m}× volume spike`;
      }
      case "news":
        return `${i.symbol} — material news`;
      default:
        return `${i.symbol} — alert`;
    }
  })();
  return extra > 0 ? `${base} (+${extra})` : base;
}

export function smartAlertEmailHtml(i: SmartAlertEmailInput): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://stockaar.app";
  const changeColor = i.snapshot.changePct >= 0 ? "#16a34a" : "#dc2626";

  const badges = i.firedKinds
    .map((k) => {
      const b = KIND_BADGE[k];
      return `<span style="display:inline-block;background:${b.color}1a;color:${b.color};padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;margin-right:6px">${b.emoji} ${b.label}</span>`;
    })
    .join("");

  const enabledSummary = (Object.keys(i.triggers) as (keyof Triggers)[]).map((k) => {
    if (k === "price" && i.triggers.price) return `${i.triggers.price.condition} ${inr(i.triggers.price.target)}`;
    if (k === "move" && i.triggers.move) return `±${i.triggers.move.pctAbs}% move`;
    if (k === "volume" && i.triggers.volume) return `${i.triggers.volume.multiple}× volume`;
    if (k === "news") return "material news";
    return "";
  }).filter(Boolean).join(" · ");

  const volMultiple = i.snapshot.volume && i.snapshot.avg20dVolume && i.snapshot.avg20dVolume > 0
    ? (i.snapshot.volume / i.snapshot.avg20dVolume).toFixed(2) + "×"
    : null;

  const newsBlock = i.news ? `
    <div style="margin-top:18px;border-top:1px solid #e2e7f0;padding-top:18px">
      <div style="font-size:11px;color:#5a6478;text-transform:uppercase;font-weight:700;letter-spacing:0.05em">Headline that fired this</div>
      <div style="margin-top:6px;font-size:14px;font-weight:600;color:#0e1525">${escapeHtml(i.news.title)}</div>
      <div style="margin-top:4px;font-size:12px;color:#5a6478">${escapeHtml(i.news.publisher)} · <a href="${escapeHtml(i.news.url)}" style="color:#4f46e5;text-decoration:none">Read source ↗</a></div>
    </div>` : "";

  const llmFooter = i.llmAvailable ? "" : `
    <div style="margin-top:14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px 12px;font-size:11px;color:#9a3412">
      AI brief unavailable today — basic snapshot only.
    </div>`;

  return `<!doctype html>
<html><body style="font-family:Inter,system-ui,sans-serif;background:#f6f8fc;margin:0;padding:24px;color:#0e1525">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e7f0;border-radius:16px;padding:28px">
    <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;color:#4f46e5;text-transform:uppercase">stocकaar smart alert</div>
    <h1 style="margin:8px 0 4px;font-size:22px">${escapeHtml(i.label || i.symbol)}</h1>
    <div style="font-size:13px;color:#5a6478;margin-bottom:14px">${i.symbol} · ${i.exchange}</div>

    <div style="margin-bottom:18px">${badges}</div>

    <blockquote style="margin:0 0 20px;padding:14px 16px;background:#eef2ff;border-left:4px solid #4f46e5;border-radius:0 12px 12px 0;font-size:15px;line-height:1.55;color:#1e1b4b;font-style:italic">
      ${escapeHtml(i.brief)}
    </blockquote>

    <div style="background:#f6f8fc;border-radius:12px;padding:14px 16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:18px">
      <div>
        <div style="font-size:10px;color:#5a6478;text-transform:uppercase;font-weight:700">Price</div>
        <div style="font-size:18px;font-weight:700;margin-top:2px">${inr(i.snapshot.price)}</div>
      </div>
      <div>
        <div style="font-size:10px;color:#5a6478;text-transform:uppercase;font-weight:700">Day</div>
        <div style="font-size:18px;font-weight:700;color:${changeColor};margin-top:2px">${pct(i.snapshot.changePct)}</div>
      </div>
      <div>
        <div style="font-size:10px;color:#5a6478;text-transform:uppercase;font-weight:700">Vol vs 20d</div>
        <div style="font-size:18px;font-weight:700;margin-top:2px">${volMultiple ?? "—"}</div>
      </div>
    </div>

    ${newsBlock}

    <a href="${siteUrl}/stock/${encodeURIComponent(i.symbol)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;margin-top:8px">View ${escapeHtml(i.symbol)} →</a>

    ${llmFooter}

    <div style="margin-top:22px;border-top:1px solid #e2e7f0;padding-top:14px;font-size:11px;color:#5a6478;line-height:1.5">
      <div>You set this watch with: ${escapeHtml(enabledSummary)}.</div>
      <div style="margin-top:4px"><a href="${siteUrl}/alerts" style="color:#4f46e5;text-decoration:none">Manage alerts</a> · For informational purposes only. Not investment advice.</div>
    </div>
  </div>
</body></html>`;
}
