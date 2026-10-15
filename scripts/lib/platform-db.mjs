// A local, throwaway stand-in for the Supabase database, shared by Round 12's SQL
// proofs. PGlite runs the real migrations in production order over small stubs of
// what Supabase provides (roles, auth, storage, vault, pg_net, pg_cron).
// No Supabase endpoint or credential is involved.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const root = new URL('../../', import.meta.url);

const STUBS = `
  create role anon nologin nosuperuser nobypassrls;
  create role authenticated nologin nosuperuser nobypassrls;
  create role service_role nologin nosuperuser bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email character varying(255) not null unique, -- as Supabase declares it
    created_at timestamptz not null default now(),
    last_sign_in_at timestamptz,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.jwt() returns jsonb language sql stable set search_path = public
    as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb); $$;
  create function auth.uid() returns uuid language sql stable set search_path = public
    as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid; $$;
  revoke all on schema auth from public;
  grant usage on schema auth to anon, authenticated, service_role;
  revoke all on auth.users from public, anon, authenticated, service_role;
  revoke all on function auth.uid(), auth.jwt() from public;
  grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
  create publication supabase_realtime;
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, owner uuid, metadata jsonb default '{}', created_at timestamptz not null default now(), unique (bucket_id, name));
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]; $$;
  create function storage.filename(name text) returns text language sql immutable as $$ select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)]; $$;
  grant usage on schema storage to anon, authenticated, service_role;
  grant select on storage.buckets, storage.objects to anon, authenticated;
  grant insert, update, delete on storage.objects to authenticated;
  grant all on storage.buckets, storage.objects to service_role;
  -- Vault: secrets readable by the definer functions that need them.
  create schema vault;
  create table vault.secrets (name text primary key, secret text not null);
  create view vault.decrypted_secrets as select name, secret as decrypted_secret from vault.secrets;
  -- pg_net: calls are recorded, never sent.
  create schema net;
  create table net.calls (id bigserial primary key, url text not null, body jsonb, headers jsonb, at timestamptz not null default now());
  create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
    headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000) returns bigint
    language sql as $$ insert into net.calls(url, body, headers) values (url, body, headers) returning id; $$;
  -- pg_cron: schedules are recorded; tests run the commands themselves.
  create schema cron;
  create table cron.job (jobid bigserial primary key, jobname text unique, schedule text not null, command text not null);
  create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$
    insert into cron.job(jobname, schedule, command) values (job_name, schedule, command)
      on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid; $$;
  create function cron.unschedule(job_name text) returns boolean language sql as $$
    with gone as (delete from cron.job where jobname = job_name returning 1) select exists (select 1 from gone); $$;
  -- Supabase's permissive defaults; migrations must revoke them.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

/** Every migration file, in the order Supabase applies them. */
export async function migrationFiles() {
  const directory = new URL('supabase/migrations/', root);
  return (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort().map((name) => new URL(name, directory));
}

/**
 * A fresh database with the review layer and every migration applied (twice, to
 * prove they re-run), or only those up to and including `through` (a filename).
 */
export async function createPlatformDb({ through, reruns = 2 } = {}) {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  // Supabase's database runs on UTC; so does this one, whatever the clock of the machine running it.
  await db.exec("set timezone = 'UTC';");
  await db.exec('create extension if not exists pgcrypto;');
  await db.exec(STUBS);
  await db.exec(await readFile(new URL('supabase/review.sql', root), 'utf8'));
  const files = [];
  for (const file of await migrationFiles()) {
    files.push(file);
    if (through && file.pathname.endsWith(`/${through}`)) break;
  }
  if (through) assert(files.at(-1).pathname.endsWith(`/${through}`), `Unknown migration ${through}`);
  for (let run = 1; run <= reruns; run++) {
    for (const file of files) {
      try { await db.exec(await readFile(file, 'utf8')); }
      catch (error) { throw new Error(`${file.pathname.split('/').pop()} (run ${run}): ${error.message}`); }
    }
  }

  const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
  const scalar = async (sql, params = []) => Object.values((await rows(sql, params))[0] ?? { v: undefined })[0];
  // SET LOCAL ROLE matters: as the table owner, RLS would be bypassed.
  async function as(role, user, sql, params = []) {
    assert(['anon', 'authenticated', 'service_role'].includes(role));
    return db.transaction(async (tx) => {
      await tx.exec(`set local role ${role};`);
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user ?? undefined, role })]);
      return (await tx.query(sql, params)).rows;
    });
  }
  const auth = (user, sql, params = []) => as('authenticated', user, sql, params);
  const anon = (sql, params = []) => as('anon', null, sql, params);
  const service = (sql, params = []) => as('service_role', null, sql, params);
  async function denied(role, user, sql, params = [], code = '42501') {
    await assert.rejects(() => as(role, user, sql, params), (error) => {
      assert.equal(error.code, code, `${sql}: ${error.message}`);
      return true;
    }, `Unexpected success: ${sql}`);
  }
  /** An auth user with a profile (the auth trigger runs), then the given role. */
  async function person(email, role = 'buyer', metadata = {}) {
    const id = (await rows('insert into auth.users(id, email, raw_user_meta_data) values (gen_random_uuid(), $1, $2) returning id', [email, metadata]))[0].id;
    if (role !== 'buyer') await db.query('update public.profiles set role = $1 where id = $2', [role, id]);
    return id;
  }
  return { db, rows, scalar, as, auth, anon, service, denied, person, migrations: files.map((f) => f.pathname.split('/').pop()) };
}
