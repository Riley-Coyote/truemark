import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPlatformDb } from './lib/platform-db.mjs';

const h = await createPlatformDb();
const { db, rows, scalar, anon, auth, service, denied, person } = h;
try {
  const migration = await readFile(new URL('../supabase/migrations/20261005000400_shop_access.sql', import.meta.url), 'utf8');
  assert(!/[^\x00-\x7f]/.test(migration));
  const owner = await person('owner@fixture.test', 'owner');
  const staff = await person('staff@fixture.test', 'staff');
  const partner = await person('partner@fixture.test', 'partner');
  const buyer = await person('researcher@fixture.test', 'buyer', { application: {
    name: 'Fixture Researcher', email: 'researcher@fixture.test', institution: 'Fixture Lab', institutionType: 'University',
    researchArea: 'Assays', intendedUse: 'Laboratory assay development in fixture cells.', attestations: [], documents: [],
  } });
  const app = (await rows('select * from applications where email = $1', ['researcher@fixture.test']))[0];
  assert(app);
  await denied('anon', null, 'select * from products');
  const showcase = await anon('select catalog_showcase() as product');
  assert(showcase.length > 0);
  const expected = ['id', 'name', 'size', 'category', 'image', 'color', 'color_ink', 'form', 'lot', 'tag'].sort();
  for (const { product } of showcase) assert.deepEqual(Object.keys(product).sort(), expected);
  assert((await auth(buyer, 'select * from products')).length > 0);
  await db.query("update products set active = false where id = $1", [showcase[0].product.id]);
  assert(!(await auth(buyer, 'select * from products')).some((p) => p.id === showcase[0].product.id));
  for (const table of ['categories', 'shipping_methods', 'lots']) await anon(`select * from ${table}`);
  console.log('PASS anon_no_prices: showcase whitelist; signed-in active catalog; public references');

  const order = (await rows(`insert into orders(buyer_id, address, shipping_method_id, shipping_price, subtotal, total)
    values ($1, '{"city":"Fixture City","region":"IL","line1":"PRIVATE STREET","phone":"PRIVATE PHONE"}',
      (select id from shipping_methods limit 1), 0, 10, 10) returning *`, [app.buyer_id]))[0];
  const product = (await rows('select * from products where active limit 1'))[0];
  await db.query('insert into order_lines(order_id, product_id, quantity, unit_price, lot) values ($1,$2,1,$3,$4)', [order.id, product.id, 10, product.lot]);
  await db.query("insert into order_events(order_id, status, actor_id, note) values ($1,'placed',$2,'Fixture event')", [order.id, buyer]);
  const tracked = (await anon('select track_order($1,$2) as result', [order.number, ' RESEARCHER@fixture.test ']))[0].result;
  assert.deepEqual(Object.keys(tracked).sort(), ['number', 'status', 'createdAt', 'events', 'shipping', 'lines', 'city', 'region'].sort());
  assert.equal(tracked.number, order.number);
  assert.equal(tracked.city, 'Fixture City');
  assert.deepEqual(Object.keys(tracked.lines[0]).sort(), ['productId', 'quantity', 'lot'].sort());
  assert(!JSON.stringify(tracked).includes('PRIVATE'));
  assert.deepEqual((await anon('select track_order($1,$2) as result', [order.number, 'wrong@fixture.test']))[0],
    (await anon('select track_order($1,$2) as result', ['TM-99999', 'wrong@fixture.test']))[0]);
  for (let i = 2; i < 10; i++) await anon('select track_order($1,$2)', [order.number.toLowerCase(), 'wrong@fixture.test']);
  await assert.rejects(() => anon('select track_order($1,$2)', [order.number, 'researcher@fixture.test']),
    (error) => error.code === '22023' && error.message === 'Too many lookups for this order. Try again in an hour.');
  await db.query("update track_lookups set at = now() - interval '61 minutes'");
  assert((await auth(buyer, 'select track_order($1,$2) as result', [order.number, 'researcher@fixture.test']))[0].result);
  assert.equal(await scalar("select exists (select 1 from track_lookups where number_hash = encode(sha256(convert_to(upper($1), 'UTF8')), 'hex'))", [order.number]), true);
  assert.equal(await scalar("select count(*)::int from track_lookups where number_hash = encode(sha256(convert_to(upper($1), 'UTF8')), 'hex') and at <= now() - interval '1 hour'", [order.number]), 0);
  assert.equal(await scalar("select count(*)::int from track_lookups where number_hash ilike 'tm-%'"), 0);
  console.log('PASS track_order_rules: email, identical misses, privacy, 10/hour, rolling expiry');

  const file = { id: '00000000-0000-4000-8000-000000000027', path: 'incoming/fixture/letter.pdf', name: 'letter.pdf', size: 123, type: 'application/pdf' };
  await service("select system_create_application_uploads($1, encode(sha256(convert_to('fixture-claim', 'UTF8')), 'hex'))", [JSON.stringify([file])]);
  const claim = (token, email, ids = [file.id]) => anon('select claim_application_uploads($1,$2,$3) as count', [token, email, ids]);
  assert.equal((await claim('wrong', app.email))[0].count, 0);
  assert.equal((await claim('fixture-claim', 'wrong@fixture.test'))[0].count, 0);
  await db.query("update applications set submitted_at = now() - interval '61 minutes' where id = $1", [app.id]);
  assert.equal((await claim('fixture-claim', app.email))[0].count, 0);
  await db.query('update applications set submitted_at = now() where id = $1', [app.id]);
  assert.equal((await claim('fixture-claim', ' RESEARCHER@fixture.test '))[0].count, 1);
  assert.equal((await claim('fixture-claim', app.email))[0].count, 0);
  assert.deepEqual(await scalar('select documents from applications where id = $1', [app.id]), ['letter.pdf']);
  for (const user of [owner, staff]) assert.equal((await auth(user, 'select * from application_uploads')).length, 1);
  for (const user of [buyer, partner]) assert.deepEqual(await auth(user, 'select * from application_uploads'), []);
  await denied('anon', null, 'select * from application_uploads');
  await denied('authenticated', owner, 'insert into application_uploads select * from application_uploads');
  const bucket = (await rows("select * from storage.buckets where id = 'application-files'"))[0];
  assert.equal(bucket.public, false); assert.equal(bucket.file_size_limit, 10485760);
  assert.deepEqual(bucket.allowed_mime_types.sort(), ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].sort());
  await db.exec("insert into storage.objects(bucket_id,name) values ('application-files','incoming/fixture/letter.pdf');");
  for (const user of [owner, staff]) assert.equal((await auth(user, "select * from storage.objects where bucket_id = 'application-files'")).length, 1);
  for (const user of [buyer, partner]) assert.deepEqual(await auth(user, "select * from storage.objects where bucket_id = 'application-files'"), []);
  assert.deepEqual(await anon("select * from storage.objects where bucket_id = 'application-files'"), []);
  for (const user of [owner, staff, buyer, partner]) {
    await denied('authenticated', user, "insert into storage.objects(bucket_id,name) values ('application-files','forbidden')");
    assert.deepEqual(await auth(user, "update storage.objects set name = 'forbidden' where bucket_id = 'application-files' returning *"), []);
    assert.deepEqual(await auth(user, "delete from storage.objects where bucket_id = 'application-files' returning *"), []);
  }
  console.log('PASS team_reads_documents: claim/email/hour, idempotency, bucket configuration and read-only RLS');

  for (let i = 0; i < 10; i++) assert.equal((await service("select system_take_upload_quota('fixture-subject') as ok"))[0].ok, true);
  assert.equal((await service("select system_take_upload_quota('fixture-subject') as ok"))[0].ok, false);
  await db.exec("update upload_usage set at = now() - interval '61 minutes';");
  assert.equal((await service("select system_take_upload_quota('fixture-subject') as ok"))[0].ok, true);
  for (const role of ['anon', 'authenticated']) {
    await denied(role, role === 'authenticated' ? owner : null, "select system_take_upload_quota('forbidden')");
    await denied(role, role === 'authenticated' ? owner : null, "select system_create_application_uploads('[]','forbidden')");
    await denied(role, role === 'authenticated' ? owner : null, 'select system_delete_application_upload($1)', [file.id]);
  }
  assert.equal(await scalar("select count(*)::int from cron.job where jobname = 'tm-uploads-sweep' and schedule = '0 * * * *'"), 1);
  await db.query("update application_uploads set created_at = now() - interval '25 hours' where id = $1", [file.id]);
  await service('select system_delete_application_upload($1)', [file.id]);
  assert.equal(await scalar('select count(*)::int from application_uploads'), 1, 'claimed files survive sweep');
  const stale = { ...file, id: '00000000-0000-4000-8000-000000000028', path: 'incoming/stale/letter.pdf' };
  await service("select system_create_application_uploads($1, 'fixture-hash')", [JSON.stringify([stale])]);
  await service('select system_delete_application_upload($1)', [stale.id]);
  assert.equal(await scalar('select count(*)::int from application_uploads'), 2, 'fresh files survive sweep');
  await db.query("update application_uploads set created_at = now() - interval '25 hours' where id = $1", [stale.id]);
  await service('select system_delete_application_upload($1)', [stale.id]);
  assert.equal(await scalar('select count(*)::int from application_uploads'), 1);
  console.log('PASS uploads_flow: rolling quota, service-only RPC writes, hourly sweep and age/claim guards');
  console.log(JSON.stringify({ sql_validated: true, anon_no_prices: true, track_order_rules: true, uploads_flow: true, team_reads_documents: true, rerunnable: true }));
} finally { await db.close(); }
