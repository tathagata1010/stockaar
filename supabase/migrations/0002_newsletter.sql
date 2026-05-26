-- Newsletter subscribers — anyone can sign up (no auth required).
-- Sends are driven by service-role cron; no user-facing RLS reads needed.

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  source text default 'landing',
  status text not null default 'active' check (status in ('active','unsubscribed','bounced')),
  unsubscribe_token text not null default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  last_sent_at timestamptz
);

create index if not exists newsletter_status_idx on public.newsletter_subscribers(status);
create unique index if not exists newsletter_email_lower_idx on public.newsletter_subscribers(lower(email));

alter table public.newsletter_subscribers enable row level security;

-- Public can INSERT (signup); only the row owner via token can update unsubscribe.
-- Service role bypasses RLS — used by the daily cron.
create policy "newsletter_insert_public"
  on public.newsletter_subscribers for insert
  with check (true);

-- No public SELECT — service role only.
