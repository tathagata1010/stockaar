# Concall Guidance Tracker — Feature Spec

> Star feature: surface stocks where **management has guided for higher growth** via concall transcripts, investor presentations, and corporate filings.

## Why this matters
Indian retail investors miss most concall guidance because:
1. Transcripts drop 5–10 days post-earnings, buried in BSE/NSE filing portals
2. Investor presentations are PDFs that nobody reads
3. Brokerages summarise them only for their own clients
4. The actual *forward-looking quote* is the alpha — and it's almost never indexed

We extract those quotes with an LLM, structure them, and show retail users *"X management said they expect Y growth by Z."* with a verbatim source quote and a link to the original filing.

## SEBI / compliance guardrails (non-negotiable)
- We **only display what management said**, verbatim. No editorialising, no buy/sell opinion, no price target derived from guidance.
- Every signal carries: (a) verbatim quote, (b) source PDF/page link, (c) "AI-extracted from company filing — verify against source" disclaimer.
- We are an information aggregator on **publicly filed** corporate disclosures (BSE/NSE filings are public domain).
- No human analyst commentary attached. Stays factual, not advisory.

## Data pipeline

```
BSE/NSE Filings API
   │  (cron: weekday 10:00, 14:00, 18:00 IST + once weekends)
   ▼
filter: category ∈ {Earnings Call Transcript, Investor Presentation,
                    Business Update, Press Release}
   ▼
fetch PDF / text body  →  store filings row (raw)
   ▼
LLM extractor (NVIDIA NIM, Llama-3.3-70B — free tier)
   prompt: "Extract every forward-looking guidance statement…"
   schema: { metric, direction, value_text, timeframe, quote, confidence }
   ▼
upsert guidance_signals rows
   ▼
surfaces:
  • /guidance     — universe feed, filterable by sector / direction
  • /stock/[sym]  — Guidance tab on detail page
  • Hot-Stocks    — bonus rank factor for stocks with fresh positive guidance
  • Pro Alert     — "TCS just guided for 12-14% revenue growth"
  • Newsletter    — Pro digest "This week's guidance"
```

## Data model

### `filings`
| column | type | notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `source` | text | `BSE` \| `NSE` |
| `source_id` | text | provider's filing id — uniq with source |
| `symbol` | text | NSE symbol when resolvable |
| `bse_scrip_code` | text | when source=BSE |
| `company_name` | text | as filed |
| `category` | text | `concall_transcript` \| `investor_presentation` \| `business_update` \| `press_release` |
| `headline` | text | |
| `filed_at` | timestamptz | from filing timestamp |
| `pdf_url` | text | |
| `text_body` | text | extracted text (nullable until extracted) |
| `status` | text | `pending` \| `extracted` \| `failed` \| `skipped` |
| `error` | text | failure reason |
| `extracted_at` | timestamptz | |
| `created_at` | timestamptz default now() | |

Unique: `(source, source_id)`. Index: `(symbol, filed_at desc)`, `(status)`.

### `guidance_signals`
| column | type | notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `filing_id` | uuid fk → filings(id) on delete cascade | |
| `symbol` | text | denormalised for fast lookup |
| `metric` | text | `revenue` \| `ebitda` \| `margin` \| `volume` \| `capex` \| `orders` \| `other` |
| `direction` | text | `up` \| `down` \| `flat` \| `mixed` |
| `value_text` | text | "12-14%", "₹500 Cr", "double digit" |
| `timeframe` | text | "FY26", "next 2 quarters", "by 2027" |
| `quote` | text | verbatim source quote (≤500 chars) |
| `confidence` | numeric | 0–1 from extractor |
| `filed_at` | timestamptz | copied from filing for sort |
| `created_at` | timestamptz default now() | |

Index: `(symbol, filed_at desc)`, `(direction, filed_at desc)`.

Both tables: RLS on, **read** allowed for authenticated users, **write** service-role only.

## LLM extractor

- Model: `meta/llama-3.3-70b-instruct` via NVIDIA NIM (already wired up at `lib/nvidia.ts`). Free tier covers prototype + production for months.
- Escalation: if NIM returns null OR low-confidence-everything, retry with Anthropic Claude Haiku 4.5 (`lib/claude.ts` already wired for AI Brief). Adds ~$0.001/filing.
- Strict JSON output. Reject non-JSON. Validate with zod.
- Prompt principle: extract only **forward-looking, quantified** statements. Reject past-tense recaps. Reject vague language like "we remain optimistic" without a number/timeframe.

## Surfaces (this turn ships items 1, 2, 5)

1. **`/guidance`** — global feed, latest first. Filter chips: sector, direction (up/down), metric, timeframe. Each row links to the source PDF and the stock page.
2. **Stock detail → Guidance tab** — last 4 quarters of signals for that symbol *(next turn)*.
3. **Hot-Stocks bonus** — symbols with ≥2 fresh "up" signals in last 30 days get a +5 score nudge *(next turn)*.
4. **Pro Alerts** — opt-in per symbol, fires when new positive signal lands *(later)*.
5. **Navigation** — Discover → "Guidance" with Sparkles icon.

## Costs
- NIM: free tier (1000 req/day)
- Anthropic Haiku fallback: ~$0.001/filing → ≤$10/mo even at 300 filings/day
- Supabase storage: tiny (text-only, no PDF storage — link out)
- Cron: 4×/day = free on Vercel hobby tier

## Phase plan
- **Phase 1 (this turn):** schema + BSE fetcher + extractor + manual ingest endpoint + feed page + nav. Ship and validate.
- **Phase 2:** vercel cron + stock-page Guidance tab + Hot-Stocks scoring nudge.
- **Phase 3:** NSE source + PDF text extraction (currently relies on filing headline + body text) + Anthropic fallback.
- **Phase 4:** Pro alerts + weekly Pro newsletter digest.

## Manual test plan (phase 1)
1. Run migration in Supabase.
2. Hit `GET /api/admin/guidance/ingest?days=3` (admin-key gated) → expect filings rows + extracted signals.
3. Visit `/guidance` → confirm rows render with quote + source link.
4. Spot-check 5 quotes against their source PDFs for accuracy.
