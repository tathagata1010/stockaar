# CLAUDE.md — Stocksbrew India

> Auto-loaded by Claude Code at session start. Keep concise.

## Project
Solo-founder subscription SaaS — Indian stock market analysis with full Stocksbrew (US) feature parity for NSE/BSE. Bootstrap budget. Charging from day one via Razorpay. Goal: launch live to attract retail Indian investors.

## SEBI / Legal — IMPORTANT BUT USER-MANAGED
- User has explicitly accepted SEBI regulatory risk and will handle Research Analyst registration / compliance separately. **Do not block features on this.**
- Disclaimer is still required on every market-data view: *"For informational purposes only. Not investment advice."* Use the `<Disclaimer />` component.
- Razorpay requires live Privacy Policy, T&C, Refund Policy pages before activation.
- GST registration triggers at ₹20L turnover.

## Stack (locked)
- **Framework**: Next.js 14 (App Router) + TypeScript + Tailwind
- **Charts**: Recharts
- **DB + Auth**: Supabase (Postgres with RLS, email/password + Google OAuth)
- **Cache**: Upstash Redis (REST, serverless)
- **Stock data**: Upstox API v2 (live, when token valid) + Yahoo Finance v8/v10 (fallback, ~15min delayed). Yahoo `quoteSummary` for fundamentals.
- **Payments**: Razorpay Subscriptions (UPI/India)
- **Email**: Resend
- **Hosting**: Vercel
- **Monitoring (later)**: Sentry + Vercel Analytics
- **AI brief (Pro feature)**: Anthropic Claude API

## Pricing
- Free: 3 stocks, 3 alerts, basic dashboard
- Pro: ₹299/mo — unlimited stocks/alerts, stock calls, scorecard, screener, anomalies, newsletter, AI brief
- Pro Annual: ₹2,999/yr (~17% off)

## Feature surface (full Stocksbrew parity)
- **Watchlist**: live prices, sparklines, % change, day range, 52W range
- **Dashboard**: indices (Nifty/Sensex/Bank Nifty), top gainers/losers, hot stocks, sector heatmap
- **Stock detail**: live price + chart (1D–5Y), Scorecard (4 pillars), Key Stats, Why Care Today, Performance Returns, Day Stats, 52W Range bar, Analyst Ratings, Financials, Ownership (when available)
- **Stock Calls**: algorithmic Buy/Hold/Sell signals with reasoning (Pro)
- **Screener**: filter stocks by P/E, market cap, dividend yield, sector, etc.
- **Hot Stocks**: trending picks (computed from volume + momentum)
- **Market Anomalies**: unusual moves (volume spikes, gap-ups, 52W highs/lows)
- **Alerts**: price target email alerts (market hours only)
- **Newsletter**: daily 3-min morning digest emailed (Pro)
- **AI Brief**: Claude-generated per-stock summaries (Pro)
- **Education**: ~50 markdown guides on Indian investing
- **Account**: subscription, billing, alerts management

## Project layout
```
app/
  (marketing)/  # landing, pricing, education
  (app)/        # authed: dashboard, watchlist, hot-stocks, calls, screener, anomalies, alerts, stock/[symbol], account
  auth/
  api/          # route handlers
lib/
  supabase/{client,server,middleware}.ts
  upstox.ts           # quote wrapper (Upstox + Yahoo fallback)
  fundamentals.ts     # Yahoo quoteSummary wrapper
  market.ts           # indices, movers, hot stocks
  scorecard.ts        # 4-pillar scoring algorithm
  calls.ts            # Buy/Hold/Sell signal algorithm
  screener.ts         # screener filters
  redis.ts
  razorpay.ts
  email.ts
  claude.ts           # Anthropic SDK wrapper for AI brief
  constants.ts        # PLANS, market hours, INR helpers
  nse-symbols.ts      # symbol master (will grow to full ~2K from NSE)
  utils.ts
components/
  ui/                 # primitives
  Disclaimer.tsx
  PriceChart.tsx
  RangeBar.tsx
  Scorecard.tsx
  KeyStats.tsx
  WhyCareToday.tsx
  AnalystRatings.tsx
  Financials.tsx
  StockSparkline.tsx
  PerformanceReturns.tsx
  LivePriceHeader.tsx
  WatchlistTable.tsx
  AddStockForm.tsx
  Header.tsx
supabase/migrations/  # SQL
docs/                 # ARCHITECTURE.md, CONVENTIONS.md, PROGRESS.md
middleware.ts
```

## Conventions (must follow)
- Server components by default; `"use client"` only when needed.
- DB through Supabase client. RLS does authz. Never bypass service role key in user-facing routes — only in cron, webhooks, admin.
- Currency: `formatINR()` from `lib/utils.ts`.
- Times: store UTC, display IST. `isMarketOpen()` in `lib/constants.ts`.
- API responses: `{ data }` or `{ error: string }` + status code.
- See `docs/CONVENTIONS.md`.

## Common pitfalls
- Upstox access token expires daily at ~3:30 AM IST. On 401 → wrapper falls back to Yahoo.
- Supabase RLS errors return empty result, not error — always verify policies.
- Razorpay webhook signature MUST be verified.
- Don't call Yahoo/Upstox on every render — `lib/upstox.ts` is Redis-cached (60s TTL); `lib/fundamentals.ts` cached 6h.
- Market hours guard on alert engine.
- Yahoo `quoteSummary` requires specific module names (summaryDetail, defaultKeyStatistics, financialData, recommendationTrend).

## Where things live
- 6-week build plan: `C:\Users\tatha\.claude\plans\fluttering-discovering-sunbeam.md`
- Production HLD: `docs/ARCHITECTURE.md`
- Coding conventions: `docs/CONVENTIONS.md`
- What's built: `docs/PROGRESS.md`
- Feature catalog: `docs/FEATURES.md`
