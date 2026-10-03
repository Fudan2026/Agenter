-- Agenter economy schema (hard gold only).
-- Apply in Supabase SQL editor with service role. Idempotent-ish.

create table if not exists public.user_economy (
  user_id uuid primary key,
  gold integer not null default 0 check (gold >= 0),
  total_earned integer not null default 0 check (total_earned >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gold_codes (
  code text primary key,
  gold integer not null check (gold > 0),
  used boolean not null default false,
  used_by uuid null,
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.economy_usage (
  id bigserial primary key,
  user_id uuid not null,
  feature text not null,
  tokens integer not null default 0,
  gold integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.user_economy enable row level security;
alter table public.gold_codes enable row level security;
alter table public.economy_usage enable row level security;

drop policy if exists "user_economy_select_own" on public.user_economy;
create policy "user_economy_select_own" on public.user_economy
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "economy_usage_select_own" on public.economy_usage;
create policy "economy_usage_select_own" on public.economy_usage
  for select to authenticated
  using (auth.uid() = user_id);

revoke all on table public.user_economy from public, anon, authenticated;
revoke all on table public.gold_codes from public, anon, authenticated;
revoke all on table public.economy_usage from public, anon, authenticated;

grant select on table public.user_economy to authenticated;
grant select on table public.economy_usage to authenticated;
grant all on table public.user_economy to service_role;
grant all on table public.gold_codes to service_role;
grant all on table public.economy_usage to service_role;
grant usage, select on sequence public.economy_usage_id_seq to service_role;

create or replace function public.ensure_user_economy(p_user_id uuid)
returns public.user_economy
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_economy;
  welcome integer := 100;
begin
  insert into public.user_economy (user_id, gold, total_earned)
  values (p_user_id, welcome, welcome)
  on conflict (user_id) do nothing;

  select * into v_row from public.user_economy where user_id = p_user_id;
  return v_row;
end;
$$;

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
begin
  perform public.ensure_user_economy(p_user_id);
  v_cost := coalesce(
    p_gold,
    greatest(1, ceil(greatest(coalesce(p_tokens, 0), 1)::numeric / 1000.0))::integer
  );

  update public.user_economy
  set gold = gold - v_cost,
      updated_at = now()
  where user_id = p_user_id
    and gold >= v_cost
  returning gold into v_gold;

  if v_gold is null then
    raise exception 'insufficient_gold';
  end if;

  insert into public.economy_usage (user_id, feature, tokens, gold)
  values (p_user_id, coalesce(p_feature, 'fin_desk'), coalesce(p_tokens, 0), v_cost);

  return jsonb_build_object(
    'ok', true,
    'gold', v_gold,
    'spent', v_cost
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
begin
  perform public.ensure_user_economy(p_user_id);

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

  update public.user_economy
  set gold = gold + v_row.gold,
      total_earned = total_earned + v_row.gold,
      updated_at = now()
  where user_id = p_user_id
  returning gold into v_gold;

  return jsonb_build_object(
    'ok', true,
    'gold', v_gold,
    'granted', v_row.gold
  );
end;
$$;

grant execute on function public.ensure_user_economy(uuid) to service_role;
grant execute on function public.spend_gold_for_usage(uuid, integer, text, integer) to service_role;
grant execute on function public.redeem_gold_code(uuid, text) to service_role;

-- Seed demo codes (owner may rotate)
insert into public.gold_codes (code, gold) values
  ('AGENTER100', 100),
  ('AGENTER500', 500),
  ('WELCOME50', 50)
on conflict (code) do nothing;
