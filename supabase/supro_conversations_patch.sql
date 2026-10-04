-- =============================================================================
-- PATCH — Fin Desk multi-turn conversations (run on Supro project after supro.sql)
-- Safe to re-run.
-- Caps: 20 conversations/user; store last 200 messages/conversation;
-- model context trimmed to 30 messages in the Function layer.
-- =============================================================================

create table if not exists public.fin_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  mode text not null default 'multifactor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fin_conversations_user_updated_idx
  on public.fin_conversations (user_id, updated_at desc);

alter table public.fin_conversations enable row level security;

drop policy if exists "fin_conversations_select_own" on public.fin_conversations;
create policy "fin_conversations_select_own" on public.fin_conversations
  for select to authenticated
  using (user_id = auth.uid());

revoke all on table public.fin_conversations from public, anon, authenticated;
grant select on table public.fin_conversations to authenticated;
grant all on table public.fin_conversations to service_role;

create table if not exists public.fin_messages (
  id bigserial primary key,
  conversation_id uuid not null references public.fin_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null default '',
  structured jsonb null,
  tokens integer not null default 0,
  gold integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists fin_messages_conversation_id_idx
  on public.fin_messages (conversation_id, id);

alter table public.fin_messages enable row level security;

drop policy if exists "fin_messages_select_own" on public.fin_messages;
create policy "fin_messages_select_own" on public.fin_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.fin_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

revoke all on table public.fin_messages from public, anon, authenticated;
grant select on table public.fin_messages to authenticated;
grant all on table public.fin_messages to service_role;
grant usage, select on sequence public.fin_messages_id_seq to service_role;

create or replace function public.list_my_fin_conversations(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'missing_user';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.updated_at desc)
    from (
      select id, title, mode, created_at, updated_at
      from public.fin_conversations
      where user_id = uid
      order by updated_at desc
      limit greatest(1, least(coalesce(p_limit, 20), 20))
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_my_fin_conversation(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  conv public.fin_conversations;
  msgs jsonb;
begin
  if uid is null then
    raise exception 'missing_user';
  end if;
  select * into conv from public.fin_conversations
   where id = p_id and user_id = uid;
  if conv.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  select coalesce(jsonb_agg(row_to_json(m)::jsonb order by m.id), '[]'::jsonb)
    into msgs
  from (
    select id, role, content, structured, tokens, gold, created_at
    from public.fin_messages
    where conversation_id = p_id
    order by id desc
    limit 200
  ) m;
  -- reverse to chronological
  select coalesce(jsonb_agg(elem order by ord desc), '[]'::jsonb)
    into msgs
  from jsonb_array_elements(msgs) with ordinality as t(elem, ord);

  return jsonb_build_object(
    'ok', true,
    'conversation', jsonb_build_object(
      'id', conv.id,
      'title', conv.title,
      'mode', conv.mode,
      'created_at', conv.created_at,
      'updated_at', conv.updated_at
    ),
    'messages', msgs
  );
end;
$$;

create or replace function public.ensure_my_fin_conversation(
  p_id uuid default null,
  p_title text default '',
  p_mode text default 'multifactor'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  conv public.fin_conversations;
  cnt integer;
begin
  if uid is null then
    raise exception 'missing_user';
  end if;

  if p_id is not null then
    select * into conv from public.fin_conversations
     where id = p_id and user_id = uid;
    if conv.id is not null then
      update public.fin_conversations
         set mode = coalesce(nullif(p_mode, ''), mode),
             updated_at = now()
       where id = conv.id
      returning * into conv;
      return jsonb_build_object(
        'ok', true,
        'id', conv.id,
        'title', conv.title,
        'mode', conv.mode
      );
    end if;
  end if;

  select count(*) into cnt from public.fin_conversations where user_id = uid;
  if cnt >= 20 then
    delete from public.fin_conversations
     where id in (
       select id from public.fin_conversations
        where user_id = uid
        order by updated_at asc
        limit (cnt - 19)
     );
  end if;

  insert into public.fin_conversations (user_id, title, mode)
  values (
    uid,
    left(coalesce(nullif(trim(p_title), ''), 'Untitled'), 80),
    coalesce(nullif(p_mode, ''), 'multifactor')
  )
  returning * into conv;

  return jsonb_build_object(
    'ok', true,
    'id', conv.id,
    'title', conv.title,
    'mode', conv.mode
  );
end;
$$;

create or replace function public.append_my_fin_messages(
  p_conversation_id uuid,
  p_user_content text,
  p_assistant_content text,
  p_structured jsonb default null,
  p_tokens integer default 0,
  p_gold integer default 0,
  p_mode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  conv public.fin_conversations;
  msg_count integer;
begin
  if uid is null then
    raise exception 'missing_user';
  end if;
  select * into conv from public.fin_conversations
   where id = p_conversation_id and user_id = uid;
  if conv.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  insert into public.fin_messages (conversation_id, role, content, tokens, gold)
  values (p_conversation_id, 'user', coalesce(p_user_content, ''), 0, 0);

  insert into public.fin_messages (
    conversation_id, role, content, structured, tokens, gold
  ) values (
    p_conversation_id,
    'assistant',
    coalesce(p_assistant_content, ''),
    p_structured,
    coalesce(p_tokens, 0),
    coalesce(p_gold, 0)
  );

  update public.fin_conversations
     set updated_at = now(),
         mode = coalesce(nullif(p_mode, ''), mode),
         title = case
           when title = '' or title = 'Untitled'
             then left(coalesce(nullif(trim(p_user_content), ''), title), 80)
           else title
         end
   where id = p_conversation_id;

  select count(*) into msg_count
    from public.fin_messages where conversation_id = p_conversation_id;
  if msg_count > 200 then
    delete from public.fin_messages
     where id in (
       select id from public.fin_messages
        where conversation_id = p_conversation_id
        order by id asc
        limit (msg_count - 200)
     );
  end if;

  return jsonb_build_object('ok', true, 'conversation_id', p_conversation_id);
end;
$$;

create or replace function public.delete_my_fin_conversation(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n integer;
begin
  if uid is null then
    raise exception 'missing_user';
  end if;
  delete from public.fin_conversations
   where id = p_id and user_id = uid;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n > 0);
end;
$$;

revoke all on function public.list_my_fin_conversations(integer) from public, anon;
revoke all on function public.get_my_fin_conversation(uuid) from public, anon;
revoke all on function public.ensure_my_fin_conversation(uuid, text, text) from public, anon;
revoke all on function public.append_my_fin_messages(uuid, text, text, jsonb, integer, integer, text) from public, anon;
revoke all on function public.delete_my_fin_conversation(uuid) from public, anon;

grant execute on function public.list_my_fin_conversations(integer) to authenticated, service_role;
grant execute on function public.get_my_fin_conversation(uuid) to authenticated, service_role;
grant execute on function public.ensure_my_fin_conversation(uuid, text, text) to authenticated, service_role;
grant execute on function public.append_my_fin_messages(uuid, text, text, jsonb, integer, integer, text) to authenticated, service_role;
grant execute on function public.delete_my_fin_conversation(uuid) to authenticated, service_role;
