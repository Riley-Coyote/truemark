import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readSeedData, seedFile } from './gen-live-seed.mjs';
import { contentFile, readJournalSeed, replaceJournalSeed } from './gen-journal-seed.mjs';

// Local, ephemeral fixture database only. No Supabase endpoint or credentials.
// Run: node scripts/validate-live-sql.mjs. Applied migrations must never be regenerated.
const root = new URL('../', import.meta.url);
const checks = {
  team_list_real: false,
  invite_single_use_expiring_email_bound: false,
  bad_invite_no_role: false,
  last_owner_protected: false,
  owner_only_changes: false,
  team_role_existing_members_only: false,
  partner_signup_intact: false,
  partner_pause_pauses_code: false,
  promo_codes_save: false,
  codes_unique: false,
  lot_transitions_guarded: false,
  team_only: false,
  live_save_retries_idempotent: false,
  partner_applicant_not_buyer: false,
  approval_creates_partner_and_code: false,
  approval_team_only: false,
  partner_application_isolation: false,
  partner_approval_idempotent: false,
  partner_duplicate_code_refused: false,
  stock_rules: false,
  insurance_math: false,
  catalog_rpcs_team_only: false,
  categories_seed: false,
  settings_owner_only: false,
  catalog_storage: false,
  settings_table: false,
  free_shipping_rule: false,
  classes_match_table: false,
  release_flow: false,
  release_gate: false,
  reject_lot_private: false,
  articles_rls: false,
  seeded_articles_text_identical: false,
  hosted_storage: "not run: hosted",
  partner_discount_policy: false,
  sql_validated: false,
  rls_buyer_isolation: false,
  rls_partner_no_buyer_identity: false,
  owner_can_advance: false,
  pending_buyer_refused: false,
  price_server_side: false,
  anon_public_only: false,
  rerunnable: false,
  profile_only_without_application: false,
  lot_lookup_no_early_results: false,
  mark_read_scoped: false,
};
const tables = ['profiles', 'buyers', 'addresses', 'applications', 'products', 'lots', 'shipping_methods',
  'partners', 'discounts', 'orders', 'order_lines', 'order_events', 'payouts', 'referrals', 'notifications', 'visits', 'settings', 'articles', 'categories', 'partner_applications', 'team_invites'];
const publicTables = ['products', 'lots', 'shipping_methods', 'settings', 'articles', 'categories'];
const users = {
  owner: '00000000-0000-4000-8000-000000000001',
  staff: '00000000-0000-4000-8000-000000000002',
  buyerA: '00000000-0000-4000-8000-000000000003',
  buyerB: '00000000-0000-4000-8000-000000000004',
  pending: '00000000-0000-4000-8000-000000000005',
  partnerA: '00000000-0000-4000-8000-000000000006',
  partnerB: '00000000-0000-4000-8000-000000000007',
  profileOnly: '00000000-0000-4000-8000-000000000008',
};
// Supabase's database runs on UTC; so does this one, whatever the clock of the machine running it.
const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec("set timezone = 'UTC';");
let assertions = 0;
function pass(description) {
  assertions += 1;
  console.log(`PASS ${description}`);
}
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const scalar = async (sql, params = []) => Object.values((await rows(sql, params))[0])[0];

// SET LOCAL ROLE is essential: merely changing a JWT while testing as the table
// owner would bypass RLS. Transaction-local settings cannot bleed between users.
async function as(role, user, sql, params = [], metadata = {}) {
  assert(['anon', 'authenticated'].includes(role));
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role};`);
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({
      sub: user ?? undefined, role, ...metadata,
    })]);
    return (await tx.query(sql, params)).rows;
  });
}
const auth = (user, sql, params = [], metadata = {}) => as('authenticated', user, sql, params, metadata);
const anon = (sql, params = []) => as('anon', null, sql, params);
async function denied(role, user, sql, params = [], code = '42501', metadata = {}) {
  await assert.rejects(() => as(role, user, sql, params, metadata), (error) => {
    assert.equal(error.code, code, `${sql}: ${error.message}`);
    return true;
  }, `Unexpected success: ${sql}`);
}
async function snapshot(engine = db) {
  const result = {};
  for (const table of tables) result[table] = (await engine.query(`select to_jsonb(t) as row from public.${table} t order by to_jsonb(t)::text`)).rows;
  return result;
}
async function reviewSnapshot() {
  return {
    rows: await rows('select * from public.review_notes order by id'),
    tables: await rows("select relname, relrowsecurity, relacl::text from pg_class where oid in ('public.review_notes'::regclass, 'public.review_access'::regclass) order by relname"),
    functions: await rows("select p.proname, pg_get_functiondef(p.oid) as definition, p.proacl::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'review_%' and p.proname <> 'review_application' order by p.proname"),
  };
}

try {
  const [schema, seed, review, seedData, partnerPolicy, storefront, contentSQL, journalSeed, commerce, assistant, accounts, liveSaves, teamSQL] = await Promise.all([
    readFile(new URL('supabase/migrations/20261001000000_platform.sql', root), 'utf8'),
    readFile(seedFile, 'utf8'),
    readFile(new URL('supabase/review.sql', root), 'utf8'),
    readSeedData(),
    readFile(new URL("supabase/migrations/20261001000200_partner_discount.sql", root), "utf8"),
    readFile(new URL("supabase/migrations/20261001000300_storefront.sql", root), "utf8"),
    readFile(contentFile, "utf8"), readJournalSeed(),
    readFile(new URL("supabase/migrations/20261001000500_commerce.sql", root), "utf8"),
    readFile(new URL("supabase/migrations/20261001000600_assistant.sql", root), "utf8"),
    readFile(new URL("supabase/migrations/20261001000700_accounts.sql", root), "utf8"),
    readFile(new URL("supabase/migrations/20261001000800_live_saves.sql", root), "utf8"),
    readFile(new URL("supabase/migrations/20261001000900_team.sql", root), "utf8"),
  ]);
  // Riley (2026-10-06): CJC (No DAC) / Ipamorelin is sold at the size its certificate tested; the applied seed
  // holds its first listing, which 20261006000100_cjc_tested_size.sql moves. These ten migrations end before that.
  seedData.products = seedData.products.map((product) => product.id === 'cjc-ipa-1010-mg' ? { ...product, size: '10 mg / 10 mg', lot: 'TM-CJI10-2609-01' } : product);
  console.log(`Engine: ${await scalar('select version()')}`);
  console.log('SQL target: PostgreSQL 15. PGlite tests execution/RLS, not hosted Auth or Realtime delivery.');
  assert.equal(createHash('sha256').update(seed).digest('hex'), 'ff24f6e62c54f8c1fc93d761f3472005f90e87af0f3fd93c1335b7d392963a8e', 'Applied seed must remain byte-identical; add a migration instead.');
  assert(/^[\x00-\x7f]*$/.test(storefront), 'WP-14 migration must be ASCII');
  await db.exec(`
    create role anon nologin nosuperuser nobypassrls;
    create role authenticated nologin nosuperuser nobypassrls;
    create role service_role nologin nosuperuser bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text not null unique,
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
    -- Storage metadata shared by commerce and content. There is no hosted file service.
    create schema storage;
    create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, metadata jsonb default '{}', unique (bucket_id, name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select on storage.buckets, storage.objects to anon, authenticated;
    grant insert, update, delete on storage.objects to authenticated;
    -- Model Supabase's permissive defaults; the migration must revoke them.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  `);
  await db.exec(`
    insert into storage.buckets(id, name) values ('fixture-other', 'fixture-other');
    create policy fixture_other_read on storage.objects for select to authenticated using (bucket_id = 'fixture-other');
  `);
  assert(/^[\x00-\x7f]*$/.test(commerce), 'Commerce migration must be ASCII');
  await db.exec(review);
  await db.exec(`insert into public.review_notes(project, kind, route, page_title, body, author_id, author_name, author_kind)
    values ('fixture', 'page', '/', 'Fixture', 'Preserve the existing review', 'fixture', 'Fixture reviewer', 'designer');`);
  const oldReview = await reviewSnapshot();
  for (let run = 1; run <= 2; run++) {
    await db.exec(schema);
    await db.exec(seed);
    await db.exec(partnerPolicy);
    await db.exec(storefront);
    if (run === 1) {
      await db.exec("update public.lots set tested_at = '2026-08-01T23:30:00-05:00' where lot = 'TM-RET10-2609-01'");
    }
    await db.exec(contentSQL);
    assert.equal(await scalar("select tested_at::text from public.lots where lot = 'TM-RET10-2609-01'"), '2026-08-02');
    await db.exec(commerce);
    await db.exec(assistant);
    await db.exec(accounts);
    await db.exec(liveSaves);
    await db.exec(teamSQL);
    pass(`all ten migrations pass ${run} in production order`);
  }
  assert.deepEqual(await reviewSnapshot(), oldReview);
  const initial = await snapshot();
  for (const table of tables.filter((table) => !['products', 'lots', 'shipping_methods', 'discounts', 'settings', 'articles', 'categories'].includes(table))) {
    assert.equal(initial[table].length, 0, `Live seed must not create ${table}`);
  }
  assert.equal(initial.products.length, seedData.products.length);
  assert.equal(initial.lots.length, seedData.products.length);
  assert.equal(initial.shipping_methods.length, seedData.shippingMethods.length);
  assert.equal(initial.discounts.length, 2);
  assert.equal(initial.settings.length, 1);
  assert.deepEqual((await anon('select id, free_shipping_threshold, free_shipping_method, insurance_mode, insurance_rate from public.settings'))[0],
    { id: true, free_shipping_threshold: '150.00', free_shipping_method: 'cold-2day', insurance_mode: 'off', insurance_rate: null });
  await assert.rejects(() => db.exec("insert into public.settings(id) values (false)"), (error) => error.code === '23514');
  await assert.rejects(() => db.exec("update public.settings set insurance_mode = 'invalid'"), (error) => error.code === '23514');
  await assert.rejects(() => db.exec("update public.settings set free_shipping_threshold = -1"), (error) => error.code === '23514');
  for (const { row } of initial.products) {
    const expected = seedData.products.find((p) => p.id === row.id);
    assert(expected, `Unknown product ${row.id}`);
    assert.equal(row.category, expected.category);
    assert.equal(Number(row.price), expected.price);
    assert.equal(row.color, expected.color);
    assert.equal(row.image, expected.image);
    assert.equal(row.lot, expected.lot);
  }
  for (const { row } of initial.shipping_methods) {
    const expected = seedData.shippingMethods.find((method) => method.id === row.id);
    assert.equal(row.detail, expected.detail);
    assert.equal(row.label, expected.label);
    assert.equal(Number(row.price), expected.price);
  }
  checks.classes_match_table = true;
  checks.settings_table = true;
  pass('WP-14 singleton settings defaults/checks/public read, exact source classes and qualified shipping details; prices/artwork/lots preserved');
  assert.equal(contentSQL, replaceJournalSeed(contentSQL, journalSeed), 'Journal seed has drifted');
  assert.equal(initial.articles.length, 7);
  for (const source of journalSeed) {
    const stored = initial.articles.find(({ row }) => row.slug === source.slug).row;
    for (const [key, value] of Object.entries(source)) {
      if (key === 'published_at') assert.equal(Date.parse(stored[key]), Date.parse(value));
      else assert.equal(stored[key], value, `${source.slug}.${key}`);
    }
  }
  checks.seeded_articles_text_identical = true;
  for (const { row } of initial.lots) {
    assert.deepEqual(row.results, []);
    assert.equal(row.status, 'testing');
    assert.equal(row.units, null);
    assert.equal(row.received_at, null);
    assert(seedData.products.some((p) => p.lot === row.lot && p.id === row.product_id));
  }
  assert(initial.discounts.every(({ row }) => !row.active && row.uses === 0));
  pass('seed contains only source catalog/lots/shipping, disabled promos, settings and client journal posts; review objects preserved');

  const security = await rows(`select relname, relrowsecurity from pg_class
    where relnamespace = 'public'::regnamespace and relname = any($1::text[]) order by relname`, [tables]);
  assert.equal(security.length, tables.length);
  assert(security.every((t) => t.relrowsecurity));
  const expectedFunctions = ['platform_role', 'platform_handle_new_user', 'resolve_code', 'record_visit',
    'place_order', 'advance_order', 'review_application', 'approve_referrals', 'record_payout',
    'lot_lookup', 'mark_notifications_read', 'release_lot', 'reject_lot', 'set_lot_certificate', 'upsert_article', 'delete_article',
    'upsert_product', 'upsert_category', 'update_storefront_settings', 'restore_cancelled_stock', 'approve_partner_application', 'decline_partner_application',
    'set_partner_status', 'create_promo_code', 'set_promo_active', 'set_lot_status',
    'team_members', 'team_invites', 'create_team_invite', 'revoke_team_invite', 'team_invite_preview', 'accept_team_invite', 'set_team_role'];
  const functions = await rows(`select proname, proconfig, prosecdef, proacl::text,
    has_function_privilege('anon', oid, 'EXECUTE') as anon_exec,
    has_function_privilege('authenticated', oid, 'EXECUTE') as auth_exec,
    has_function_privilege('service_role', oid, 'EXECUTE') as service_exec,
    exists (select 1 from aclexplode(proacl) where grantee = 0 and privilege_type = 'EXECUTE') as public_exec
    from pg_proc where pronamespace = 'public'::regnamespace and proname = any($1::text[])`, [expectedFunctions]);
  assert.equal(functions.length, expectedFunctions.length);
  for (const f of functions) {
    assert(f.prosecdef, `${f.proname} must cross the closed table boundary`);
    assert.deepEqual(f.proconfig, ['search_path=public']);
    assert.equal(f.anon_exec, ['resolve_code', 'record_visit', 'lot_lookup', 'team_invite_preview'].includes(f.proname));
    assert.equal(f.auth_exec, !['platform_handle_new_user', 'restore_cancelled_stock'].includes(f.proname));
    assert.equal(f.service_exec, false);
    assert.equal(f.public_exec, false, `${f.proname} still grants PUBLIC execute`);
  }
  assert.deepEqual((await rows("select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename")).map((t) => t.tablename),
    ['notifications', 'order_events', 'orders', 'referrals']);
  const role = (await auth(users.buyerA, 'select current_user, rolsuper, rolbypassrls from pg_roles where rolname = current_user'))[0];
  assert.deepEqual(role, { current_user: 'authenticated', rolsuper: false, rolbypassrls: false });
  pass(`${tables.length} commerce/content/account tables enforce RLS, function ACL/search paths are explicit, four publications exist, tests use a non-bypass role`);

  for (const [name, id] of Object.entries(users)) {
    const metadata = ['buyerA', 'buyerB', 'pending'].includes(name) ? {
      role: 'owner', status: 'verified',
      application: { name: `Fixture ${name}`, email: 'spoofed@fixture.example', role: 'Research scientist',
        institution: `PRIVATE institution ${name}`, institutionType: 'Laboratory', researchArea: 'Fixture research',
        intendedUse: 'Fixture only', attestations: ['research-only'], documents: [], status: 'approved', reviewedBy: users.owner },
    } : {};
    await db.query('insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)', [id, `${name}@fixture.example`, JSON.stringify(metadata)]);
  }
  assert.equal(await scalar("select count(*)::int from public.profiles where role = 'buyer'"), 8);
  assert.equal(await scalar("select count(*)::int from public.buyers where status = 'pending' and verified_at is null"), 3);
  assert.equal(await scalar("select count(*)::int from public.applications where status = 'submitted' and reviewed_by is null"), 3);
  assert.equal(await scalar("select count(*)::int from public.buyers where email = 'spoofed@fixture.example'"), 0);
  for (const name of ['owner', 'staff', 'partnerA', 'partnerB', 'profileOnly']) {
    assert.deepEqual(await rows('select id, role from public.profiles where id = $1', [users[name]]), [{ id: users[name], role: 'buyer' }]);
    assert.equal(await scalar('select count(*)::int from public.buyers where user_id = $1', [users[name]]), 0);
    assert.equal(await scalar('select count(*)::int from public.applications where email = $1', [`${name}@fixture.example`]), 0);
  }
  for (const name of ['owner', 'staff', 'partnerA', 'partnerB']) {
    await db.query('update public.profiles set role = $1 where id = $2', [name.startsWith('partner') ? 'partner' : name, users[name]]);
  }
  const buyers = Object.fromEntries((await rows('select user_id, id from public.buyers')).map((row) => [row.user_id, row.id]));
  const applications = Object.fromEntries((await rows('select buyer_id, id from public.applications')).map((row) => [row.buyer_id, row.id]));
  for (const [name, reviewer] of [['buyerA', 'owner'], ['buyerB', 'staff']]) {
    const reviewed = (await auth(users[reviewer], "select * from public.review_application($1, 'approved', 'Fixture approval')", [applications[buyers[users[name]]]]))[0];
    assert.equal(reviewed.status, 'approved');
    assert.equal(reviewed.reviewed_by, users[reviewer]);
    assert.equal(await scalar('select status from public.buyers where id = $1', [buyers[users[name]]]), 'verified');
  }
  pass('application signups create pending rows atomically; metadata cannot grant roles or verification; owner/staff approval verifies buyers');

  const partners = {};
  for (const [name, code, rate, percent] of [['partnerA', 'FIXTURE10', 0.12, 10], ['partnerB', 'FIXTURE20', 0.1, 20]]) {
    partners[name] = await scalar(`insert into public.partners(user_id, name, email, code, rate, status)
      values ($1, $2, $3, $4, $5, 'active') returning id`, [users[name], `Fixture ${name}`, `${name}@fixture.example`, code, rate]);
    await db.query("insert into public.discounts(code, kind, percent, partner_id, active) values ($1, 'partner', $2, $3, true)", [code, percent, partners[name]]);
  }
  const address = { label: 'Laboratory', institution: 'PRIVATE institution buyerA', attention: 'PRIVATE recipient',
    line1: '1 Fixture Way', city: 'Fixture City', region: 'XX', postal: '00000', country: 'US' };
  const addresses = {};
  for (const name of ['buyerA', 'buyerB']) {
    addresses[name] = (await auth(users[name], `insert into public.addresses(buyer_id, institution, attention, line1, city, region, postal, country)
      values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`, [buyers[users[name]], address.institution, address.attention,
      address.line1, address.city, address.region, address.postal, address.country]))[0].id;
  }
  const draft = {
    lines: [{ productId: 'retatrutide-10-mg', quantity: 2, unitPrice: 0.01, lot: 'SPOOFED' },
      { productId: 'bpc-157-10-mg', quantity: 3, unitPrice: 0.01 }],
    address: { ...address, id: addresses.buyerA, injected: 'discard me' }, shipping: 'cold-2day',
    discountCode: ' fixture10 ', via: 'link', buyerId: buyers[users.buyerB],
    subtotal: 0.01, total: 0.01, shippingPrice: 0, discountAmount: 99999,
    payment: 'captured', commission: 99999, number: 'TM-SPOOFED',
  };
  const place = (user, value = draft) => auth(user, 'select * from public.place_order($1::jsonb)', [JSON.stringify(value)]);
  const orderA = (await place(users.buyerA))[0];
  const orderB = (await place(users.buyerB, { ...draft, discountCode: 'FIXTURE20', via: 'code', address: { ...address, id: addresses.buyerB } }))[0];
  assert.equal(orderA.number, 'TM-10500');
  assert.equal(orderB.number, 'TM-10501');
  assert.equal(orderA.buyer_id, buyers[users.buyerA]);
  assert.equal(orderA.payment, 'authorized');
  assert.equal(orderA.status, 'placed');
  assert.equal(Number(orderA.subtotal), 220);
  assert.equal(Number(orderA.discount_amount), 22);
  assert.equal(Number(orderA.shipping_price), 0);
  assert.equal(Number(orderA.total), 198);
  assert.equal(orderA.address.injected, undefined);
  const lines = await auth(users.buyerA, 'select * from public.order_lines order by product_id');
  assert.deepEqual(lines.map((line) => [line.product_id, line.quantity, Number(line.unit_price), line.lot]),
    [['bpc-157-10-mg', 3, 40, 'TM-BPC10-2609-01'], ['retatrutide-10-mg', 2, 50, 'TM-RET10-2609-01']]);
  const referralA = (await rows('select * from public.referrals where order_id = $1', [orderA.id]))[0];
  assert.equal(Number(referralA.order_subtotal), 198);
  assert.equal(Number(referralA.commission), 23.76);
  assert.equal(referralA.via, 'link');
  assert.equal(referralA.status, 'pending');
  assert.equal(await scalar('select uses::int from public.discounts where code = $1', ['FIXTURE10']), 1);
  assert.equal(await scalar('select count(*)::int from public.order_events where order_id = $1', [orderA.id]), 1);
  assert.equal(await scalar('select count(*)::int from public.notifications where title like $1 or body like $1', [`%${orderA.number}%`]), 3);
  checks.price_server_side = true;
  pass('TM-10500 sequence, prices/lot/shipping/discount/commission are server-side; authorized order, lines, event, referral and three notices created');

  for (const [name, order] of [['buyerA', orderA], ['buyerB', orderB]]) {
    assert.deepEqual((await auth(users[name], 'select id from public.buyers')).map((b) => b.id), [buyers[users[name]]]);
    assert.deepEqual((await auth(users[name], 'select id from public.orders')).map((o) => o.id), [order.id]);
    assert.equal((await auth(users[name], 'select * from public.order_lines')).length, 2);
    assert.equal((await auth(users[name], 'select * from public.order_events')).length, 1);
    assert.equal((await auth(users[name], 'select * from public.applications')).length, 1);
    assert.deepEqual((await auth(users[name], 'select id from public.addresses')).map((a) => a.id), [addresses[name]]);
    assert((await auth(users[name], 'select * from public.notifications')).every((n) => n.audience === `buyer:${buyers[users[name]]}`));
    for (const table of ['partners', 'referrals', 'payouts', 'visits', 'discounts']) assert.equal((await auth(users[name], `select * from public.${table}`)).length, 0);
  }
  assert.equal((await auth(users.buyerA, 'select * from public.orders where id = $1 or number = $2', [orderB.id, orderB.number])).length, 0);
  assert.equal((await auth(users.buyerA, 'update public.addresses set label = $1 where id = $2 returning id', ['Foreign edit', addresses.buyerB])).length, 0);
  await denied('authenticated', users.buyerA, 'update public.addresses set buyer_id = $1 where id = $2', [buyers[users.buyerB], addresses.buyerA]);
  await denied('authenticated', users.buyerA, `insert into public.addresses(buyer_id, institution, attention, line1, city, region, postal, country)
    select $1, 'x', 'x', 'x', 'x', 'x', 'x', 'x'`, [buyers[users.buyerB]]);
  assert.equal((await auth(users.buyerA, 'update public.addresses set label = $1 where id = $2 returning id', ['Updated', addresses.buyerA])).length, 1);
  assert.equal((await auth(users.buyerA, 'delete from public.addresses where id = $1 returning id', [addresses.buyerA])).length, 1);
  assert.equal((await auth(users.buyerA, 'select address from public.orders where id = $1', [orderA.id]))[0].address.id, addresses.buyerA);
  checks.rls_buyer_isolation = true;
  pass('buyers see only their own rows; own address CRUD works, cross-buyer reads/writes fail, order address snapshots survive deletion');

  for (const [name, order] of [['partnerA', orderA], ['partnerB', orderB]]) {
    const referral = await auth(users[name], 'select * from public.referrals');
    assert.equal(referral.length, 1);
    assert.equal(referral[0].order_id, order.id);
    assert.equal(referral[0].partner_id, partners[name]);
    assert.deepEqual((await auth(users[name], 'select id from public.partners')).map((p) => p.id), [partners[name]]);
    for (const table of ['buyers', 'addresses', 'applications', 'orders', 'order_lines', 'order_events']) {
      assert.equal((await auth(users[name], `select * from public.${table}`)).length, 0, `${name} leaked ${table}`);
    }
    const joined = await auth(users[name], `select r.id, to_jsonb(o) as order_row, to_jsonb(b) as buyer_row from public.referrals r
      left join public.orders o on o.id = r.order_id left join public.buyers b on b.id = o.buyer_id`);
    assert(joined.every((r) => r.order_row === null && r.buyer_row === null));
    const notices = await auth(users[name], 'select * from public.notifications');
    assert.equal(notices.length, 1);
    assert(notices.every((n) => n.audience === `partner:${partners[name]}`));
    const exposed = JSON.stringify([...referral, ...notices]);
    for (const privateValue of ['PRIVATE', 'buyerA@fixture.example', 'buyerB@fixture.example', buyers[users.buyerA], buyers[users.buyerB]]) {
      assert(!exposed.includes(privateValue), `Partner output leaked ${privateValue}`);
    }
  }
  for (const status of ['active', 'pending', 'paused']) {
    await db.query('update public.partners set status = $1 where id = $2', [status, partners.partnerA]);
    const own = await auth(users.partnerA, 'select * from public.discounts');
    assert.equal(own.length, 1);
    assert.equal(own[0].partner_id, partners.partnerA);
    assert.equal((await auth(users.partnerA, 'select * from public.discounts where partner_id = $1', [partners.partnerB])).length, 0);
    assert.equal((await auth(users.buyerA, 'select * from public.discounts')).length, 0);
  }
  await db.query("update public.partners set status = 'active' where id = $1", [partners.partnerA]);
  checks.partner_discount_policy = true;
  pass('partner discount policy: own row in every status, no other partner row, no buyer access');
  checks.rls_partner_no_buyer_identity = true;
  pass('each partner sees its own referral and notification; buyer/order joins are empty and payloads contain no buyer identity');

  const originalNotices = await rows('select * from public.notifications order by id');
  const noticeFor = (audience) => originalNotices.find((notice) => notice.audience === audience).id;
  const buyerNoticeA = noticeFor(`buyer:${buyers[users.buyerA]}`);
  const buyerNoticeB = noticeFor(`buyer:${buyers[users.buyerB]}`);
  const partnerNoticeA = noticeFor(`partner:${partners.partnerA}`);
  const partnerNoticeB = noticeFor(`partner:${partners.partnerB}`);
  const ownerNotices = originalNotices.filter((notice) => notice.audience === 'owner').map((notice) => notice.id);
  const allNoticeIds = originalNotices.map((notice) => notice.id);
  const markReadSql = 'select public.mark_notifications_read($1::uuid[]) as changed';
  const markRead = async (user, ids) => (await auth(user, markReadSql, [ids]))[0].changed;
  assert(originalNotices.every((notice) => !notice.read));
  assert.equal(await markRead(users.buyerA, [buyerNoticeA, buyerNoticeA]), 1);
  assert.equal(await markRead(users.buyerA, [buyerNoticeA]), 0, 'Already-read alerts must not count as changed');
  assert.equal(await markRead(users.buyerA, [buyerNoticeB]), 0);
  assert.equal(await markRead(users.partnerA, [...ownerNotices, buyerNoticeB, partnerNoticeB]), 0);
  await denied('anon', null, markReadSql, [[buyerNoticeB]]);
  await denied('authenticated', null, markReadSql, [[buyerNoticeB]]);
  assert.equal(await markRead(users.owner, [ownerNotices[0], buyerNoticeB, partnerNoticeB]), 1);
  assert.equal(await markRead(users.staff, allNoticeIds), 1, 'Staff may mark only the remaining owner alert');
  assert.equal(await markRead(users.partnerA, allNoticeIds), 1, 'Partner may mark only its own alert');
  assert.equal(await markRead(users.buyerA, allNoticeIds), 0);
  assert.equal(await markRead(users.profileOnly, allNoticeIds), 0);
  for (const ids of [[], null, ['00000000-0000-4000-8000-000000000098']]) {
    assert.equal(await markRead(users.buyerB, ids), 0);
  }
  const changedNotices = new Set([buyerNoticeA, partnerNoticeA, ...ownerNotices]);
  assert.deepEqual(await rows('select * from public.notifications order by id'),
    originalNotices.map((notice) => ({ ...notice, read: changedNotices.has(notice.id) })));
  await denied('authenticated', users.buyerA, 'update public.notifications set read = true where id = $1', [buyerNoticeA]);
  checks.mark_read_scoped = true;
  pass('mark-read counts actual changes, scopes every role to its own audience, denies anon, and leaves foreign alerts/direct-write restrictions intact');

  await denied('authenticated', users.profileOnly, 'select * from public.place_order($1::jsonb)', [JSON.stringify(draft)]);
  assert.deepEqual(await auth(users.profileOnly, 'select id, role from public.profiles'), [{ id: users.profileOnly, role: 'buyer' }]);
  assert.equal((await auth(users.profileOnly, 'select * from public.buyers')).length, 0);
  assert.equal((await auth(users.profileOnly, 'select * from public.applications')).length, 0);
  checks.profile_only_without_application = true;
  pass('empty auth metadata creates only a buyer-role profile, no buyer/application rows; profile-only users cannot order');

  await denied('authenticated', users.pending, 'select * from public.place_order($1::jsonb)', [JSON.stringify(draft)], '42501', {
    app_metadata: { role: 'owner' }, user_metadata: { role: 'owner', status: 'verified' },
  });
  for (const name of ['owner', 'staff', 'partnerA']) await denied('authenticated', users[name], 'select * from public.place_order($1::jsonb)', [JSON.stringify(draft)]);
  await denied('authenticated', null, 'select * from public.place_order($1::jsonb)', [JSON.stringify(draft)]);
  assert.equal((await auth(users.pending, 'select * from public.orders')).length, 0);
  await denied('authenticated', users.pending, "update public.profiles set role = 'owner' where id = $1", [users.pending]);
  await denied('authenticated', users.pending, "update public.buyers set status = 'verified' where user_id = $1", [users.pending]);
  await denied('authenticated', users.pending, "select * from public.review_application($1, 'approved')", [applications[buyers[users.pending]]]);
  checks.pending_buyer_refused = true;
  pass('pending, missing and non-buyer identities cannot order or self-promote, including forged JWT metadata');

  for (const name of ['owner', 'staff', 'buyerA', 'partnerA']) {
    for (const table of tables.filter((t) => t !== 'addresses')) {
      await denied('authenticated', users[name], `insert into public.${table} default values`);
      assert.equal((await auth(users[name], 'select has_table_privilege(current_user, $1, $2) as allowed', [`public.${table}`, 'INSERT,UPDATE,DELETE,TRUNCATE']))[0].allowed, false);
    }
  }
  await denied('authenticated', users.buyerA, "select nextval('public.platform_order_number_seq')");
  assert.equal((await auth(users.owner, "update public.addresses set label = 'Team cannot write' returning id")).length, 0);
  for (const name of ['owner', 'staff']) {
    for (const table of tables.filter((t) => t !== 'team_invites')) assert.equal((await auth(users[name], `select count(*)::int as n from public.${table}`))[0].n,
      await scalar(`select count(*)::int from public.${table}`), `${name} cannot read all ${table}`);
  }
  pass('owner/staff read operational tables; invite hashes remain RPC-only; direct writes and sequence use remain refused to every client role except own address CRUD');

  for (const name of ['buyerA', 'partnerA', 'pending']) {
    await denied('authenticated', users[name], "select * from public.advance_order($1, 'paid')", [orderA.id]);
    await denied('authenticated', users[name], 'select public.approve_referrals(current_date + 1)');
    await denied('authenticated', users[name], "select * from public.record_payout($1, current_date, current_date, 'Fixture transfer')", [partners.partnerA]);
  }
  await denied('authenticated', users.staff, 'select public.approve_referrals(current_date + 1)');
  await denied('authenticated', users.staff, "select * from public.record_payout($1, current_date, current_date, 'Fixture transfer')", [partners.partnerA]);
  assert.equal((await auth(users.owner, 'select public.approve_referrals(current_date + 1) as n'))[0].n, 0, 'Authorized payments cannot earn approved commissions');
  for (const [status, user] of [['paid', users.owner], ['packed', users.staff], ['shipped', users.owner], ['delivered', users.owner]]) {
    const changed = (await auth(user, 'select * from public.advance_order($1, $2, $3, $4, $5)', [orderA.id, status,
      status === 'shipped' ? 'Fixture Carrier' : null, status === 'shipped' ? 'FIXTURE-TRACKING' : null, 'Fixture event note']))[0];
    assert.equal(changed.status, status);
    assert.equal(changed.payment, 'captured');
  }
  const delivered = (await auth(users.buyerA, 'select * from public.orders where id = $1', [orderA.id]))[0];
  assert.equal(delivered.carrier, 'Fixture Carrier');
  assert.equal(delivered.tracking, 'FIXTURE-TRACKING');
  const eventCount = await scalar('select count(*)::int from public.order_events where order_id = $1', [orderA.id]);
  await auth(users.owner, "select * from public.advance_order($1, 'delivered')", [orderA.id]);
  assert.equal(await scalar('select count(*)::int from public.order_events where order_id = $1', [orderA.id]), eventCount);
  await denied('authenticated', users.owner, "select * from public.advance_order($1, 'paid')", [orderA.id], '22023');
  assert.deepEqual((await auth(users.buyerA, 'select kind from public.notifications order by kind')).map((n) => n.kind),
    ['order.delivered', 'order.packed', 'order.paid', 'order.placed', 'order.shipped']);
  checks.owner_can_advance = true;
  pass('owner/staff advance with capture, tracking, events and buyer notices; retries are idempotent and backward/unauthorized transitions fail');

  await db.exec(`
    insert into public.shipping_methods values ('fixture-inactive', 'Fixture', 'Fixture', 1, false);
    insert into public.products(id, name, size, category, price, form, lot, active)
      values ('fixture-inactive', 'Fixture', 'Fixture', 'peptide-fragments', 1, 'Fixture', 'FIXTURE-INACTIVE', false);
    insert into public.lots(lot, product_id, status, results, reference, released_at) values
      ('FIXTURE-RELEASED', 'retatrutide-10-mg', 'released', '[{"label":"Fixture","method":"Fixture","value":"Fixture","unit":""}]', 'FIXTURE-COA', '2026-10-01T12:00:00Z'),
      ('FIXTURE-EMPTY', 'retatrutide-10-mg', 'released', '[]', null, null),
      ('FIXTURE-TESTING', 'retatrutide-10-mg', 'testing', '[{"label":"Not released"}]', 'PRIVATE-TESTING-REFERENCE', null),
      ('FIXTURE-QUARANTINE', 'retatrutide-10-mg', 'quarantine', '[{"label":"Not released"}]', 'PRIVATE-QUARANTINE-REFERENCE', null),
      ('FIXTURE-REJECTED', 'retatrutide-10-mg', 'rejected', '[{"label":"Rejected"}]', 'PRIVATE-REJECTED-REFERENCE', null),
      ('FIXTURE-ARCHIVED', 'retatrutide-10-mg', 'archived', '[{"label":"Archived"}]', 'PRIVATE-ARCHIVED-REFERENCE', null);
    insert into public.discounts(code, kind, percent, active, expires_at)
      values ('FIXTUREEXPIRED', 'promo', 99, true, now() - interval '1 day');
  `);
  assert.equal((await anon('select * from public.products')).length, seedData.products.length);
  assert.equal((await anon('select * from public.shipping_methods')).length, seedData.shippingMethods.length);
  assert.deepEqual((await anon('select lot from public.lots')).map((l) => l.lot), ['FIXTURE-RELEASED']);
  for (const lookup of [anon, (sql, params) => auth(users.buyerA, sql, params)]) {
    const lookupSql = 'select public.lot_lookup($1) as result';
    for (const [input, lot, status] of [
      [' \t fiXTURe - tEsTinG \n ', 'FIXTURE-TESTING', 'testing'],
      [' fixture-quarantine ', 'FIXTURE-QUARANTINE', 'quarantine'],
    ]) {
      assert.deepEqual((await lookup(lookupSql, [input]))[0].result,
        { lot, productId: 'retatrutide-10-mg', status, releasedAt: null, testedAt: null, coaUrl: null, reference: null, results: [] });
    }
    const released = (await lookup(lookupSql, [' fixture-released ']))[0].result;
    assert.equal(Date.parse(released.releasedAt), Date.parse('2026-10-01T12:00:00Z'));
    assert.deepEqual(released, {
      lot: 'FIXTURE-RELEASED', productId: 'retatrutide-10-mg', status: 'released', releasedAt: released.releasedAt,
      testedAt: null, coaUrl: null, reference: 'FIXTURE-COA', results: [{ label: 'Fixture', method: 'Fixture', value: 'Fixture', unit: '' }],
    });
    assert.deepEqual((await lookup(lookupSql, ['FIXTURE-EMPTY']))[0].result, {
      lot: 'FIXTURE-EMPTY', productId: 'retatrutide-10-mg', status: 'released', releasedAt: null, testedAt: null, coaUrl: null, reference: null, results: [],
    });
    for (const lot of ['FIXTURE-REJECTED', 'FIXTURE-ARCHIVED', 'UNKNOWN', '', null]) {
      assert.equal((await lookup(lookupSql, [lot]))[0].result, null);
    }
  }
  checks.lot_lookup_no_early_results = true;
  pass('anon/authenticated lot lookup normalizes case/whitespace, masks early results/references, returns released evidence and hides rejected/archived/unknown lots');
  for (const table of tables.filter((t) => !publicTables.includes(t))) await denied('anon', null, `select * from public.${table}`);
  for (const table of tables) await denied('anon', null, `insert into public.${table} default values`);
  await denied('anon', null, 'select * from public.review_notes');
  await denied('anon', null, 'select * from public.review_access');
  await denied('anon', null, 'select * from public.place_order($1::jsonb)', [JSON.stringify(draft)]);
  await denied('anon', null, "select * from public.advance_order($1, 'paid')", [orderA.id]);
  assert.deepEqual((await anon("select public.resolve_code(' fixture10 ') as result"))[0].result, { percent: 10, partnerName: 'Fixture partnerA' });
  for (const code of ['FIRSTLOT', 'WELCOME5', 'UNKNOWN', 'FIXTUREEXPIRED']) {
    assert.equal((await anon('select public.resolve_code($1) as result', [code]))[0].result, null);
  }
  await db.query("update public.partners set status = 'paused' where id = $1", [partners.partnerB]);
  assert.equal((await anon("select public.resolve_code('FIXTURE20') as result"))[0].result, null);
  await anon("select public.record_visit('FIXTURE20')");
  assert.equal(await scalar('select count(*)::int from public.visits'), 0);
  await db.query("update public.partners set status = 'active' where id = $1", [partners.partnerB]);
  for (const code of [' fixture10 ', 'FIXTURE10', 'FIXTURE20', 'UNKNOWN', 'FIRSTLOT']) await anon('select public.record_visit($1)', [code]);
  assert.equal((await auth(users.partnerA, 'select * from public.visits'))[0].clicks, 2);
  assert.equal((await auth(users.partnerB, 'select * from public.visits'))[0].clicks, 1);
  assert.equal(await scalar('select count(*)::int from public.visits'), 2);
  checks.anon_public_only = true;
  pass('anon reads active products/shipping and released nonempty results only; public code resolution is minimal, visit upsert is scoped');

  for (const bad of [
    null, {}, { ...draft, lines: [] }, { ...draft, lines: [{ productId: 'retatrutide-10-mg', quantity: -1 }] },
    { ...draft, lines: [{ productId: 'retatrutide-10-mg', quantity: 1.5 }] },
    { ...draft, lines: [{ productId: 'retatrutide-10-mg', quantity: '2' }] },
    { ...draft, lines: [{ productId: 'retatrutide-10-mg', quantity: 10001 }] },
    { ...draft, lines: [draft.lines[0], draft.lines[0]] },
    { ...draft, lines: [{ productId: 'missing', quantity: 1 }] },
    { ...draft, lines: [{ productId: 'fixture-inactive', quantity: 1 }] },
    { ...draft, address: {} }, { ...draft, shipping: 'missing' }, { ...draft, shipping: 'fixture-inactive' },
    { ...draft, discountCode: 'FIRSTLOT' }, { ...draft, discountCode: 'FIXTUREEXPIRED' }, { ...draft, via: 'spoofed' },
  ]) await denied('authenticated', users.buyerA, 'select * from public.place_order($1::jsonb)', [JSON.stringify(bad)], '22023');
  // Exercise actual late failure, after order/lines/event/referral writes. Sequence
  // gaps are normal PostgreSQL semantics; all transactional rows must roll back.
  const beforeFailure = await snapshot();
  await db.exec(`create function public.fixture_fail_notice() returns trigger language plpgsql set search_path = public as $$
    begin if new.audience like 'partner:%' then raise exception 'fixture late failure' using errcode = '23514'; end if; return new; end; $$;
    create trigger fixture_fail_notice before insert on public.notifications for each row execute function public.fixture_fail_notice();`);
  try {
    await denied('authenticated', users.buyerA, 'select * from public.place_order($1::jsonb)', [JSON.stringify(draft)], '23514');
  } finally {
    await db.exec('drop trigger fixture_fail_notice on public.notifications; drop function public.fixture_fail_notice();');
  }
  assert.deepEqual(await snapshot(), beforeFailure);
  await assert.rejects(() => db.query('insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)',
    ['00000000-0000-4000-8000-000000000099', 'invalid@fixture.example', '{"application":{"attestations":{}}}']), { code: '23514' });
  assert.equal(await scalar("select count(*)::int from auth.users where email = 'invalid@fixture.example'"), 0);
  assert.deepEqual(await snapshot(), beforeFailure);
  pass('invalid inputs are refused; injected late checkout failure and invalid signup roll back every transactional row');

  assert.equal((await auth(users.owner, 'select public.approve_referrals(current_date) as n'))[0].n, 0);
  assert.equal((await auth(users.owner, 'select public.approve_referrals(current_date + 1) as n'))[0].n, 1);
  assert.equal((await auth(users.owner, 'select public.approve_referrals(current_date + 1) as n'))[0].n, 0);
  const approved = (await auth(users.partnerA, 'select * from public.referrals'))[0];
  assert.equal(approved.status, 'approved');
  assert.equal(approved.approved_by, users.owner);
  assert(approved.approved_at);
  const payout = (await auth(users.owner, "select * from public.record_payout($1, current_date, current_date, 'Fixture transfer', 'Fixture audit note')", [partners.partnerA]))[0];
  assert.equal(Number(payout.amount), 23.76);
  assert.equal(payout.referrals, 1);
  assert.equal(payout.created_by, users.owner);
  assert.equal(payout.status, 'paid');
  assert.equal((await auth(users.partnerA, 'select * from public.referrals'))[0].payout_id, payout.id);
  assert.equal((await auth(users.partnerA, 'select * from public.referrals'))[0].status, 'paid');
  assert.equal((await auth(users.partnerA, 'select * from public.payouts')).length, 1);
  assert.equal((await auth(users.partnerB, 'select * from public.payouts')).length, 0);
  await denied('authenticated', users.owner, "select * from public.record_payout($1, current_date, current_date, 'Fixture transfer')", [partners.partnerA], '22023');
  const cancelled = (await auth(users.owner, "select * from public.advance_order($1, 'cancelled')", [orderB.id]))[0];
  assert.equal(cancelled.payment, 'failed');
  assert.equal((await auth(users.partnerB, 'select * from public.referrals'))[0].status, 'void');
  assert.equal((await auth(users.owner, 'select public.approve_referrals(current_date + 1) as n'))[0].n, 0);
  assert.equal((await auth(users.partnerA, "select * from public.notifications where kind in ('commission.approved', 'payout.sent')")).length, 2);
  pass('owner-only approval cutoff and payouts derive/audit exact amounts, reject double payment, preserve partner isolation, void cancelled referrals');

  // Threshold boundary fixtures live only in a rolled-back local transaction.
  const beforeShipping = await snapshot();
  await assert.rejects(() => db.transaction(async (tx) => {
    for (const [price, base] of [[166.66, 149.99], [166.67, 150], [166.68, 150.01]]) {
      await tx.query("update public.products set price = $1 where id = 'retatrutide-10-mg'", [price]);
      for (const method of ['cold-2day', 'cold-overnight']) {
        await tx.exec('set local role authenticated');
        await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: users.buyerA, role: 'authenticated' })]);
        const placed = (await tx.query('select * from public.place_order($1::jsonb)', [JSON.stringify({ ...draft,
          lines: [{ productId: 'retatrutide-10-mg', quantity: 1, unitPrice: 0 }], shipping: method,
          freeShippingThreshold: 0, shippingPrice: 0 })])).rows[0];
        assert.equal(Math.round((Number(placed.subtotal) - Number(placed.discount_amount)) * 100) / 100, base);
        const shipping = method === 'cold-overnight' ? 42 : base >= 150 ? 0 : 24;
        assert.equal(Number(placed.shipping_price), shipping);
        assert.equal(Number(placed.total), Math.round((base + shipping) * 100) / 100);
        await tx.exec('reset role');
      }
    }
    for (const threshold of [null, 200, 0]) {
      await tx.query('update public.settings set free_shipping_threshold = $1', [threshold]);
      await tx.exec('set local role authenticated');
      const placed = (await tx.query('select * from public.place_order($1::jsonb)', [JSON.stringify({ ...draft,
        lines: [{ productId: 'retatrutide-10-mg', quantity: 1 }], shipping: 'cold-2day' })])).rows[0];
      assert.equal(Number(placed.shipping_price), threshold === 0 ? 0 : 24);
      await tx.exec('reset role');
    }
    throw new Error('ROLLBACK_SHIPPING_FIXTURES');
  }), /ROLLBACK_SHIPPING_FIXTURES/);
  assert.deepEqual(await snapshot(), beforeShipping);
  checks.free_shipping_rule = true;
  pass('place_order after-discount boundaries $149.99/$150/$150.01, overnight price, off/custom/zero thresholds and forged client values; fixtures rolled back');

  // WP-16: the metadata stub proves policy behavior, not hosted uploads or limits.
  assert.deepEqual(await rows("select id, public, file_size_limit::int, allowed_mime_types from storage.buckets where id in ('catalog', 'certificates', 'journal') order by id"), [
    { id: 'catalog', public: true, file_size_limit: 5242880, allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'] },
    { id: 'certificates', public: true, file_size_limit: 10485760, allowed_mime_types: ['application/pdf'] },
    { id: 'journal', public: true, file_size_limit: 5242880, allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'] },
  ]);
  for (const user of [users.buyerA, users.partnerA, users.pending, users.profileOnly]) {
    for (const bucket of ['certificates', 'journal']) await denied('authenticated', user,
      'insert into storage.objects(bucket_id,name) values ($1,$2)', [bucket, 'denied.pdf']);
  }
  await denied('anon', null, "insert into storage.objects(bucket_id,name) values ('certificates','denied.pdf')");
  for (const user of [users.owner, users.staff]) {
    await denied('authenticated', user, "insert into storage.objects(bucket_id,name) values ('fixture-other','denied.pdf')");
    await auth(user, "insert into storage.objects(bucket_id,name) values ('journal',$1)", [`${user}.png`]);
    assert.equal((await auth(user, "update storage.objects set metadata = '{\"fixture\":true}' where bucket_id='journal' and name=$1 returning id", [`${user}.png`])).length, 1);
    await denied('authenticated', user, "update storage.objects set bucket_id = 'fixture-other' where bucket_id='journal' and name=$1", [`${user}.png`]);
  }
  assert.equal((await auth(users.buyerA, "update storage.objects set metadata='{}' returning id")).length, 0);
  assert.equal((await auth(users.partnerA, 'delete from storage.objects returning id')).length, 0);
  assert.equal((await anon('select * from storage.objects')).length, 2);
  assert.equal((await auth(users.staff, 'delete from storage.objects where name=$1 returning id', [`${users.staff}.png`])).length, 1);
  pass('Storage metadata policies scope reads and team writes to both buckets; configured MIME/size limits match the brief (hosted uploads not run)');

  const fixtureResults = [
    { label: 'Purity', method: 'HPLC', value: '99.0', unit: '%' },
    { label: 'Identity', method: 'Mass spectrometry', value: 'Confirmed', unit: '' },
    { label: 'Sterility', method: '', value: 'Pass', unit: '' },
  ];
  const releaseSQL = 'select * from public.release_lot($1,$2::jsonb,$3,$4::date,$5)';
  const releaseArgs = ['FIXTURE-TESTING', JSON.stringify(fixtureResults), 'FIXTURE-REFERENCE', '2026-09-29', 'FIXTURE-TESTING.pdf'];
  for (const user of [users.buyerA, users.partnerA, users.profileOnly]) {
    await denied('authenticated', user, releaseSQL, releaseArgs);
    await denied('authenticated', user, 'select public.reject_lot($1,$2)', ['FIXTURE-TESTING', 'Fixture rejection']);
    await denied('authenticated', user, 'select * from public.set_lot_certificate($1,$2)', ['FIXTURE-RELEASED', 'FIXTURE-RELEASED.pdf']);
    await denied('authenticated', user, 'select public.upsert_article($1::jsonb)', ['{}']);
    await denied('authenticated', user, 'select public.delete_article($1)', [users.owner]);
  }
  await denied('anon', null, releaseSQL, releaseArgs);
  await denied('anon', null, 'select public.reject_lot($1,$2)', ['FIXTURE-TESTING', 'Fixture rejection']);
  await denied('anon', null, 'select public.upsert_article($1::jsonb)', ['{}']);
  await denied('anon', null, 'select public.delete_article($1)', [users.owner]);
  await denied('anon', null, "select public.set_lot_certificate('FIXTURE-TESTING', 'FIXTURE-TESTING.pdf')");
  await denied('authenticated', users.owner, releaseSQL, releaseArgs, '22023'); // No upload yet.
  await auth(users.owner, "insert into storage.objects(bucket_id,name) values ('certificates','FIXTURE-TESTING.pdf')");
  const beforeRelease = await rows("select * from public.lots where lot='FIXTURE-TESTING'");
  for (const bad of [null, {}, [], [{ label: 'Only label' }], [{ ...fixtureResults[0], unit: 3 }], [{ ...fixtureResults[0], extra: 'No' }]]) {
    await denied('authenticated', users.owner, releaseSQL, [releaseArgs[0], JSON.stringify(bad), ...releaseArgs.slice(2)], '22023');
  }
  for (const bad of [
    ...['98.9', 'NaN', 'Infinity', '99%', 'not measured'].map((value) => [{ ...fixtureResults[0], value }, ...fixtureResults.slice(1)]),
    [fixtureResults[0], { ...fixtureResults[1], value: 'Not confirmed' }],
    [fixtureResults[0], { ...fixtureResults[1], method: 'Unrelated test' }],
    [fixtureResults[0]], fixtureResults.slice(1),
    [...fixtureResults, { ...fixtureResults[0], value: '98.9' }],
    [...fixtureResults, { ...fixtureResults[1], value: 'Not confirmed' }],
  ]) {
    await denied('authenticated', users.owner, releaseSQL, [releaseArgs[0], JSON.stringify(bad), ...releaseArgs.slice(2)], '22023');
  }
  assert.deepEqual(await rows("select * from public.lots where lot='FIXTURE-TESTING'"), beforeRelease);
  const releasedLot = (await auth(users.staff, releaseSQL, releaseArgs))[0];
  assert.equal(releasedLot.status, 'released'); assert(releasedLot.released_at);
  assert.equal(releasedLot.tested_at.toISOString().slice(0, 10), '2026-09-29'); assert.equal(releasedLot.reference, 'FIXTURE-REFERENCE');
  assert.deepEqual(releasedLot.results, fixtureResults);
  checks.release_gate = true;
  // These ten migrations end before WP-28, whose 20261006000000_certificates.sql replaces this gate with the
  // certificates' own specification (95.0%, identity conforms); scripts/validate-certificates-sql.mjs proves it.
  pass('WP-16 release gate (superseded by WP-28) refuses 98.9%, non-numeric/missing HPLC, unconfirmed/missing MS and contradictory duplicates; 99.0% with Confirmed releases');
  const releasedLookup = (await anon("select public.lot_lookup(' fixture-testing ') as result"))[0].result;
  assert.equal(releasedLookup.coaUrl, 'https://gydihnfzmuqmbnykaihg.supabase.co/storage/v1/object/public/certificates/FIXTURE-TESTING.pdf');
  assert.equal(releasedLookup.testedAt, '2026-09-29'); assert.deepEqual(releasedLookup.results, fixtureResults);
  await denied('authenticated', users.owner, releaseSQL, releaseArgs, '22023');
  await denied('authenticated', users.owner, releaseSQL, ['FIXTURE-REJECTED', ...releaseArgs.slice(1)], '22023');
  const replacedLot = (await auth(users.owner, 'select * from public.set_lot_certificate($1,$2)', ['FIXTURE-TESTING', 'FIXTURE-TESTING.pdf']))[0];
  assert.equal(replacedLot.released_at.getTime(), releasedLot.released_at.getTime());
  assert.deepEqual(replacedLot.results, fixtureResults);
  await denied('authenticated', users.owner, 'select * from public.set_lot_certificate($1,$2)', ['FIXTURE-QUARANTINE', 'FIXTURE-QUARANTINE.pdf'], '22023');
  await db.exec("update public.lots set coa_path='PRIVATE.pdf' where lot='FIXTURE-QUARANTINE'");
  assert.equal((await anon("select public.lot_lookup('FIXTURE-QUARANTINE') as result"))[0].result.coaUrl, null);
  await auth(users.staff, "insert into storage.objects(bucket_id,name) values ('certificates','FIXTURE-QUARANTINE.pdf')");
  assert.equal((await auth(users.owner, releaseSQL, ['FIXTURE-QUARANTINE', JSON.stringify(fixtureResults), 'FIXTURE-REFERENCE', '2026-09-29', 'FIXTURE-QUARANTINE.pdf']))[0].status, 'released');
  checks.release_flow = true;
  pass('release and replacement validate inputs/files/status and team access, stamp dates, publish only released coaUrl; failed releases leave the row intact');

  const rejectSQL = 'select * from public.reject_lot($1,$2)';
  for (const [status, user] of [['quarantine', users.owner], ['testing', users.staff]]) {
    const id = `FIXTURE-REJECT-${status.toUpperCase()}`;
    await db.query('insert into public.lots(lot,product_id,status,results) values ($1,$2,$3,$4::jsonb)',
      [id, 'retatrutide-10-mg', status, JSON.stringify(fixtureResults)]);
    assert.equal((await anon('select public.lot_lookup($1) as result', [id]))[0].result.status, status);
    for (const note of [null, '', '   ']) await denied('authenticated', user, rejectSQL, [id, note], '22023');
    const rejected = (await auth(user, rejectSQL, [id, '  Fixture: below release specification.  ']))[0];
    assert.equal(rejected.status, 'rejected'); assert.equal(rejected.rejection_note, 'Fixture: below release specification.');
    assert.equal((await auth(users.owner, 'select rejection_note from public.lots where lot=$1', [id]))[0].rejection_note, rejected.rejection_note);
    assert.equal((await anon('select * from public.lots where lot=$1', [id])).length, 0);
    assert.equal((await anon('select public.lot_lookup($1) as result', [id]))[0].result, null);
    assert.equal((await auth(users.buyerA, 'select * from public.lots where lot=$1', [id])).length, 0);
    assert.equal((await auth(users.partnerA, 'select public.lot_lookup($1) as result', [id]))[0].result, null);
    await denied('authenticated', user, releaseSQL, [id, ...releaseArgs.slice(1)], '22023');
    await denied('authenticated', user, rejectSQL, [id, 'Cannot revise a final rejection'], '22023');
  }
  for (const id of ['FIXTURE-RELEASED', 'FIXTURE-ARCHIVED', 'UNKNOWN'])
    await denied('authenticated', users.owner, rejectSQL, [id, 'Fixture note'], '22023');
  checks.reject_lot_private = true;
  pass('owner/staff reject quarantine/testing lots with a stored note; final/unknown states are refused and rejected lots stay invisible to anon, buyers and partners');

  const articleDraft = { slug: 'fixture-article', title: 'Fixture article', kicker: 'Fixture', excerpt: 'Fixture excerpt', body_md: '## Fixture\n\nFixture body.',
    reading_minutes: 1, status: 'draft', published_at: null, author: 'Fixture author', cover_path: `${users.owner}.png` };
  const savedArticle = (await auth(users.staff, 'select * from public.upsert_article($1::jsonb)', [JSON.stringify(articleDraft)]))[0];
  assert.equal(savedArticle.status, 'draft');
  assert.equal((await anon('select * from public.articles where id=$1', [savedArticle.id])).length, 0);
  assert.equal((await auth(users.buyerA, 'select * from public.articles where id=$1', [savedArticle.id])).length, 0);
  assert.equal((await auth(users.partnerA, 'select * from public.articles where id=$1', [savedArticle.id])).length, 0);
  assert.equal((await auth(users.owner, 'select * from public.articles where id=$1', [savedArticle.id])).length, 1);
  for (const bad of [{ status: 'published' }, { status: 'published', published_at: '2026-09-01', body_md: '' }, { slug: 'invalid slug' }, { cover_image: 'javascript:alert(1)' }, { cover_path: 'missing.png' }, { reading_minutes: 0 }]) {
    await assert.rejects(auth(users.owner, 'select * from public.upsert_article($1::jsonb)', [JSON.stringify({ ...articleDraft, id: savedArticle.id, ...bad })]));
  }
  await auth(users.owner, 'select * from public.upsert_article($1::jsonb)', [JSON.stringify({ ...articleDraft, id: savedArticle.id, status: 'published', published_at: '2026-09-01T00:00:00Z' })]);
  assert.equal((await anon('select * from public.articles where id=$1', [savedArticle.id])).length, 1);
  await auth(users.staff, 'select * from public.upsert_article($1::jsonb)', [JSON.stringify({ ...articleDraft, id: savedArticle.id })]);
  assert.equal((await anon('select * from public.articles where id=$1', [savedArticle.id])).length, 0);
  assert.equal((await auth(users.owner, 'select public.delete_article($1) as removed', [savedArticle.id]))[0].removed, true);
  assert.equal((await auth(users.owner, 'select public.delete_article($1) as removed', [savedArticle.id]))[0].removed, false);
  // Keep a seeded slug but edit it to draft. Reapplying the seed must preserve that decision.
  const sourceArticle = (await rows('select * from public.articles order by slug limit 1'))[0];
  await auth(users.owner, 'select * from public.upsert_article($1::jsonb)', [JSON.stringify({ ...sourceArticle, title: 'Fixture editorial change', status: 'draft' })]);
  const deletedSeed = (await rows('select id from public.articles where id <> $1 order by slug limit 1', [sourceArticle.id]))[0].id;
  await auth(users.owner, 'select public.delete_article($1)', [deletedSeed]);
  checks.articles_rls = true;
  pass('article drafts are team-only, published posts are public, RPCs validate/edit/publish/unpublish/delete, non-team callers and direct writes are refused');

  const expectedCategories = [
    ['metabolic-peptides', 'Metabolic peptides', 'Metabolic', '#7A39B1', 'Retatrutide · Tirzepatide · Semaglutide · Cagrilintide'],
    ['peptide-fragments', 'Peptide fragments', 'Peptide fragments', '#058F93', 'BPC-157 · BPC-157 / TB-500 · KPV'],
    ['copper-peptides', 'Copper peptides', 'Copper peptides', '#CC3358', 'GHK-Cu · GLOW'],
    ['secretagogue-peptides', 'Secretagogue peptides', 'Secretagogues', '#0273D0', 'Tesamorelin · CJC (No DAC) / Ipamorelin'],
    ['mitochondrial-peptides', 'Mitochondrial peptides', 'Mitochondrial', '#B97102', 'MOTS-C'],
    ['coenzymes-cofactors', 'Coenzymes & cofactors', 'Coenzymes', '#B97102', 'NAD+'],
    ['neuropeptides', 'Neuropeptides', 'Neuropeptides', '#4E762E', 'Semax · Selank'],
    ['melanocortin-analogs', 'Melanocortin analogs', 'Melanocortins', '#AB531A', 'Melanotan II'],
    ['lab-supplies', 'Lab supplies', 'Lab supplies', '#486377', 'BAC Water'],
  ].map(([id, name, short, label_color, members_note], index) => ({ id, name, short, label_color, members_note, position: index + 1, on_home: index < 8 }));
  assert.deepEqual(await anon('select * from public.categories order by position'), expectedCategories);
  checks.categories_seed = true;
  pass('nine categories match the client table: exact member notes, colour, numbering and homepage membership');

  // Commerce assertions roll back together, including all fixture orders and catalog edits.
  const beforeCommerce = await snapshot();
  await assert.rejects(() => db.transaction(async (tx) => {
    const query = async (sql, params = []) => (await tx.query(sql, params)).rows;
    const value = async (sql, params = []) => Object.values((await query(sql, params))[0])[0];
    async function act(user, sql, params = [], role = 'authenticated') {
      await tx.exec(`savepoint commerce_call; set local role ${role};`);
      try {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, role })]);
        const result = await query(sql, params);
        await tx.exec('reset role; release savepoint commerce_call;');
        return result;
      } catch (error) { await tx.exec('rollback to savepoint commerce_call; release savepoint commerce_call;'); throw error; }
    }
    const rejected = (user, sql, params = [], code = '42501', role) => assert.rejects(() => act(user, sql, params, role), { code });
    const order = async (user, lines, extra = {}) => (await act(user, 'select * from public.place_order($1::jsonb)', [JSON.stringify({ ...draft, lines, ...extra })]))[0];
    const advance = (id, status) => act(users.owner, 'select * from public.advance_order($1, $2)', [id, status]);
    const stock = () => value("select stock from public.products where id = 'retatrutide-10-mg'");
    const line = (quantity) => [{ productId: 'retatrutide-10-mg', quantity }];
    await tx.exec("update public.products set stock = 3 where id = 'retatrutide-10-mg'");
    const first = await order(users.buyerA, line(2));
    assert.equal(await stock(), 1);
    const afterFirst = await snapshot(tx);
    await assert.rejects(() => order(users.buyerB, line(2)), /Only 1 left of Retatrutide/);
    assert.deepEqual(await snapshot(tx), afterFirst);
    const second = await order(users.buyerB, line(1));
    assert.equal(await stock(), 0);
    await assert.rejects(() => order(users.buyerA, line(1)), /Only 0 left of Retatrutide/);
    assert.equal((await act(null, "select stock from public.products where id = 'retatrutide-10-mg'", [], 'anon'))[0].stock, 0, 'Sold-out products remain public');
    await advance(first.id, 'cancelled');
    assert.equal(await stock(), 2);
    await advance(first.id, 'cancelled');
    assert.equal(await stock(), 2, 'Cancellation retry does not restore twice');
    await advance(second.id, 'paid'); await advance(second.id, 'cancelled');
    assert.equal(await stock(), 2, 'Paid cancellation does not restore stock');
    assert.equal(await value('select stock_reserved from public.order_lines where order_id = $1', [first.id]), 0);
    const untracked = await order(users.buyerA, [{ productId: 'bacteriostatic-water-10-ml', quantity: 2 }]);
    await tx.exec("update public.products set stock = 5 where id = 'bacteriostatic-water-10-ml'");
    await advance(untracked.id, 'cancelled');
    assert.equal(await value("select stock from public.products where id = 'bacteriostatic-water-10-ml'"), 5, 'Untracked lines never restore invented stock');
    const beforeMultiFailure = await snapshot(tx);
    await assert.rejects(() => order(users.buyerA, [...line(3), { productId: 'bacteriostatic-water-10-ml', quantity: 1 }]), /Only 2 left/);
    assert.deepEqual(await snapshot(tx), beforeMultiFailure, 'An earlier line decrement rolls back on later refusal');
    await tx.exec(`create function public.commerce_fixture_fail() returns trigger language plpgsql as $$ begin raise exception 'fixture failure' using errcode = '23514'; end $$;
      create trigger commerce_fixture_fail before insert on public.notifications for each row execute function public.commerce_fixture_fail();`);
    await rejected(users.buyerA, 'select * from public.place_order($1::jsonb)', [JSON.stringify({ ...draft, lines: line(1) })], '23514');
    assert.deepEqual(await snapshot(tx), beforeMultiFailure, 'A late write failure restores decremented stock');
    await tx.exec('drop trigger commerce_fixture_fail on public.notifications; drop function public.commerce_fixture_fail();');
    const locks = await value("select pg_get_functiondef('public.place_order(jsonb)'::regprocedure)");
    assert.match(locks, /order by value ->> 'productId'/);
    assert.match(locks, /public.products where id = item ->> 'productId' and active for update/);
    pass('stock row locks, sequential competing buyers, atomic refusals, untracked history, unpaid restoration and cancellation idempotency');

    const product = seedData.products.find((p) => p.id === 'retatrutide-10-mg');
    const edit = { ...product, active: true, stock: 4, expectedStock: 2, description: 'Fixture description', tag: 'Fixture', price: 51 };
    const category = { id: 'fixture-class', name: 'Fixture class', short: 'Fixture', labelColor: '#123456', position: 10, onHome: false, members: 'Fixture member' };
    for (const [user, role] of [[null, 'anon'], [users.buyerA, 'authenticated'], [users.partnerA, 'authenticated'], [users.profileOnly, 'authenticated'], [null, 'authenticated']]) {
      await rejected(user, 'select * from public.upsert_product($1::jsonb)', [JSON.stringify(edit)], '42501', role);
      await rejected(user, 'select * from public.upsert_category($1::jsonb)', [JSON.stringify(category)], '42501', role);
    }
    const saved = (await act(users.staff, 'select * from public.upsert_product($1::jsonb)', [JSON.stringify(edit)]))[0];
    assert.equal(saved.description, edit.description); assert.equal(saved.stock, 4); assert.equal(Number(saved.price), 51);
    assert.equal(saved.color, product.color); assert.equal(saved.lot, product.lot);
    await rejected(users.owner, 'select * from public.upsert_product($1::jsonb)', [JSON.stringify({ ...edit, expectedStock: 2 })], '40001');
    await act(users.owner, 'select * from public.upsert_category($1::jsonb)', [JSON.stringify(category)]);
    await act(users.staff, 'select * from public.upsert_category($1::jsonb)', [JSON.stringify({ ...category, name: 'Edited fixture class', labelColor: '#FFFFFF' })]);
    assert.equal(await value("select label_color from public.categories where id = 'fixture-class'"), '#123456', 'Existing label colours stay unchanged');
    await act(users.owner, 'select * from public.upsert_product($1::jsonb)', [JSON.stringify({ ...edit, expectedStock: 4, category: category.id, active: false })]);
    assert.equal((await act(null, "select * from public.products where id = 'retatrutide-10-mg'", [], 'anon')).length, 0);
    assert.equal((await act(users.staff, "select * from public.products where id = 'retatrutide-10-mg'")).length, 1);
    await act(users.owner, 'select * from public.upsert_product($1::jsonb)', [JSON.stringify({ ...edit, expectedStock: 4, stock: null, active: true })]);
    for (const invalid of [{ stock: -1 }, { stock: 1.5 }, { image: 'javascript:alert(1)' }, { price: 1.001 }, { name: '' }]) {
      await rejected(users.owner, 'select * from public.upsert_product($1::jsonb)', [JSON.stringify({ ...edit, ...invalid })], '22023');
    }
    pass('catalog RPCs allow owner/staff only, preserve brand/lot fields, validate inputs, detect stale stock and expose inactive products only to the team');

    for (const [user, role] of [[null, 'anon'], [users.staff, 'authenticated'], [users.buyerA, 'authenticated'], [users.partnerA, 'authenticated'], [null, 'authenticated']]) {
      await rejected(user, 'select * from public.update_storefront_settings($1::jsonb)', ['{"freeShippingThreshold":0}'], '42501', role);
    }
    await act(users.owner, 'select * from public.update_storefront_settings($1::jsonb)', ['{"freeShippingThreshold":null}']);
    assert.equal(await value('select free_shipping_threshold from public.settings'), null);
    await rejected(users.owner, 'select * from public.update_storefront_settings($1::jsonb)', ['{"insuranceMode":"automatic","insuranceRate":null}'], '23514');
    await rejected(users.owner, 'select * from public.update_storefront_settings($1::jsonb)', ['{"insuranceRate":1.00001}'], '23514');
    await act(users.owner, 'select * from public.update_storefront_settings($1::jsonb)', ['{"freeShippingThreshold":150}']);
    pass('settings writes are owner-only; patches preserve other fields, null disables free shipping, enabled insurance requires a valid rate');

    await tx.exec("update public.products set price = 166.67, stock = null where id = 'retatrutide-10-mg'");
    for (const mode of ['off', 'optional', 'automatic']) {
      await act(users.owner, 'select * from public.update_storefront_settings($1::jsonb)', [JSON.stringify({ insuranceMode: mode, insuranceRate: 0.0125 })]);
      for (const insured of [false, true]) {
        const priced = await order(users.buyerA, line(1), { insurance: insured, insuranceAmount: 0, total: 0 });
        const applies = mode === 'automatic' || (mode === 'optional' && insured);
        assert.equal(Number(priced.subtotal) - Number(priced.discount_amount), 150);
        assert.equal(Number(priced.insurance), applies ? 1.88 : 0);
        assert.equal(priced.insurance_applied, applies);
        assert.equal(Number(priced.total), applies ? 151.88 : 150);
      }
    }
    await act(users.owner, 'select * from public.update_storefront_settings($1::jsonb)', ['{"insuranceMode":"automatic","insuranceRate":0}']);
    const zero = await order(users.buyerA, line(1));
    assert.equal(zero.insurance_applied, true); assert.equal(Number(zero.insurance), 0);
    await rejected(users.buyerA, 'select * from public.place_order($1::jsonb)', [JSON.stringify({ ...draft, insurance: 'true' })], '22023');
    pass('server insurance rounds the discounted base to cents in off/optional/automatic modes, ignores forged amounts and records zero-rate automatic insurance');

    const bucket = (await query("select * from storage.buckets where id = 'catalog'"))[0];
    assert.equal(bucket.public, true); assert.equal(Number(bucket.file_size_limit), 5242880);
    assert.deepEqual(bucket.allowed_mime_types, ['image/jpeg', 'image/png', 'image/webp']);
    await act(users.owner, "insert into storage.objects(bucket_id, name) values ('catalog', 'fixture-1.png')");
    await act(users.staff, "update storage.objects set name = 'fixture-2.webp' where bucket_id = 'catalog'");
    assert.equal((await act(null, "select * from storage.objects where bucket_id = 'catalog'", [], 'anon')).length, 1);
    for (const [user, role] of [[null, 'anon'], [users.buyerA, 'authenticated'], [users.partnerA, 'authenticated']]) {
      await rejected(user, "insert into storage.objects(bucket_id, name) values ('catalog', 'forbidden.png')", [], '42501', role);
    }
    assert.equal((await act(users.buyerA, "delete from storage.objects where bucket_id = 'catalog' returning id")).length, 0);
    await rejected(users.staff, "update storage.objects set bucket_id = 'fixture-other' where bucket_id = 'catalog'");
    await rejected(users.owner, "insert into storage.objects(bucket_id, name) values ('fixture-other', 'forbidden.png')");
    const otherPolicy = await query("select * from pg_policies where schemaname = 'storage' and policyname = 'fixture_other_read'");
    const edited = await snapshot(tx);
    await tx.exec(commerce.replace(/^begin;$/m, '').replace(/^commit;$/m, ''));
    assert.deepEqual(await snapshot(tx), edited, 'Rerunning commerce preserves edited classes, stock, settings and financial rows');
    assert.deepEqual(await query("select * from pg_policies where schemaname = 'storage' and policyname = 'fixture_other_read'"), otherPolicy);
    assert.equal((await act(users.staff, "delete from storage.objects where bucket_id = 'catalog' returning id")).length, 1);
    pass('catalog bucket metadata, public read and team-only writes are scoped; other bucket policies and populated commerce rows survive rerun');
    throw new Error('ROLLBACK_COMMERCE_FIXTURES');
  }), /ROLLBACK_COMMERCE_FIXTURES/);
  assert.deepEqual(await snapshot(), beforeCommerce);
  checks.stock_rules = checks.insurance_math = checks.catalog_rpcs_team_only = checks.settings_owner_only = checks.catalog_storage = true;

  {
  // WP-19: all identities below exist only in this ephemeral fixture database.
  const applicants = Array.from({ length: 5 }, (_, i) => `00000000-0000-4000-8000-00000000001${i}`);
  const partnerForm = { name: 'Fixture Jordan', channel: 'https://fixture.example/channel', otherChannels: ['https://fixture.example/other'],
    audience: 'Fixture researchers', feature: 'Fixture certificate reading walkthrough.', commitments: ['research-only', 'no-claims', 'disclose', 'approved-assets'],
    email: 'spoofed@fixture.example', role: 'owner', status: 'approved', code: 'SPOOFED' };
  for (const id of applicants) {
    await rows('insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)', [id, `${id}@fixture.example`, JSON.stringify({
      role: 'owner', partner_application: partnerForm, application: { name: 'Never a buyer', institution: 'Never a research application' },
    })]);
    assert.deepEqual(await auth(id, 'select id, role from public.profiles'), [{ id, role: 'buyer' }]);
    assert.equal(await scalar('select count(*)::int from public.buyers where user_id=$1', [id]), 0);
    assert.equal(await scalar('select count(*)::int from public.applications where email=$1', [`${id}@fixture.example`]), 0);
    await denied('authenticated', id, 'select public.place_order($1::jsonb)', [JSON.stringify(draft)]);
  }
  const submissions = await rows('select * from public.partner_applications order by user_id');
  assert.equal(submissions.length, applicants.length);
  for (const row of submissions) {
    assert.equal(row.status, 'submitted'); assert.equal(row.email, `${row.user_id}@fixture.example`);
    assert.equal(row.reviewed_by, null); assert.equal(row.partner_id, null);
    assert.deepEqual(row.other_channels, partnerForm.otherChannels); assert.deepEqual(row.commitments, partnerForm.commitments);
    assert.equal(row.feature, partnerForm.feature); assert.equal(row.channel, partnerForm.channel);
    assert.deepEqual(await auth(row.user_id, 'select * from public.partner_applications'), [row]);
  }
  for (const user of [users.buyerA, users.partnerA, users.profileOnly]) assert.equal((await auth(user, 'select * from public.partner_applications')).length, 0);
  for (const user of [users.owner, users.staff]) assert.equal((await auth(user, 'select * from public.partner_applications')).length, applicants.length);
  await denied('anon', null, 'select * from public.partner_applications');
  for (const user of [users.owner, users.staff, ...applicants]) {
    await denied('authenticated', user, "update public.partner_applications set status='approved'");
    await denied('authenticated', user, "delete from public.partner_applications");
    await denied('authenticated', user, "insert into public.partner_applications(user_id,name,email,channel,audience,feature) values ($1,'x','x','x','x','x')", [user]);
  }
  checks.partner_applicant_not_buyer = checks.partner_application_isolation = checks.partner_signup_intact = true;
  pass('partner metadata creates only a buyer-role profile and submitted partner application; email/roles are authoritative; applicant reads are isolated and direct writes closed');

  for (const [role, user] of [['anon', null], ['authenticated', null], ...[users.buyerA, users.partnerA, ...applicants].map((id) => ['authenticated', id])]) {
    await denied(role, user, "select public.approve_partner_application($1,'FIXTURENEW',0.1,10)", [submissions[0].id]);
    await denied(role, user, "select public.decline_partner_application($1,'Fixture decline')", [submissions[0].id]);
  }
  for (const [code, rate, percent] of [['bad code', .1, 10], ['', .1, 10], ['VALID', -.1, 10], ['VALID', 1.1, 10], ['VALID', .1, 101], ['VALID', .1, null], ['VALID', .1, -1]]) {
    await denied('authenticated', users.owner, 'select public.approve_partner_application($1,$2,$3,$4)', [submissions[0].id, code, rate, percent], '22023');
  }
  for (const code of ['FIXTURE10', 'FIRSTLOT']) {
    await assert.rejects(() => auth(users.owner, 'select public.approve_partner_application($1,$2,0.1,10)', [submissions[0].id, code]), (error) => error.code === '23505' && /code is already in use/.test(error.message));
    assert.equal(await scalar('select status from public.partner_applications where id=$1', [submissions[0].id]), 'submitted');
    assert.equal(await scalar('select role from public.profiles where id=$1', [applicants[0]]), 'buyer');
  }
  const beforePartners = Number(await scalar('select count(*) from public.partners'));
  const beforeCodes = Number(await scalar('select count(*) from public.discounts'));
  const approved = (await auth(users.owner, "select * from public.approve_partner_application($1,' jordan10 ',0.1,10)", [submissions[0].id]))[0];
  assert.equal(approved.status, 'approved'); assert.equal(approved.reviewed_by, users.owner); assert(approved.reviewed_at);
  assert.equal(await scalar('select role from public.profiles where id=$1', [applicants[0]]), 'partner');
  const partner = (await auth(applicants[0], 'select * from public.partners'))[0];
  assert.equal(partner.id, approved.partner_id); assert.equal(partner.status, 'active'); assert.equal(partner.code, 'JORDAN10');
  assert.equal(partner.handle, partnerForm.channel); assert.equal(Number(partner.rate), .1);
  const discount = (await auth(applicants[0], 'select * from public.discounts'))[0];
  assert.equal(discount.partner_id, partner.id); assert.equal(discount.code, partner.code); assert.equal(Number(discount.percent), 10); assert.equal(discount.active, true);
  const welcome = (await auth(applicants[0], 'select * from public.notifications'))[0];
  assert.equal(welcome.kind, 'partner.welcome'); assert.equal(welcome.audience, `partner:${partner.id}`); assert.equal(welcome.href, '/partners/app');
  assert.equal(Number(await scalar('select count(*) from public.partners')), beforePartners + 1);
  assert.equal(Number(await scalar('select count(*) from public.discounts')), beforeCodes + 1);
  const beforeRetry = await snapshot();
  assert.deepEqual((await auth(users.staff, "select * from public.approve_partner_application($1,'JORDAN10',0.1,10)", [approved.id]))[0], approved);
  assert.deepEqual(await snapshot(), beforeRetry);
  await denied('authenticated', users.staff, "select public.approve_partner_application($1,'NEWCODE',0.1,10)", [approved.id], '22023');
  await denied('authenticated', users.staff, "select public.decline_partner_application($1,'No reversal')", [approved.id], '22023');
  assert.deepEqual(await auth(applicants[0], 'select * from public.partner_applications'), [approved]);
  assert.equal((await auth(applicants[1], 'select * from public.partner_applications where id=$1', [approved.id])).length, 0);
  const staffApproval = (await auth(users.staff, "select * from public.approve_partner_application($1,'STAFFAPPROVED',0.12,8)", [submissions[1].id]))[0];
  assert.equal(staffApproval.reviewed_by, users.staff);
  await assert.rejects(() => auth(users.owner, "select public.approve_partner_application($1,'JORDAN10',0.1,10)", [submissions[2].id]), (error) => error.code === '23505' && /code is already in use/.test(error.message));
  for (const [i, reviewer] of [[2, users.staff], [3, users.owner]]) {
    await denied('authenticated', reviewer, "select public.decline_partner_application($1,' ')", [submissions[i].id], '22023');
    const declined = (await auth(reviewer, "select * from public.decline_partner_application($1,' Fixture decision ')", [submissions[i].id]))[0];
    assert.equal(declined.status, 'declined'); assert.equal(declined.reviewed_by, reviewer); assert.equal(declined.review_note, 'Fixture decision');
    assert.deepEqual((await auth(reviewer, "select * from public.decline_partner_application($1,'Fixture decision')", [declined.id]))[0], declined);
    await denied('authenticated', reviewer, "select public.approve_partner_application($1,'REVERSED',0.1,10)", [declined.id], '22023');
    assert.deepEqual(await auth(applicants[i], 'select * from public.partner_applications'), [declined]);
    assert.equal(await scalar('select role from public.profiles where id=$1', [applicants[i]]), 'buyer');
    assert.equal(await scalar('select count(*)::int from public.partners where user_id=$1', [applicants[i]]), 0);
  }
  // A role granted outside this workflow cannot be silently downgraded on approval.
  await rows("update public.profiles set role='owner' where id=$1", [applicants[4]]);
  await denied('authenticated', users.owner, "select public.approve_partner_application($1,'PROTECTED',0.1,10)", [submissions[4].id], '22023');
  checks.approval_creates_partner_and_code = checks.approval_team_only = checks.partner_approval_idempotent = checks.partner_duplicate_code_refused = true;
  pass('only owner/staff approve or decline; code conflicts are clear and atomic; approval creates one partner/code/welcome; retries preserve original audit and reviewed decisions are final');

  }

  // WP-21: audited live controls. Fixtures never contact a hosted project.
  {
    const setPartner = 'select * from public.set_partner_status($1,$2)';
    const createPromo = 'select * from public.create_promo_code($1,$2,$3,$4,$5)';
    const setPromo = 'select * from public.set_promo_active($1,$2)';
    const setLot = 'select * from public.set_lot_status($1,$2)';
    let requestNumber = 0;
    const requestId = () => `00000000-0021-4000-8000-${String(++requestNumber).padStart(12, '0')}`;
    const promoArgs = ['WP21_SAVE', 12.34, '2099-10-01T23:59:59.999Z', true, requestId()];
    const commands = [
      [setPartner, [partners.partnerA, 'paused']], [createPromo, promoArgs],
      [setPromo, ['FIRSTLOT', false]], [setLot, ['FIXTURE-TESTING', 'archived']],
    ];
    const beforeDenied = await snapshot();
    for (const [role, user] of [['anon', null], ['authenticated', null],
      ...[users.buyerA, users.pending, users.partnerA, users.partnerB, users.profileOnly].map((id) => ['authenticated', id])]) {
      for (const [sql, args] of commands) await denied(role, user, sql, args, '42501', { user_metadata: { role: 'owner' } });
    }
    assert.deepEqual(await snapshot(), beforeDenied);
    for (const user of [users.owner, users.staff]) {
      for (const table of ['partners', 'discounts', 'lots']) {
        await denied('authenticated', user, `update public.${table} set updated_by=$1`, [user]);
      }
    }
    checks.team_only = true;
    pass('all four live-save RPCs deny anon, buyers, partners, profile-only and missing users, including forged role metadata; team direct writes remain closed');

    const financial = async () => ({ referrals: await rows('select * from public.referrals order by id'), payouts: await rows('select * from public.payouts order by id') });
    const earnings = await financial();
    const otherCodes = await rows("select * from public.discounts where code <> 'FIXTURE10' order by code");
    const otherPartners = await rows('select * from public.partners where id <> $1 order by id', [partners.partnerA]);
    let saved = (await auth(users.owner, setPartner, [partners.partnerA, 'paused']))[0];
    assert.equal(saved.status, 'paused'); assert.equal(saved.updated_by, users.owner); assert(saved.updated_at);
    let code = (await rows("select * from public.discounts where code='FIXTURE10'"))[0];
    assert.equal(code.active, false); assert.equal(code.updated_by, users.owner); assert.equal(code.updated_at.getTime(), saved.updated_at.getTime());
    assert.equal((await anon("select public.resolve_code('FIXTURE10') as result"))[0].result, null);
    assert.deepEqual((await auth(users.staff, setPartner, [partners.partnerA, 'paused']))[0], saved, 'Retry cannot overwrite the original actor/time');
    assert.deepEqual((await rows("select * from public.discounts where code='FIXTURE10'"))[0], code);
    saved = (await auth(users.staff, setPartner, [partners.partnerA, 'active']))[0];
    assert.equal(saved.status, 'active'); assert.equal(saved.updated_by, users.staff);
    code = (await rows("select * from public.discounts where code='FIXTURE10'"))[0];
    assert.equal(code.active, true); assert.equal(code.updated_by, users.staff);
    assert.equal((await anon("select public.resolve_code('FIXTURE10') as result"))[0].result.percent, 10);
    assert.deepEqual((await auth(users.owner, setPartner, [partners.partnerA, 'active']))[0], saved);
    assert.deepEqual(await financial(), earnings);
    assert.deepEqual(await rows("select * from public.discounts where code <> 'FIXTURE10' order by code"), otherCodes);
    assert.deepEqual(await rows('select * from public.partners where id <> $1 order by id', [partners.partnerA]), otherPartners);
    for (const status of [null, 'pending', 'deleted', 'ACTIVE']) await denied('authenticated', users.owner, setPartner, [partners.partnerA, status], '22023');
    await denied('authenticated', users.owner, setPartner, [users.owner, 'active'], '22023');
    // A historical pending row must not bypass Applications, even with a discount.
    const pendingPartner = await scalar("insert into public.partners(user_id,name,email,code,rate,status) values ($1,'Pending fixture','wp21-pending@fixture.example','WP21_PENDING',0.1,'pending') returning id", [users.profileOnly]);
    await rows("insert into public.discounts(code,kind,percent,partner_id,active) values ('WP21_PENDING','partner',10,$1,false)", [pendingPartner]);
    for (const status of ['active', 'paused']) await denied('authenticated', users.staff, setPartner, [pendingPartner, status], '22023');
    await denied('authenticated', users.owner, setPromo, ['FIXTURE10', false], '22023');
    await denied('authenticated', users.staff, setPromo, ['WP21_PENDING', true], '22023');
    checks.partner_pause_pauses_code = true;
    pass('pause/resume audit owner/staff, change exactly the own code, control resolve_code, preserve all earned commission, retry without changes and refuse pending approval');

    const created = (await auth(users.owner, createPromo, [' wp21_save ', ...promoArgs.slice(1)]))[0];
    assert.equal(created.code, 'WP21_SAVE'); assert.equal(created.kind, 'promo'); assert.equal(Number(created.percent), 12.34);
    assert.equal(created.expires_at.toISOString(), promoArgs[2]); assert.equal(created.active, true);
    assert.equal(created.created_by, users.owner); assert.equal(created.updated_by, users.owner); assert(created.created_at);
    assert.equal((await anon("select public.resolve_code('wp21_save') as result"))[0].result.percent, 12.34);
    assert.deepEqual((await auth(users.owner, createPromo, promoArgs))[0], created);
    // Equivalent expiry text/time zone is the same input and request.
    assert.deepEqual((await auth(users.owner, createPromo, [promoArgs[0], promoArgs[1], '2099-10-01T18:59:59.999-05:00', ...promoArgs.slice(3)]))[0], created);
    const inactive = (await auth(users.staff, setPromo, [' wp21_save ', false]))[0];
    assert.equal(inactive.active, false); assert.equal(inactive.updated_by, users.staff);
    assert.equal((await anon("select public.resolve_code('WP21_SAVE') as result"))[0].result, null);
    assert.deepEqual((await auth(users.owner, setPromo, ['WP21_SAVE', false]))[0], inactive);
    assert.deepEqual((await auth(users.owner, createPromo, promoArgs))[0], inactive, 'A delayed creation retry never reactivates the code');
    const active = (await auth(users.owner, setPromo, ['WP21_SAVE', true]))[0];
    assert.equal(active.active, true); assert.equal(active.updated_by, users.owner);
    assert.deepEqual((await auth(users.staff, setPromo, ['WP21_SAVE', true]))[0], active);
    assert.equal(await scalar("select count(*)::int from public.discounts where code='WP21_SAVE'"), 1);
    assert.equal((await auth(users.staff, 'select * from public.discounts where code=$1', ['WP21_SAVE']))[0].active, true);
    for (const [codeValue, amount] of [['_', 0], ['X'.repeat(64), 100], ['WP21-DECIMAL', 0.01]]) {
      const value = (await auth(users.staff, createPromo, [codeValue, amount, null, false, requestId()]))[0];
      assert.equal(Number(value.percent), amount); assert.equal(value.expires_at, null); assert.equal(value.created_by, users.staff);
    }
    const expired = (await auth(users.staff, createPromo, ['WP21_EXPIRED', 1, '2000-01-01T00:00:00Z', true, requestId()]))[0];
    assert.equal(expired.active, true); assert.equal((await anon("select public.resolve_code('WP21_EXPIRED') as result"))[0].result, null);
    for (const badCode of [null, '', 'A B', 'A/B', 'é', 'X'.repeat(65)]) await denied('authenticated', users.owner, createPromo, [badCode, 10, null, true, requestId()], '22023');
    for (const amount of [null, -0.01, 100.01, 12.345, 'NaN', 'Infinity']) await denied('authenticated', users.staff, createPromo, ['WP21_BAD', amount, null, true, requestId()], '22023');
    for (const args of [['WP21_BAD', 10, 'infinity', true, requestId()], ['WP21_BAD', 10, null, null, requestId()], ['WP21_BAD', 10, null, true, null]]) await denied('authenticated', users.owner, createPromo, args, '22023');
    await denied('authenticated', users.owner, setPromo, ['WP21_SAVE', null], '22023');
    await denied('authenticated', users.owner, setPromo, ['WP21_MISSING', true], '22023');
    await denied('authenticated', users.owner, createPromo, [promoArgs[0], 20, ...promoArgs.slice(2)], '22023');
    await denied('authenticated', users.staff, createPromo, promoArgs, '22023');
    checks.promo_codes_save = true;

    // Partners without a discount still reserve their code. Do not let a promo take it.
    const orphan = await scalar("insert into public.partners(user_id,name,email,code,rate,status) values ($1,'Orphan fixture','wp21-orphan@fixture.example','WP21_RESERVED',0.1,'active') returning id", [users.pending]);
    for (const duplicate of ['wp21_save', 'FIRSTLOT', 'FIXTURE10', 'WP21_PENDING', 'WP21_RESERVED']) {
      await assert.rejects(() => auth(users.owner, createPromo, [duplicate, 10, null, true, requestId()]),
        (error) => error.code === '23505' && error.message === 'That code is already in use. Choose another code.');
    }
    // Reciprocal path: an Application cannot claim a promo code either.
    const applicant = '00000000-0021-4000-8001-000000000001';
    await rows("insert into auth.users(id,email,raw_user_meta_data) values ($1,'wp21-applicant@fixture.example',$2)", [applicant, JSON.stringify({ partner_application: { name: 'WP21 applicant', channel: 'https://fixture.example', audience: 'Fixture', feature: 'Fixture', commitments: ['research-only'] } })]);
    const applicationId = await scalar('select id from public.partner_applications where user_id=$1', [applicant]);
    await assert.rejects(() => auth(users.staff, "select public.approve_partner_application($1,'WP21_SAVE',0.1,10)", [applicationId]), (error) => error.code === '23505' && /already in use/.test(error.message));
    assert.equal(await scalar('select status from public.partner_applications where id=$1', [applicationId]), 'submitted');
    await denied('authenticated', users.owner, setPartner, [orphan, 'paused'], '22023');
    assert.equal(await scalar('select status from public.partners where id=$1', [orphan]), 'active', 'Missing discount failure must be atomic');
    checks.codes_unique = true;
    pass('promos persist with audited creation/activation, 0–100/two-decimal/code/expiry validation, explicit duplicates across both tables, and safe retries even after a later toggle');

    const states = ['quarantine', 'testing', 'released', 'rejected', 'archived'];
    for (const state of states) {
      for (const target of [...states, 'draft', null]) {
        const lotId = `WP21-${state}-${target}`;
        await rows("insert into public.lots(lot,product_id,status,results,reference,released_at) values ($1,'retatrutide-10-mg',$2,$3,'WP21_REFERENCE',case when $2='released' then now() end)", [lotId, state, JSON.stringify(fixtureResults)]);
        const original = (await rows('select * from public.lots where lot=$1', [lotId]))[0];
        const allowed = (state === 'quarantine' && target === 'testing') || (['released', 'rejected'].includes(state) && target === 'archived');
        const noop = ['testing', 'archived'].includes(state) && target === state;
        if (allowed || noop) {
          const reviewer = state === 'released' ? users.staff : users.owner;
          const value = (await auth(reviewer, setLot, [lotId, target]))[0];
          assert.equal(value.status, target);
          assert.deepEqual(value.results, original.results); assert.equal(value.reference, original.reference);
          assert.equal(value.updated_by, allowed ? reviewer : null);
          assert.equal(Boolean(value.updated_at), allowed);
          assert.deepEqual((await auth(users.staff, setLot, [lotId, target]))[0], value);
          assert.deepEqual((await auth(users.owner, 'select * from public.lots where lot=$1', [lotId]))[0], value);
          if (target === 'archived') {
            assert.equal((await anon('select * from public.lots where lot=$1', [lotId])).length, 0);
            assert.equal((await anon('select public.lot_lookup($1) as result', [lotId]))[0].result, null);
          }
        } else {
          await denied('authenticated', users.staff, setLot, [lotId, target], '22023');
          assert.deepEqual((await rows('select * from public.lots where lot=$1', [lotId]))[0], original);
        }
      }
    }
    await denied('authenticated', users.owner, setLot, ['WP21-MISSING', 'testing'], '22023');
    checks.lot_transitions_guarded = checks.live_save_retries_idempotent = true;
    pass('lot transition matrix permits quarantine → testing and released/rejected → archived only, preserves evidence, audits actors, hides archives and makes retries no-ops');
  }


  // WP-22: real membership, private invitations, audited owner-only changes.
  {
    const members = 'select * from public.team_members()';
    const createInvite = 'select public.create_team_invite($1,$2) as token';
    const acceptInvite = 'select public.accept_team_invite($1) as role';
    const setRole = 'select public.set_team_role($1,$2) as role';
    const pendingInvites = 'select * from public.team_invites()';
    const previewInvite = 'select public.team_invite_preview($1) as invite';
    const revokeInvite = 'select public.revoke_team_invite($1) as changed';
    const make = async (email, role = 'staff') => (await auth(users.owner, createInvite, [email, role]))[0].token;
    const invitation = async (token) => (await rows("select * from public.team_invites where token_hash=sha256(convert_to($1,'UTF8'))", [token]))[0];
    let fixtureNumber = 0;
    const signup = async (email, token, extra = {}) => {
      const id = `00000000-0022-4000-8000-${String(++fixtureNumber).padStart(12,'0')}`;
      await rows('insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)', [id,email,JSON.stringify({ ...extra, team_invite: token, role: 'owner' })]);
      assert.equal(await scalar('select count(*)::int from public.buyers where user_id=$1',[id]),0);
      assert.equal(await scalar('select count(*)::int from public.applications where email=$1',[email]),0);
      assert.equal(await scalar('select count(*)::int from public.partner_applications where user_id=$1',[id]),0);
      return id;
    };
    await rows("update auth.users set last_sign_in_at='2026-10-01T15:00:00Z' where id=$1", [users.owner]);
    const expectedTeam = await rows("select p.id as user_id, u.email::text, p.role, u.created_at as joined_at, u.last_sign_in_at from public.profiles p join auth.users u on u.id=p.id where p.role in ('owner','staff') order by lower(u.email),p.id");
    assert.deepEqual(await auth(users.owner,members),expectedTeam);
    assert.deepEqual(await auth(users.staff,members),expectedTeam);
    assert.equal(expectedTeam.length,3); // Includes the protected role fixture from WP-19.
    assert.equal(expectedTeam.find((m)=>m.user_id===users.owner).last_sign_in_at.toISOString(),'2026-10-01T15:00:00.000Z');
    assert.equal(expectedTeam.find((m)=>m.user_id===users.staff).last_sign_in_at,null);
    for (const [role,user] of [['anon',null],['authenticated',null],...['buyerA','partnerA','profileOnly'].map((name)=>['authenticated',users[name]])]) {
      await denied(role,user,members,[],'42501',{user_metadata:{role:'owner'},app_metadata:{role:'owner'}});
    }
    for (const user of Object.values(users)) await denied('authenticated',user,'select * from public.team_invites');
    await denied('anon',null,'select * from public.team_invites');
    checks.team_list_real = true;
    pass('team_members exposes only real owner/staff accounts, authoritative email, joined and nullable last sign-in; non-team and direct invite reads are refused');

    const token = await make('  Invited@fixture.example  ');
    assert.match(token,/^[0-9a-f]{64}$/);
    const saved = await invitation(token);
    assert.equal(saved.email,'invited@fixture.example'); assert.equal(saved.role,'staff'); assert.equal(saved.created_by,users.owner);
    assert.equal(saved.expires_at - saved.created_at,7*86400000);
    assert.equal(Buffer.from(saved.token_hash).toString('hex'),createHash('sha256').update(token).digest('hex'));
    assert(!JSON.stringify(saved).includes(token));
    const publicInvite=(await anon(previewInvite,[token]))[0].invite;
    assert.deepEqual(Object.keys(publicInvite).sort(),['email','expiresAt','role']);
    assert.equal(publicInvite.email,saved.email);
    assert.deepEqual((await auth(users.staff,previewInvite,[token]))[0].invite,publicInvite);
    assert.equal((await anon(previewInvite,['unknown']))[0].invite,null);
    assert.equal((await anon(previewInvite,[null]))[0].invite,null);
    assert.equal((await auth(users.owner,pendingInvites))[0].id,saved.id);
    assert.deepEqual(await auth(users.staff,pendingInvites), await auth(users.owner,pendingInvites));
    assert.deepEqual(Object.keys((await auth(users.staff,pendingInvites))[0]).sort(), ['email','expires_at','id','role']);
    for (const [role,user] of [['anon',null],['authenticated',null],...['staff','buyerA','partnerA','profileOnly'].map((name)=>['authenticated',users[name]])]) {
      await denied(role,user,createInvite,['attack@fixture.example','owner']);
      await denied(role,user,revokeInvite,[saved.id]);
      if (user !== users.staff) await denied(role,user,pendingInvites);
      await denied(role,user,setRole,[users.staff,'owner']);
    }
    // No actor, including an owner, can accept another email's invitation.
    for (const user of [users.owner,users.staff,users.buyerA,users.partnerA]) await denied('authenticated',user,acceptInvite,[token]);
    await denied('anon',null,acceptInvite,[token]);
    await denied('authenticated',null,acceptInvite,[token]);
    assert.equal((await invitation(token)).used_at,null);
    for (const email of [null,'','missing-at','x@y','a b@fixture.example','x'.repeat(255)+'@fixture.example']) await denied('authenticated',users.owner,createInvite,[email,'staff'],'22023');
    for (const role of [null,'buyer','partner','OWNER']) await denied('authenticated',users.owner,createInvite,['fixture@fixture.example',role],'22023');
    checks.owner_only_changes = true;
    pass('owners alone create/revoke invitations and change roles; staff can read redacted pending invitations; invitation tokens are 32 random bytes, hashed only, seven-day and email-bound, even against owner impersonation');

    const newStaff = await signup('INVITED@fixture.example',token);
    assert.equal(await scalar('select role from public.profiles where id=$1',[newStaff]),'staff');
    assert.equal((await invitation(token)).used_by,newStaff);
    assert((await invitation(token)).used_at);
    assert.equal((await anon(previewInvite,[token]))[0].invite,null);
    await denied('authenticated',newStaff,acceptInvite,[token],'22023');
    assert.equal((await auth(users.owner,pendingInvites)).length,0);
    const buyerBefore = await snapshot();
    const existingToken = await make('buyera@fixture.example','owner');
    assert.equal((await auth(users.buyerA,acceptInvite,[existingToken]))[0].role,'owner');
    assert.equal((await invitation(existingToken)).used_by,users.buyerA);
    const afterAcceptance = await snapshot();
    for (const table of tables.filter((t)=>!['profiles','team_invites'].includes(t))) assert.deepEqual(afterAcceptance[table],buyerBefore[table]);
    await denied('authenticated',users.buyerA,acceptInvite,[existingToken],'22023');
    assert.equal((await auth(users.owner,setRole,[users.buyerA,'buyer']))[0].role,'buyer');
    const revokedToken=await make('revoked@fixture.example');
    const revokedId=(await invitation(revokedToken)).id;
    assert.equal((await auth(users.owner,revokeInvite,[revokedId]))[0].changed,true);
    const revoked=await invitation(revokedToken);
    assert.equal(revoked.revoked_by,users.owner); assert(revoked.revoked_at);
    assert.equal((await auth(users.owner,revokeInvite,[revokedId]))[0].changed,false);
    assert.deepEqual(await invitation(revokedToken),revoked);
    assert.equal((await anon(previewInvite,[revokedToken]))[0].invite,null);
    const expiredToken=await make('expired@fixture.example');
    await rows("update public.team_invites set created_at=now()-interval '8 days',expires_at=now()-interval '1 day' where id=$1",[(await invitation(expiredToken)).id]);
    assert.equal((await anon(previewInvite,[expiredToken]))[0].invite,null);
    const unmatched=await make('correct@fixture.example','owner');
    const noRoleCases=[['bad@fixture.example','bad'],['expired@fixture.example',expiredToken],['wrong@fixture.example',unmatched],['revoked@fixture.example',revokedToken],['replayed@fixture.example',token],['null@fixture.example',null]];
    for (const [email,badToken] of noRoleCases) {
      const id=await signup(email,badToken,{application:{name:'Ignored'},partner_application:{name:'Ignored'}});
      assert.equal(await scalar('select role from public.profiles where id=$1',[id]),'buyer');
      assert.equal(await scalar('select role_updated_at from public.profiles where id=$1',[id]),null);
    }
    assert.equal((await invitation(unmatched)).used_at,null,'A wrong-email signup must not burn the right email\'s invite');
    const rightEmail=await signup('correct@fixture.example',unmatched);
    assert.equal(await scalar('select role from public.profiles where id=$1',[rightEmail]),'owner');
    await auth(users.owner,setRole,[rightEmail,'buyer']);
    for (const badToken of [expiredToken,revokedToken,'unknown',null]) await denied('authenticated',users.owner,acceptInvite,[badToken],'22023');
    checks.invite_single_use_expiring_email_bound = checks.bad_invite_no_role = true;
    pass('new and existing accounts accept once; revoked/expired/unknown/replayed/mismatched tokens grant no role and create no application or buyer rows');

    // Restore the WP-19 protected-role fixture before the single-owner checks.
    for (const member of await auth(users.owner,members)) if (member.role==='owner' && member.user_id!==users.owner) await auth(users.owner,setRole,[member.user_id,'buyer']);
    const onlyOwnerToken=await make('owner@fixture.example','staff');
    for (const role of ['staff','buyer']) await denied('authenticated',users.owner,setRole,[users.owner,role],'22023');
    await denied('authenticated',users.owner,acceptInvite,[onlyOwnerToken],'22023');
    assert.equal((await invitation(onlyOwnerToken)).used_at,null);
    const originalOwner=(await rows('select * from public.profiles where id=$1',[users.owner]))[0];
    assert.equal((await auth(users.owner,setRole,[users.owner,'owner']))[0].role,'owner');
    assert.deepEqual((await rows('select * from public.profiles where id=$1',[users.owner]))[0],originalOwner);
    for (const role of ['partner','invalid',null]) await denied('authenticated',users.owner,setRole,[newStaff,role],'22023');
    await denied('authenticated',users.owner,setRole,['00000000-9999-4000-8000-000000000000','owner'],'22023');
    await auth(users.owner,setRole,[newStaff,'owner']);
    await auth(users.owner,setRole,[users.owner,'staff']);
    await denied('authenticated',users.owner,setRole,[newStaff,'buyer']);
    await denied('authenticated',newStaff,setRole,[newStaff,'buyer'],'22023');
    await auth(newStaff,setRole,[users.owner,'owner']);
    await auth(users.owner,setRole,[newStaff,'staff']);
    const roleSaved = await snapshot();
    await auth(users.owner,setRole,[newStaff,'staff']);
    assert.deepEqual(await snapshot(),roleSaved,'Repeating a team role save leaves all audit and account rows unchanged');
    await auth(users.owner,setRole,[newStaff,'buyer']);
    const removal = await snapshot();
    await denied('authenticated',users.owner,setRole,[newStaff,'buyer'],'22023');
    assert.deepEqual(await snapshot(),removal,'Repeating removal is refused without changing any account or audit rows');
    const removed=(await rows('select * from public.profiles where id=$1',[newStaff]))[0];
    assert.equal(removed.role_updated_by,users.owner); assert(removed.role_updated_at);
    assert.equal(await scalar('select count(*)::int from auth.users where id=$1',[newStaff]),1);
    await denied('authenticated',newStaff,members);
    assert.equal((await auth(users.owner,members)).length,2);
    // All paths that can reduce owner count serialize before reading it.
    for (const functionName of ['set_team_role','accept_team_invite']) {
      const definition=await scalar('select pg_get_functiondef(oid) from pg_proc where pronamespace=\'public\'::regnamespace and proname=$1',[functionName]);
      assert(definition.indexOf('pg_advisory_xact_lock')<definition.indexOf('select count(*)'));
      assert(definition.includes("hashtextextended('platform-team-roles', 0)"));
    }
    checks.last_owner_protected = true;
    pass('last owner cannot be demoted, removed or demoted by accepting an invite; changes serialize, are audited and retry safely, preserving the account and all other rows');

    const beforeNonTeamChanges = await snapshot();
    for (const user of [users.partnerA, users.partnerB, users.buyerA, users.buyerB, users.pending, users.profileOnly, newStaff]) {
      assert(['partner','buyer'].includes(await scalar('select role from public.profiles where id=$1',[user])));
      for (const role of ['owner','staff','buyer']) {
        await assert.rejects(() => auth(users.owner,setRole,[user,role]), (error) => {
          assert.equal(error.code,'22023');
          assert.equal(error.message,'Only team members can be changed here. Invite new members from Team.');
          return true;
        });
      }
    }
    assert.deepEqual(await snapshot(),beforeNonTeamChanges,'Refused role changes preserve profiles, linked buyer/partner records and all audit rows');
    checks.team_role_existing_members_only = true;
    pass('set_team_role refuses partner and buyer profiles for every requested role, including profile-only users and removed members; exact error and all existing records are preserved');
  }

  // Repeat on a populated database, with deliberate client edits. An empty-only
  // rerun would miss destructive seed upserts and accidental sequence restarts.
  await db.exec("update public.products set price = 51 where id = 'retatrutide-10-mg'; update public.discounts set active = true where code = 'FIRSTLOT';");
  await db.exec("update public.settings set free_shipping_threshold = 175, insurance_mode = 'optional', insurance_rate = 0.01250");
  const populated = await snapshot();
  const sequence = await rows('select last_value, is_called from public.platform_order_number_seq');
  await db.exec(schema);
  await db.exec(seed);
  await db.exec(partnerPolicy);
  await db.exec(storefront);
  await db.exec(contentSQL);
  await db.exec(commerce);
  await db.exec(assistant);
  await db.exec(accounts);
  await db.exec(liveSaves);
  await db.exec(teamSQL);
  assert.deepEqual(await snapshot(), populated);
  assert.deepEqual(await rows('select last_value, is_called from public.platform_order_number_seq'), sequence);
  assert.deepEqual(await reviewSnapshot(), oldReview);
  const afterRerun = (await place(users.buyerA, { ...draft, discountCode: 'FIRSTLOT' }))[0];
  assert.equal(Number(afterRerun.subtotal), 222);
  assert.equal(Number(afterRerun.discount_amount), 22.2);
  assert.equal(Number(afterRerun.total), 199.8);
  assert.equal(afterRerun.discount_partner_id, null);
  assert.equal(Number(afterRerun.number.slice(3)), Number(sequence[0].last_value) + 1);
  assert.equal(await scalar('select count(*)::int from public.referrals where order_id = $1', [afterRerun.id]), 0);
  checks.rerunnable = true;
  checks.sql_validated = true;
  pass('populated rerun preserves edits, financial rows, review objects and sequence; RPCs still work with changed server prices');
  console.log(`Validation complete: ${assertions} check groups passed.`);
} catch (error) {
  process.exitCode = 1;
  console.error('FAIL', JSON.stringify({ message: error.message, code: error.code, detail: error.detail, where: error.where, stack: error.stack }, null, 2));
} finally {
  console.log(JSON.stringify(checks, null, 2));
  await db.close();
}
