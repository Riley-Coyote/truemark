// WP-28: the release gate is the certificates' own specification, in SQL and in the release drawer.
// Every migration runs twice on PGlite (createPlatformDb); no Supabase endpoint is involved.
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createPlatformDb } from './lib/platform-db.mjs';

globalThis.fetch = async () => { throw new Error('External network forbidden in certificate SQL proofs'); };
const root = resolve(import.meta.dirname, '..');
const temp = await mkdtemp('/private/tmp/truemark-wp28-sql-');
await build({ entryPoints: [join(root, 'src/platform/certificate-records.ts')], outfile: join(temp, 'records.mjs'), bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const { certificates, resultsFor, releaseProblem } = await import(pathToFileURL(join(temp, 'records.mjs')));
const { manifest } = { manifest: JSON.parse(await readFile(join(root, 'src/platform/certificate-manifest.json'), 'utf8')) };

const h = await createPlatformDb();
const { db, rows, auth, anon, denied, person, migrations } = h;
const checks = {};
const pass = (name, detail) => console.log(`PASS ${name}: ${detail}`);
const release = 'select * from public.release_lot($1,$2::jsonb,$3,$4::date,$5)';
try {
  assert.deepEqual(migrations.filter(name => name.startsWith('20261006')), ['20261006000000_certificates.sql', '20261006000100_cjc_tested_size.sql']);
  // CJC (No DAC) / Ipamorelin moves to the size and lot its certificate tested; its first listing's lot stays on file.
  assert.deepEqual(await rows("select size, lot from public.products where id = 'cjc-ipa-1010-mg'"), [{ size: '5 mg / 5 mg', lot: 'TM-CJI5-2609-01' }]);
  assert.deepEqual((await rows("select lot, status from public.lots where product_id = 'cjc-ipa-1010-mg' order by lot")).map((l) => `${l.lot} ${l.status}`), ['TM-CJI10-2609-01 testing', 'TM-CJI5-2609-01 testing']);
  checks.cjc_tested_size = 'product 5 mg / 5 mg on lot TM-CJI5-2609-01; TM-CJI10-2609-01 kept, untouched';
  const owner = await person('owner@certificates.fixture', 'owner');
  const staff = await person('staff@certificates.fixture', 'staff');
  const buyer = await person('buyer@certificates.fixture');

  // The signature and grants are unchanged: team members through RLS-checked RPC, nobody else.
  const fn = (await rows("select pg_get_function_identity_arguments(p.oid) as args, p.prosecdef, p.proconfig from pg_proc p where p.proname = 'release_lot'"));
  assert.equal(fn.length, 1);
  assert.equal(fn[0].args, 'lot text, results jsonb, reference text, tested_at date, coa_path text');
  assert.equal(fn[0].prosecdef, true); assert.deepEqual(fn[0].proconfig, ['search_path=public']);
  const grants = await rows("select grantee from information_schema.routine_privileges where routine_name = 'release_lot' and privilege_type = 'EXECUTE' order by grantee");
  assert.deepEqual(grants.map((g) => g.grantee).filter((g) => g !== 'postgres'), ['authenticated']);

  // Accepts: all 19 real certificates, exactly as the import sends them.
  for (const entry of certificates) {
    assert.equal(releaseProblem(resultsFor(entry)), null, `${entry.lot}: drawer check`);
    await db.query("update public.lots set status = 'testing', results = '[]', reference = null, tested_at = null, coa_path = null, released_at = null where lot = $1", [entry.lot]);
    await auth(staff, "insert into storage.objects(bucket_id,name) values ('certificates',$1) on conflict do nothing", [`${entry.lot}.pdf`]);
    const [lot] = await auth(owner, release, [entry.lot, JSON.stringify(resultsFor(entry)), entry.certificate, entry.analyzed, `${entry.lot}.pdf`]);
    assert.equal(lot.status, 'released', entry.lot);
    assert.equal(lot.reference, entry.certificate); assert.equal(lot.tested_at.toISOString().slice(0, 10), entry.analyzed);
    assert.deepEqual(lot.results, resultsFor(entry));
    const lookup = (await anon('select public.lot_lookup($1) as result', [entry.lot]))[0].result;
    assert.equal(lookup.status, 'released'); assert.deepEqual(lookup.results, resultsFor(entry));
  }
  // An older record's MS identity still counts.
  const legacy = [{ label: 'Purity', method: 'HPLC', value: '99.0', unit: '%' }, { label: 'Identity', method: 'Mass spectrometry', value: 'Confirmed', unit: '' }];
  assert.equal(releaseProblem(legacy), null);
  checks.gate_accepts = `all ${certificates.length} certificates (and an MS "Confirmed" record)`;
  pass('gate_accepts', checks.gate_accepts);

  // Rejects, with the same message from SQL and the drawer, leaving the lot untouched.
  const single = resultsFor(certificates.find((entry) => entry.lot === 'TM-BPC10-2609-01'));
  const glow = resultsFor(certificates.find((entry) => entry.lot === 'TM-GLW70-2609-01'));
  const swap = (results, label, patch) => results.map((result) => (result.label === label ? { ...result, ...patch } : result));
  const target = 'TM-CJI10-2609-01';
  await auth(staff, "insert into storage.objects(bucket_id,name) values ('certificates',$1)", [`${target}.pdf`]);
  const before = await rows('select * from public.lots where lot = $1', [target]);
  assert.equal(before[0].status, 'testing');
  const cases = [
    ['purity 94.9', swap(single, 'Purity', { value: '94.9' }), 'HPLC purity must be at least 95.0'],
    ['a blend with one component at 94.9', swap(glow, 'Purity · TB-500', { value: '94.9' }), 'HPLC purity must be at least 95.0'],
    ['identity "Does not conform"', swap(single, 'Identity', { value: 'Does not conform' }), 'Identity must conform'],
    ['a blend component that does not conform', swap(glow, 'Identity · BPC-157', { value: 'Does not conform' }), 'Identity must conform'],
    ['no identity row', single.filter((result) => result.label !== 'Identity'), 'Release needs HPLC purity at least 95.0 and a conforming identity for every component'],
    ['a blend component without identity', glow.filter((result) => result.label !== 'Identity · GHK-Cu'), 'Release needs HPLC purity at least 95.0 and a conforming identity for every component'],
    ['a blend component without purity', glow.filter((result) => result.label !== 'Purity · GHK-Cu'), 'Release needs HPLC purity at least 95.0 and a conforming identity for every component'],
    ['MS "Not confirmed"', [legacy[0], { ...legacy[1], value: 'Not confirmed' }], 'Identity must conform'],
    ['no purity row', single.filter((result) => result.label !== 'Purity'), 'Release needs HPLC purity at least 95.0 and a conforming identity for every component'],
    ['a non-numeric purity', swap(single, 'Purity', { value: '99.5%' }), 'HPLC purity must be a number at least 95.0'],
    ['an extra key', [{ ...single[0], extra: 'No' }, ...single.slice(1)], 'Each result needs label, method, value and unit strings'],
  ];
  for (const [name, results, message] of cases) {
    assert.equal(releaseProblem(results), message, `${name}: drawer`);
    await assert.rejects(() => auth(owner, release, [target, JSON.stringify(results), 'TB-FIXTURE-0000-01', '2026-10-01', `${target}.pdf`]),
      (error) => { assert.equal(error.code, '22023', name); assert.equal(error.message, message, name); return true; }, name);
  }
  // A missing PDF: the results pass; the upload is what's missing.
  const unuploaded = 'TM-FIXTURE-NOPDF';
  await db.query("insert into public.lots(lot, product_id, status, results) values ($1, 'bpc-157-10-mg', 'testing', '[]')", [unuploaded]);
  await assert.rejects(() => auth(owner, release, [unuploaded, JSON.stringify(single), 'TB-FIXTURE-0000-01', '2026-10-01', `${unuploaded}.pdf`]),
    (error) => { assert.equal(error.code, '22023'); assert.equal(error.message, 'Upload the certificate before releasing the lot'); return true; });
  assert.deepEqual(await rows('select * from public.lots where lot = $1', [target]), before, 'rejections leave the lot untouched');
  checks.gate_rejects = [...cases.map(([name]) => name), 'a missing PDF'].join('; ');
  pass('gate_rejects', checks.gate_rejects);

  // Only the team releases.
  await denied('authenticated', buyer, release, [target, JSON.stringify(single), 'TB-FIXTURE-0000-01', '2026-10-01', `${target}.pdf`]);
  await denied('anon', null, release, [target, JSON.stringify(single), 'TB-FIXTURE-0000-01', '2026-10-01', `${target}.pdf`]);
  checks.gate_team_only = true;
  pass('gate_team_only', 'buyers and anonymous callers are refused');

  // The drawer's rule and the SQL agree on the edge of the specification.
  for (const value of ['95.0', '95', '95.00', '94.99', '094.99', '95.000000000000000001', '94.999999999999999999']) {
    const results = swap(single, 'Purity', { value });
    const drawer = releaseProblem(results);
    const lot = `TM-FIXTURE-${value.replace(/\W/g, '')}`;
    await db.query("insert into public.lots(lot, product_id, status, results) values ($1, 'bpc-157-10-mg', 'testing', '[]')", [lot]);
    await auth(staff, "insert into storage.objects(bucket_id,name) values ('certificates',$1)", [`${lot}.pdf`]);
    const sql = await auth(owner, release, [lot, JSON.stringify(results), 'TB-FIXTURE-0000-01', '2026-10-01', `${lot}.pdf`]).then(() => null, (error) => error.message);
    assert.equal(drawer, sql, `purity ${value}`);
  }
  checks.drawer_matches_sql = true;
  pass('drawer_matches_sql', 'same verdict and message at 95.0, 95, 94.99 and beyond float precision');
  assert.equal(manifest.specification.purity, '95.0');
  checks.rerunnable = true;
  pass('rerunnable', 'every migration applied twice in production order');
} finally {
  await db.close();
}
console.log(JSON.stringify({ sql_validated: true, ...checks }, null, 2));
