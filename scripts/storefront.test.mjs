/** WP-14: deterministic Node proofs. No browser or hosted writes. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const temp = await mkdtemp('/private/tmp/truemark-wp14-');
const base = 'b4672596ee67078d6d7d463ae5a9b8de128e3b22';
const values = new Map();
globalThis.localStorage = globalThis.sessionStorage = { getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
globalThis.window = Object.assign(new EventTarget(), { setTimeout: (callback) => { queueMicrotask(callback); return 1; }, clearTimeout() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
globalThis.document = { hidden: false, baseURI: 'https://fixture.example/' };
globalThis.BroadcastChannel = class extends EventTarget { postMessage() {} close() {} };

async function bundle(sourceRoot, name, contents, mode = 'preview') {
  const file = join(temp, `${name}.mjs`);
  await build({ stdin: { contents, resolveDir: sourceRoot, loader: 'tsx' }, outfile: file, bundle: true,
    format: 'esm', platform: 'node', nodePaths: [join(root, 'node_modules')], loader: { '.css': 'empty' },
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    define: { 'import.meta.env': JSON.stringify({ VITE_PLATFORM: mode, BASE_URL: '/', PROD: false }), 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  return import(pathToFileURL(file));
}
for (const file of ['src/data.ts', 'src/platform/seed.ts', 'src/platform/mode.ts']) {
  const target = join(temp, 'baseline', file);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, execFileSync('git', ['show', `${base}:${file}`], { cwd: root }));
}
const before = await bundle(join(temp, 'baseline'), 'before', `export * as seed from './src/platform/seed.ts'; export * as data from './src/data.ts';`);
const current = await bundle(root, 'current', `
  export * as seed from './src/platform/seed.ts'; export * as data from './src/data.ts';
  export * as preview from './src/platform/preview/store.ts'; export * as pricing from './src/platform/pricing.ts';
  export * as rows from './src/platform/live/rows.ts'; export * as catalog from './src/shop/catalog.ts';
  export * as previewInventory from './src/platform/preview/inventory.ts';
  export * as carousel from './src/brand/carousel.ts';
  export { renderToStaticMarkup } from 'react-dom/server';
  import { createElement } from 'react'; import { ShippingProgress } from './src/shop/ShippingProgress.tsx';
  export const progressMarkup = (props) => createElement(ShippingProgress, props);
`);
const snapshot = (seed) => ({ ...JSON.parse(JSON.stringify(seed)), visits: seed.partners.map((p) => seed.visitsFor(p.id)) });
// Riley (2026-10-06): CJC (No DAC) / Ipamorelin is sold at the size its certificate tested; everything else stays.
const tested = (product) => (product.id === 'cjc-ipa-1010-mg' ? { ...product, size: '5 mg / 5 mg', lot: 'TM-CJI5-2609-01' } : product);
const testedLot = (value) => JSON.parse(JSON.stringify(value).replaceAll('TM-CJI10-2609-01', 'TM-CJI5-2609-01'));
await writeFile(join(temp, 'seed-before.json'), JSON.stringify(snapshot(before.seed), null, 2));
await writeFile(join(temp, 'seed-after.json'), JSON.stringify(snapshot(current.seed), null, 2));
console.log(`Seed snapshots: ${temp}/seed-{before,after}.json`);

const expectedClasses = [
  ['metabolic-peptides', 'Metabolic peptides', 'Metabolic', '#7A39B1', 'Retatrutide · Tirzepatide · Semaglutide · Cagrilintide', 'retatrutide-10-mg', ['retatrutide-10-mg', 'retatrutide-20-mg', 'retatrutide-30-mg', 'retatrutide-60-mg', 'tirzepatide-30-mg', 'semaglutide-20-mg', 'cagrilintide-10-mg']],
  ['peptide-fragments', 'Peptide fragments', 'Peptide fragments', '#058F93', 'BPC-157 · BPC-157 / TB-500 · KPV', 'bpc-157-10-mg', ['bpc-157-10-mg', 'bpc-tb-1010-mg', 'kpv-10-mg']],
  ['copper-peptides', 'Copper peptides', 'Copper peptides', '#CC3358', 'GHK-Cu · GLOW', 'ghk-cu-100-mg', ['ghk-cu-100-mg', 'glow-70-mg']],
  ['secretagogue-peptides', 'Secretagogue peptides', 'Secretagogues', '#0273D0', 'Tesamorelin · CJC (No DAC) / Ipamorelin', 'tesamorelin-10-mg', ['tesamorelin-10-mg', 'cjc-ipa-1010-mg']],
  ['mitochondrial-peptides', 'Mitochondrial peptides', 'Mitochondrial', '#B97102', 'MOTS-C', 'mots-c-10-mg', ['mots-c-10-mg']],
  ['coenzymes-cofactors', 'Coenzymes & cofactors', 'Coenzymes', '#B97102', 'NAD+', 'nad-500-mg', ['nad-500-mg']],
  ['neuropeptides', 'Neuropeptides', 'Neuropeptides', '#4E762E', 'Semax · Selank', 'semax-10-mg', ['semax-10-mg', 'selank-10-mg']],
  ['melanocortin-analogs', 'Melanocortin analogs', 'Melanocortins', '#AB531A', 'Melanotan II', 'melanotan-ii-10-mg', ['melanotan-ii-10-mg']],
];

test('seed_only_lots_changed: the first batch carries its real certificates; stock, financial history and every other seed value remain fixed', async () => {
  const a = testedLot(snapshot(before.seed)), b = snapshot(current.seed);
  for (const key of Object.keys(a).filter((key) => !['lots', 'sampleRecord', 'shippingMethods'].includes(key))) assert.deepEqual(b[key], a[key], key);
  for (const key of ['orders', 'referrals', 'payouts']) console.log(`${key}: ${b[key].length} rows, unchanged SHA-256 ${createHash('sha256').update(JSON.stringify(b[key])).digest('hex')}`);
  // WP-14 merged the mockup's sample record into the BPC-157 lot; WP-28 replaced it with the client's certificates.
  const manifest = JSON.parse(await readFile(join(root, 'src/platform/certificate-manifest.json'), 'utf8'));
  const certified = new Map(manifest.certificates.map((entry) => [entry.lot, entry]));
  assert.equal(b.lots.length, a.lots.length - 1);
  assert.equal(new Set(b.lots.map((lot) => lot.lot)).size, b.lots.length);
  assert.deepEqual(b.lots.filter((lot) => lot.sample), a.lots.filter((lot) => lot.lot.startsWith('SAMPLE-')), 'the command center sample lots are unchanged');
  const firstBatch = a.lots.filter((lot) => lot.lot.startsWith('TM-'));
  assert.deepEqual(b.lots.filter((lot) => !lot.sample).map((lot) => lot.lot).sort(), firstBatch.map((lot) => lot.lot).sort());
  for (const base of firstBatch) {
    const lot = b.lots.find((item) => item.lot === base.lot), entry = certified.get(base.lot);
    if (!entry) { assert.deepEqual(lot, base, `${base.lot} stays as it was`); continue; }
    const { results, ...record } = lot;
    const { results: none, ...testing } = base;
    assert.deepEqual(none, [], `${base.lot} had no results`);
    // Seeded stock stays. No certificate states TrueMark's receipt date, so the sample keeps its own, which the
    // lot inventory rules require before a lot can sell.
    assert.deepEqual(record, { ...testing, status: 'released', receivedAt: testing.receivedAt, testedAt: entry.analyzed, releasedAt: entry.issued, reference: entry.certificate, coaPath: `${base.lot}.pdf`, sample: false }, base.lot);
    const rows = (label) => results.filter((result) => result.label === label || result.label.startsWith(`${label} · `));
    const suffix = (component) => (component.name ? ` · ${component.name}` : '');
    assert.deepEqual(rows('Purity'), entry.components.map((c) => ({ label: `Purity${suffix(c)}`, method: 'HPLC', value: c.purity, unit: '%' })), `${base.lot} purity`);
    assert.deepEqual(rows('Identity'), entry.components.map((c) => ({ label: `Identity${suffix(c)}`, method: 'HPLC (RT + UV vs. reference)', value: c.identity, unit: '' })), `${base.lot} identity`);
    assert.deepEqual(rows('Label claim').map((result) => result.value), entry.components.map((c) => c.claim), `${base.lot} claim`);
    assert.deepEqual(rows('% of label claim').map((result) => result.value), entry.components.map((c) => c.ofClaim), `${base.lot} % of claim`);
  }
  const bpc = [
    { label: 'Purity', method: 'HPLC', value: '99.51', unit: '%' },
    { label: 'Identity', method: 'HPLC (RT + UV vs. reference)', value: 'Conforms', unit: '' },
    { label: 'Content', method: 'HPLC', value: '12.46', unit: 'mg per vial' },
    { label: 'Label claim', method: '', value: '10', unit: 'mg' },
    { label: '% of label claim', method: '', value: '124.6', unit: '%' },
  ];
  assert.deepEqual(b.lots.find((lot) => lot.lot === 'TM-BPC10-2609-01').results, bpc);
  const { trail, receivedAt, ...retained } = a.sampleRecord;
  assert(trail && receivedAt, 'the mockup trail and receipt date are retired');
  assert.deepEqual(b.sampleRecord, { ...retained, lot: 'TM-BPC10-2609-01', reference: 'TB-20260924-VKKT-01', results: bpc, laboratory: 'KMD Analytical', testedAt: '2026-10-01', releasedAt: '2026-10-01' });
  assert.deepEqual(b.shippingMethods.map(({ detail, ...method }) => method), a.shippingMethods.map(({ detail, ...method }) => method));
  assert(b.shippingMethods.every((m) => m.detail.includes('when applicable')));
});

test('classes_match_table: all twenty products, exact names/member lines/colours and nine filter chips', () => {
  assert.deepEqual(current.data.compoundClasses.map((c) => [c.id, c.name, c.short, c.labelColor, c.members, c.vial, c.productIds]), expectedClasses);
  assert.deepEqual(current.data.categories.map((c) => c.id), ['all', ...expectedClasses.map((c) => c[0]), 'lab-supplies']);
  for (const product of current.data.products) {
    const original = tested(before.data.products.find((p) => p.id === product.id));
    assert.deepEqual({ ...product, category: original.category }, original, 'Only category may change on product metadata');
    const expected = expectedClasses.find((c) => c[6].includes(product.id));
    assert.equal(product.category, expected?.[0] ?? 'lab-supplies');
  }
});

test('rainbow_order: every compound remains, class groups then names, Retatrutide sizes ascend', () => {
  assert.deepEqual(current.catalog.compoundsForBrowsing.map((c) => c.lead.id), [
    'ghk-cu-100-mg', 'glow-70-mg', 'melanotan-ii-10-mg', 'mots-c-10-mg', 'nad-500-mg',
    'selank-10-mg', 'semax-10-mg', 'bpc-157-10-mg', 'bpc-tb-1010-mg', 'kpv-10-mg',
    'cjc-ipa-1010-mg', 'tesamorelin-10-mg', 'cagrilintide-10-mg', 'retatrutide-10-mg',
    'semaglutide-20-mg', 'tirzepatide-30-mg', 'bacteriostatic-water-10-ml',
  ]);
  assert.deepEqual(current.catalog.compounds.find((c) => c.name === 'Retatrutide').variants.map((p) => p.size), ['10 mg', '20 mg', '30 mg', '60 mg']);
});

test('catalog renders old class URLs as All and a valid class as only its members', async () => {
  const catalog = await bundle(root, 'catalog-render', `
    import { createElement } from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
    import { MemoryRouter } from 'react-router-dom'; import Catalog from './src/shop/pages/Catalog.tsx';
    import { ShopContext } from './src/shop/context.tsx';
    export const render = (path) => renderToStaticMarkup(createElement(ShopContext.Provider,
      { value: { cart: [], add() {}, change() {}, clear() {}, openCart() {}, closeCart() {} } },
      createElement(MemoryRouter, { initialEntries: [path] }, createElement(Catalog))));
  `);
  for (const id of ['copper-complexes', 'amino-acids', 'unknown']) {
    const html = catalog.render(`/products?class=${id}`);
    assert.match(html, /aria-pressed="true">All compounds/);
    assert.equal((html.match(/class="tm-card"/g) ?? []).length, 17);
  }
  const single = catalog.render('/products?class=copper-peptides');
  assert.match(single, /aria-pressed="true">Copper peptides/);
  assert.equal((single.match(/class="tm-card"/g) ?? []).length, 2);
});

test('free_shipping_rule: actual preview quote and shared live checkout quote agree after a 10% discount at all three boundaries', async () => {
  const product = current.data.products.find((p) => p.id === 'retatrutide-10-mg');
  const price = product.price;
  const settings = current.rows.settings({ free_shipping_threshold: '150.00', free_shipping_method: 'cold-2day', insurance_mode: 'off', insurance_rate: null });
  // Placing a preview order refreshes the catalog from the sample inventory, so set the fixture price on whichever
  // product object the catalog holds before each quote.
  const setPrice = (value) => { for (const item of current.data.products) if (item.id === product.id) item.price = value; };
  try {
    for (const [fixturePrice, base] of [[166.66, 149.99], [166.67, 150], [166.68, 150.01]]) {
      for (const method of current.seed.shippingMethods) {
        setPrice(fixturePrice);
        const draft = { lines: [{ productId: product.id, quantity: 1 }], shipping: method.id, discountCode: 'FIRSTLOT', address: current.seed.buyers[0].addresses[0] };
        const preview = current.preview.quote(draft);
        const live = current.pricing.priceQuote(fixturePrice, 10, method, settings);
        assert.equal(preview.base, base);
        assert.equal(preview.total, live.total);
        assert.equal(preview.method.price, live.shipping);
        assert.equal(live.shipping, method.id === 'cold-overnight' ? 42 : base >= 150 ? 0 : 24);
        const placed = await current.preview.store.orders.place(current.seed.buyers[0].id, draft);
        assert.equal(placed.shipping.price, live.shipping);
        assert.equal(placed.total, live.total);
      }
    }
    for (const threshold of [null, 200, 0]) {
      const custom = { ...settings, freeShippingThreshold: threshold };
      values.set('tm-preview-storefront-settings', JSON.stringify(custom));
      assert.deepEqual(await current.preview.store.settings.get(), custom);
      const preview = current.preview.quote({ lines: [{ productId: product.id, quantity: 1 }], shipping: 'cold-2day', discountCode: 'FIRSTLOT' });
      assert.equal(preview.method.price, threshold === 0 ? 0 : 24);
    }
  } finally { setPrice(price); values.clear(); }
});

test('shipping progress is absent for empty/off, shows cents remaining and unlocks exactly at threshold', () => {
  const markup = (base, count = 1, threshold = 150) => current.renderToStaticMarkup(current.progressMarkup({ base, count, settings: { ...current.pricing.defaultSettings, freeShippingThreshold: threshold } }));
  assert.equal(markup(0, 0), ''); assert.equal(markup(200, 1, null), '');
  assert.match(markup(149.99), /\$0.01 more for free shipping/);
  assert.match(markup(150), /Free shipping unlocked/);
  assert.match(markup(150.01), /aria-valuenow="100"/);
  assert.match(markup(0, 1, 0), /Free shipping unlocked/);
});

test('the progress bar points to the next reward: free BAC water, then free shipping; the vial only while one can be sent', () => {
  const settings = { ...current.pricing.defaultSettings, freeShippingThreshold: 200, freeBacWaterThreshold: 75 };
  const markup = (base, extra = {}) => current.renderToStaticMarkup(current.progressMarkup({ base, count: 1, settings, bacWater: true, ...extra }));
  assert.match(markup(40), /\$35\.00 more for free BAC water/); assert.match(markup(40), /aria-label="Free BAC water" aria-valuenow="53"/);
  assert.match(markup(74.99), /\$0\.01 more for free BAC water/);
  assert.match(markup(75), /\$125\.00 more for free shipping/); assert.match(markup(75), /aria-label="Free shipping" aria-valuenow="38"/);
  assert.match(markup(200), /Free shipping unlocked/);
  assert.match(markup(40, { bacWater: false }), /\$160\.00 more for free shipping/);
  assert.match(markup(80, { settings: { ...settings, freeShippingThreshold: null } }), /Free BAC water unlocked/);
  assert.equal(markup(80, { settings: { ...settings, freeShippingThreshold: null, freeBacWaterThreshold: null } }), '');
  assert.equal(current.pricing.earnsFreeBacWater(74.99, settings), false); assert.equal(current.pricing.earnsFreeBacWater(75, settings), true);
  assert.equal(current.pricing.lineCharge({ quantity: 3, unitPrice: 10, freeQuantity: 1 }), 20);
  assert.equal(current.pricing.lineUnits({ quantity: 1, unitPrice: 0, freeQuantity: 1 }, String), 'Free');
});

test('free BAC Water in sample orders: a $0 line at $75 after discounts, one more free unit on BAC Water already in the cart, none when out of stock', async () => {
  values.clear();
  const bac = 'bacteriostatic-water-10-ml';
  const vial = () => current.previewInventory.previewProducts().find((p) => p.id === bac);
  const draft = (lines, extra = {}) => ({ lines, shipping: 'cold-2day', address: current.seed.buyers[0].addresses[0], ...extra });
  const price = (id) => current.data.products.find((p) => p.id === id).price;
  const cheap = current.data.products.filter((p) => p.id !== bac && p.price && 75 % p.price !== 0 && p.price < 75).sort((a, b) => b.price - a.price)[0];
  assert(vial().stock > 2, 'the sample data holds BAC Water to give');
  try {
    // Below the threshold, and above it before a 10% code but below after.
    assert.equal(current.preview.quote(draft([{ productId: cheap.id, quantity: 1 }])).lines.length, 1);
    const near = current.data.products.find((p) => p.id !== bac && p.price >= 75 && p.price * 0.9 < 75);
    if (near) assert.equal(current.preview.quote(draft([{ productId: near.id, quantity: 1 }], { discountCode: 'FIRSTLOT' })).lines.length, 1);
    const twice = cheap.price * 2 >= 75 ? 2 : 3;
    const earned = current.preview.quote(draft([{ productId: cheap.id, quantity: twice }]));
    assert.deepEqual(earned.lines.at(-1), { productId: bac, quantity: 1, unitPrice: 0, lot: vial().lot, freeQuantity: 1 });
    assert.equal(earned.subtotal, cheap.price * twice); assert.equal(earned.freeVialNote, undefined);
    const merged = current.preview.quote(draft([{ productId: cheap.id, quantity: twice }, { productId: bac, quantity: 2 }]));
    assert.deepEqual(merged.lines.find((l) => l.productId === bac), { productId: bac, quantity: 3, unitPrice: price(bac), lot: merged.lines.find((l) => l.productId === bac).lot, freeQuantity: 1 });
    assert.equal(merged.subtotal, cheap.price * twice + price(bac) * 2);
    const before = vial().stock;
    const order = await current.preview.store.orders.place(current.seed.buyers[0].id, draft([{ productId: cheap.id, quantity: twice }]));
    assert.deepEqual(order.lines.filter((l) => l.productId === bac).map((l) => [l.quantity, l.unitPrice, l.freeQuantity, l.allocations.length]), [[1, 0, 1, 1]]);
    assert.equal(vial().stock, before - 1); assert.equal(order.total, earned.total); assert.equal(order.events[0].note, undefined);
    await current.previewInventory.savePreviewProduct({ ...vial(), active: false });
    const none = await current.preview.store.orders.place(current.seed.buyers[0].id, draft([{ productId: cheap.id, quantity: twice }]));
    assert(!none.lines.some((l) => l.productId === bac)); assert.equal(none.events[0].note, 'Free BAC Water not included: out of stock');
  } finally { values.clear(); }
});

test('the opening reads each vial\'s own lot record for its caption, and leaves the sample record alone', async () => {
  assert.deepEqual(Object.keys(current.carousel), ['collectionIds']);
  const opening = await readFile(join(root, 'src/brand/MistOpening.tsx'), 'utf8');
  assert.match(opening, /store.lots.get\(product.lot\)/);
  assert(!opening.includes('sampleRecord'));
});

test('live home never embeds sample evidence in its initial rendered HTML', async () => {
  const live = await bundle(root, 'live-home', `
    import { createElement } from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
    import { MemoryRouter } from 'react-router-dom'; import Home from './src/shop/Home.tsx';
    export const render = () => renderToStaticMarkup(createElement(MemoryRouter, {}, createElement(Home)));
  `, 'live');
  const html = live.render();
  assert(!html.includes('99.31')); assert(!html.includes('TM-COA-0114'));
  assert(!html.includes('Sample record')); assert(!html.includes('02 Aug'));
  assert(html.includes('TM-BPC10-2609-01'));
});
