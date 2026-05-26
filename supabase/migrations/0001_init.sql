-- Stocksbrew India: initial schema
-- Run in Supabase SQL editor or via supabase CLI migration.

-- ============ profiles ============
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro_monthly','pro_annual')),
  razorpay_customer_id text,
  razorpay_subscription_id text,
  subscription_status text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============ watchlist_items ============
create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  exchange text not null default 'NSE' check (exchange in ('NSE','BSE')),
  added_at timestamptz not null default now(),
  unique (user_id, symbol, exchange)
);
create index if not exists watchlist_items_user_idx on public.watchlist_items(user_id);

-- ============ alerts ============
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  exchange text not null default 'NSE' check (exchange in ('NSE','BSE')),
  condition text not null check (condition in ('above','below')),
  target_price numeric(12,2) not null,
  status text not null default 'active' check (status in ('active','triggered','cancelled')),
  created_at timestamptz not null default now(),
  triggered_at timestamptz
);
create index if not exists alerts_active_idx on public.alerts(status) where status = 'active';
create index if not exists alerts_user_idx on public.alerts(user_id);

-- ============ alert_history ============
create table if not exists public.alert_history (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  triggered_at timestamptz not null default now(),
  price_at_trigger numeric(12,2) not null
);

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_history enable row level security;

-- profiles: user reads/updates own
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id);

-- watchlist_items: user CRUDs own
create policy "watchlist_select_own" on public.watchlist_items for select using (auth.uid() = user_id);
create policy "watchlist_insert_own" on public.watchlist_items for insert with check (auth.uid() = user_id);
create policy "watchlist_delete_own" on public.watchlist_items for delete using (auth.uid() = user_id);

-- alerts: user CRUDs own
create policy "alerts_select_own" on public.alerts for select using (auth.uid() = user_id);
create policy "alerts_insert_own" on public.alerts for insert with check (auth.uid() = user_id);
create policy "alerts_update_own" on public.alerts for update using (auth.uid() = user_id);
create policy "alerts_delete_own" on public.alerts for delete using (auth.uid() = user_id);

-- alert_history: user reads own (joined via alerts)
create policy "alert_history_select_own" on public.alert_history for select using (
  exists (select 1 from public.alerts a where a.id = alert_id and a.user_id = auth.uid())
);
