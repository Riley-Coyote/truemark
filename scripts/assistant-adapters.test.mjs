import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url), values = new Map();
globalThis.fetch = async () => { throw new Error('External network forbidden'); };
globalThis.window = Object.assign(new EventTarget(), { setTimeout: (fn) => { queueMicrotask(fn); return 1; } });
globalThis.localStorage = globalThis.sessionStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
globalThis.BroadcastChannel = class extends EventTarget { postMessage() {} close() {} };

async function bundle(mode) {
  const dir = await mkdtemp('/private/tmp/wp17-adapters-'), file = join(dir, 'adapter.cjs');
  await build({ stdin: { contents: `export { store } from './src/assistant/store'; export { content } from './src/platform/content'; export { recordFromLot } from './src/shop/records'; export { createToolRuntime } from './src/assistant/runtime'; export { worldNow } from './src/platform/storage'; import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import { AssistantSettings } from './src/assistant/Settings'; export const settingsMarkup = () => renderToStaticMarkup(React.createElement(AssistantSettings));`, resolveDir: root, loader: 'ts' },
    outfile: file, bundle: true, format: 'cjs', platform: 'node', loader: { '.css': 'empty' }, logLevel: 'silent',
    define: { 'import.meta.env': JSON.stringify({ VITE_PLATFORM: mode, BASE_URL: '/', PROD: false }), 'process.env.NODE_ENV': '"production"' },
    plugins: mode === 'live' ? [{ name: 'fixture-client', setup(plugin) { plugin.onLoad({ filter: /platform\/live\/client\.ts$/ }, () => ({ contents: 'export const getClient = () => globalThis.assistantFixture;', loader: 'js' })); } }] : [] });
  return require(file);
}
test('preview read helpers and confirmed writes use the shared sample world; drafts never publish', async () => {
  const { store, content, recordFromLot, settingsMarkup } = await bundle('preview');
  const settings = settingsMarkup(); assert.match(settings, /Visitor model/); assert.match(settings, /Partner model/); assert.match(settings, /Owner model/); assert.match(settings, /fieldset[^>]+disabled/); assert.match(settings, /Test visitor assistant/); assert.match(settings, /live platform, for the signed-in owner/);
  await assert.rejects(store.assistant.saveModels({ visitor: 'fixture', partner: 'fixture', owner: 'fixture' }), /live platform/);
  assert.deepEqual(await store.assistant.capabilities(), { updateProduct: false });
  assert((await store.assistant.products()).length > 0);
  const lots = await store.lots.list(), lot = lots.find((l) => l.status === 'released');
  assert(lot); assert.deepEqual(recordFromLot(await store.lots.get(lot.lot)).results, lot.results);
  const code = await store.actions.createDiscount({ code: 'WP17FIXTURE', percent: 10, active: true });
  assert.equal((await store.catalog.validateCode(code.code)).percent, 10);
  await assert.rejects(store.actions.createDiscount({ code: code.code, percent: 20, active: false }), /already exists/);
  const input = { id: 'must-not-overwrite', title: 'Fixture', slug: 'wp17-fixture', excerpt: 'For research use only.', bodyMd: 'Fixture text.', status: 'published', publishedAt: '2026-09-01', readingMinutes: 1, kicker: '', author: 'Fixture author' };
  const saved = await store.actions.saveDraft(input);
  assert.equal(saved.status, 'draft'); assert.equal(saved.publishedAt, undefined); assert.notEqual(saved.id, input.id);
  assert((await content.articles.list(true)).some((a) => a.id === saved.id));
  assert(!(await content.articles.list()).some((a) => a.id === saved.id));
  assert.equal(await content.articles.get(saved.slug), null);
  const approved = await store.actions.approveCommissions(); assert(approved >= 0);
  const candidate = (await store.partners.referrals()).find((r) => r.status === 'approved');
  if (candidate) {
    const payout = await store.actions.recordPayout(candidate.partnerId, '2020-01-01', '2030-01-01', 'Fixture transfer');
    assert((await store.partners.payouts(candidate.partnerId)).some((p) => p.id === payout.id));
    assert.equal((await store.partners.referrals(candidate.partnerId)).find((r) => r.id === candidate.id).status, 'paid');
    await assert.rejects(store.actions.recordPayout(candidate.partnerId, '2020-01-01', '2030-01-01', 'Fixture transfer'), /No approved/);
  }
});
test('live assistant reads use the injected user client; catalog detection is read-only and writes verify RPC results', async () => {
  const calls = []; let supported = false, droppedStock = false;
  const tables = { profiles: [{ id: 'fixture-user', role: 'owner' }], products: [{ id: 'fixture-product', name: 'Fixture product', size: '10 mg', category: 'fixture', price: 50, stock: null, description: null, active: true, form: 'Lyophilized powder', lot: 'FIXTURE' }], articles: [] };
  globalThis.assistantFixture = {
    auth: { onAuthStateChange() {}, async getSession() { return { data: { session: { user: { id: 'fixture-user' } } }, error: null }; } },
    from(table) {
      const filters = {}, q = { select() { calls.push(['read', table]); return q; }, eq(key, value) { filters[key] = value; return q; }, order() { return q; }, range() { return q; }, returns() { return q; },
        then(resolve) { return Promise.resolve({ data: (tables[table] ?? []).filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value)), error: null }).then(resolve); } }; return q;
    },
    async rpc(name, args) {
      calls.push(['rpc', name, args]);
      if (name === 'update_assistant_settings') return { data: args.draft, error: null };
      if (name === 'assistant_capabilities') return { data: { updateProduct: supported, productArgument: supported ? 'draft' : null }, error: null };
      if (name === 'upsert_product') { if (args.draft.expectedStock !== tables.products[0].stock) return { data: null, error: { message: 'Stock changed.' } }; const product = { ...args.draft }; if (droppedStock) delete product.stock; tables.products[0] = product; return { data: product, error: null }; }
      if (name === 'create_discount_code') return { data: { ...args, kind: 'promo' }, error: null };
      if (name === 'upsert_article') return { data: { ...args.article, id: 'draft-id', updated_at: '2026-10-01' }, error: null };
      throw new Error('Unexpected RPC');
    },
  };
  const { store } = await bundle('live');
  assert.equal((await store.assistant.identity()).role, 'owner');
  const models = { visitor: 'fixture/visitor', partner: 'fixture/partner', owner: 'fixture/owner' }; assert.deepEqual(await store.assistant.saveModels(models), models); assert.deepEqual(calls.find(([, name]) => name === 'update_assistant_settings')[2], { draft: models });
  assert.equal((await store.assistant.products())[0].stock, null);
  assert.equal((await store.assistant.productRecord('fixture-product')).price, 50);
  assert.equal((await store.assistant.capabilities()).updateProduct, false);
  await assert.rejects(store.actions.updateProduct('fixture-product', { price: 40 }), /Catalog editing arrives with the next update/);
  assert(!calls.some(([, name]) => name === 'upsert_product'));
  supported = true;
  const result = await store.actions.updateProduct('fixture-product', { price: 40, stock: 20, injected: 'ignored' });
  assert.deepEqual(result, { id: 'fixture-product', price: 40, stock: 20 });
  assert.equal(calls.find(([, name]) => name === 'upsert_product')[2].draft.expectedStock, null);
  assert.equal(tables.products[0].name, 'Fixture product'); assert.equal(tables.products[0].injected, undefined);
  await assert.rejects(store.actions.updateProduct('fixture-product', { stock: 30 }, null), /Stock changed/); assert.equal(tables.products[0].stock, 20);
  droppedStock = true;
  await assert.rejects(store.actions.updateProduct('fixture-product', { stock: 25 }), /could not be verified/);
  const saved = await store.actions.saveDraft({ id: 'injected', slug: 'fixture', title: 'Fixture', excerpt: '', bodyMd: 'For research use only.', kicker: '', status: 'published', publishedAt: '2026-10-01', readingMinutes: 1, author: 'Fixture' });
  assert.equal(saved.status, 'draft'); const article = calls.find(([, name]) => name === 'upsert_article')[2].article;
  assert.equal(article.id, undefined); assert.equal(article.published_at, null);
  await store.actions.createDiscount({ code: 'FIXTURE', percent: 10, active: false });
  assert(calls.some(([, name]) => name === 'create_discount_code'));
  assert(!calls.some(([type]) => ['insert', 'update', 'delete'].includes(type)));
});
