import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getQuotes } from "@/lib/upstox";
import { get20dAvgVolume } from "@/lib/history-volume";
import { getStockNews, type NewsItem } from "@/lib/news";
import { isMarketOpen } from "@/lib/constants";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { smartAlertEmailHtml, smartAlertEmailSubject } from "@/lib/email/templates/smart-alert";
import { scoreHeadlines, urlHash, type MaterialityScore } from "@/lib/alerts/materiality";
import { generateBrief } from "@/lib/alerts/brief";
import { evaluate, type EvalFired } from "@/lib/alerts/evaluate";
import { TriggersSchema, type Triggers, type TriggerKind } from "@/lib/alerts/schema";
import { isNvidiaConfigured } from "@/lib/nvidia";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h per alert
const FRESH_NEWS_WINDOW_MS = 24 * 60 * 60 * 1000;
const NEWS_MATERIALITY_THRESHOLD = 7;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const hdr = req.headers.get("authorization") || "";
  return hdr === `Bearer ${secret}`;
}

type AlertRow = {
  id: string;
  user_id: string;
  symbol: string;
  exchange: "NSE" | "BSE";
  label: string | null;
  triggers: unknown;
  last_notified_at: string | null;
};

type ParsedAlert = AlertRow & { parsedTriggers: Triggers };

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "supabase service env missing" }, { status: 500 });
  }
  const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: alertsRaw, error } = await admin
    .from("alerts")
    .select("id, user_id, symbol, exchange, label, triggers, last_notified_at")
    .eq("status", "active")
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const alerts: ParsedAlert[] = [];
  for (const a of (alertsRaw ?? []) as AlertRow[]) {
    const parsed = TriggersSchema.safeParse(a.triggers);
    if (!parsed.success) {
      console.warn("[cron:smart-alerts] skip invalid triggers", a.id, parsed.error.issues[0]?.message);
      continue;
    }
    alerts.push({ ...a, parsedTriggers: parsed.data });
  }
  if (alerts.length === 0) return NextResponse.json({ ok: true, checked: 0, triggered: 0 });

  const marketOpen = isMarketOpen();
  const llmAvailable = isNvidiaConfigured();

  // Bucket alerts by symbol so we share the per-symbol fetches.
  const buckets = new Map<string, { exchange: "NSE" | "BSE"; alerts: ParsedAlert[] }>();
  for (const a of alerts) {
    const k = `${a.exchange}:${a.symbol}`;
    const b = buckets.get(k);
    if (b) b.alerts.push(a);
    else buckets.set(k, { exchange: a.exchange, alerts: [a] });
  }

  // Bulk-fetch quotes for every symbol in one call.
  const quoteItems = Array.from(buckets.entries()).map(([k, v]) => ({ symbol: k.split(":")[1], exchange: v.exchange }));
  const quotes = await getQuotes(quoteItems).catch(() => []);
  const quoteMap = new Map(quotes.map((q) => [`${q.exchange}:${q.symbol}`, q]));

  const triggered: { alertId: string; kinds: TriggerKind[]; emailed: boolean }[] = [];

  for (const [bucketKey, bucket] of buckets) {
    const quote = quoteMap.get(bucketKey);
    if (!quote) continue;

    const needsVolume = marketOpen && bucket.alerts.some((a) => a.parsedTriggers.volume);
    const needsNews = bucket.alerts.some((a) => a.parsedTriggers.news);

    let avg20dVolume: number | undefined;
    if (needsVolume) {
      const v = await get20dAvgVolume(quote.symbol, quote.exchange).catch(() => null);
      avg20dVolume = v ?? undefined;
    }

    let freshNews: NewsItem[] = [];
    let materialityByUrl: Map<string, MaterialityScore> = new Map();
    if (needsNews) {
      const news = await getStockNews(quote.symbol, quote.exchange, 12).catch(() => [] as NewsItem[]);
      const cutoff = Date.now() - FRESH_NEWS_WINDOW_MS;
      freshNews = news.filter((n) => n.publishedAt >= cutoff);
      if (freshNews.length > 0) {
        materialityByUrl = await scoreHeadlines(quote.symbol, freshNews).catch(() => new Map());
        // Only keep news that cleared the materiality bar — evaluate() also checks
        // but pre-filtering here keeps the array small for the LLM brief prompt.
        freshNews = freshNews.filter((n) => (materialityByUrl.get(n.url)?.score ?? 0) >= NEWS_MATERIALITY_THRESHOLD);
      }
    }

    const snapshot = {
      price: quote.lastPrice,
      changePct: quote.changePct,
      volume: quote.volume,
      avg20dVolume,
    };

    for (const a of bucket.alerts) {
      await processAlert({
        admin,
        alert: a,
        snapshot,
        freshNews,
        materialityByUrl,
        marketOpen,
        llmAvailable,
        triggered,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    marketOpen,
    checked: alerts.length,
    triggered: triggered.length,
    emailed: triggered.filter((t) => t.emailed).length,
  });
}

async function processAlert(args: {
  admin: ReturnType<typeof createServiceClient>;
  alert: ParsedAlert;
  snapshot: { price: number; changePct: number; volume?: number; avg20dVolume?: number };
  freshNews: NewsItem[];
  materialityByUrl: Map<string, MaterialityScore>;
  marketOpen: boolean;
  llmAvailable: boolean;
  triggered: { alertId: string; kinds: TriggerKind[]; emailed: boolean }[];
}) {
  const { admin, alert, snapshot, freshNews, materialityByUrl, marketOpen, llmAvailable, triggered } = args;

  // Outside market hours: only news triggers run.
  const effectiveTriggers: Triggers = { ...alert.parsedTriggers };
  if (!marketOpen) {
    delete effectiveTriggers.price;
    delete effectiveTriggers.move;
    delete effectiveTriggers.volume;
  }
  if (Object.keys(effectiveTriggers).length === 0) return;

  const fired = evaluate(effectiveTriggers, snapshot, freshNews, materialityByUrl);
  if (fired.length === 0) return;

  // News dedup — drop fired news entries we've already emailed for this alert.
  const newsHashes = fired
    .filter((f): f is EvalFired & { news: NewsItem } => f.kind === "news" && !!f.news)
    .map((f) => urlHash(f.news.url));
  let firedAfterDedup: EvalFired[] = fired;
  if (newsHashes.length > 0) {
    const { data: priorNotifs } = await admin
      .from("alert_notifications")
      .select("news_url_hash")
      .eq("alert_id", alert.id)
      .in("news_url_hash", newsHashes);
    const seen = new Set((priorNotifs ?? []).map((p) => p.news_url_hash as string));
    firedAfterDedup = fired.filter((f) => f.kind !== "news" || !seen.has(urlHash(f.news!.url)));
  }
  if (firedAfterDedup.length === 0) return;

  const firedKinds = Array.from(new Set(firedAfterDedup.map((f) => f.kind)));
  const primaryNews = firedAfterDedup.find((f) => f.kind === "news")?.news;

  // 6h cooldown per alert: log the suppressed firings so the user sees them in the activity log.
  const lastNotifiedMs = alert.last_notified_at ? Date.parse(alert.last_notified_at) : 0;
  const inCooldown = lastNotifiedMs > 0 && Date.now() - lastNotifiedMs < COOLDOWN_MS;
  if (inCooldown) {
    await admin.from("alert_notifications").insert(
      firedAfterDedup.map((f) => ({
        alert_id: alert.id,
        kind: f.kind,
        suppressed: true,
        payload: buildPayload(f, snapshot, alert.parsedTriggers),
        news_url_hash: f.news ? urlHash(f.news.url) : null,
      })),
    );
    triggered.push({ alertId: alert.id, kinds: firedKinds, emailed: false });
    return;
  }

  const brief = await generateBrief({
    symbol: alert.symbol,
    exchange: alert.exchange,
    triggerKinds: firedKinds,
    snapshot,
    news: primaryNews,
  });

  const { data: userRes } = await admin.auth.admin.getUserById(alert.user_id);
  const email = userRes?.user?.email;

  let emailed = false;
  if (email && isEmailConfigured()) {
    const emailArgs = {
      symbol: alert.symbol,
      exchange: alert.exchange,
      label: alert.label,
      firedKinds,
      triggers: alert.parsedTriggers,
      snapshot,
      brief,
      news: primaryNews,
      llmAvailable,
    };
    const sendRes = await sendEmail({
      to: email,
      subject: smartAlertEmailSubject(emailArgs),
      html: smartAlertEmailHtml(emailArgs),
    });
    emailed = sendRes.ok;
  }

  await admin.from("alert_notifications").insert(
    firedAfterDedup.map((f) => ({
      alert_id: alert.id,
      kind: f.kind,
      brief: emailed ? brief : null,
      payload: buildPayload(f, snapshot, alert.parsedTriggers),
      news_url_hash: f.news ? urlHash(f.news.url) : null,
      suppressed: !emailed,
    })),
  );

  if (emailed) {
    await admin
      .from("alerts")
      .update({ last_notified_at: new Date().toISOString() })
      .eq("id", alert.id);
  }

  triggered.push({ alertId: alert.id, kinds: firedKinds, emailed });
}

function buildPayload(f: EvalFired, snapshot: { price: number; changePct: number; volume?: number; avg20dVolume?: number }, triggers: Triggers) {
  if (f.kind === "price" && triggers.price) {
    return { current: snapshot.price, target: triggers.price.target, condition: triggers.price.condition };
  }
  if (f.kind === "move" && triggers.move) {
    return { current: snapshot.price, changePct: snapshot.changePct, threshold: triggers.move.pctAbs };
  }
  if (f.kind === "volume" && triggers.volume) {
    return {
      volume: snapshot.volume,
      avg20d: snapshot.avg20dVolume,
      multiple: snapshot.avg20dVolume && snapshot.volume ? snapshot.volume / snapshot.avg20dVolume : null,
    };
  }
  if (f.kind === "news" && f.news) {
    return {
      url: f.news.url,
      title: f.news.title,
      publisher: f.news.publisher,
      publishedAt: f.news.publishedAt,
      materiality: f.materiality ?? null,
    };
  }
  return {};
}
