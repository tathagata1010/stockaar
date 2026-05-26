import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  if (!token) {
    return new NextResponse(htmlPage("Missing token", "This unsubscribe link is invalid."), {
      status: 400,
      headers: { "content-type": "text/html" },
    });
  }

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !serviceKey) {
    return new NextResponse(htmlPage("Try again later", "Server is not configured."), {
      status: 500,
      headers: { "content-type": "text/html" },
    });
  }

  const admin = createServiceClient(sbUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin
    .from("newsletter_subscribers")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .select("email")
    .maybeSingle();

  if (error || !data) {
    return new NextResponse(htmlPage("Link expired", "We couldn't find that subscription."), {
      status: 404,
      headers: { "content-type": "text/html" },
    });
  }

  return new NextResponse(
    htmlPage("You're unsubscribed", `${data.email} will no longer receive the daily brief.`),
    { status: 200, headers: { "content-type": "text/html" } },
  );
}

function htmlPage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title} — stocकaar</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:Inter,system-ui,sans-serif;background:#0a0f1c;color:#e8eef9;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
.card{max-width:480px;background:#101728;border:1px solid #243154;border-radius:16px;padding:32px;text-align:center}
h1{margin:0 0 12px;font-size:22px}
p{margin:0;color:#8e9bb8;line-height:1.55}
a{display:inline-block;margin-top:20px;background:linear-gradient(135deg,#6398ff,#38e0c8);color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600}</style></head>
<body><div class="card"><h1>${title}</h1><p>${body}</p><a href="/">← Back to stocकaar</a></div></body></html>`;
}
