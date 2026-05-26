# Architecture — Stocksbrew India (Production-Ready)

## Goals
- Solo-operable (managed services > self-hosted)
- Bootstrap cost (₹0–500/mo at launch, scale to ~₹10K/mo at 1K paying users)
- Low ops burden (auto-deploy, managed DB, serverless cron)
- Compliance-ready (SEBI awareness, GST, Razorpay KYC)

---

## High-Level Diagram

```
                          ┌────────────────────────┐
                          │     End User (Web)     │
                          └───────────┬────────────┘
                                      │  HTTPS
                          ┌───────────▼────────────┐
                          │   Vercel Edge / CDN    │
                          │  (static + RSC cache)  │
                          └───────────┬────────────┘
                                      │
                          ┌───────────▼────────────┐
                          │   Next.js (App Router) │
                          │   ├ Server Components  │
                          │   ├ Server Actions     │
                          │   └ Route Handlers     │
                          └─┬──────┬──────┬──────┬─┘
                            │      │      │      │
              ┌─────────────┘      │      │      └─────────────┐
              │                    │      │                    │
        ┌─────▼──────┐    ┌────────▼──┐ ┌─▼────────┐    ┌──────▼─────┐
        │  Supabase  │    │  Upstash  │ │  Upstox  │    │  Razorpay  │
        │ Postgres   │    │   Redis   │ │  API v2  │    │ Subs + Hook│
        │ + Auth+RLS │    │  (cache,  │ │ (NSE/BSE │    │            │
        └────────────┘    │   rate    │ │  quotes) │    └────────────┘
                          │   limit)  │ └──────────┘
                          └───────────┘
                                ▲
                          ┌─────┴───────────────┐
                          │   Vercel Cron       │
                          │   (alert engine,    │
                          │    token refresh,   │
                          │    newsletter)      │
                          └─────────────────────┘

                  ┌────────────┐
                  │   Resend   │  ← triggered by alert engine, signup, billing events
                  │   (email)  │
                  └────────────┘
```

---

## Components

### 1. Edge / Delivery
- **Vercel CDN** caches static assets + RSC payloads where possible.
- Marketing pages (`/`, `/pricing`, blog) fully static (ISR).
- Authed pages dynamic (SSR with cookie).

### 2. Application Layer (Next.js)
- **Route groups**:
  - `(marketing)/*` — public, SEO-optimized, static.
  - `(app)/*` — authed, dynamic, requires session.
  - `auth/*` — public auth flows.
  - `api/*` — route handlers for mutations, webhooks, cron.
- **Server Components** by default. Client only for forms and live-updating widgets.
- **Server Actions** for mutations from forms (auth, watchlist add/remove, alert create).
- **Middleware** (`middleware.ts`) refreshes Supabase session on every request.

### 3. Data Layer (Supabase Postgres)
- **Tables**: `profiles`, `watchlist_items`, `alerts`, `alert_history`. (Schema in `supabase/migrations/0001_init.sql`.)
- **Row-Level Security**: every table has RLS enabled; policies enforce `auth.uid() = user_id`.
- **Triggers**: auto-create `profiles` row on `auth.users` insert.
- **Service role key** used ONLY in: cron jobs (alert engine), Razorpay webhook, admin ops. Never in user-facing routes.
- **Backup**: Supabase auto-backups daily (Pro tier); restore tested quarterly.

### 4. Cache Layer (Upstash Redis)
- **Quote cache**: `quote:{exchange}:{symbol}` → JSON, TTL 60s.
- **Rate limiting**: `@upstash/ratelimit` on `/api/stocks/*` (e.g., 30 req/min/user).
- **Idempotency keys**: Razorpay webhook deduplication.
- **Job locks**: cron jobs use Redis SETNX to prevent double-runs.

### 5. Stock Data (Upstox)
- `lib/upstox.ts` wraps all API calls. Cache-first read pattern.
- **Token refresh**: Upstox tokens expire daily at ~3:30 AM IST. Cron job at 4 AM re-authenticates via OAuth refresh flow. Token stored encrypted in Redis (key: `upstox:access_token`).
- **Fallback**: on 401, log + alert ops; degrade to "data temporarily unavailable" UI.
- **Quota**: Upstox free tier limits — cache aggressively, batch where possible.

### 6. Payments (Razorpay)
- **Subscriptions API**: customers → subscriptions → recurring charges. Plans created in dashboard.
- **Webhook** at `/api/razorpay/webhook` handles: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `payment.failed`. Signature verified using `RAZORPAY_WEBHOOK_SECRET`.
- **Plan gating**: middleware reads `profiles.plan` and enforces limits in API routes (`maxWatchlistItems`, `maxAlerts`).
- **Invoice/GST**: Razorpay generates GST-compliant invoices once GSTIN registered.

### 7. Email (Resend)
- Transactional only: signup verification (Supabase handles), price alerts, billing receipts.
- All emails sent from `alerts@stocksbrew.in` (or chosen domain).
- Templates in `lib/email/templates/` (Week 4).

### 8. Cron Jobs (Vercel Cron)
Defined in `vercel.json`. Run as HTTP GET to protected endpoints (`CRON_SECRET` Bearer auth):
- **Every 5 min, 9:15–15:30 IST Mon–Fri**: `/api/cron/check-alerts` — scans active alerts, triggers email + marks triggered.
- **Daily 4 AM IST**: `/api/cron/refresh-upstox-token`.
- **Daily 8 AM IST (Phase 2)**: `/api/cron/send-newsletter`.

When cron work > 60s (Vercel Hobby limit) or > 300s (Pro): migrate to **QStash** or dedicated worker on Render.

### 9. Observability
- **Errors**: Sentry on both client and server. Source maps uploaded on build.
- **Web vitals**: Vercel Analytics.
- **Logs**: Vercel native (7-day retention). Upgrade to Axiom/Logflare for longer.
- **Uptime**: BetterStack or UptimeRobot pinging `/api/health`.
- **Alerts**: critical errors page to email/Slack.

### 10. CI/CD
- GitHub → Vercel: PR → preview deploy; merge to `main` → production.
- GitHub Actions: typecheck + lint on every PR.
- DB migrations: hand-applied via Supabase SQL editor (small team). Migrate to `supabase` CLI once team > 1.

---

## Scaling Path

| Stage | Users | Bottleneck | Action |
|-------|-------|-----------|--------|
| 0–100 paying | < 1K MAU | None | Free/Hobby tiers |
| 100–1K paying | < 10K MAU | Supabase free DB | Supabase Pro (8GB), Vercel Pro |
| 1K–10K paying | < 100K MAU | Upstash free, cron 60s limit | Paid Upstash, QStash for alerts, separate worker |
| 10K+ paying | 100K+ MAU | Single DB writes | Read replicas, partition `alert_history`, dedicated stock-data worker |

---

## Security
- **Secrets**: only in Vercel env vars (production) and `.env.local` (dev). Never in code, never in chat.
- **RLS**: every public-data table has it on; service role key never exposed to client.
- **Webhooks**: always signature-verified before processing.
- **Rate limiting**: per-user (auth'd) and per-IP (unauth'd) on all API endpoints.
- **Auth**: Supabase handles password hashing, OAuth, session JWT signing.
- **CSP**: configure in `next.config.js` before launch.
- **Dependency scanning**: GitHub Dependabot enabled.

---

## What's deliberately NOT included (yet)
- Mobile app (web is mobile-responsive; native later if traction)
- Real-time websocket prices (60s polling is enough for retail watchlists)
- Self-hosted ML for predictions (avoid scope creep + SEBI risk)
- Multi-region (single Mumbai region is fine for Indian users)
- Microservices (monolith Next.js scales fine to 100K users)

---

## Disaster Recovery
- Supabase: daily automated backups (Pro tier), PITR on Pro+.
- Upstash: ephemeral cache, can be lost without data loss.
- Razorpay: source of truth for billing state. On webhook miss, reconcile via Razorpay API.
- Recovery target: RTO 1 hr, RPO 24 hr (acceptable for MVP, tighten post-PMF).
