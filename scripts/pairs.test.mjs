/** WP-20: deterministic catalog rules and Node-rendered bag/cart checks. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const temp = await mkdtemp('/private/tmp/truemark-pairs-');
globalThis.localStorage = globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = new EventTarget();
globalThis.BroadcastChannel = undefined;
async function bundle(mode) {
  const outfile = join(temp, `${mode}.mjs`);
  await build({ stdin: { resolveDir: root, loader: 'tsx', contents: `
    import { createElement as h } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { MemoryRouter } from 'react-router-dom';
    import { ShopContext } from './src/shop/context';
    import { BagContents, CartPage } from './src/shop/pages/checkout/Bag';
    export { pairsFor } from './src/shop/pairs';
    export { products } from './src/data';
    export { productCutout } from './src/shop/catalog';
    export const render = (drawer, cart, extra = {}) => renderToStaticMarkup(h(ShopContext.Provider,
      { value: { cart, add() {}, change() {}, clear() {}, openCart() {}, closeCart() {}, ...extra } },
      h(MemoryRouter, {}, h(drawer ? BagContents : CartPage))));
  ` }, outfile, bundle: true, format: 'esm', platform: 'node', loader: { '.css': 'empty' },
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    define: { 'import.meta.env': JSON.stringify({ VITE_PLATFORM: mode, BASE_URL: '/', PROD: false }), 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  return import(pathToFileURL(outfile));
}
const preview = await bundle('preview');
const live = await bundle('live');
const { pairsFor, products } = preview;
const water = 'bacteriostatic-water-10-ml';
const bpc = 'bpc-157-10-mg';
const bag = (...ids) => ids.map((id) => ({ id, quantity: 1 }));
const ids = (suggestions) => suggestions.map((product) => product.id);
const catalogWith = (edits) => products.map((product) => ({ ...product, ...edits[product.id] }));

test('any lyophilized powder gives BAC water sole priority, using its catalog record', () => {
  for (const product of products.filter((product) => product.form === 'Lyophilized powder')) {
    const suggested = pairsFor(products, bag(product.id));
    assert.deepEqual(ids(suggested), [water]);
    assert.equal(suggested[0], products.find((product) => product.id === water));
  }
  const changedForm = catalogWith({ [bpc]: { form: 'Research diluent' } });
  assert(!ids(pairsFor(changedForm, bag(bpc))).includes(water), 'Form, not category or name, triggers water');
});

test('BAC already in the bag switches to same-class siblings, excluding every bag item', () => {
  assert.deepEqual(ids(pairsFor(products, bag(bpc, water))), ['bpc-tb-1010-mg', 'kpv-10-mg']);
  assert.deepEqual(ids(pairsFor(products, bag(bpc, water, 'kpv-10-mg'))), ['bpc-tb-1010-mg']);
});

test('classes rank by distinct bag lines, not quantities, and names break ties', () => {
  const mixed = [{ id: bpc, quantity: 99 }, ...bag('retatrutide-10-mg', 'tirzepatide-30-mg', water)];
  assert.deepEqual(ids(pairsFor(products, mixed)), ['cagrilintide-10-mg', 'retatrutide-20-mg']);
  assert.deepEqual(ids(pairsFor(products, bag(bpc, 'tesamorelin-10-mg', water))), ['bpc-tb-1010-mg', 'cjc-ipa-1010-mg']);
});

test('a depleted top class fills the remaining slot from the next represented class', () => {
  const held = bag('retatrutide-10-mg', 'tirzepatide-30-mg', bpc, water);
  const keep = new Set([...held.map((line) => line.id), 'semaglutide-20-mg', 'kpv-10-mg']);
  assert.deepEqual(ids(pairsFor(products.filter((product) => keep.has(product.id)), held)), ['semaglutide-20-mg', 'kpv-10-mg']);
});

test('inactive or sold-out BAC falls back to siblings; inactive and sold-out siblings are excluded', () => {
  for (const unavailable of [{ stock: 0 }, { active: false }]) {
    const catalog = catalogWith({ [water]: unavailable, 'bpc-tb-1010-mg': { stock: 0 }, 'kpv-10-mg': { active: false } });
    assert.deepEqual(pairsFor(catalog, bag(bpc)), []);
    assert.deepEqual(ids(pairsFor(catalogWith({ [water]: unavailable }), bag(bpc))), ['bpc-tb-1010-mg', 'kpv-10-mg']);
  }
  assert.deepEqual(ids(pairsFor(catalogWith({ [water]: { stock: 1 } }), bag(bpc))), [water]);
  assert.deepEqual(ids(pairsFor(catalogWith({ [water]: { stock: null } }), bag(bpc))), [water]);
});

test('empty, unknown-only and exhausted bags have no suggestions; results never exceed two', () => {
  assert.deepEqual(pairsFor(products, []), []);
  assert.deepEqual(pairsFor(products, bag('unknown')), []);
  assert.deepEqual(pairsFor(products, bag(water)), []);
  assert.deepEqual(pairsFor(products, bag(...products.map((product) => product.id))), []);
  for (const first of products) for (const second of products) {
    const held = bag(first.id, second.id, water);
    const suggested = pairsFor(products, held);
    assert(suggested.length <= 2);
    assert.equal(new Set(ids(suggested)).size, suggested.length);
    assert(suggested.every((product) => !held.some((line) => line.id === product.id)));
  }
});

test('suggestions require a real finite catalog price, while a recorded zero price is valid', () => {
  for (const price of [undefined, NaN, Infinity, -1]) assert(!ids(pairsFor(catalogWith({ [water]: { price } }), bag(bpc))).includes(water));
  assert.equal(pairsFor(catalogWith({ [water]: { price: 0 } }), bag(bpc))[0].price, 0);
});

test('sorting is stable across catalog order, uses numeric sizes, and never mutates inputs', () => {
  const held = Object.freeze(bag('cagrilintide-10-mg', 'semaglutide-20-mg', 'tirzepatide-30-mg', water).map(Object.freeze));
  const catalog = Object.freeze(products.map((product) => Object.freeze({ ...product })));
  const before = JSON.stringify(catalog);
  const expected = ['retatrutide-10-mg', 'retatrutide-20-mg'];
  assert.deepEqual(ids(pairsFor(catalog, held)), expected);
  assert.deepEqual(ids(pairsFor([...catalog].reverse(), held)), expected);
  assert.equal(JSON.stringify(catalog), before);
});

test('current catalog edits and availability changes are reflected on the next call', () => {
  const catalog = catalogWith({ [water]: { stock: 0 } });
  assert(!ids(pairsFor(catalog, bag(bpc))).includes(water));
  const updated = catalog.find((product) => product.id === water);
  updated.stock = 2;
  updated.description = 'Fixture catalog edit';
  const suggested = pairsFor(catalog, bag(bpc));
  assert.equal(suggested[0], updated);
  assert.equal(suggested[0].description, 'Fixture catalog edit');
});

test('both modes render the same compact suggestions in the drawer and cart summary, with original cutouts and exact add labels', () => {
  for (const mode of [preview, live]) for (const drawer of [true, false]) {
    const html = mode.render(drawer, bag(bpc));
    assert.match(html, />Pairs with<\/h3>/);
    assert.match(html, /aria-label="Add BAC Water 10 mL to cart"/);
    assert(html.includes(`src="${mode.productCutout(mode.products.find((product) => product.id === water), 'sm')}"`));
    assert.equal((html.match(/class="tm-pair"/g) ?? []).length, 1);
    assert(html.indexOf('class="tm-bag-lines"') < html.indexOf('class="tm-pairs"') || !drawer);
    assert(html.indexOf('class="tm-pairs"') < html.indexOf(drawer ? 'class="tm-bag-foot"' : '<dt>Subtotal</dt>'));
    assert(!mode.render(drawer, []).includes('class="tm-pairs"'));
    assert(!mode.render(drawer, bag(water)).includes('class="tm-pairs"'));
  }
});

test('add controls are disabled while live availability is loading or failed', () => {
  for (const state of [{ catalogChecking: true }, { catalogError: 'Fixture unavailable' }]) {
    for (const drawer of [true, false]) assert.match(live.render(drawer, bag(bpc), state), /class="tm-pair-add" disabled=""/);
  }
  assert.doesNotMatch(live.render(true, bag(bpc)), /class="tm-pair-add" disabled=""/);
});

test('drawer keeps its three content-sized rows; suggestion controls cover five states and reduced motion', async () => {
  const css = await readFile(join(root, 'src/shop/pages/checkout/checkout.css'), 'utf8');
  assert.match(css, /grid-template-rows: auto minmax\(0, auto\) auto;\s*align-content: start;/);
  for (const state of [':hover', ':focus-visible', ':active', ':disabled']) assert(css.includes(`.tm-pair-add${state}`));
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.tm \.tm-pair-add,[\s\S]*transition: none;/);
});
