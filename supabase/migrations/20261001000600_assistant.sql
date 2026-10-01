-- WP-17. No model credentials or review keys are stored here.
begin;

alter table public.settings
  add column if not exists assistant_model_visitor text not null default 'openai/gpt-6-luna',
  add column if not exists assistant_model_partner text not null default 'openai/gpt-6-luna',
  add column if not exists assistant_model_owner text not null default 'anthropic/claude-sonnet-5.5';
-- Public settings remain readable; writes still have no direct client grant.
-- The function's service transport only needs the model columns.
grant select (assistant_model_visitor, assistant_model_partner, assistant_model_owner) on public.settings to service_role;
create or replace function public.update_assistant_settings(draft jsonb) returns jsonb
language plpgsql security definer set search_path = public
as $$ declare field text; saved public.settings;
begin
  if public.platform_role() is distinct from 'owner' then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if jsonb_typeof(draft) is distinct from 'object' or (draft - array['visitor','partner','owner']) <> '{}'::jsonb then
    raise exception 'Check the model names' using errcode = '22023';
  end if;
  foreach field in array array['visitor','partner','owner'] loop
    if jsonb_typeof(draft -> field) is distinct from 'string' or (draft ->> field) !~ '^[a-zA-Z0-9_./:+@-]{1,200}$' then
      raise exception 'Check the model names' using errcode = '22023';
    end if;
  end loop;
  update public.settings set assistant_model_visitor = draft ->> 'visitor', assistant_model_partner = draft ->> 'partner',
    assistant_model_owner = draft ->> 'owner', updated_at = now() where id = true returning * into saved;
  return jsonb_build_object('visitor', saved.assistant_model_visitor, 'partner', saved.assistant_model_partner, 'owner', saved.assistant_model_owner);
end $$;
revoke all on function public.update_assistant_settings(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.update_assistant_settings(jsonb) to authenticated;

create table if not exists public.assistant_usage (
  subject_hash text not null,
  class text not null check (class in ('anonymous', 'buyer', 'partner', 'owner', 'preview')),
  window_start timestamptz not null,
  requests integer not null check (requests > 0),
  primary key (subject_hash, class, window_start)
);
create table if not exists public.assistant_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  subject_hash text not null,
  token_hash text not null,
  persona text not null check (persona in ('visitor', 'owner', 'partner')),
  mode text not null check (mode in ('live', 'preview')),
  revision integer not null default 0,
  tool_rounds integer not null default 0 check (tool_rounds between 0 and 6),
  busy_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.assistant_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.assistant_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content jsonb not null check (jsonb_typeof(content) in ('string','null') and octet_length(content::text) <= 65536),
  tool_calls jsonb check (jsonb_typeof(tool_calls) = 'array' and octet_length(tool_calls::text) <= 65536),
  tool_call_id text,
  usage jsonb check (jsonb_typeof(usage) = 'object'),
  cost numeric(18,10) check (cost >= 0),
  provider text,
  model text,
  notice text check (notice in ('refusal','error')),
  created_at timestamptz not null default now()
);
create index if not exists assistant_messages_thread on public.assistant_messages(thread_id, id desc);
create index if not exists assistant_threads_user on public.assistant_threads(user_id, created_at desc);
create index if not exists assistant_usage_age on public.assistant_usage(window_start);

alter table public.assistant_usage enable row level security;
alter table public.assistant_threads enable row level security;
alter table public.assistant_messages enable row level security;
revoke all on public.assistant_usage, public.assistant_threads, public.assistant_messages from public, anon, authenticated;
revoke all on sequence public.assistant_messages_id_seq from public, anon, authenticated;
grant select on public.assistant_threads, public.assistant_messages to authenticated;
grant select, insert, update, delete on public.assistant_usage, public.assistant_threads, public.assistant_messages to service_role;
grant usage, select on sequence public.assistant_messages_id_seq to service_role;

drop policy if exists assistant_thread_read on public.assistant_threads;
create policy assistant_thread_read on public.assistant_threads for select to authenticated using (
  mode = 'live' and (user_id = (select auth.uid()) or
    (persona = 'visitor' and (select public.platform_role()) in ('owner', 'staff')))
);
drop policy if exists assistant_message_read on public.assistant_messages;
create policy assistant_message_read on public.assistant_messages for select to authenticated using (
  exists (select 1 from public.assistant_threads t where t.id = thread_id)
);

-- One atomic fixed-window counter; simultaneous requests cannot overspend a bucket.
create or replace function public.assistant_take_usage(p_subject text, p_class text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_limit integer; v_start timestamptz; v_seconds integer; v_count integer;
begin
  if p_subject !~ '^[a-f0-9]{64}$' then raise exception 'Invalid subject' using errcode = '22023'; end if;
  v_limit := case p_class when 'anonymous' then 30 when 'buyer' then 60 when 'partner' then 200 when 'owner' then 600 when 'preview' then 120 end;
  if v_limit is null then raise exception 'Invalid usage class' using errcode = '22023'; end if;
  v_seconds := case when p_class in ('owner', 'partner') then 86400 else 3600 end;
  v_start := to_timestamp(floor(extract(epoch from now()) / v_seconds) * v_seconds);
  insert into public.assistant_usage(subject_hash, class, window_start, requests)
    values (p_subject, p_class, v_start, 1)
  on conflict (subject_hash, class, window_start) do update
    set requests = assistant_usage.requests + 1 where assistant_usage.requests < v_limit
  returning requests into v_count;
  -- This table is a limiter, not a permanent activity log.
  delete from public.assistant_usage where window_start < now() - interval '2 days';
  return jsonb_build_object('allowed', v_count is not null, 'limit', v_limit,
    'retryAfter', greatest(1, ceil(extract(epoch from v_start + make_interval(secs => v_seconds) - now())))::integer);
end $$;

-- Same review_access comparison as the review layer, without opening that table.
create or replace function public.assistant_review_project(p_key text) returns text
language sql stable security definer set search_path = public
as $$ select public.review_key_project(p_key); $$;

-- Compare-and-swap reservation also prevents replaying the same confirmation result.
create or replace function public.assistant_reserve(p_id uuid, p_subject text, p_token text, p_user uuid,
  p_persona text, p_mode text, p_revision integer, p_round integer, p_content jsonb) returns integer
language plpgsql security definer set search_path = public
as $$
declare v_revision integer; message jsonb;
begin
  if p_revision = 0 then
    insert into public.assistant_threads(id, subject_hash, token_hash, user_id, persona, mode)
    values (p_id, p_subject, p_token, p_user, p_persona, p_mode) on conflict (id) do nothing;
  end if;
  update public.assistant_threads set revision = revision + 1, tool_rounds = p_round,
    busy_until = now() + interval '2 minutes', updated_at = now()
  where id = p_id and revision = p_revision and subject_hash = p_subject and token_hash = p_token
    and user_id is not distinct from p_user and persona = p_persona and mode = p_mode
    and (busy_until is null or busy_until < now()) returning revision into v_revision;
  if v_revision is null then raise exception 'Conversation changed; please try again' using errcode = '40001'; end if;
  if jsonb_typeof(p_content) is distinct from 'array' or jsonb_array_length(p_content) not between 1 and 7 then
    raise exception 'Invalid messages' using errcode = '22023';
  end if;
  for message in select value from jsonb_array_elements(p_content) loop
    if message ->> 'role' not in ('user','tool') or jsonb_typeof(message -> 'content') is distinct from 'string' then
      raise exception 'Invalid message' using errcode = '22023';
    end if;
    insert into public.assistant_messages(thread_id, role, content, tool_call_id)
      values (p_id, message ->> 'role', message -> 'content', message ->> 'tool_call_id');
  end loop;
  return v_revision;
end $$;
create or replace function public.assistant_finish(p_id uuid, p_revision integer, p_content jsonb) returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  perform 1 from public.assistant_threads where id = p_id and revision = p_revision and busy_until is not null for update;
  if not found then return false; end if;
  if p_content is not null then
    if p_content ->> 'role' is distinct from 'assistant' then raise exception 'Invalid answer' using errcode = '22023'; end if;
    insert into public.assistant_messages(thread_id, role, content, tool_calls, usage, cost, provider, model, notice)
      values (p_id, 'assistant', p_content -> 'content', p_content -> 'tool_calls', nullif(p_content -> 'usage', 'null'::jsonb),
        (p_content ->> 'cost')::numeric, p_content ->> 'provider', p_content ->> 'model', p_content ->> 'notice');
  end if;
  update public.assistant_threads set busy_until = null, updated_at = now() where id = p_id;
  return true;
end $$;

-- Spend is computed over stored accounting, including preview and connection tests.
-- Unknown provider costs remain unknown rather than being presented as zero.
create or replace function public.assistant_month_spend() returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('month', to_char(now() at time zone 'UTC', 'YYYY-MM'),
    'cost', coalesce(sum(cost), 0), 'unpricedMessages', count(*) filter (where cost is null),
    'messages', count(*), 'promptTokens', coalesce(sum((usage ->> 'prompt_tokens')::bigint), 0),
    'completionTokens', coalesce(sum((usage ->> 'completion_tokens')::bigint), 0))
  from public.assistant_messages where role = 'assistant'
    and created_at >= (date_trunc('month', now() at time zone 'UTC') at time zone 'UTC');
$$;
revoke all on function public.assistant_month_spend() from public, anon, authenticated, service_role;
grant execute on function public.assistant_month_spend() to service_role;

create or replace function public.assistant_capabilities() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_argument text;
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    return jsonb_build_object('updateProduct', false);
  end if;
  select p.proargnames[1] into v_argument from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'upsert_product' and p.pronargs = 1
      and p.proargtypes[0] = 'jsonb'::regtype and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  return jsonb_build_object('updateProduct', coalesce(v_argument = 'draft', false), 'productArgument', v_argument);
end $$;

create or replace function public.create_discount_code(code text, percent numeric, active boolean, expires_at timestamptz default null)
returns public.discounts language plpgsql security definer set search_path = public
as $$
declare v_row public.discounts;
begin
  if coalesce(public.platform_role(), '') <> 'owner' then raise exception 'Owner access required' using errcode = '42501'; end if;
  if $1 is null or $1 !~ '^[A-Z0-9_-]{1,64}$' or $2 is null or $2 <= 0 or $2 > 100 or $3 is null
    or ($4 is not null and $4 <= now()) then raise exception 'Check the code, percentage and expiry' using errcode = '22023'; end if;
  insert into public.discounts(code, kind, percent, active, expires_at) values ($1, 'promo', $2, $3, $4) returning * into v_row;
  return v_row;
end $$;

revoke all on function public.assistant_take_usage(text, text), public.assistant_review_project(text),
  public.assistant_reserve(uuid, text, text, uuid, text, text, integer, integer, jsonb), public.assistant_finish(uuid, integer, jsonb),
  public.assistant_capabilities(), public.create_discount_code(text, numeric, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.assistant_take_usage(text, text), public.assistant_review_project(text),
  public.assistant_reserve(uuid, text, text, uuid, text, text, integer, integer, jsonb), public.assistant_finish(uuid, integer, jsonb) to service_role;
grant execute on function public.assistant_capabilities(), public.create_discount_code(text, numeric, boolean, timestamptz) to authenticated;
notify pgrst, 'reload schema';
commit;
