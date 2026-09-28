-- The TrueMark review layer: the notes people leave on the preview, shared only with people
-- who hold the review link.
--
-- The review key, in two lines:
--   1. Make a long random key (for example `openssl rand -hex 32`) and insert it with the template at the end of this file.
--   2. Send the review link with it: https://…/truemark/#/review?key=<the key>
--
-- Paste this whole file into Supabase's SQL editor (Project → SQL editor → New query) and run it.
-- Running it again is safe. Then set VITE_REVIEW_SUPABASE_URL and VITE_REVIEW_SUPABASE_ANON_KEY
-- (see .env.example) and rebuild the site.
--
-- How it stays private: the site's public ("anon") key cannot read or write either table. It can
-- only call the four functions below, and the three that touch notes check the review key first.
-- Needs Postgres 13 or later (for gen_random_uuid); every Supabase project has it.


-- One row per note: a pinned comment, a note about a page, a reply, or an answer to one of Riley's questions.
create table if not exists public.review_notes (
  id           uuid primary key default gen_random_uuid(),
  -- Which review the note belongs to; set by the server from the review key, never by the site.
  project      text not null,
  kind         text not null check (kind in ('comment', 'page', 'reply', 'answer')),
  -- For a reply: the note it answers. For an answer: the question it answers.
  thread_id    uuid,
  question_id  text,
  -- The page it was left on, and that page's name at the time.
  route        text not null,
  page_title   text not null,
  -- Where on the page: the element, the click point inside it, its text, the window size.
  anchor       jsonb,
  body         text not null check (char_length(body) <= 4000),
  category     text check (category in ('change', 'missing', 'question', 'love')),
  -- For an answer: the choices picked and any words added.
  answer       jsonb,
  author_id    text not null,
  author_name  text not null,
  author_role  text,
  author_kind  text not null check (author_kind in ('client', 'designer')),
  status       text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- A review's notes are read in the order they were written; this keeps that quick.
create index if not exists review_notes_project_created_at on public.review_notes (project, created_at);

-- Keep updated_at true whenever a note changes, however it is changed.
create or replace function public.review_notes_touch() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists review_notes_touch on public.review_notes;
create trigger review_notes_touch
  before update on public.review_notes
  for each row execute function public.review_notes_touch();

-- Which key opens which review. Riley adds the row himself (the template at the end); the key
-- never enters the site's code.
create table if not exists public.review_access (
  project  text primary key,
  key      text not null
);

-- Close both tables to everyone but their owner: nothing can be read, added, changed or removed
-- through the site's public key, or by signed-in users, or by anyone else.
revoke all on table public.review_notes from anon, authenticated, public;
revoke all on table public.review_access from anon, authenticated, public;

-- Row level security stays on as a second lock. With no policies, only the owner (and the
-- functions below, which run as the owner) can see a row.
alter table public.review_notes enable row level security;
alter table public.review_access enable row level security;

-- An earlier version of this file let the public key read and write notes through policies;
-- remove them if they are there.
drop policy if exists "review notes: read truemark" on public.review_notes;
drop policy if exists "review notes: add to truemark" on public.review_notes;
drop policy if exists "review notes: change truemark" on public.review_notes;

-- That version also streamed the table through Supabase Realtime; live updates now travel on a
-- private Broadcast channel instead, so take the table out of the stream if it is in it.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'review_notes'
  ) then
    alter publication supabase_realtime drop table public.review_notes;
  end if;
end;
$$;

-- The review a key opens; any other key is refused with 'invalid review key' (SQLSTATE 28000),
-- which the site reads as "this review link isn't valid". Used only by the functions below.
create or replace function public.review_key_project(p_key text) returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_project text;
begin
  select project into v_project from public.review_access where key = p_key;
  if v_project is null then
    raise exception 'invalid review key' using errcode = '28000';
  end if;
  return v_project;
end;
$$;

-- Every note of the review the key opens, oldest first.
create or replace function public.review_list(p_key text) returns setof public.review_notes
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_project text := public.review_key_project(p_key);
begin
  return query
    select * from public.review_notes
    where project = v_project
    order by created_at, id;
end;
$$;

-- Add a note. The server decides which review it belongs to (from the key) and when it was written.
create or replace function public.review_add(p_key text, p_note jsonb) returns public.review_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project text := public.review_key_project(p_key);
  v_thread  uuid := nullif(p_note ->> 'thread_id', '')::uuid;
  v_row     public.review_notes;
begin
  -- A reply must answer a note in the same review.
  if v_thread is not null and not exists (
    select 1 from public.review_notes where id = v_thread and project = v_project
  ) then
    raise exception 'unknown thread' using errcode = '22023';
  end if;

  insert into public.review_notes (
    id, project, kind, thread_id, question_id, route, page_title, anchor, body, category, answer,
    author_id, author_name, author_role, author_kind, status
  ) values (
    coalesce(nullif(p_note ->> 'id', '')::uuid, gen_random_uuid()),
    v_project,
    p_note ->> 'kind',
    v_thread,
    nullif(p_note ->> 'question_id', ''),
    p_note ->> 'route',
    p_note ->> 'page_title',
    nullif(p_note -> 'anchor', 'null'::jsonb),
    p_note ->> 'body',
    nullif(p_note ->> 'category', ''),
    nullif(p_note -> 'answer', 'null'::jsonb),
    p_note ->> 'author_id',
    p_note ->> 'author_name',
    nullif(p_note ->> 'author_role', ''),
    p_note ->> 'author_kind',
    coalesce(nullif(p_note ->> 'status', ''), 'open')
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- Resolve or reopen a note of the review the key opens, recording who resolved it.
create or replace function public.review_set_status(p_key text, p_id uuid, p_status text, p_by text)
returns public.review_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project text := public.review_key_project(p_key);
  v_row     public.review_notes;
begin
  update public.review_notes
     set status = p_status,
         resolved_by = case when p_status = 'resolved' then nullif(p_by, '') end,
         updated_at = now()
   where id = p_id and project = v_project
  returning * into v_row;
  if not found then
    raise exception 'note not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- Returns 1 and needs no key: a weekly call keeps a free Supabase project from pausing.
create or replace function public.review_ping() returns int
language sql
stable
security definer
set search_path = public
as $$
  select 1;
$$;

-- Functions can be called by everyone unless told otherwise. Take that away, then let the
-- site's public key call the four review functions and nothing else.
revoke all on function public.review_notes_touch() from public, anon, authenticated;
revoke all on function public.review_key_project(text) from public, anon, authenticated;
revoke all on function public.review_list(text) from public, anon, authenticated;
revoke all on function public.review_add(text, jsonb) from public, anon, authenticated;
revoke all on function public.review_set_status(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.review_ping() from public, anon, authenticated;
grant execute on function public.review_list(text) to anon;
grant execute on function public.review_add(text, jsonb) to anon;
grant execute on function public.review_set_status(text, uuid, text, text) to anon;
grant execute on function public.review_ping() to anon;

-- The review key: make a long random one, paste it below in place of <paste the key>, remove the
-- two dashes, and run just that line. Then send the review link ending #/review?key=<the key>.
-- insert into public.review_access (project, key) values ('truemark', '<paste the key>');
