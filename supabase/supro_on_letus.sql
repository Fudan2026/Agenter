-- =============================================================================
-- ARCHIVE — Supro-on-Letus (text user_id). DO NOT use for new deploys.
-- Current canonical SQL for Supro is: supabase/supro.sql
-- (new Supabase Organization + Project; no Letus user migration).
-- Kept only for historical reference on jrnabzfvdcmcoxyadmax.
-- =============================================================================

-- Fin Desk / 苏坡大模型 usage ledger (text user_id — matches Letus)
create table if not exists public.fin_desk_usage (
  id bigserial primary key,
  user_id text not null,
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
  using (user_id = public.uid_text());

revoke all on table public.fin_desk_usage from public, anon, authenticated;
grant select on table public.fin_desk_usage to authenticated;
grant all on table public.fin_desk_usage to service_role;
grant usage, select on sequence public.fin_desk_usage_id_seq to service_role;

-- Optional gold-only redeem codes (credits shared user_economy.gold)
create table if not exists public.gold_codes (
  code text primary key,
  gold integer not null check (gold > 0),
  used boolean not null default false,
  used_by text null,
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.gold_codes enable row level security;
revoke all on table public.gold_codes from public, anon, authenticated;
grant all on table public.gold_codes to service_role;

-- Admin detection: email allowlist and/or JWT app_metadata.role=admin
create or replace function public.is_supro_admin(p_user_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  uid text := nullif(trim(coalesce(p_user_id, '')), '');
  v_email text;
  v_role text;
begin
  if uid is null then
    return false;
  end if;

  select lower(u.email), coalesce(u.raw_app_meta_data ->> 'role', '')
    into v_email, v_role
  from auth.users u
  where u.id::text = uid;

  if v_role = 'admin' then
    return true;
  end if;
  if v_email = 'seanfudan@163.com' then
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public.is_supro_admin(text) from public, anon, authenticated;
grant execute on function public.is_supro_admin(text) to service_role;

-- Ensure wallet row; bootstrap admin to ≥100000 gold
create or replace function public.ensure_supro_economy(p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  eco public.user_economy;
  uid text := nullif(trim(coalesce(p_user_id, '')), '');
  admin_grant integer := 100000;
begin
  if uid is null then
    raise exception 'missing_user';
  end if;

  insert into public.user_economy (user_id) values (uid)
    on conflict (user_id) do nothing;

  if public.is_supro_admin(uid) then
    update public.user_economy
       set gold = greatest(gold, admin_grant),
           total_earned = greatest(total_earned, admin_grant),
           updated_at = now()
     where user_id = uid;
  end if;

  select * into eco from public.user_economy where user_id = uid;
  return to_jsonb(eco) || jsonb_build_object(
    'is_admin', public.is_supro_admin(uid),
    'min_gold_floor', 20,
    'gold_per_usd', 100
  );
end;
$$;

-- Atomic spend AFTER model usage. Admin: log tokens, spent=0.
-- Non-admin: require gold >= 20 before debit; then gold >= cost.
create or replace function public.spend_gold_for_usage(
  p_user_id text,
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
  uid text := nullif(trim(coalesce(p_user_id, '')), '');
  v_cost integer;
  v_gold integer;
  v_admin boolean;
  min_floor integer := 20;
begin
  if uid is null then
    raise exception 'missing_user';
  end if;

  perform public.ensure_supro_economy(uid);
  v_admin := public.is_supro_admin(uid);

  v_cost := coalesce(
    p_gold,
    greatest(1, ceil(greatest(coalesce(p_tokens, 0), 1)::numeric / 1000.0))::integer
  );

  if v_admin then
    select gold into v_gold from public.user_economy where user_id = uid;
    insert into public.fin_desk_usage (user_id, feature, tokens, gold)
    values (uid, coalesce(p_feature, 'fin_desk'), coalesce(p_tokens, 0), 0);
    return jsonb_build_object(
      'ok', true,
      'gold', v_gold,
      'spent', 0,
      'admin', true,
      'tokens', coalesce(p_tokens, 0)
    );
  end if;

  select gold into v_gold from public.user_economy where user_id = uid for update;
  if coalesce(v_gold, 0) < min_floor then
    raise exception 'insufficient_gold_floor';
  end if;
  if coalesce(v_gold, 0) < v_cost then
    raise exception 'insufficient_gold';
  end if;

  update public.user_economy
  set gold = gold - v_cost,
      updated_at = now()
  where user_id = uid
  returning gold into v_gold;

  insert into public.fin_desk_usage (user_id, feature, tokens, gold)
  values (uid, coalesce(p_feature, 'fin_desk'), coalesce(p_tokens, 0), v_cost);

  return jsonb_build_object(
    'ok', true,
    'gold', v_gold,
    'spent', v_cost,
    'admin', false,
    'tokens', coalesce(p_tokens, 0)
  );
end;
$$;

-- Preflight only (no debit): check floor / admin before calling LLM
create or replace function public.preflight_fin_desk(p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := nullif(trim(coalesce(p_user_id, '')), '');
  eco jsonb;
  v_gold integer;
  v_admin boolean;
  min_floor integer := 20;
begin
  if uid is null then
    raise exception 'missing_user';
  end if;
  eco := public.ensure_supro_economy(uid);
  v_gold := coalesce((eco ->> 'gold')::integer, 0);
  v_admin := public.is_supro_admin(uid);
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

-- Redeem additive gold_codes into shared wallet
create or replace function public.redeem_gold_code(
  p_user_id text,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := nullif(trim(coalesce(p_user_id, '')), '');
  v_row public.gold_codes;
  v_gold integer;
  granted integer;
begin
  if uid is null then
    raise exception 'missing_user';
  end if;

  perform public.ensure_supro_economy(uid);

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
      used_by = uid,
      used_at = now()
  where code = v_row.code;

  granted := v_row.gold;

  update public.user_economy
  set gold = gold + granted,
      total_earned = total_earned + granted,
      updated_at = now()
  where user_id = uid
  returning gold into v_gold;

  return jsonb_build_object(
    'ok', true,
    'gold', v_gold,
    'granted', granted
  );
end;
$$;

-- Recent usage for account / admin prototype
create or replace function public.list_fin_desk_usage(
  p_user_id text,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := nullif(trim(coalesce(p_user_id, '')), '');
  lim integer := least(greatest(coalesce(p_limit, 20), 1), 100);
begin
  if uid is null then
    raise exception 'missing_user';
  end if;
  return coalesce(
    (
      select jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc)
      from (
        select id, feature, tokens, gold, created_at
        from public.fin_desk_usage
        where user_id = uid
        order by created_at desc
        limit lim
      ) t
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.ensure_supro_economy(text) from public, anon, authenticated;
revoke all on function public.spend_gold_for_usage(text, integer, text, integer) from public, anon, authenticated;
revoke all on function public.redeem_gold_code(text, text) from public, anon, authenticated;
revoke all on function public.preflight_fin_desk(text) from public, anon, authenticated;
revoke all on function public.list_fin_desk_usage(text, integer) from public, anon, authenticated;

grant execute on function public.ensure_supro_economy(text) to service_role;
grant execute on function public.spend_gold_for_usage(text, integer, text, integer) to service_role;
grant execute on function public.redeem_gold_code(text, text) to service_role;
grant execute on function public.preflight_fin_desk(text) to service_role;
grant execute on function public.list_fin_desk_usage(text, integer) to service_role;

-- Seed demo codes (owner may rotate). Credits shared Letus gold.
insert into public.gold_codes (code, gold) values
  ('SUPRO100', 100),
  ('SUPRO500', 500),
  ('WELCOME50', 50)
on conflict (code) do nothing;

-- Bootstrap admin wallet if the Auth user already exists
do $$
declare
  admin_id text;
begin
  select u.id::text into admin_id
  from auth.users u
  where lower(u.email) = 'seanfudan@163.com'
  limit 1;
  if admin_id is not null then
    perform public.ensure_supro_economy(admin_id);
  end if;
end $$;
