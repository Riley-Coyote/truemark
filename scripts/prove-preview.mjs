/** Deterministic API equivalence, including persistence and notifications. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const temp = await mkdtemp('/private/tmp/truemark-preview-proof-');
const base = process.argv[2] ?? '012a29d';
const files = ['src/data.ts', ...['store', 'seed', 'types', 'storage', 'notifications', 'events'].map((name) => `src/platform/${name}.ts`)];
for (const file of files) {
  const target = join(temp, 'base', file);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, execFileSync('git', ['show', `${base}:${file}`], { cwd: root }));
}
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...args) { super(...(args.length ? args : ['2026-10-01T12:34:56.000Z'])); }
  static now() { return new RealDate('2026-10-01T12:34:56.000Z').valueOf(); }
}
async function exercise(sourceRoot, label) {
  const out = join(temp, `${label}.mjs`);
  await build({ stdin: { contents: `export * from './src/platform/store.ts'; export * from './src/platform/notifications.ts'; export * from './src/platform/events.ts'; export * as seed from './src/platform/seed.ts';`, resolveDir: sourceRoot }, outfile: out, bundle: true, format: 'esm', platform: 'node', nodePaths: [join(root, 'node_modules')], define: { 'import.meta.env.VITE_PLATFORM': '"preview"', 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  globalThis.Date = FixedDate;
  let rng = 13;
  Math.random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 2 ** 32; };
  const storage = new Map();
  const broadcasts = [];
  const channels = [];
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key), clear: () => storage.clear() };
  globalThis.window = Object.assign(new EventTarget(), { setTimeout: (callback) => { callback(); return 1; } });
  globalThis.BroadcastChannel = class extends EventTarget {
    constructor(name) { super(); this.name = name; channels.push(name); }
    postMessage(value) { broadcasts.push({ channel: this.name, value }); }
    close() {}
  };
  const { store, seed, quote, notices, onPlatformEvent } = await import(pathToFileURL(out));
  const events = [];
  const stop = onPlatformEvent((event, fromHere) => events.push({ event, fromHere }));
  const snapshot = async () => ({ session: await store.session.get(), orders: await store.orders.list(), lots: await store.lots.list(), buyers: await store.buyers.list(), applications: await store.applications.list(), partners: await store.partners.list(), me: await store.partners.me(), referrals: await store.partners.referrals(), payouts: await store.partners.payouts(), shipping: await store.catalog.shippingMethods(), discounts: await store.partners.discounts(), visits: await store.partners.visits(seed.demoPartnerId) });
  const result = { seed: await snapshot() };
  result.signIn = await store.session.signIn('fixture@example.test');
  const partner = await store.partners.get(seed.demoPartnerId);
  const buyer = await store.buyers.get(seed.demoBuyerId);
  const draft = { lines: [{ productId: 'bpc-157-10-mg', quantity: 2 }], address: buyer.addresses[0], shipping: 'cold-2day', discountCode: partner.code, via: 'link' };
  result.validCode = await store.catalog.validateCode(` ${partner.code.toLowerCase()} `);
  result.invalidCode = await store.catalog.validateCode('unknown');
  result.quote = quote(draft);
  result.placed = await store.orders.place(buyer.id, draft);
  result.advances = [];
  for (const status of ['paid', 'packed', 'shipped', 'delivered']) result.advances.push(await store.orders.advance(result.placed.id, status, status === 'shipped' ? { carrier: 'UPS', tracking: 'FIXTURE-TRACKING', note: 'Dispatched cold' } : {}));
  result.byNumber = await store.orders.get(result.placed.number);
  result.buyerOrders = await store.orders.listForBuyer(buyer.id);
  result.application = await store.applications.submit({ name: 'Fixture Researcher', email: 'fixture@example.test', role: 'Researcher', institution: 'Fixture Lab', institutionType: 'Laboratory', researchArea: 'Assays', intendedUse: 'Controlled laboratory assay development.', documents: ['fixture.pdf'], attestations: ['research-only'] });
  result.review = await store.applications.review(result.application.id, 'approved', 'Fixture approval');
  result.lot = await store.lots.setStatus(result.seed.lots[0].lot, 'released');
  result.lookup = await store.lots.get(` ${result.lot.lot.toLowerCase()} `);
  result.notices = {};
  for (const audience of ['owner', `buyer:${buyer.id}`, `partner:${partner.id}`]) {
    const before = notices.list(audience);
    notices.markRead(audience, before.slice(0, 1).map((n) => n.id));
    result.notices[audience] = { before, after: notices.list(audience) };
  }
  await store.session.signOut();
  result.final = await snapshot();
  result.events = events;
  result.broadcasts = broadcasts;
  result.channels = channels;
  result.storage = [...storage];
  stop();
  const json = JSON.stringify(result, null, 2) + '\n';
  await writeFile(join(temp, `${label}.json`), json);
  return json;
}
const original = await exercise(join(temp, 'base'), 'base');
const current = await exercise(root, 'current');
assert.equal(current, original, `Preview drift. Compare ${temp}/base.json and current.json`);
assert.equal(await readFile(join(temp, 'base.json'), 'utf8'), await readFile(join(temp, 'current.json'), 'utf8'));
console.log(`PASS preview_unchanged: ${base} and current store output are byte-identical (${Buffer.byteLength(current)} bytes, SHA-256 ${createHash('sha256').update(current).digest('hex')}).`);
console.log(`Proof snapshots: ${temp}`);
