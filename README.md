# stocकaar

Indian stock market analysis — watchlists, alerts, market dashboard, paid subscription.

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth)
- Upstash Redis (price cache)
- Upstox API (NSE/BSE quotes)
- Razorpay (subscriptions)
- Resend (email alerts)
- Vercel (hosting + cron)

## Local setup

1. `cp .env.local.example .env.local` and fill in the values below.
2. `npm install`
3. `npm run dev` → http://localhost:3000

### Required accounts (all free to start)
- **Supabase**: https://supabase.com — create a project, copy URL + anon key + service role key.
- **Upstash**: https://upstash.com — create a Redis db, copy REST URL + token.
- **Upstox Developer**: https://upstox.com/developer/ — create app for OAuth credentials. Access token must be refreshed daily.
- **Razorpay**: https://razorpay.com — sign up, switch to test mode, create plans for ₹299/mo and ₹2999/yr, copy plan IDs.
- **Resend**: https://resend.com — verify a sending domain, get API key.

### Database migration
Open Supabase → SQL Editor → paste contents of `supabase/migrations/0001_init.sql` → Run.

## Build phases
See `C:\Users\tatha\.claude\plans\fluttering-discovering-sunbeam.md` for the 6-week roadmap.

**Current**: Week 1 foundation (✅ done)
- Project scaffolded
- Landing + pricing page
- Supabase schema + RLS
- Upstox + Redis price cache wrapper
- Middleware for auth session refresh

**Next**: Week 2 — auth flows + watchlist CRUD.

## Important
- This product does NOT give Buy/Sell/Hold recommendations (SEBI compliance).
- All prices/data shown are informational only. Footer disclaimer is required.
- Razorpay needs Privacy Policy, Terms, and Refund Policy pages live before going live.
