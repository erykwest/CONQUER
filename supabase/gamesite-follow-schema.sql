-- CONQUER GameSite newsletter + anonymous aggregate website metrics.
-- Migration to apply to the *site* Supabase environment before enabling subscriptions.
-- Never execute automatically from an unreviewed production deployment.
-- Emails are not auth.users and must not be inserted into player identity tables.
create table if not exists public.gamesite_followers (
  email text primary key,
  status text not null default 'pending' check (status in ('pending','confirmed','unsubscribed')),
  token_hash text unique,
  token_expires_at timestamptz,
  last_sent_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gamesite_followers_status_idx on public.gamesite_followers(status);
alter table public.gamesite_followers enable row level security;
revoke all on table public.gamesite_followers from anon, authenticated;
-- service_role bypasses RLS; public API handlers do not expose its key.
-- Backend enforces double opt-in before marking confirmed.

create table if not exists public.gamesite_daily_metrics (
  day date not null,
  metric text not null check (metric in ('home_view','game_view','play_view','play_click','follow_view','media_view','devlog_view')),
  count bigint not null default 0 check (count >= 0),
  primary key (day,metric)
);
alter table public.gamesite_daily_metrics enable row level security;
revoke all on table public.gamesite_daily_metrics from anon, authenticated;

-- This RPC accepts only a finite enum and stores aggregate counts with no visitor identifier.
-- Restrict EXECUTE: server-side service_role only.
create or replace function public.gamesite_record_metric(p_metric text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_metric not in ('home_view','game_view','play_view','play_click','follow_view','media_view','devlog_view') then
    raise exception 'invalid metric';
  end if;
  insert into public.gamesite_daily_metrics (day,metric,count)
  values ((now() at time zone 'UTC')::date,p_metric,1)
  on conflict (day,metric) do update
    set count=public.gamesite_daily_metrics.count+1;
end;
$$;
revoke all on function public.gamesite_record_metric(text) from public, anon, authenticated;
grant execute on function public.gamesite_record_metric(text) to service_role;


-- Abuse prevention: a server-side HMAC of the proxy source IP + 15-minute window.
-- No raw IP, cookie, account ID or user-agent is recorded in this table.
create table if not exists public.gamesite_follow_budget (
  bucket text primary key check (bucket ~ '^[0-9a-f]{64}$'),
  attempts integer not null check (attempts >= 0),
  expires_at timestamptz not null
);
create index if not exists gamesite_follow_budget_expiry_idx
  on public.gamesite_follow_budget(expires_at);
alter table public.gamesite_follow_budget enable row level security;
revoke all on table public.gamesite_follow_budget from anon, authenticated;

-- Atomic limit: at most five subscription requests per proxy source every 15 minutes.
-- This is a server-only RPC; it must never be granted to anon or authenticated clients.
create or replace function public.gamesite_consume_follow_budget(p_bucket text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare accepted integer;
begin
  if p_bucket !~ '^[0-9a-f]{64}$' then return false; end if;
  insert into public.gamesite_follow_budget as b (bucket,attempts,expires_at)
  values (p_bucket,1,now() + interval '15 minutes')
  on conflict (bucket) do update
    set attempts = case when b.expires_at <= now() then 1 else b.attempts + 1 end,
        expires_at = case when b.expires_at <= now() then now() + interval '15 minutes' else b.expires_at end
    where b.expires_at <= now() or b.attempts < 5
  returning attempts into accepted;
  return accepted is not null and accepted <= 5;
end;
$$;
revoke all on function public.gamesite_consume_follow_budget(text) from public, anon, authenticated;
grant execute on function public.gamesite_consume_follow_budget(text) to service_role;

-- Requires an explicit daily cleanup job when the mailing service goes live:
-- delete from public.gamesite_follow_budget where expires_at < now();
