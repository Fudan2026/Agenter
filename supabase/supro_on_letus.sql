-- =============================================================================
-- Supro on Letus — additive Fin Desk gold metering
-- Apply in the SHARED Letus Supabase project (jrnabzfvdcmcoxyadmax).
--
-- DO NOT apply supabase/economy.sql here (uuid PK + RPC clash with Letus).
--
-- Prerequisites: Letus P0 schema already live:
--   user_economy (user_id text, gold, total_earned, …)
--   ensure_my_economy(), redeem_vip_code(), uid_text()
--
-- Shared hard gold + USD peg: GOLD_PER_USD = 100 (documented in app; 100 gold = $1).
-- Soft Soft / Soft Softlet remain Letus-only.
-- =============================================================================

-- Fin Desk usage ledger (text user_id — matches Letus)
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

-- Ensure wallet row exists (service_role path; no separate welcome steal).
-- Mirrors Letus insert-on-conflict; admin bootstrap stays in ensure_my_economy.
create or replace function public.ensure_supro_economy(p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  eco public.user_economy;
  uid text := nullif(trim(coalesce(p_user_id, '')), '');
begin
  if uid is null then
    raise exception 'missing_user';
  end if;

  insert into public.user_economy (user_id) values (uid)
    on conflict (user_id) do nothing;

  select * into eco from public.user_economy where user_id = uid;
  return to_jsonb(eco);
end;
$$;

-- Atomic server spend against shared Letus gold (Fin Desk)
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
begin
  if uid is null then
    raise exception 'missing_user';
  end if;

  perform public.ensure_supro_economy(uid);

  v_cost := coalesce(
    p_gold,
    greatest(1, ceil(greatest(coalesce(p_tokens, 0), 1)::numeric / 1000.0))::integer
  );

  update public.user_economy
  set gold = gold - v_cost,
      updated_at = now()
  where user_id = uid
    and gold >= v_cost
  returning gold into v_gold;

  if v_gold is null then
    raise exception 'insufficient_gold';
  end if;

  insert into public.fin_desk_usage (user_id, feature, tokens, gold)
  values (uid, coalesce(p_feature, 'fin_desk'), coalesce(p_tokens, 0), v_cost);

  return jsonb_build_object(
    'ok', true,
    'gold', v_gold,
    'spent', v_cost
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

revoke all on function public.ensure_supro_economy(text) from public, anon, authenticated;
revoke all on function public.spend_gold_for_usage(text, integer, text, integer) from public, anon, authenticated;
revoke all on function public.redeem_gold_code(text, text) from public, anon, authenticated;

grant execute on function public.ensure_supro_economy(text) to service_role;
grant execute on function public.spend_gold_for_usage(text, integer, text, integer) to service_role;
grant execute on function public.redeem_gold_code(text, text) to service_role;

-- Seed demo codes (owner may rotate). Credits shared Letus gold.
insert into public.gold_codes (code, gold) values
  ('SUPRO100', 100),
  ('SUPRO500', 500),
  ('WELCOME50', 50)
on conflict (code) do nothing;
