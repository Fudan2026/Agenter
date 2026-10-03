-- =============================================================================
-- Supro — standalone Auth + gold + 苏坡大模型 metering
-- Apply in a NEW Supabase Organization / Project (NOT the Letus IELTS org).
--
-- Why a new org/project:
--   Email confirmation redirect_to must return to https://supro.si/#/login
--   Sharing the Letus org would send confirm links to the IELTS site.
--
-- DO NOT migrate Letus users. Fresh signup only.
-- DO NOT apply this on jrnabzfvdcmcoxyadmax (use archive supabase/supro_on_letus.sql).
-- DO NOT apply legacy supabase/economy.sql here without review.
--
-- Owner checklist:
--   1. Create new Supabase Organization + Project
--   2. Auth → Enable email confirmations (disable autoconfirm)
--   3. Auth → Site URL: https://supro.si
--   4. Auth → Redirect URLs: https://supro.si/** , https://www.supro.si/** , Pages preview
--   5. SQL Editor → paste this file → Run
--   6. Copy anon + service_role into Pages + GitHub Actions secrets
--   7. Register seanfudan@163.com → confirm email → ensure_* grants ≥100000 gold
--
-- Gold: GOLD_PER_USD = 100 (100 gold = $1). MIN_GOLD_FLOOR = 20.
-- Admin email: seanfudan@163.com → ≥100000 gold; spend no-ops cost.
-- =============================================================================

create extension if not exists "pgcrypto";

-- Profiles (nickname + avatar URL; user-owned)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null default '',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (user_id = auth.uid());

revoke all on table public.profiles from public, anon;
grant select, insert, update on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

-- Hard-gold wallet (uuid PK — matches new Auth project)
create table if not exists public.user_economy (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gold integer not null default 0 check (gold >= 0),
  total_earned integer not null default 0 check (total_earned >= 0),
  total_spent integer not null default 0 check (total_spent >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_economy enable row level security;

drop policy if exists "user_economy_select_own" on public.user_economy;
create policy "user_economy_select_own" on public.user_economy
  for select to authenticated
  using (user_id = auth.uid());

revoke all on table public.user_economy from public, anon;
grant select on table public.user_economy to authenticated;
grant all on table public.user_economy to service_role;

-- Fin Desk / 苏坡大模型 usage ledger
create table if not exists public.fin_desk_usage (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  tokens integer not null default 0,
  gold integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists fin_desk_usage_user_id_idx
  on public.fin_desk_usage (user_id);

alter table public.fin_desk_usage enable row level security;

drop policy if exists "fin_desk_usage_select_own" on public.fin_desk_usage;
create policy "fin_desk_usage_select_own" on public.fin_desk_usage
  for select to authenticated
  using (user_id = auth.uid());

revoke all on table public.fin_desk_usage from public, anon, authenticated;
grant select on table public.fin_desk_usage to authenticated;
grant all on table public.fin_desk_usage to service_role;
grant usage, select on sequence public.fin_desk_usage_id_seq to service_role;

-- Optional gold redeem codes
create table if not exists public.gold_codes (
  code text primary key,
  gold integer not null check (gold > 0),
  used boolean not null default false,
  used_by uuid null references auth.users (id),
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.gold_codes enable row level security;
revoke all on table public.gold_codes from public, anon, authenticated;
grant all on table public.gold_codes to service_role;

-- Admin: email allowlist and/or JWT app_metadata.role=admin
create or replace function public.is_supro_admin(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_role text;
begin
  if p_user_id is null then
    return false;
  end if;

  select lower(u.email), coalesce(u.raw_app_meta_data ->> 'role', '')
    into v_email, v_role
  from auth.users u
  where u.id = p_user_id;

  if v_role = 'admin' then
    return true;
  end if;
  if v_email = 'seanfudan@163.com' then
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public.is_supro_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_supro_admin(uuid) to service_role;

-- Profile upsert (nickname + avatar URL)
create or replace function public.upsert_my_profile(
  p_nickname text default null,
  p_avatar_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  nick text;
  avatar text;
  row public.profiles;
begin
  if uid is null then
    raise exception 'missing_user';
  end if;

  nick := left(trim(coalesce(p_nickname, '')), 64);
  avatar := left(trim(coalesce(p_avatar_url, '')), 500);

  insert into public.profiles (user_id, nickname, avatar_url)
  values (uid, nick, avatar)
  on conflict (user_id) do update
    set nickname = case when p_nickname is null then public.profiles.nickname else excluded.nickname end,
        avatar_url = case when p_avatar_url is null then public.profiles.avatar_url else excluded.avatar_url end,
        updated_at = now()
  returning * into row;

  return to_jsonb(row);
end;
$$;

revoke all on function public.upsert_my_profile(text, text) from public, anon;
grant execute on function public.upsert_my_profile(text, text) to authenticated, service_role;

-- Ensure wallet + profile; bootstrap admin to ≥100000 gold
create or replace function public.ensure_supro_economy(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  eco public.user_economy;
  admin_grant integer := 100000;
begin
  if p_user_id is null then
    raise exception 'missing_user';
  end if;

  insert into public.user_economy (user_id) values (p_user_id)
    on conflict (user_id) do nothing;

  insert into public.profiles (user_id) values (p_user_id)
    on conflict (user_id) do nothing;

  if public.is_supro_admin(p_user_id) then
    update public.user_economy
       set gold = greatest(gold, admin_grant),
           total_earned = greatest(total_earned, admin_grant),
           updated_at = now()
     where user_id = p_user_id;
  end if;

  select * into eco from public.user_economy where user_id = p_user_id;
  return to_jsonb(eco) || jsonb_build_object(
    'is_admin', public.is_supro_admin(p_user_id),
    'min_gold_floor', 20,
    'gold_per_usd', 100
  );
end;
$$;

-- Alias used by some clients
create or replace function public.ensure_my_economy()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.ensure_supro_economy(auth.uid());
end;
$$;

-- Atomic spend AFTER model usage. Admin: log tokens, spent=0.
create or replace function public.spend_gold_for_usage(
  p_user_id uuid,
  p_tokens integer,
  p_feature text,
  p_gold integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost integer;
  v_gold integer;
  v_admin boolean;
  min_floor integer := 20;
begin
  if p_user_id is null then
    raise exception 'missing_user';
  end if;

  perform public.ensure_supro_economy(p_user_id);
  v_admin := public.is_supro_admin(p_user_id);

  v_cost := coalesce(
    p_gold,
    greatest(1, ceil(greatest(coalesce(p_tokens, 0), 1)::numeric / 1000.0))::integer
  );

  if v_admin then
    select gold into v_gold from public.user_economy where user_id = p_user_id;
    insert into public.fin_desk_usage (user_id, feature, tokens, gold)
    values (p_user_id, coalesce(p_feature, 'fin_desk'), coalesce(p_tokens, 0), 0);
    return jsonb_build_object(
      'ok', true,
      'gold', v_gold,
      'spent', 0,
      'admin', true,
      'tokens', coalesce(p_tokens, 0)
    );
  end if;

  select gold into v_gold from public.user_economy where user_id = p_user_id for update;
  if coalesce(v_gold, 0) < min_floor then
    raise exception 'insufficient_gold_floor';
  end if;
  if coalesce(v_gold, 0) < v_cost then
    raise exception 'insufficient_gold';
  end if;

  update public.user_economy
  set gold = gold - v_cost,
      total_spent = total_spent + v_cost,
      updated_at = now()
  where user_id = p_user_id
  returning gold into v_gold;

  insert into public.fin_desk_usage (user_id, feature, tokens, gold)
  values (p_user_id, coalesce(p_feature, 'fin_desk'), coalesce(p_tokens, 0), v_cost);

  return jsonb_build_object(
    'ok', true,
    'gold', v_gold,
    'spent', v_cost,
    'admin', false,
    'tokens', coalesce(p_tokens, 0)
  );
end;
$$;

create or replace function public.preflight_fin_desk(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  eco jsonb;
  v_gold integer;
  v_admin boolean;
  min_floor integer := 20;
begin
  if p_user_id is null then
    raise exception 'missing_user';
  end if;
  eco := public.ensure_supro_economy(p_user_id);
  v_gold := coalesce((eco ->> 'gold')::integer, 0);
  v_admin := public.is_supro_admin(p_user_id);
  if (not v_admin) and v_gold < min_floor then
    return jsonb_build_object(
      'ok', false,
      'code', 'insufficient_gold_floor',
      'gold', v_gold,
      'min_gold_floor', min_floor,
      'is_admin', false
    );
  end if;
  return jsonb_build_object(
    'ok', true,
    'gold', v_gold,
    'min_gold_floor', min_floor,
    'is_admin', v_admin,
    'gold_per_usd', 100
  );
end;
$$;

create or replace function public.redeem_gold_code(
  p_user_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.gold_codes;
  v_gold integer;
  granted integer;
begin
  if p_user_id is null then
    raise exception 'missing_user';
  end if;

  perform public.ensure_supro_economy(p_user_id);

  select * into v_row
  from public.gold_codes
  where code = upper(trim(p_code))
  for update;

  if v_row.code is null then
    raise exception 'invalid_code';
  end if;
  if v_row.used then
    raise exception 'code_used';
  end if;

  update public.gold_codes
  set used = true,
      used_by = p_user_id,
      used_at = now()
  where code = v_row.code;

  granted := v_row.gold;

  update public.user_economy
  set gold = gold + granted,
      total_earned = total_earned + granted,
      updated_at = now()
  where user_id = p_user_id
  returning gold into v_gold;

  return jsonb_build_object(
    'ok', true,
    'gold', v_gold,
    'granted', granted
  );
end;
$$;

create or replace function public.list_fin_desk_usage(
  p_user_id uuid,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lim integer := least(greatest(coalesce(p_limit, 20), 1), 100);
begin
  if p_user_id is null then
    raise exception 'missing_user';
  end if;
  return coalesce(
    (
      select jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc)
      from (
        select id, feature, tokens, gold, created_at
        from public.fin_desk_usage
        where user_id = p_user_id
        order by created_at desc
        limit lim
      ) t
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.get_my_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.profiles;
begin
  if uid is null then
    raise exception 'missing_user';
  end if;
  perform public.ensure_supro_economy(uid);
  select * into row from public.profiles where user_id = uid;
  return to_jsonb(row);
end;
$$;

revoke all on function public.ensure_supro_economy(uuid) from public, anon, authenticated;
revoke all on function public.ensure_my_economy() from public, anon;
revoke all on function public.spend_gold_for_usage(uuid, integer, text, integer) from public, anon, authenticated;
revoke all on function public.redeem_gold_code(uuid, text) from public, anon, authenticated;
revoke all on function public.preflight_fin_desk(uuid) from public, anon, authenticated;
revoke all on function public.list_fin_desk_usage(uuid, integer) from public, anon, authenticated;
revoke all on function public.get_my_profile() from public, anon;

grant execute on function public.ensure_supro_economy(uuid) to service_role;
grant execute on function public.ensure_my_economy() to authenticated, service_role;
grant execute on function public.spend_gold_for_usage(uuid, integer, text, integer) to service_role;
grant execute on function public.redeem_gold_code(uuid, text) to service_role;
grant execute on function public.preflight_fin_desk(uuid) to service_role;
grant execute on function public.list_fin_desk_usage(uuid, integer) to service_role;
grant execute on function public.get_my_profile() to authenticated, service_role;

insert into public.gold_codes (code, gold) values
  ('SUPRO100', 100),
  ('SUPRO500', 500),
  ('WELCOME50', 50)
on conflict (code) do nothing;

-- Bootstrap admin wallet if Auth user already exists
do $$
declare
  admin_id uuid;
begin
  select u.id into admin_id
  from auth.users u
  where lower(u.email) = 'seanfudan@163.com'
  limit 1;
  if admin_id is not null then
    perform public.ensure_supro_economy(admin_id);
  end if;
end $$;
