// Thin Resend wrapper. No-ops gracefully when RESEND_API_KEY is missing.

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<
  { ok: true; id?: string } | { ok: false; error: string }
> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "alerts@stockaar.app";
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY missing — skipping send", { to, subject });
    return { ok: false, error: "email not configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    console.error("[email] resend error", res.status, errText);
    return { ok: false, error: errText };
  }
  const data = (await res.json().catch(() => null)) as { id?: string } | null;
  return { ok: true, id: data?.id };
}

export function alertEmailHtml({
  symbol, condition, target, current, exchange,
}: {
  symbol: string;
  condition: "above" | "below";
  target: number;
  current: number;
  exchange: "NSE" | "BSE";
}): string {
  const arrow = condition === "above" ? "↑" : "↓";
  const color = condition === "above" ? "#16a34a" : "#dc2626";
  const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://stockaar.app";
  return `<!doctype html>
<html><body style="font-family:Inter,system-ui,sans-serif;background:#f6f8fc;margin:0;padding:24px;color:#0e1525">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e7f0;border-radius:16px;padding:28px">
    <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;color:#4f46e5;text-transform:uppercase">stocकaar alert</div>
    <h1 style="margin:8px 0 16px;font-size:24px">${symbol} crossed your target ${arrow}</h1>
    <p style="margin:0 0 20px;color:#5a6478">${exchange} · ${condition === "above" ? "Above" : "Below"} ${inr(target)}</p>
    <div style="background:#f6f8fc;border-radius:12px;padding:16px;margin-bottom:20px">
      <div style="font-size:12px;color:#5a6478;text-transform:uppercase">Current price</div>
      <div style="font-size:28px;font-weight:700;color:${color};margin-top:4px">${inr(current)}</div>
    </div>
    <a href="${siteUrl}/stock/${encodeURIComponent(symbol)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">View ${symbol} →</a>
    <p style="margin-top:24px;font-size:11px;color:#5a6478;line-height:1.5">For informational purposes only. Not investment advice. You received this because you set an alert at stocकaar.</p>
  </div>
</body></html>`;
}
