-- Concall guidance tracker — corporate filings + LLM-extracted forward-looking signals.
-- See docs/GUIDANCE_FEATURE.md.

create table if not exists filings (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('BSE','NSE')),
  source_id text not null,
  symbol text,
  bse_scrip_code text,
  company_name text,
  category text not null check (category in (
    'concall_transcript','investor_presentation','business_update','press_release'
  )),
  headline text,
  filed_at timestamptz not null,
  pdf_url text,
  text_body text,
  status text not null default 'pending' check (status in ('pending','extracted','failed','skipped')),
  error text,
  extracted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source, source_id)
);

create index if not exists filings_symbol_filed_at_idx on filings (symbol, filed_at desc);
create index if not exists filings_status_idx on filings (status);
create index if not exists filings_filed_at_idx on filings (filed_at desc);

create table if not exists guidance_signals (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid not null references filings(id) on delete cascade,
  symbol text not null,
  metric text not null check (metric in ('revenue','ebitda','margin','volume','capex','orders','other')),
  direction text not null check (direction in ('up','down','flat','mixed')),
  value_text text,
  timeframe text,
  quote text not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  filed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists guidance_signals_symbol_filed_at_idx on guidance_signals (symbol, filed_at desc);
create index if not exists guidance_signals_direction_filed_at_idx on guidance_signals (direction, filed_at desc);

alter table filings enable row level security;
alter table guidance_signals enable row level security;

-- Authenticated users can read. Writes go through service role only.
drop policy if exists "filings read" on filings;
create policy "filings read" on filings for select to authenticated using (true);

drop policy if exists "guidance_signals read" on guidance_signals;
create policy "guidance_signals read" on guidance_signals for select to authenticated using (true);
