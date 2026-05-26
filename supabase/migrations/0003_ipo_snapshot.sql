-- Persistent snapshot of last good IPO data from NSE
-- Single-row table; service role only.
create table if not exists ipo_snapshot (
  id int primary key default 1,
  data jsonb not null,
  source text not null,
  fetched_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

alter table ipo_snapshot enable row level security;
-- No anon policies. Read via service role only.
