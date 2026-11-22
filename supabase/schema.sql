-- GRIEEZBOY AIO — accounts, free trial and daily download limit.
-- Run this ONCE in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- It is safe to run again (everything is "if not exists" / "create or replace").

-- ---------------------------------------------------------------- tables

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  created_at    timestamptz not null default now(),
  -- one week of access from the moment the account is created
  trial_ends_at timestamptz not null default (now() + interval '7 days'),
  -- set this (Table Editor) to give someone premium until that date
  premium_until timestamptz
);

create table if not exists public.usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  count   int  not null default 0,
  primary key (user_id, day)
);

-- one row per counted download so a failed lookup can be refunded exactly once
create table if not exists public.download_tickets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  counted    boolean not null,
  refunded   boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- security
-- Browsers may only READ their own rows. Nobody can write directly:
-- all changes go through the functions below.

alter table public.profiles         enable row level security;
alter table public.usage            enable row level security;
alter table public.download_tickets enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "read own usage" on public.usage;
create policy "read own usage" on public.usage
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------- new users

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- accounts that already exist get a profile (and a fresh 7-day trial)
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------- counting
-- Day boundaries follow Nigerian time. The limit (3) is fixed in here on purpose
-- so a browser cannot ask for a bigger one.

create or replace function public.consume_download()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit constant int := 3;
  v_uid   uuid := auth.uid();
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  p       public.profiles%rowtype;
  v_used  int;
  v_ticket uuid;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'auth_required');
  end if;

  delete from public.download_tickets
   where user_id = v_uid and created_at < now() - interval '2 days';

  select * into p from public.profiles where id = v_uid;
  if not found then
    insert into public.profiles (id, email)
    select id, email from auth.users where id = v_uid
    returning * into p;
  end if;

  -- premium: unlimited, nothing to count
  if p.premium_until is not null and p.premium_until > now() then
    insert into public.download_tickets (user_id, day, counted)
    values (v_uid, v_today, false) returning id into v_ticket;
    return jsonb_build_object(
      'allowed', true, 'reason', 'premium', 'ticket', v_ticket,
      'premium_until', p.premium_until
    );
  end if;

  -- trial over
  if now() >= p.trial_ends_at then
    return jsonb_build_object(
      'allowed', false, 'reason', 'trial_expired',
      'trial_ends_at', p.trial_ends_at
    );
  end if;

  insert into public.usage (user_id, day, count)
  values (v_uid, v_today, 0)
  on conflict (user_id, day) do nothing;

  -- atomic: only counts while below the limit, even with parallel requests
  update public.usage
     set count = count + 1
   where user_id = v_uid and day = v_today and count < v_limit
  returning count into v_used;

  if v_used is null then
    return jsonb_build_object(
      'allowed', false, 'reason', 'daily_limit',
      'used', v_limit, 'limit', v_limit,
      'trial_ends_at', p.trial_ends_at
    );
  end if;

  insert into public.download_tickets (user_id, day, counted)
  values (v_uid, v_today, true) returning id into v_ticket;

  return jsonb_build_object(
    'allowed', true, 'reason', 'trial', 'ticket', v_ticket,
    'used', v_used, 'limit', v_limit,
    'trial_ends_at', p.trial_ends_at
  );
end;
$$;

-- gives the count back once, when the link could not be processed
create or replace function public.refund_download(p_ticket uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.download_tickets%rowtype;
begin
  update public.download_tickets
     set refunded = true
   where id = p_ticket and user_id = auth.uid() and refunded = false
  returning * into t;

  if found and t.counted then
    update public.usage
       set count = greatest(count - 1, 0)
     where user_id = t.user_id and day = t.day;
  end if;
end;
$$;

revoke all on function public.consume_download() from public, anon;
revoke all on function public.refund_download(uuid) from public, anon;
grant execute on function public.consume_download() to authenticated;
grant execute on function public.refund_download(uuid) to authenticated;
