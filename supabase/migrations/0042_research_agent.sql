-- Research Agent: chat threads + messages + auditable actions.
-- Additive only. Does not touch existing tables (watchlist, alerts, portfolio_imports, etc.).

create table if not exists public.agent_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled research',
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_threads_user_idx
  on public.agent_threads(user_id, updated_at desc);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.agent_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool','system')),
  content text,
  tool_name text,
  tool_args jsonb,
  tool_result jsonb,
  tool_status text check (tool_status in ('ok','error','skipped') or tool_status is null),
  reasoning text,
  created_at timestamptz not null default now()
);
create index if not exists agent_messages_thread_idx
  on public.agent_messages(thread_id, created_at);

create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.agent_threads(id) on delete cascade,
  message_id uuid references public.agent_messages(id) on delete set null,
  kind text not null check (kind in (
    'watchlist_add','watchlist_remove',
    'alert_create','alert_delete',
    'doctor_run','brief_generate'
  )),
  args jsonb not null,
  status text not null check (status in (
    'proposed','auto_executed','confirmed','declined','undone','failed'
  )),
  target_id uuid,
  executed_at timestamptz,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists agent_actions_thread_idx
  on public.agent_actions(thread_id, created_at desc);

alter table public.agent_threads   enable row level security;
alter table public.agent_messages  enable row level security;
alter table public.agent_actions   enable row level security;

drop policy if exists "agent_threads_own"    on public.agent_threads;
drop policy if exists "agent_messages_own"   on public.agent_messages;
drop policy if exists "agent_actions_own"    on public.agent_actions;

create policy "agent_threads_own" on public.agent_threads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "agent_messages_own" on public.agent_messages for select using (
  exists (select 1 from public.agent_threads t
          where t.id = thread_id and t.user_id = auth.uid())
);

create policy "agent_actions_own" on public.agent_actions for select using (
  exists (select 1 from public.agent_threads t
          where t.id = thread_id and t.user_id = auth.uid())
);
-- Message + action writes go through the service role in the streaming route.
