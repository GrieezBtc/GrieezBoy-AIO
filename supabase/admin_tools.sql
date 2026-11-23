-- GRIEEZBOY AIO — admin tools: find a user by email and send coins.
-- Run ONCE in Supabase (SQL Editor -> New query -> paste -> Run), after analytics.sql and coins.sql.
-- Safe to run again. Only emails listed in public.admins can use these.

create table if not exists public.coin_grants (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  admin_email text not null,
  user_id     uuid references auth.users (id) on delete set null,
  user_email  text,
  amount      int not null
);
alter table public.coin_grants enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
     where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.admin_search_users(p_query text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q text := trim(coalesce(p_query, ''));
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if length(q) < 2 then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(t) from (
      select id, email, coins, premium_until, created_at
        from public.profiles
       where email ilike '%' || replace(replace(q, '%', '\%'), '_', '\_') || '%'
       order by (lower(email) = lower(q)) desc, created_at desc
       limit 10
    ) t
  ), '[]'::jsonb);
end;
$$;

-- positive amount adds coins, negative removes (never below 0)
create or replace function public.admin_add_coins(p_user uuid, p_amount int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins int;
  v_email text;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 1000 then
    raise exception 'amount must be between -1000 and 1000 and not 0';
  end if;

  update public.profiles
     set coins = greatest(coins + p_amount, 0)
   where id = p_user
  returning coins, email into v_coins, v_email;

  if not found then raise exception 'user not found'; end if;

  insert into public.coin_grants (admin_email, user_id, user_email, amount)
  values (coalesce(auth.jwt() ->> 'email', ''), p_user, v_email, p_amount);

  return jsonb_build_object('coins', v_coins, 'email', v_email);
end;
$$;

create or replace function public.admin_recent_grants()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return coalesce((
    select jsonb_agg(t) from (
      select created_at, admin_email, user_email, amount
        from public.coin_grants
       order by created_at desc
       limit 10
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.admin_search_users(text) from public, anon;
revoke all on function public.admin_add_coins(uuid, int) from public, anon;
revoke all on function public.admin_recent_grants() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_search_users(text) to authenticated;
grant execute on function public.admin_add_coins(uuid, int) to authenticated;
grant execute on function public.admin_recent_grants() to authenticated;
