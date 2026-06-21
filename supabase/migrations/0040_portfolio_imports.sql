-- Portfolio Doctor — user-imported holdings + LLM-generated diagnostic reports.
-- Anon imports are allowed (user_id null) and are intentionally inaccessible
-- via RLS after creation; service role inserts only.

create table if not exists portfolio_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  source text not null check (source in ('screenshot','csv','manual')),
  holdings jsonb not null,
  raw_image_hash text,
  created_at timestamptz not null default now()
);

create index if not exists portfolio_imports_user_idx on portfolio_imports (user_id, created_at desc);
create index if not exists portfolio_imports_image_hash_idx on portfolio_imports (raw_image_hash) where raw_image_hash is not null;

create table if not exists portfolio_diagnostics (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references portfolio_imports(id) on delete cascade,
  health_score smallint not null check (health_score between 0 and 100),
  doctors_note text not null,
  red_flags jsonb not null default '[]'::jsonb,
  quality_issues jsonb not null default '[]'::jsonb,
  rebalance_suggestions jsonb not null default '[]'::jsonb,
  sector_tilt jsonb,
  model text not null,
  prompt_tokens int,
  output_tokens int,
  created_at timestamptz not null default now()
);

create index if not exists portfolio_diagnostics_import_idx on portfolio_diagnostics (import_id);

alter table portfolio_imports enable row level security;
alter table portfolio_diagnostics enable row level security;

drop policy if exists "own imports" on portfolio_imports;
create policy "own imports" on portfolio_imports
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own diagnostics" on portfolio_diagnostics;
create policy "own diagnostics" on portfolio_diagnostics
  for select to authenticated using (
    exists (
      select 1 from portfolio_imports pi
      where pi.id = portfolio_diagnostics.import_id and pi.user_id = auth.uid()
    )
  );
