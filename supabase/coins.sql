-- GRIEEZBOY AIO — coins 🪙
-- Run ONCE in Supabase (SQL Editor -> New query -> paste -> Run) AFTER schema.sql.
-- Safe to run again.
--
-- Rules:
--   * every account holds a coin balance (new accounts start with 10)
--   * a download costs 1 coin and is only kept when the link resolves successfully
--     (the coin is taken first, and handed back if the lookup fails)
--   * premium users download without spending coins
--   * the old 7-day trial limit and 3-per-day limit are no longer used
-- To add coins to someone: Table Editor -> profiles -> edit their `coins` number.

alter table public.profiles
  add column if not exists coins int not null default 10
  constraint profiles_coins_nonneg check (coins >= 0);

create or replace function public.consume_download()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_today  date := (now() at time zone 'Africa/Lagos')::date;
  p        public.profiles%rowtype;
  v_coins  int;
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

  -- premium: no coins needed
  if p.premium_until is not null and p.premium_until > now() then
    insert into public.download_tickets (user_id, day, counted)
    values (v_uid, v_today, false) returning id into v_ticket;
    return jsonb_build_object(
      'allowed', true, 'reason', 'premium', 'ticket', v_ticket, 'coins', p.coins
    );
  end if;

  -- atomic: takes 1 coin only if there is one, even with parallel requests
  update public.profiles
     set coins = coins - 1
   where id = v_uid and coins > 0
  returning coins into v_coins;

  if v_coins is null then
    return jsonb_build_object('allowed', false, 'reason', 'no_coins', 'coins', 0);
  end if;

  insert into public.download_tickets (user_id, day, counted)
  values (v_uid, v_today, true) returning id into v_ticket;

  return jsonb_build_object(
    'allowed', true, 'reason', 'coin', 'ticket', v_ticket, 'coins', v_coins
  );
end;
$$;

-- gives the coin back once if the link could not be processed
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
    update public.profiles
       set coins = coins + 1
     where id = t.user_id;
  end if;
end;
$$;

revoke all on function public.consume_download() from public, anon;
revoke all on function public.refund_download(uuid) from public, anon;
grant execute on function public.consume_download() to authenticated;
grant execute on function public.refund_download(uuid) to authenticated;
