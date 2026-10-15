import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// An ephemeral local Postgres fixture; no network, hosted users or hosted writes.
const db = await PGlite.create();
const root = new URL('../', import.meta.url);
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005'];
const [owner, staff, buyer, partner, other] = ids;
async function as(role, user, sql, params = []) {
  assert(['anon', 'authenticated', 'service_role'].includes(role));
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, role })]);
    return (await tx.query(sql, params)).rows;
  });
}
const auth = (id, sql, params) => as('authenticated', id, sql, params);
const svc = (sql, params) => as('service_role', null, sql, params);
const denied = async (run, code = '42501') => assert.rejects(run, (error) => error.code === code);
try {
  await db.exec(`
    create role anon nologin nosuperuser nobypassrls;
    create role authenticated nologin nosuperuser nobypassrls;
    create role service_role nologin nosuperuser bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text unique not null, raw_user_meta_data jsonb not null default '{}');
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb); $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub', '')::uuid; $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
    create publication supabase_realtime;
    create schema storage;
    create table storage.buckets(id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, unique(bucket_id, name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select on storage.buckets, storage.objects to anon, authenticated;
    grant insert, update, delete on storage.objects to authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  `);
  for (const path of ['supabase/review.sql', ...['00000_platform', '00100_seed', '00200_partner_discount', '00300_storefront', '00400_content', '00500_commerce', '00600_assistant'].map((suffix) => `supabase/migrations/202610010${suffix}.sql`)]) {
    await db.exec(await readFile(new URL(path, root), 'utf8'));
  }
  const migration = await readFile(new URL('supabase/migrations/20261001000600_assistant.sql', root), 'utf8');
  for (let i = 0; i < ids.length; i++) await rows('insert into auth.users(id,email) values ($1,$2)', [ids[i], `fixture-${i}@example.test`]);
  for (const [id, role] of [[owner, 'owner'], [staff, 'staff'], [partner, 'partner']]) await rows('update public.profiles set role=$2 where id=$1', [id, role]);
  await db.exec("insert into public.review_access(project,key) values ('fixture','fixture-review-only');");
  assert.equal((await svc('select public.assistant_review_project($1) as project', ['fixture-review-only']))[0].project, 'fixture');
  await denied(() => svc('select public.assistant_review_project($1)', ['invalid']), '28000');
  await denied(() => as('anon', null, 'select public.assistant_review_project($1)', ['fixture-review-only']));
  console.log('PASS review gate delegates to review_key_project; only service role can call it');

  for (const [kind, limit] of [['anonymous', 30], ['buyer', 60], ['partner', 200], ['owner', 600], ['preview', 120]]) {
    const result = await svc("select public.assistant_take_usage(repeat('a',64), $1) as result from generate_series(1,$2)", [kind, limit + 1]);
    assert.equal(result.filter((r) => r.result.allowed).length, limit);
    assert.equal(result.at(-1).result.allowed, false);
    assert(result.at(-1).result.retryAfter > 0);
    const counter = await rows('select requests from public.assistant_usage where class=$1', [kind]);
    assert.equal(counter[0].requests, limit);
  }
  await rows("update public.assistant_usage set window_start = window_start - interval '3 days'");
  assert.equal((await svc("select public.assistant_take_usage(repeat('a',64),'anonymous') as result"))[0].result.allowed, true);
  assert.equal((await rows('select count(*)::int as n from public.assistant_usage'))[0].n, 1);
  await denied(() => auth(buyer, "select public.assistant_take_usage(repeat('a',64),'owner')"));
  await denied(() => auth(owner, 'select * from public.assistant_usage'));
  console.log('PASS all five rate-limit boundaries, capped counters, fresh windows, cleanup and service-only grants');

  const fixtures = [
    [buyer, 'visitor', 'live'], [other, 'visitor', 'live'], [partner, 'partner', 'live'],
    [owner, 'owner', 'live'], [null, 'visitor', 'live'], [null, 'owner', 'preview'],
  ];
  const threads = [];
  for (const [user, persona, mode] of fixtures) {
    const id = crypto.randomUUID(); threads.push(id);
    const result = await svc("select public.assistant_reserve($1,repeat('a',64),repeat('b',64),$2,$3,$4,0,0,$5::jsonb) as revision", [id, user, persona, mode, JSON.stringify([{ role: 'user', content: 'Fixture question' }])]);
    assert.equal(result[0].revision, 1);
    await denied(() => svc("select public.assistant_reserve($1,repeat('a',64),repeat('b',64),$2,$3,$4,1,0,'[]')", [id, user, persona, mode]), '40001');
    assert.equal((await svc("select public.assistant_finish($1,1,'{\"role\":\"assistant\",\"content\":\"Fixture answer\",\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":5,\"total_tokens\":15},\"cost\":0.000025,\"provider\":\"OpenRouter\",\"model\":\"fixture/model\"}') as ok", [id]))[0].ok, true);
    assert.equal((await svc("select public.assistant_finish($1,1,'[]') as ok", [id]))[0].ok, false);
  }
  assert.equal((await auth(buyer, 'select * from public.assistant_threads')).length, 1);
  assert.equal((await auth(buyer, 'select * from public.assistant_messages')).length, 2);
  assert.equal((await auth(partner, 'select * from public.assistant_threads')).length, 1);
  assert.equal((await auth(partner, 'select * from public.assistant_messages')).length, 2);
  assert.equal((await auth(owner, 'select * from public.assistant_threads')).length, 4);
  assert.equal((await auth(staff, 'select * from public.assistant_threads')).length, 3);
  assert.equal((await auth(owner, "select * from public.assistant_threads where mode='preview'")).length, 0);
  await denied(() => as('anon', null, 'select * from public.assistant_threads'));
  await denied(() => auth(owner, "insert into public.assistant_messages(thread_id,role,content) values ($1,'assistant','[]')", [threads[0]]));
  await denied(() => auth(owner, "select public.assistant_finish($1,1,'[]')", [threads[0]]));
  console.log('PASS buyer/partner isolation, owner/staff visitor reads, anonymous denial, preview separation, confirmation replay and busy-thread exclusion');

  await db.exec('alter function public.upsert_product(jsonb) rename to fixture_catalog_not_installed');
  assert.equal((await auth(owner, 'select public.assistant_capabilities() as c'))[0].c.updateProduct, false);
  await db.exec('alter function public.fixture_catalog_not_installed(jsonb) rename to upsert_product');
  assert.deepEqual((await auth(owner, 'select public.assistant_capabilities() as c'))[0].c, { updateProduct: true, productArgument: 'draft' });
  assert.equal((await auth(buyer, 'select public.assistant_capabilities() as c'))[0].c.updateProduct, false);
  const product = (await rows("select * from public.products where id='retatrutide-10-mg'"))[0];
  const draft = { ...product, price: 40, stock: 20, expectedStock: null, description: 'Fixture research description.', colorInk: product.color_ink };
  const updated = (await auth(owner, 'select * from public.upsert_product($1::jsonb)', [JSON.stringify(draft)]))[0];
  assert.equal(Number(updated.price), 40); assert.equal(updated.stock, 20); assert.equal(updated.description, draft.description);
  await denied(() => auth(owner, 'select * from public.upsert_product($1::jsonb)', [JSON.stringify(draft)]), '40001');
  console.log('PASS catalog capability detection, actual WP-15 draft RPC, persisted fields and stale-stock protection');

  const defaults = { visitor: 'openai/gpt-6-luna', partner: 'openai/gpt-6-luna', owner: 'anthropic/claude-sonnet-5.5' };
  const modelFields = 'assistant_model_visitor, assistant_model_partner, assistant_model_owner';
  const setting = (await rows(`select ${modelFields} from public.settings`))[0];
  for (const [persona, model] of Object.entries(defaults)) assert.equal(setting[`assistant_model_${persona}`], model);
  assert.deepEqual((await svc(`select ${modelFields} from public.settings`))[0], setting);
  const selected = { visitor: 'fixture/affordable', partner: 'fixture/partner:free', owner: 'fixture/owner' };
  for (const id of [staff, buyer, partner]) await denied(() => auth(id, 'select public.update_assistant_settings($1::jsonb)', [JSON.stringify(selected)]));
  await denied(() => as('anon', null, 'select public.update_assistant_settings($1::jsonb)', [JSON.stringify(selected)]));
  await denied(() => svc('select public.update_assistant_settings($1::jsonb)', [JSON.stringify(selected)]));
  for (const id of [owner, staff, buyer, partner]) await denied(() => auth(id, "update public.settings set assistant_model_owner='bypass'"));
  const otherSettings = await rows('select free_shipping_threshold, insurance_mode, insurance_rate from public.settings');
  assert.deepEqual((await auth(owner, 'select public.update_assistant_settings($1::jsonb) as models', [JSON.stringify(selected)]))[0].models, selected);
  assert.deepEqual(await rows('select free_shipping_threshold, insurance_mode, insurance_rate from public.settings'), otherSettings);
  for (const invalid of [{ ...selected, visitor: '' }, { ...selected, owner: 'has whitespace' }, { ...selected, owner: null }, { ...selected, extra: 'no' }, { visitor: 'fixture' }])
    await denied(() => auth(owner, 'select public.update_assistant_settings($1::jsonb)', [JSON.stringify(invalid)]), '22023');
  console.log('PASS exact model defaults, owner-only settings RPC, direct-update denial, validation and isolation from commerce settings');

  const firstThread = threads[0];
  assert.equal((await svc("select public.assistant_reserve($1,repeat('a',64),repeat('b',64),$2,'visitor','live',1,0,$3::jsonb) as revision", [firstThread, buyer, JSON.stringify([{ role: 'user', content: 'What dose?' }])]))[0].revision, 2);
  await svc('select public.assistant_finish($1,2,$2::jsonb)', [firstThread, JSON.stringify({ role: 'assistant', content: 'Fixture refusal', notice: 'refusal', usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, cost: 0 })]);
  const refusal = (await rows("select notice, usage, cost from public.assistant_messages where notice='refusal'"))[0];
  assert.equal(refusal.notice, 'refusal'); assert.equal(Number(refusal.cost), 0); assert.equal(refusal.usage.total_tokens, 0);
  await rows("insert into public.assistant_messages(thread_id,role,content,usage,provider,model) values ($1,'assistant','\"Fixture unknown cost\"','{\"prompt_tokens\":2,\"completion_tokens\":1,\"total_tokens\":3}','Anthropic','fixture/native')", [firstThread]);
  await rows("insert into public.assistant_messages(thread_id,role,content,cost,created_at) values ($1,'assistant','\"Previous month\"',10,date_trunc('month',now())-interval '1 day')", [firstThread]);
  const spend = (await svc('select public.assistant_month_spend() as spend'))[0].spend;
  assert.equal(spend.cost, 0.00015); assert.equal(spend.unpricedMessages, 1); assert.equal(spend.messages, 8); assert.equal(spend.promptTokens, 62); assert.equal(spend.completionTokens, 31);
  for (const id of [owner, staff, buyer, partner]) await denied(() => auth(id, 'select public.assistant_month_spend()'));
  console.log('PASS per-message tokens/cost/provider/model/refusal logging, current-month UTC spend, unknown costs and service-only accounting');

  for (const id of [staff, buyer, partner]) await denied(() => auth(id, "select public.create_discount_code('FIXTURE',10,true)"));
  const created = await auth(owner, "select * from public.create_discount_code('FIXTURE',10,true)");
  assert.equal(created[0].kind, 'promo'); assert.equal(Number(created[0].percent), 10);
  await denied(() => auth(owner, "select public.create_discount_code('FIXTURE',20,false)"), '23505');
  for (const sql of ["select public.create_discount_code('bad code',10,true)", "select public.create_discount_code('INVALID',101,true)", "select public.create_discount_code('INVALID',10,true,'2000-01-01')"])
    await denied(() => auth(owner, sql), '22023');
  console.log('PASS owner-only promo RPC, exact values, duplicate protection and input validation');

  const savedSettings = await rows(`select ${modelFields} from public.settings`);
  const snapshot = await rows('select * from public.assistant_messages order by id');
  await db.exec(migration); await db.exec(migration);
  assert.deepEqual(await rows('select * from public.assistant_messages order by id'), snapshot);
  assert.deepEqual(await rows(`select ${modelFields} from public.settings`), savedSettings);
  assert.equal((await rows("select count(*)::int as n from public.discounts where code='FIXTURE'"))[0].n, 1);
  assert.equal((await rows('select count(*)::int as n from public.review_access'))[0].n, 1);
  console.log('PASS populated migration reruns preserve chats, codes and the review gate');
  console.log(JSON.stringify({ sql_validated: true, rate_limits: true, review_key_gate: true, tools_respect_store_permissions: true }));
} finally { await db.close(); }
