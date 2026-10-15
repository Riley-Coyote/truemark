/** WP-15: Node-only quote and render checks. No hosted services or browser. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const temp = await mkdtemp('/private/tmp/truemark-wp15-');
const values = new Map();
globalThis.localStorage = globalThis.sessionStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
globalThis.window = Object.assign(new EventTarget(), { setTimeout: (fn) => { queueMicrotask(fn); return 1; }, clearTimeout() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
globalThis.document = { hidden: false, baseURI: 'https://fixture.example/' };
globalThis.BroadcastChannel = class extends EventTarget { postMessage() {} close() {} };
async function bundle(mode) {
  const outfile = join(temp, `${mode}.mjs`);
  await build({ stdin: { resolveDir: root, loader: 'tsx', contents: `
    export * as data from './src/data.ts';
    export * as preview from './src/platform/preview/store.ts';
    export * as pricing from './src/platform/pricing.ts';
    export * as catalog from './src/shop/catalog.ts';
    export * as commerce from './src/platform/commerce.ts';
    export { createLiveAdapter } from './src/platform/live/adapter.ts';
    import { createElement as h } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { MemoryRouter, Routes, Route } from 'react-router-dom';
    import { ShopContext } from './src/shop/context.tsx';
    import { ProductCard } from './src/brand/ProductCard.tsx';
    import { ProductEditor, ClassesEditor } from './src/admin/Commerce.tsx';
    import { InsuranceRow } from './src/shop/Insurance.tsx';
    import { CartPage } from './src/shop/pages/checkout/Bag.tsx';
    import ProductPage from './src/shop/pages/Product.tsx';
    import Gate from './src/brand/Gate.tsx';
    import Verify from './src/shop/pages/Verify.tsx';
    import { MistOpening } from './src/brand/MistOpening.tsx';
    import { compounds, refreshCatalog } from './src/shop/catalog.ts';
    import { products, previewCategories } from './src/data.ts';
    const wrap = (element, path = '/', cart = []) => renderToStaticMarkup(h(ShopContext.Provider,
      { value: { cart, add() {}, change() {}, clear() {}, openCart() {}, closeCart() {} } },
      h(MemoryRouter, { initialEntries: [path] }, element)));
    export const card = () => { refreshCatalog(); return wrap(h(ProductCard, { compound: compounds.find((c) => c.name === 'BPC-157') })); };
    export const page = () => wrap(h(Routes, {}, h(Route, { path: '/product/:id', element: h(ProductPage) })), '/product/bpc-157-10-mg');
    export const cart = (quantity = 1) => wrap(h(CartPage), '/cart', [{ id: 'bpc-157-10-mg', quantity }]);
    export const editor = () => wrap(h(ProductEditor, { product: products[0], classes: previewCategories(), onSaved() {} }));
    export const classes = () => wrap(h(ClassesEditor, { classes: previewCategories(), onSaved() {} }));
    export const insurance = (props) => renderToStaticMarkup(h('dl', {}, h(InsuranceRow, props)));
    export const gate = () => wrap(h(Gate));
    export const verify = () => wrap(h(Verify));
    export const opening = () => wrap(h(MistOpening));
  ` }, outfile, bundle: true, format: 'esm', platform: 'node', loader: { '.css': 'empty' },
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    define: { 'import.meta.env': JSON.stringify({ VITE_PLATFORM: mode, BASE_URL: '/', PROD: false }), 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  return import(pathToFileURL(outfile));
}
const current = await bundle('preview');
const liveRender = await bundle('live');

test('preview and the live adapter quote agree on insurance to the cent in every mode', async () => {
  const product = current.data.products[0], original = product.price;
  let settings;
  const client = { from(table) {
    let result = table === 'products' ? [{ ...product, active: true, color_ink: product.colorInk, stock: null }] : table === 'settings' ? [{ id: true,
      free_shipping_threshold: settings.freeShippingThreshold, free_shipping_method: settings.freeShippingMethod, insurance_mode: settings.insuranceMode, insurance_rate: settings.insuranceRate }]
      : table === 'shipping_methods' ? [{ id: 'cold-2day', active: true, price: 24, label: 'Cold chain · 2 business days', detail: 'Fixture' }] : [];
    const query = { select() { return query; }, eq(key, value) { result = result.filter((row) => String(row[key]) === String(value)); return query; },
      order() { return query; }, range() { return query; }, returns() { return query; }, then(resolve) { return Promise.resolve({ data: result, error: null }).then(resolve); } };
    return query;
  }, rpc: async () => ({ data: { percent: 10, partnerName: null }, error: null }) };
  const adapter = current.createLiveAdapter(client);
  try {
    for (const mode of ['off', 'optional', 'automatic']) for (const rate of [0, .0125, .03755, .5]) for (const price of [.01, 1.05, 16.99, 166.66, 166.67, 166.68, 999.99]) for (const insurance of [false, true]) {
      product.price = price;
      settings = { ...current.pricing.defaultSettings, insuranceMode: mode, insuranceRate: rate };
      values.set('tm-preview-storefront-settings', JSON.stringify(settings));
      const draft = { lines: [{ productId: product.id, quantity: 1 }], shipping: 'cold-2day', discountCode: 'FIRSTLOT', insurance, address: {} };
      const preview = current.preview.quote(draft), live = await adapter.quote(draft);
      for (const key of ['subtotal', 'discountAmount', 'base', 'insurance', 'insuranceApplied', 'total']) assert.equal(preview[key], live[key], `${mode} ${price} ${rate} ${insurance} ${key}`);
      assert.equal(preview.method.price, live.method.price);
      const cents = BigInt(Math.round(live.base * 100));
      const expected = mode === 'automatic' || (mode === 'optional' && insurance) ? Number((cents * BigInt(Math.round(rate * 100000)) + 50000n) / 100000n) / 100 : 0;
      assert.equal(live.insurance, expected);
    }
    assert.equal(current.pricing.insurancePrice(15.3, { ...current.pricing.defaultSettings, insuranceMode: 'automatic', insuranceRate: .15 }), 2.3);
    assert.equal(current.pricing.insurancePrice(.01, { ...current.pricing.defaultSettings, insuranceMode: 'automatic', insuranceRate: .5 }), .01);
  } finally { product.price = original; values.clear(); }
});

test('preview stock remains untracked, saving refuses, and the seeded world is unchanged', async () => {
  assert((await current.preview.store.catalog.products()).every((product) => product.stock === null));
  await assert.rejects(current.preview.store.catalog.saveProduct(current.data.products[0]), /Saving works in the live platform/);
  await assert.rejects(current.preview.store.catalog.saveCategory(current.data.previewCategories()[0]), /Saving works in the live platform/);
  await assert.rejects(current.preview.store.settings.save({ insuranceMode: 'automatic' }), /Saving works in the live platform/);
  const seed = await readFile(join(root, 'src/platform/seed.ts'), 'utf8');
  // Round 12 builds the sample world from the catalog as shipped (sampleCatalog), so a signed-out
  // live visit, whose catalog has no prices, cannot break it. That one import is the only change;
  // the generated world was compared export by export and is identical.
  const reference = execFileSync('git', ['show', 'ab7d6ad:src/platform/seed.ts'], { cwd: root, encoding: 'utf8' })
    .replace('import { products } from "../data";', 'import { sampleCatalog as products } from "../data";');
  // WP-28 replaced the mockup's illustrative BPC-157 record and its merge into the lot list with the
  // client's certificates (and the header's note on them); every other line is unchanged.
  const record = /\/\*\* (?:Preview-only illustrative|The featured lot)[\s\S]*?(?=\/\/ Build every first-batch row)/;
  const lotList = /(?:const certified = new Map[\s\S]*?)?export const lots: Lot\[\] = \[[\s\S]*?(?=\n  \{ lot: "SAMPLE-RT30-A")/;
  const outside = (text) => text.replace(/ \* First-batch[\s\S]*?\n(?= \* Rates)/, '').replace(record, '').replace(lotList, '')
    .replace('import { LAB, certificates, releasedFields, resultsFor } from "./certificate-records";\n', '');
  assert.match(reference.match(record)[0], /TM-COA-0114/);
  assert.match(seed.match(lotList)[0], /releasedFields\(entry\)/);
  assert.equal(outside(seed), outside(reference));
  assert.match(current.editor(), /Saving works in the live platform/);
  assert.match(current.editor(), /<fieldset disabled=""/);
});

test('sold-out products remain visible with disabled purchase controls and a blocked bag', () => {
  const product = liveRender.data.products.find((product) => product.id === 'bpc-157-10-mg');
  const original = product.stock;
  try {
    product.stock = 0;
    const card = liveRender.card(), page = liveRender.page(), bag = liveRender.cart();
    assert.match(card, /Out of stock/); assert.match(card, /class="tm-card-plus" disabled=""/);
    assert.match(page, /Out of stock/); assert.match(page, /disabled="">Add to cart/);
    assert.match(bag, /BPC-157 is out of stock/); assert.match(bag, /aria-disabled="true"/);
    product.stock = 1;
    assert.match(liveRender.cart(2), /Only 1 left of BPC-157/);
    assert.equal(liveRender.commerce.stockProblem(product, 1), null);
    product.stock = null;
    assert.equal(liveRender.commerce.stockProblem(product, 99), null);
  } finally { product.stock = original; }
});

test('product descriptions and uploaded originals are used without changing label artwork', () => {
  const product = liveRender.data.products.find((product) => product.id === 'bpc-157-10-mg');
  const original = { ...product };
  try {
    product.description = 'Client-authored description.';
    product.image = 'https://fixture.example/storage/v1/object/public/catalog/bpc-157-10-mg-1.png';
    assert.match(liveRender.page(), /Client-authored description\./);
    assert.equal(liveRender.catalog.productCutout(product), product.image);
    assert.equal(liveRender.catalog.productImage(product), product.image);
  } finally { Object.assign(product, original); }
});

test('insurance is explicit at zero when applied and absent when off', () => {
  assert.equal(current.insurance({ amount: 0, applied: false }), '<dl></dl>');
  assert.match(current.insurance({ amount: 0, applied: true }), /Insurance<\/dt><dd>\$0.00/);
  assert.match(current.insurance({ amount: 1.88, applied: true }), /\$1.88/);
});

test('deactivating catalog products keeps shared vial references safe and every vial in the opening an active one', () => {
  const products = liveRender.data.products;
  const active = products.map((product) => product.active);
  try {
    products.find((product) => product.id === 'bpc-157-10-mg').active = false;
    const opening = liveRender.opening();
    assert.equal((opening.match(/class="tm-room-vial"/g) ?? []).length, 4);
    assert(!opening.includes('data-product-id="bpc-157-10-mg"'));
    assert(!opening.includes('TM-BPC10-2609-01'));
    assert.doesNotThrow(() => liveRender.gate());
    assert.doesNotThrow(() => liveRender.verify());
    // The featured vial off sale takes its closer look with it: no film, and no stills in its place.
    assert.match(opening, /class="tm-seq-track" data-shape=/);
    products.find((product) => product.id === 'bpc-157-10-mg').active = true;
    products.find((product) => product.id === 'semax-10-mg').active = false;
    const unfeatured = liveRender.opening();
    assert.equal((unfeatured.match(/class="tm-room-vial"/g) ?? []).length, 4);
    assert.match(unfeatured, /class="tm-seq-track" data-off=""/);
    assert(!unfeatured.includes('tm-seq-stills'));
    assert(!unfeatured.includes('TM-SMX10-2609-01'));
    for (const product of products) product.active = false;
    assert.doesNotThrow(() => liveRender.opening());
    assert.doesNotThrow(() => liveRender.gate());
    assert.doesNotThrow(() => liveRender.verify());
    assert.match(liveRender.catalog.productCutout(undefined), /images\/brand\/monogram.svg$/);
    assert.match(liveRender.catalog.productImage(undefined), /images\/brand\/monogram.svg$/);
  } finally { products.forEach((product, index) => { product.active = active[index]; }); }
});

test('live class ordering and homepage flags can change without changing the rainbow order', () => {
  const expected = liveRender.catalog.compoundsForBrowsing.map((compound) => compound.lead.id);
  const classes = liveRender.data.previewCategories();
  liveRender.data.setCategories(classes.map((category) => ({ ...category, position: 10 - category.position, onHome: category.id === 'copper-peptides', name: category.id === 'copper-peptides' ? 'Fixture class name' : category.name })));
  assert.equal(liveRender.data.categories[1].id, 'lab-supplies');
  assert.deepEqual(liveRender.data.compoundClasses.map((category) => category.id), ['copper-peptides']);
  assert.equal(liveRender.data.categoryName('copper-peptides'), 'Fixture class name');
  liveRender.catalog.refreshCatalog();
  assert.deepEqual(liveRender.catalog.compoundsForBrowsing.map((compound) => compound.lead.id), expected);
  for (const state of [current, liveRender]) {
    const before = state.catalog.compoundsForBrowsing.map((compound) => compound.lead.id);
    const product = state.data.products.find((product) => product.id === 'bpc-157-10-mg');
    const category = product.category;
    try {
      product.category = 'copper-peptides';
      state.catalog.refreshCatalog();
      assert.deepEqual(state.catalog.compoundsForBrowsing.map((compound) => compound.lead.id), before, 'Reclassification cannot move unchanged label artwork in the rainbow');
    } finally { product.category = category; state.catalog.refreshCatalog(); }
  }
  const bootstrap = readFile(join(root, 'src/platform/live/bootstrap.ts'), 'utf8');
  return bootstrap.then((source) => assert.match(source, /live\(\)\.store\.catalog\.categories\(\)/));
});

test('saved preview addresses survive new reads across account, checkout and owner views without changing seed data', async () => {
  values.clear();
  const buyer = await current.preview.store.session.signIn('fixture@example.test');
  const original = structuredClone(buyer.addresses);
  const another = (await current.preview.store.buyers.list()).find(entry => entry.id !== buyer.id);
  const address = { ...original[0], id: 'preview-fixture-unique', label: 'Fixture receiving', line1: '2 Example Lane' };
  await current.preview.savePreviewAddress(buyer.id, address);
  assert.deepEqual((await current.preview.store.session.get()).addresses, [...original, address]);
  assert.deepEqual((await current.preview.store.buyers.get(buyer.id)).addresses, [...original, address]);
  await current.preview.savePreviewAddress(buyer.id, { ...address, line1: '3 Example Lane' });
  assert.equal((await current.preview.store.buyers.get(buyer.id)).addresses.length, original.length + 1);
  assert.equal((await current.preview.store.session.get()).addresses.at(-1).line1, '3 Example Lane');
  assert.deepEqual((await current.preview.store.buyers.get(another.id)).addresses, another.addresses);
  values.clear();
  assert.deepEqual((await current.preview.store.buyers.get(buyer.id)).addresses, original);
});

test('preview address saves reject missing accounts and storage failure without reporting success', async () => {
  values.clear();
  const buyer = await current.preview.store.session.signIn('fixture@example.test');
  await assert.rejects(current.preview.savePreviewAddress('missing', buyer.addresses[0]), /could not be found/);
  const write = globalThis.localStorage.setItem;
  try {
    globalThis.localStorage.setItem = () => { throw new Error('Quota exceeded'); };
    await assert.rejects(current.preview.savePreviewAddress(buyer.id, { ...buyer.addresses[0], label: 'Unsaved' }), /Quota exceeded/);
    assert.deepEqual((await current.preview.store.buyers.get(buyer.id)).addresses, buyer.addresses);
  } finally { globalThis.localStorage.setItem = write; values.clear(); }
});
