# Feature Catalog — Stocksbrew India

Full Stocksbrew (US) feature parity, adapted for NSE/BSE. Free vs Pro split for monetization.

## Free tier
- 3 stocks in watchlist
- 3 active price alerts
- Market dashboard (indices, top gainers/losers — limited to top 5)
- Stock detail page (basic: price, chart, day stats, 52W range)
- Stock search

## Pro tier (₹299/mo or ₹2,999/yr)
- Unlimited watchlist & alerts
- Stock Calls (Buy/Hold/Sell algorithmic signals with reasoning)
- Full Scorecard on every stock (Valuation, Growth, Quality, Momentum)
- Key Statistics panel (market cap, P/E, EPS, ROE, debt ratios)
- Why Care Today widget (earnings dates, momentum signals, range position)
- Analyst Ratings (from Yahoo recommendation trend)
- Financials (revenue, profit, growth)
- Ownership / holders (where data available)
- Stock Screener (filter by P/E, market cap, sector, dividend yield, etc.)
- Hot Stocks page (curated picks based on momentum + volume)
- Market Anomalies (volume spikes, gap-ups, 52W breakouts)
- Daily Newsletter (3-min morning digest)
- AI Brief — Claude-generated per-stock summary
- Sector heatmap on dashboard

## Free for all (marketing surface)
- Landing page
- Pricing
- ~50 educational guides on Indian investing (markdown)
- Sample Stock Calls (1 per week, public)
- About / legal / contact

## Stock Detail page sections (full)
1. **Header**: symbol, name, exchange, live price (auto-refreshing), day change, "Add to watchlist" / "Set alert" buttons
2. **Chart**: interactive area chart with 7 time ranges (1D, 5D, 1M, 3M, 6M, 1Y, 5Y)
3. **Scorecard** (Pro): 4 pillar scores out of 100 — Valuation, Growth, Quality, Momentum + composite
4. **Why Care Today** (Pro): bullet list of 3–5 signals (earnings date, range position, momentum, volume spike)
5. **52-Week Range bar**: visual position of current price
6. **Performance Returns**: 1W, 1M, 3M, 6M, 1Y returns
7. **Day Statistics**: open, high, low, prev close, volume
8. **Key Statistics** (Pro): market cap, P/E (trailing + forward), EPS, dividend yield, beta, 52W high/low
9. **Financials** (Pro): TTM revenue, operating income, net income, YoY growth
10. **Analyst Ratings** (Pro): consensus + counts (Strong Buy / Buy / Hold / Sell / Strong Sell)
11. **News** (Pro, future): per-stock news feed

## Dashboard sections
1. Indices (Nifty 50, Sensex, Bank Nifty) — large cards
2. Market open/closed indicator
3. Top Gainers (Pro: top 10, Free: top 5)
4. Top Losers (Pro: top 10, Free: top 5)
5. Hot Stocks (Pro): trending by volume + momentum
6. Sector Heatmap (Pro): grid showing sector-wise performance
7. Recently traded (logged-in user's recent views)

## Stock Calls page (Pro)
- Tabbed view: All / Buy / Hold / Sell
- Each call shows: stock, signal, target price, reasoning (3 bullets), generated date, historical accuracy (if tracked)
- Algorithm: combine Scorecard composite + momentum + valuation thresholds
- "Latest call" badge on stocks where signal changed recently

## Screener (Pro)
- Filters: sector, market cap range, P/E range, dividend yield range, 52W range position, change today range
- Results table with sortable columns
- "Save screen" feature (per-user saved filters)

## Hot Stocks (Pro)
- Trending today: top % movers + volume > avg
- Trending this week
- Recent IPOs (when we have that data)
- 52-week high breakouts
- 52-week low rebounds

## Market Anomalies (Pro)
- Volume > 2× 20-day avg
- Gap up / gap down > 3%
- New 52W high / low today
- Stuck in tight range (low volatility)
- Earnings within 7 days

## Newsletter (Pro)
- Sent every weekday 8 AM IST via Resend
- Content: yesterday's close summary, top mover, anomaly highlights, 1 educational tidbit, 1 watchlist stock movement (personalized)
- "3 minutes every morning" framing

## AI Brief (Pro)
- Per-stock natural language summary
- Generated via Claude Haiku (cost-efficient)
- Refreshed weekly per stock or on-demand (rate-limited per user)
- Cached 24h
- Format: "What this company does", "Recent performance highlights", "Things to watch"

## Education (Free, marketing)
- ~50 markdown articles
- Topics: how to read a P/E ratio, sector basics, F&O explained, tax on capital gains in India, diversification, ETFs vs MFs, etc.
- SEO-optimized (each article = landing page for retail Google searches)

## Alerts (Free 3, Pro unlimited)
- Type: price above target / price below target
- Delivery: email (Pro: also Telegram in future)
- Trigger window: market hours only (avoid noise)
- Cron: every 5 min

## Watchlist enhancements (post-MVP)
- Multiple categories / lists
- Drag to reorder
- Add notes per stock (Pro)
- Share watchlist (read-only link)

## Disclaimers (required, displayed everywhere)
- Footer: "For informational purposes only. Not investment advice."
- Stock Calls page: bold red banner explaining algorithmic nature, no guarantee, past performance, etc.
- Newsletter footer: same disclaimer + unsubscribe link
