-- The TrueMark review layer: the notes people leave on the preview, shared live.
-- Paste this whole file into Supabase's SQL editor (Project → SQL editor → New query) and run it once.
-- Then set VITE_REVIEW_SUPABASE_URL and VITE_REVIEW_SUPABASE_ANON_KEY (see .env.example) and rebuild the site.

-- gen_random_uuid() comes from pgcrypto; Supabase projects have it, this makes sure.
create extension if not exists pgcrypto;

-- One row per note: a pinned comment, a note about a page, a reply, or an answer to one of Riley's questions.
create table if not exists public.review_notes (
  id           uuid primary key default gen_random_uuid(),
  -- Which review the note belongs to; the site sends "truemark".
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

-- The site reads a project's notes in the order they were written; this keeps that quick.
create index if not exists review_notes_project_created_at on public.review_notes (project, created_at);

-- Keep updated_at true whenever a note changes (resolved, reopened).
create or replace function public.review_notes_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists review_notes_touch on public.review_notes;
create trigger review_notes_touch
  before update on public.review_notes
  for each row execute function public.review_notes_touch();

-- The site signs in as nobody (the "anon" role). Let that role read, add and change rows;
-- the policies below then narrow it to the TrueMark review. It is never given delete.
grant select, insert, update on public.review_notes to anon;

-- Row level security: nobody can touch a row unless a policy below allows it.
alter table public.review_notes enable row level security;

-- Anyone with the site (the public anon key) can read the TrueMark review's notes…
drop policy if exists "review notes: read truemark" on public.review_notes;
create policy "review notes: read truemark" on public.review_notes
  for select to anon
  using (project = 'truemark');

-- …add a note to it…
drop policy if exists "review notes: add to truemark" on public.review_notes;
create policy "review notes: add to truemark" on public.review_notes
  for insert to anon
  with check (project = 'truemark');

-- …and change a note in it (resolve or reopen). There is no delete policy, so nothing can be deleted from the site.
drop policy if exists "review notes: change truemark" on public.review_notes;
create policy "review notes: change truemark" on public.review_notes
  for update to anon
  using (project = 'truemark')
  with check (project = 'truemark');

-- Send every new or changed note to open previews the moment it happens.
alter publication supabase_realtime add table public.review_notes;
