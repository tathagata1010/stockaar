-- Smart Alerts: extend alerts with multi-trigger JSONB + notification log.
-- Migration is idempotent and preserves existing price-only rows.

alter table public.alerts
  add column if not exists triggers jsonb not null default '{}'::jsonb,
  add column if not exists last_notified_at timestamptz,
  add column if not exists label text;

-- Backfill: turn legacy {condition, target_price} into triggers.price shape.
update public.alerts
   set triggers = jsonb_build_object(
     'price', jsonb_build_object('condition', condition, 'target', target_price)
   )
 where triggers = '{}'::jsonb and target_price is not null;

-- Collapse status enum: 'triggered' is no longer a terminal state — Smart Alerts persist.
-- Existing 'triggered' rows are paused so the user can reactivate them from the UI.
update public.alerts set status = 'paused' where status = 'triggered';
update public.alerts set status = 'paused' where status = 'cancelled';

alter table public.alerts drop constraint if exists alerts_status_check;
alter table public.alerts
  add constraint alerts_status_check check (status in ('active','paused'));

-- target_price is now optional (an alert may be news/move/volume-only with no price target).
alter table public.alerts alter column target_price drop not null;
alter table public.alerts alter column condition drop not null;

-- ============ alert_notifications ============
create table if not exists public.alert_notifications (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  kind text not null check (kind in ('price','move','volume','news')),
  payload jsonb not null,
  brief text,
  news_url_hash text,
  suppressed boolean not null default false,
  sent_at timestamptz not null default now()
);

create index if not exists alert_notifications_alert_idx
  on public.alert_notifications(alert_id, sent_at desc);

-- Dedup: same alert + same news URL never sent twice.
create unique index if not exists alert_notifications_news_dedup
  on public.alert_notifications(alert_id, news_url_hash)
  where news_url_hash is not null;

alter table public.alert_notifications enable row level security;

create policy "alert_notifications_select_own"
  on public.alert_notifications for select
  using (
    exists (select 1 from public.alerts a where a.id = alert_id and a.user_id = auth.uid())
  );
-- Inserts via service role (cron) only — no insert policy.
