// Lots lockdown (20261019000300_lots_lockdown.sql): visitors and signed-in customers read a released lot's
// public fields only; owner and staff keep the whole table. Every migration runs twice on PGlite
// (createPlatformDb), here and in a database migrated only up to the migration before this one, for
// comparison. No Supabase endpoint is involved.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createPlatformDb } from './lib/platform-db.mjs';

globalThis.fetch = async () => { throw new Error('Network forbidden in lot SQL proofs'); };
const MIGRATION = '20261019000300_lots_lockdown.sql';
const PUBLIC = ['lot', 'lot_number', 'product_id', 'status', 'testing_status', 'tested_at', 'released_at', 'results', 'reference', 'coa_path'];
const INTERNAL = ['units', 'reserved_units', 'received_units', 'expected_units', 'expected_at', 'received_at',
  'hold_reason', 'rejection_note', 'updated_by', 'updated_at', 'version', 'inventory_id'];
const LOOKUP = ['lot', 'productId', 'status', 'releasedAt', 'testedAt', 'reference', 'results', 'coaUrl'];
const PRIVATE = /PRIVATE/;
const product = 'retatrutide-30-mg';
const results = [{ label: 'Purity', method: 'HPLC', value: '99.5', unit: '%' }, { label: 'Identity', method: 'Mass spectrometry', value: 'Confirmed', unit: '' }];
const pass = (name, detail) => console.log(`PASS ${name}: ${detail}`);

/**
 * One fixture world: lots in every state, a held released lot carrying every internal field, and a buyer's order
 * reserving units from it. The same steps run in the legacy and the locked-down database.
 */
async function world(h) {
  const { db, auth, rows, person } = h;
  const owner = await person('lots-owner@fixture.test', 'owner');
  const staff = await person('lots-staff@fixture.test', 'staff');
  const buyer = await person('lots-buyer@fixture.test');
  const partner = await person('lots-partner@fixture.test', 'partner');
  const stranger = await person('lots-stranger@fixture.test');
  await db.query("insert into buyers(id,user_id,name,email,institution,status) values ($1,$1,'Fixture','lots-buyer@fixture.test','Lab','verified')", [buyer]);
  await auth(owner, "select set_connection_mode('payments','off',null)");
  const save = async (draft) => (await auth(owner, 'select * from save_inventory_lot($1)', [{ productId: product, reason: 'Fixture', ...draft }]))[0];
  const receive = async (lot, quantity) => (await auth(staff, 'select * from receive_inventory($1,$2,$3,$4)', [lot.inventory_id, quantity, '2026-09-01T12:00:00Z', randomUUID()]))[0];
  const certify = async (lot) => {
    const path = `${lot.lot}.pdf`; // fixed, so the two databases compare field for field
    await auth(owner, "insert into storage.objects(bucket_id,name) values ('certificates',$1)", [path]);
    return (await auth(staff, 'select * from release_lot($1,$2,$3,$4,$5)', [lot.lot, results, `CERT-${lot.lot}`, '2026-09-01', path]))[0];
  };
  // Selling: released and eligible, then an order reserves from it and a hold note goes on it.
  let selling = await certify(await receive(await save({ number: 'TM-LOCK-SELLING', expectedUnits: 12, expectedAt: '2026-11-01' }), 10));
  await auth(buyer, 'select * from place_order($1)', [{ lines: [{ productId: product, quantity: 2 }], shipping: 'cold-2day',
    address: { institution: 'Lab', attention: 'Fixture', line1: '1 Test Road', city: 'Austin', region: 'TX', postal: '78701', country: 'US' } }]);
  selling = (await rows('select * from lots where lot = $1', ['TM-LOCK-SELLING']))[0];
  selling = await save({ id: selling.inventory_id, version: selling.version, number: 'TM-LOCK-SELLING', expectedUnits: 12, expectedAt: '2026-11-01',
    status: 'held', holdReason: 'PRIVATE hold: seal check' });
  await db.query("update lots set rejection_note = 'PRIVATE earlier note' where lot = 'TM-LOCK-SELLING'");
  // The other states the old policy kept from the public.
  await receive(await save({ number: 'TM-LOCK-QUARANTINE', expectedUnits: 5 }), 5);
  const rejected = await certify(await receive(await save({ number: 'TM-LOCK-REJECTED', expectedUnits: 4 }), 4));
  await auth(owner, 'select * from reject_lot($1,$2)', [rejected.lot, 'PRIVATE below specification']);
  const archived = await certify(await receive(await save({ number: 'TM-LOCK-ARCHIVED', expectedUnits: 3 }), 3));
  await auth(owner, 'select * from set_lot_status($1,$2)', [archived.lot, 'archived']);
  await certify(await receive(await save({ number: 'TM-LOCK-EMPTY', expectedUnits: 2 }), 2));
  await db.query("update lots set results = '[]' where lot = 'TM-LOCK-EMPTY'");
  await certify(await receive(await save({ number: 'TM-LOCK-PLAIN', expectedUnits: 6 }), 6));
  // Fixed release dates, so the two databases compare field for field.
  await db.query("update lots set released_at = '2026-09-02T12:00:00Z' where released_at is not null");
  return { owner, staff, buyer, partner, stranger };
}

const publicColumns = `select ${PUBLIC.join(', ')} from public.lots`;
const h = await createPlatformDb();
const legacy = await createPlatformDb({ through: '20261019000200_free_bac_water.sql' });
const { db, rows, auth, anon, denied, migrations } = h;
try {
  // The migration is new, last, ASCII and applied (twice) after every existing one.
  assert.equal(migrations.at(-1), MIGRATION);
  assert(!/[^\x00-\x7f]/.test(await readFile(new URL(`../supabase/migrations/${MIGRATION}`, import.meta.url), 'utf8')));
  const people = await world(h);
  const before = await world(legacy);

  // What was exposed: the legacy table policy handed visitors and customers every column of a released lot.
  for (const [role, user] of [['anon', null], ['authenticated', before.buyer], ['authenticated', before.partner]]) {
    const leaked = (await legacy.as(role, user, 'select * from public.lots where lot = $1', ['TM-LOCK-SELLING']))[0];
    assert(leaked, `legacy ${role} reads the released lot`);
    assert.equal(leaked.units, 10); assert.equal(leaked.reserved_units, 2); assert.match(leaked.hold_reason, PRIVATE); assert.match(leaked.rejection_note, PRIVATE);
    assert.equal(leaked.updated_by, before.owner); assert(leaked.inventory_id && leaked.version > 1);
  }
  pass('legacy_exposed', 'before this migration, visitors, buyers and partners read units, reservations, hold and rejection notes, the saving owner and bookkeeping of a released lot');

  // Visitors: the table is closed; the public function returns only the public fields.
  await denied('anon', null, 'select * from public.lots');
  await denied('anon', null, 'select units from public.lots');
  await denied('anon', null, "update public.lots set units = 0 where lot = 'TM-LOCK-SELLING'");
  const visitor = await anon('select * from public.released_lots()');
  assert(visitor.length > 0);
  for (const row of visitor) assert.deepEqual(Object.keys(row), PUBLIC);
  assert.doesNotMatch(JSON.stringify(visitor), PRIVATE);
  assert(!JSON.stringify(visitor).includes(people.owner) && !JSON.stringify(visitor).includes(people.staff));
  pass('anon_public_fields', `visitors are refused the lots table and read ${PUBLIC.length} public fields through released_lots()`);

  // Signed-in customers, partners and anyone else without a team role: no table rows, the same public record.
  for (const [name, user] of [['buyer', people.buyer], ['partner', people.partner], ['signed-in stranger', people.stranger]]) {
    assert.equal((await auth(user, 'select * from public.lots')).length, 0, `${name} reads no lot rows`);
    assert.equal((await auth(user, 'select l.* from public.order_lot_allocations a join public.lots l on l.inventory_id = a.lot_id')).length, 0, `${name} reaches no lot through an allocation`);
    await denied('authenticated', user, "update public.lots set units = 0 where lot = 'TM-LOCK-SELLING'");
    assert.deepEqual(await auth(user, 'select * from public.released_lots()'), visitor, `${name} reads the public record`);
    assert.equal((await auth(user, 'select * from public.inventory_events')).length, 0, `${name} reads no inventory history`);
  }
  // The buyer still has their own allocation (their order's lot and certificate), and nobody else does.
  const mine = await auth(people.buyer, 'select * from public.order_lot_allocations');
  assert.equal(mine.length, 1); assert.equal(mine[0].quantity, 2); assert.equal(mine[0].lot_number, 'TM-LOCK-SELLING');
  assert.equal((await auth(people.stranger, 'select * from public.order_lot_allocations')).length, 0);
  await denied('anon', null, 'select * from public.order_lot_allocations');
  await denied('anon', null, 'select * from public.inventory_events');
  pass('customers_public_fields', 'buyers, partners and other signed-in users read no lot rows, directly or through an allocation, and the same public record; buyers keep only their own allocations');

  // Owner and staff: every lot, every column, as before.
  for (const user of [people.owner, people.staff]) {
    const team = await auth(user, "select * from public.lots where lot like 'TM-LOCK-%' order by lot");
    assert.deepEqual(team.map((l) => l.lot), ['TM-LOCK-ARCHIVED', 'TM-LOCK-EMPTY', 'TM-LOCK-PLAIN', 'TM-LOCK-QUARANTINE', 'TM-LOCK-REJECTED', 'TM-LOCK-SELLING']);
    const selling = team.find((l) => l.lot === 'TM-LOCK-SELLING');
    for (const column of INTERNAL) assert(column in selling, `team reads ${column}`);
    assert.equal(selling.units, 10); assert.equal(selling.reserved_units, 2); assert.equal(selling.updated_by, people.owner);
    assert.match(selling.hold_reason, PRIVATE); assert.match(team.find((l) => l.lot === 'TM-LOCK-REJECTED').rejection_note, PRIVATE);
    assert((await auth(user, 'select * from public.inventory_events')).length > 0);
    assert.equal((await auth(user, 'select * from public.order_lot_allocations')).length, 1);
  }
  pass('team_full_access', 'owner and staff read every lot in every state with all columns, the inventory history and every allocation');

  // Same rows and same public values as the old policy: released with results, held or not; never quarantined,
  // rejected, archived or a release without results. For visitors and customers alike.
  const old = await legacy.anon(`${publicColumns} order by lot`);
  assert.deepEqual(visitor, old);
  assert.deepEqual(await legacy.as('authenticated', before.buyer, `${publicColumns} order by lot`), old);
  assert.deepEqual(visitor.filter((l) => l.lot.startsWith('TM-LOCK-')).map((l) => l.lot), ['TM-LOCK-PLAIN', 'TM-LOCK-SELLING']);
  assert.deepEqual(visitor.map((l) => l.lot), (await rows("select lot from public.lots where status = 'released' and jsonb_array_length(results) > 0 order by lot")).map((l) => l.lot));
  pass('same_rows_as_before', `released_lots() returns exactly the ${visitor.length} rows and public values the old policy showed; a held lot stays (it is still released); quarantined, rejected, archived and result-less lots stay out`);

  // The Verify lookup is unchanged: public fields only, for every lot it knows, for visitors and customers.
  for (const lot of ['TM-LOCK-SELLING', 'TM-LOCK-QUARANTINE', 'TM-LOCK-REJECTED', 'TM-LOCK-ARCHIVED', 'TM-LOCK-EMPTY']) {
    const lookup = (await anon('select public.lot_lookup($1) as r', [lot]))[0].r;
    assert.deepEqual(Object.keys(lookup).sort(), [...LOOKUP].sort(), lot);
    assert.doesNotMatch(JSON.stringify(lookup), PRIVATE, lot);
    assert.deepEqual((await auth(people.buyer, 'select public.lot_lookup($1) as r', [lot]))[0].r, lookup);
    assert.deepEqual(lookup, (await legacy.anon('select public.lot_lookup($1) as r', [lot]))[0].r, `${lot} lookup unchanged`);
  }
  assert.equal((await anon('select public.lot_lookup($1) as r', ['TM-LOCK-REJECTED']))[0].r.status, 'rejected');
  pass('verify_unchanged', 'lot_lookup returns the same public fields and answers as before, rejected lots included');

  // Grants: the public function is a fixed-path definer readable by visitors and customers only; nothing a
  // visitor can call returns a lots row; the lot RPCs a customer can call refuse non-team callers.
  const [fn] = await rows(`select prosecdef, provolatile, proconfig,
    has_function_privilege('anon', oid, 'EXECUTE') as anon, has_function_privilege('authenticated', oid, 'EXECUTE') as auth,
    has_function_privilege('service_role', oid, 'EXECUTE') as service,
    exists (select 1 from aclexplode(proacl) where grantee = 0 and privilege_type = 'EXECUTE') as everyone
    from pg_proc where oid = 'public.released_lots()'::regprocedure`);
  assert.deepEqual(fn, { prosecdef: true, provolatile: 's', proconfig: ['search_path=public'], anon: true, auth: true, service: false, everyone: false });
  assert.equal(await h.scalar("select has_any_column_privilege('anon', 'public.lots', 'select')"), false);
  assert.equal(await h.scalar("select count(*)::int from pg_policies where tablename = 'lots' and 'anon' = any(roles)"), 0);
  assert.deepEqual((await rows("select policyname from pg_policies where schemaname = 'public' and tablename = 'lots' order by policyname")).map((p) => p.policyname), ['platform_team_read']);
  const lotTypes = "('public.lots'::regtype, 'public.order_lot_allocations'::regtype, 'public.inventory_events'::regtype)";
  assert.deepEqual(await rows(`select proname from pg_proc where pronamespace = 'public'::regnamespace and prorettype in ${lotTypes}
    and has_function_privilege('anon', oid, 'EXECUTE')`), []);
  const teamOnly = await rows(`select proname, pg_get_function_identity_arguments(oid) as args from pg_proc where pronamespace = 'public'::regnamespace
    and prorettype in ${lotTypes} and has_function_privilege('authenticated', oid, 'EXECUTE') order by proname`);
  const calls = {
    receive_inventory: ['select receive_inventory($1,1,now(),$2)', [randomUUID(), randomUUID()]],
    reject_lot: ["select reject_lot('TM-LOCK-SELLING','No')", []],
    release_lot: ["select release_lot('TM-LOCK-SELLING','[]','No','2026-09-01','x.pdf')", []],
    save_inventory_lot: ['select save_inventory_lot($1)', [{ productId: product, number: 'TM-LOCK-DENIED', reason: 'No', expectedUnits: 0 }]],
    set_lot_certificate: ["select set_lot_certificate('TM-LOCK-SELLING','x.pdf')", []],
    set_lot_status: ["select set_lot_status('TM-LOCK-SELLING','archived')", []],
  };
  assert.deepEqual(teamOnly.map((f) => f.proname), Object.keys(calls));
  const voidCalls = [
    ['select substitute_inventory($1,$2,$3,$4)', [randomUUID(), product, [], 'No']],
    ['select remove_inventory_certificate($1,$2)', [randomUUID(), 'No']],
    ['select return_inventory($1,1,$2,true,$3)', [randomUUID(), 'No', randomUUID()]],
  ];
  for (const [sql, params] of [...Object.values(calls), ...voidCalls]) {
    for (const user of [people.buyer, people.partner]) await denied('authenticated', user, sql, params);
  }
  assert.equal(await h.scalar("select has_function_privilege('authenticated', 'public.inventory_eligible(public.lots)', 'EXECUTE')"), false);
  pass('grants', `released_lots() is a stable definer with a fixed search path for anon and authenticated only; the lots table has no visitor grant or policy; no visitor-callable function returns a lot row, and every lot and inventory RPC open to signed-in users refuses buyers and partners`);

  console.log(JSON.stringify({ sql_validated: true, legacy_exposed: true, anon_public_fields: true, customers_public_fields: true,
    team_full_access: true, same_rows_as_before: true, verify_unchanged: true, grants: true, rerunnable: true }));
} finally { await db.close(); await legacy.db.close(); }
