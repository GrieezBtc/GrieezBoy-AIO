-- GRIEEZBOY AIO — first-party analytics.
-- Run ONCE in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.

create table if not exists public.site_events (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  type       text not null,          -- pageview | download | download_failed | blocked
  path       text,
  visitor_id text,                   -- random anonymous id kept in the visitor's browser
  country    text,
  device     text,                   -- mobile | tablet | desktop
  referrer   text,                   -- host only, e.g. google.com
  user_id    uuid references auth.users (id) on delete set null,
  meta       jsonb
);

create index if not exists site_events_created_idx on public.site_events (created_at desc);
create index if not exists site_events_type_idx    on public.site_events (type, created_at desc);

-- who may open /admin
create table if not exists public.admins (
  email text primary key
);

-- nobody can read or write these directly from a browser
alter table public.site_events enable row level security;
alter table public.admins      enable row level security;

-- ---------------------------------------------------------------- writing

create or replace function public.log_event(
  p_type     text,
  p_path     text default null,
  p_visitor  text default null,
  p_country  text default null,
  p_device   text default null,
  p_referrer text default null,
  p_meta     jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_type not in ('pageview', 'download', 'download_failed', 'blocked') then
    return;
  end if;
  if p_meta is not null and length(p_meta::text) > 400 then
    p_meta := null;
  end if;

  insert into public.site_events
    (type, path, visitor_id, country, device, referrer, user_id, meta)
  values
    (p_type, left(p_path, 200), left(p_visitor, 64), left(p_country, 2),
     left(p_device, 16), left(p_referrer, 100), auth.uid(), p_meta);
end;
$$;

revoke all on function public.log_event(text, text, text, text, text, text, jsonb) from public;
grant execute on function public.log_event(text, text, text, text, text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------- reading
-- Only emails listed in public.admins can call this.

create or replace function public.admin_stats(p_days int default 7)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90)));
begin
  if not exists (
    select 1 from public.admins
     where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  ) then
    raise exception 'not allowed';
  end if;

  return jsonb_build_object(
    'since', v_since,
    'visits',   (select count(*) from public.site_events where type = 'pageview' and created_at >= v_since),
    'visitors', (select count(distinct visitor_id) from public.site_events where type = 'pageview' and created_at >= v_since),
    'downloads', (select count(*) from public.site_events where type = 'download' and created_at >= v_since),
    'failed',    (select count(*) from public.site_events where type = 'download_failed' and created_at >= v_since),
    'blocked',   (select count(*) from public.site_events where type = 'blocked' and created_at >= v_since),
    'signups',        (select count(*) from public.profiles where created_at >= v_since),
    'total_users',    (select count(*) from public.profiles),
    'premium_active', (select count(*) from public.profiles where premium_until > now()),

    'daily', (
      select coalesce(jsonb_agg(d order by d.day), '[]'::jsonb) from (
        select (created_at at time zone 'Africa/Lagos')::date as day,
               count(*) filter (where type = 'pageview') as visits,
               count(distinct visitor_id) filter (where type = 'pageview') as visitors,
               count(*) filter (where type = 'download') as downloads
          from public.site_events
         where created_at >= v_since
         group by 1
      ) d
    ),
    'top_pages', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select path as label, count(*) as n from public.site_events
         where type = 'pageview' and created_at >= v_since and path is not null
         group by path order by n desc limit 8) t
    ),
    'countries', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select country as label, count(distinct visitor_id) as n from public.site_events
         where type = 'pageview' and created_at >= v_since and country is not null
         group by country order by n desc limit 8) t
    ),
    'devices', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select device as label, count(distinct visitor_id) as n from public.site_events
         where type = 'pageview' and created_at >= v_since and device is not null
         group by device order by n desc) t
    ),
    'referrers', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select referrer as label, count(*) as n from public.site_events
         where type = 'pageview' and created_at >= v_since and referrer is not null
         group by referrer order by n desc limit 8) t
    ),
    'platforms', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select meta ->> 'platform' as label, count(*) as n from public.site_events
         where type = 'download' and created_at >= v_since and meta ->> 'platform' is not null
         group by 1 order by n desc) t
    ),
    'blocked_reasons', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select meta ->> 'code' as label, count(*) as n from public.site_events
         where type = 'blocked' and created_at >= v_since and meta ->> 'code' is not null
         group by 1 order by n desc) t
    )
  );
end;
$$;

revoke all on function public.admin_stats(int) from public, anon;
grant execute on function public.admin_stats(int) to authenticated;

-- ---------------------------------------------------------------- YOU
-- After running everything above, make yourself an admin (use the email you sign in with):
--   insert into public.admins (email) values ('your-email@example.com');
