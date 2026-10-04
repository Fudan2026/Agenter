-- =============================================================================
-- PATCH — run on the NEW Supro project if you already applied supabase/supro.sql
-- Adds authenticated (JWT) wrappers so /api/economy-balance and /api/fin-desk
-- work even when SUPABASE_SERVICE_ROLE_KEY is missing/mis-set.
-- Safe to re-run.
-- =============================================================================

-- Balance path (already in full supro.sql; re-assert grants for older applies)
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

revoke all on function public.ensure_my_economy() from public, anon;
grant execute on function public.ensure_my_economy() to authenticated, service_role;

create or replace function public.preflight_my_fin_desk()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.preflight_fin_desk(auth.uid());
end;
$$;

create or replace function public.spend_my_gold_for_usage(
  p_tokens integer,
  p_feature text,
  p_gold integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.spend_gold_for_usage(auth.uid(), p_tokens, p_feature, p_gold);
end;
$$;

create or replace function public.list_my_fin_desk_usage(
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.list_fin_desk_usage(auth.uid(), p_limit);
end;
$$;

create or replace function public.redeem_my_gold_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.redeem_gold_code(auth.uid(), p_code);
end;
$$;

revoke all on function public.preflight_my_fin_desk() from public, anon;
revoke all on function public.spend_my_gold_for_usage(integer, text, integer) from public, anon;
revoke all on function public.list_my_fin_desk_usage(integer) from public, anon;
revoke all on function public.redeem_my_gold_code(text) from public, anon;

grant execute on function public.preflight_my_fin_desk() to authenticated, service_role;
grant execute on function public.spend_my_gold_for_usage(integer, text, integer) to authenticated, service_role;
grant execute on function public.list_my_fin_desk_usage(integer) to authenticated, service_role;
grant execute on function public.redeem_my_gold_code(text) to authenticated, service_role;

-- Re-bootstrap admin wallet if present
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
