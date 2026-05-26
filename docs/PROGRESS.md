# Progress Log

Track what's built, what's deployed, what's pending. Update after each work session.

## Week 1: Foundation ✅
**Status**: complete
- [x] Next.js 14 + TypeScript + Tailwind scaffolded
- [x] Supabase client + server + middleware helpers
- [x] DB schema (profiles, watchlist_items, alerts, alert_history) with RLS + auto-profile trigger
- [x] Upstash Redis wrapper
- [x] Upstox API wrapper (cached, 60s TTL)
- [x] Landing page (hero, features, pricing)
- [x] CLAUDE.md, ARCHITECTURE.md, CONVENTIONS.md, PROGRESS.md

**Verified working**:
- [x] Landing page renders at http://localhost:3000

## Week 2: Auth + Watchlist ✅
**Status**: complete
- [x] Signup/login/signout server actions with `useFormState` error display
- [x] OAuth callback route
- [x] Email confirmation flow (`/auth/check-email`)
- [x] Authed `(app)` layout with redirect-if-unauth
- [x] Header with nav + sign out
- [x] Watchlist page with live prices + plan-aware limits
- [x] `POST /api/watchlist`, `DELETE /api/watchlist/[id]`
- [x] `GET /api/stocks/search` (60 NSE symbols seed)
- [x] AddStockForm with autocomplete
- [x] WatchlistTable with live prices + remove
- [x] Diagnostic endpoints: `/api/health`, `/api/watchlist/debug`
- [x] Yahoo Finance fallback when Upstox 401/missing (lib/upstox.ts)

**Verified working** (2026-05-22): TCS shown at ₹2,317.30 (+1.49%) via Yahoo.

## Week 3: Market Dashboard (in progress)
- [x] `lib/market.ts` — index quotes (Nifty 50, Sensex, Bank Nifty) + top movers
- [x] Dashboard page with index cards, gainers/losers, market-open indicator
- [x] Stock detail page `/stock/[symbol]` with stats grid
- [x] AddStockDetailButton component
- [x] Watchlist symbols now link to stock detail
- [ ] Optional: most-active by volume
- [ ] Optional: sector performance grid

## Week 4: Alerts ✅
**Status**: complete (cron will activate on Vercel deploy)
- [x] Alerts page UI with hero, plan-aware counter, market-open chip
- [x] AlertForm with symbol autocomplete + above/below + target ₹
- [x] AlertsList with status pills + remove
- [x] `GET/POST /api/alerts`, `DELETE /api/alerts/[id]`
- [x] Resend email wrapper + branded HTML template (`lib/email.ts`)
- [x] `/api/cron/check-alerts` (service-role, market-hours guard, dedup quotes, writes alert_history, sends email)
- [x] `vercel.json` cron: `*/5 4-10 * * 1-5` (UTC ≈ 9:15–15:30 IST)

## Week 5: Razorpay Subscription ✅
**Status**: complete (test mode — switch keys + verify webhook URL before launch)
- [x] `lib/razorpay.ts` — client, plan map, webhook signature verify (timing-safe)
- [x] `POST /api/razorpay/create-subscription` (creates sub, stores sub_id)
- [x] `POST /api/razorpay/cancel` (cancel at cycle end, retains access)
- [x] `POST /api/razorpay/webhook` (service-role, handles activated/charged/cancelled/halted/paused)
- [x] `CheckoutButton.tsx` — loads Razorpay checkout.js, opens modal, refreshes on success
- [x] `CancelButton.tsx` — two-step confirm
- [x] Rewrote `/account` with hero, plan card, upgrade tiles (gradient-border on annual)
- [x] Plan gating already enforced in `/api/watchlist` and `/api/alerts` (max from PLANS)
- [ ] Razorpay live keys + webhook URL `https://<domain>/api/razorpay/webhook` (post-deploy)

## Week 6: Polish + Launch (in progress)
- [x] Uniform UI sweep (2026-05-23): created `components/StockGrid.tsx` (card grid with gradient accent bar + hover shine + signal chip + 52W bar + scorecard progress) and swapped into `hot-stocks` and `anomalies` pages
- [x] Dashboard polished — indices + movers re-themed with `surface`, gradient bar, magnitude meters, ring chips
- [x] Sectors grid — gradient accent bar + Avg Score gradient progress + "Open sector →" CTA
- [x] Calls page — feeds `sector` into logos for tinted gradients via CallsGridLazy
- [x] Screener page rebuilt as live, game-like (`components/ScreenerControls.tsx`): URL-as-state with 220ms debounce + `useTransition`, 6 presets (Value/Growth/Quality/Momentum/BUY/Beaten down), pillar+val+quality+growth+tech slider rail with sticky pending pulse, active filter pills with × remove + Reset all, big animated MatchCount with color-shifting gradient bar (danger→warning→brand)
- [x] Demo newsletter endpoint `app/api/admin/demo-newsletter/route.ts` — Bearer-auth or NODE_ENV bypass, builds the same HTML brief with a yellow "Demo preview" banner
- [x] Sent first demo email via Resend (id `77ca94da-7823-4aca-b773-dcba3ef21d76`) to logintotathagata@gmail.com using key `re_g3AkuP2i_4kKrFij2zSwN4nGSBURKGHdU` from `onboarding@resend.dev` (bypassed dev server because RESEND_API_KEY in .env.local is still empty)
- [x] Newsletter template upgrade (2026-05-23): richer hero, scorecard CTA blocks, Pro upsell card, social proof strip, secondary "Try the screener" + "Should I Buy" CTAs — shared by both demo and cron route
- [ ] Loading states, empty states, error boundaries
- [ ] SEO meta tags + sitemap.xml + robots.txt
- [ ] OG images for landing + pricing
- [ ] Privacy Policy, Terms, Refund Policy pages (Razorpay requires)
- [ ] Sentry integration
- [ ] Domain + SSL on Vercel
- [ ] Razorpay live keys + webhook URL (post-deploy)
- [ ] Should-I-Buy enhancement (PositionSizer, RiskProfileToggle, VerdictGauge, Bull vs Bear)
- [ ] Persist `RESEND_API_KEY` + real `EMAIL_FROM` (verified domain) into Vercel env
- [ ] Tighten cron `isAuthorized` (drop NODE_ENV bypass for production)
- [ ] Soft launch: post to Twitter, r/IndianStreetBets, IndieHackers

---

## Post-MVP backlog (Phase 2)
- Daily newsletter automation
- Screening tools (P/E, dividend yield, market cap filters)
- Sector performance tracker
- Historical price charts (Upstox candle endpoints)
- Mobile responsiveness polish
- Educational blog
- Affiliate / referral program
- Telegram alert delivery (alternative to email)

---

## Decisions log
- **2026-05-22**: Locked stack (Next.js, Supabase, Upstash, Razorpay, Resend). Bootstrap budget.
- **2026-05-22**: No buy/sell recommendations in MVP (SEBI). User handles license separately.
- **2026-05-22**: Pricing — Free (3 stocks/alerts), Pro ₹299/mo, Annual ₹2999/yr.
- **2026-05-22**: Quote cache TTL = 60s (balance freshness vs Upstox rate limits).
- **2026-05-23**: Uniform UX standard locked — surface card + 1px gradient accent bar (left) + hover shine + ringed chips + gradient progress bars. Applied across calls/hot-stocks/anomalies/dashboard/sectors/screener.
- **2026-05-23**: Screener interaction model = URL-as-state + debounced router.replace + useTransition, not form-submit. Filters live-update; back/forward works. Presets are exact-match (params equality).
- **2026-05-23**: Newsletter is product's #1 acquisition surface — every email carries an upsell strip (Pro features), a "Should I Buy" CTA, and a "Try the screener" CTA. Demo endpoint exists so any prospect can request a preview before subscribing.
