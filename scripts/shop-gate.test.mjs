/** WP-27 Node bundle proofs. Every transport is a local fixture. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { pagesDestination, writePages404 } from './pages-404.mjs';

const root = resolve(import.meta.dirname, '..');
const temp = await mkdtemp(join(tmpdir(), 'truemark-wp27-'));
const values = new Map();
const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
globalThis.localStorage = globalThis.sessionStorage = storage;
globalThis.fetch = async () => { throw new Error('Unexpected network access'); };
globalThis.window = Object.assign(new EventTarget(), { setTimeout: (fn) => { queueMicrotask(fn); return 1; }, clearTimeout() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
globalThis.document = { hidden: false, baseURI: 'https://fixture.test/' };
globalThis.location = new URL('https://fixture.test/truemark/live/#/products?ref=FIXTURE27');
globalThis.BroadcastChannel = class extends EventTarget { postMessage() {} close() {} };
globalThis.fixtureLive = { auth: { hasSession: async () => false }, store: { catalog: { categories: async () => [] } },
  products: async () => [], showcase: async () => [], recordVisit: async () => {} };

async function bundle(mode, fixtureUi = false) {
  const outfile = join(temp, `${mode}-${fixtureUi}.mjs`);
  await build({ stdin: { resolveDir: root, loader: 'tsx', contents: `
    export { shopAccess, gatedShopPath } from './src/App.tsx';
    export { entryUrl } from './src/platform/mode.ts';
    export { catalogAccess, catalogReloadNeeded, rememberLink, bootstrap } from './src/platform/live/bootstrap.ts';
    export { readReferral } from './src/shop/context.tsx';
    export { createLiveAdapter } from './src/platform/live/adapter.ts';
    export { submitWithDocuments } from './src/shop/pages/account/Apply.tsx';
    export { product } from './src/platform/live/rows.ts';
    import { createElement as h } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { MemoryRouter } from 'react-router-dom';
    import { ShopContext } from './src/shop/context.tsx';
    import Catalog from './src/shop/pages/Catalog.tsx';
    import { Header } from './src/shop/Chrome.tsx';
    import Gate from './src/brand/Gate.tsx';
    import Apply from './src/shop/pages/account/Apply.tsx';
    const wrap = (element) => renderToStaticMarkup(h(ShopContext.Provider, {value:{cart:[], add(){}, change(){}, clear(){}, openCart(){}, closeCart(){}}}, h(MemoryRouter,{},element)));
    export const catalogMarkup = () => wrap(h(Catalog));
    export const headerMarkup = () => wrap(h(Header));
    export const gateMarkup = () => wrap(h(Gate));
    export const applyMarkup = () => wrap(h(Apply));
  ` }, outfile, bundle: true, format: 'esm', platform: 'node', loader: { '.css': 'empty' },
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    define: { 'import.meta.env': JSON.stringify({ VITE_PLATFORM: mode, BASE_URL: '/', PROD: false }), 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
    plugins: [{ name: 'fixture-runtime', setup(b) {
      b.onResolve({ filter: /\/runtime$/ }, (args) => args.path.includes('live') || args.importer.includes('/platform/live/') ? { path: 'runtime', namespace: 'fixture' } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const live = () => globalThis.fixtureLive; export const initialize = async () => {};', loader: 'js' }));
      if (fixtureUi) b.onLoad({ filter: /\/platform\/store\.ts$/ }, () => ({ loader: 'ts', contents: `
        export const store = globalThis.fixtureStore;
        export const quote = () => {};
        export function useResource(load) {
          const source = load.toString();
          const data = source.includes('hasSession') ? globalThis.fixtureSignedIn : source.includes('FIRSTLOT') ? globalThis.fixtureOffer : undefined;
          return { data, loading: false, error: null, reload(){} };
        }
      ` }));
    } }],
  });
  return import(pathToFileURL(outfile));
}
globalThis.fixtureStore = { catalog: { validateCode: async () => null } };
globalThis.fixtureSignedIn = false;
globalThis.fixtureOffer = null;
const live = await bundle('live');
const liveUi = await bundle('live', true);
const preview = await bundle('preview', true);

const gated = ['/products', '/products?class=peptide-fragments', '/products/future', '/cart', '/cart/future', '/checkout', '/checkout/confirmation/TM-10500', '/checkout/payment/future', '/account', '/account/orders/TM-10500'];
const publicPaths = ['/', '/product/bpc-157-10-mg', '/access', '/access/apply', '/access/team', '/verify', '/quality', '/handling', '/about', '/research-blog', '/research-blog/article', '/contact', '/terms', '/disclaimer', '/privacy-policy', '/refund_returns', '/shipping-policy', '/track', '/track/TM-10500', '/partners', '/partners/app', '/admin', '/admin/applications'];
test('every gated path redirects signed out, renders signed in and waits for session', async () => {
  for (const path of gated) {
    assert.equal(live.shopAccess(path, false, false), 'redirect', path);
    assert.equal(live.shopAccess(path, false, true), 'render', path);
    assert.equal(live.shopAccess(path, true, false), 'wait', path);
  }
  const app = await readFile(join(root, 'src/App.tsx'), 'utf8');
  assert.match(app, /<Navigate to="\/access" replace state=\{\{ from: location.pathname \+ location.search \}\} \/>/);
  // The gate decides before any route renders (the routes take a location: src/brand/FlightViews.tsx).
  const routes = app.indexOf('<Routes');
  assert(routes > 0 && app.indexOf('access === "redirect"') < routes);
});
test('public paths render while signed out', () => {
  for (const path of publicPaths) assert.equal(live.shopAccess(path, false, false), 'render', path);
});
test('catalog reload occurs once, only after auth on a gated path, and full load clears the flag', () => {
  values.clear();
  assert.equal(live.catalogReloadNeeded('showcase', false, true, storage), false);
  assert.equal(live.catalogReloadNeeded('showcase', true, false, storage), false);
  assert.equal(live.catalogReloadNeeded('showcase', true, true, storage), true);
  assert.equal(values.get('tm-catalog-reload'), '1');
  assert.equal(live.catalogReloadNeeded('showcase', true, true, storage), false);
  assert.equal(live.catalogReloadNeeded('full', true, true, storage), false);
  assert.equal(values.has('tm-catalog-reload'), false);
});
test('signed-out referral records once, survives sign-in/reload, and reaches the checkout draft', async () => {
  values.clear(); let signedIn = false; const visits = [], drafts = [], catalogs = [];
  const client = {
    auth: {
      getSession: async () => ({ data: { session: signedIn ? { user: { id: 'fixture-user' } } : null }, error: null }),
      signInWithPassword: async () => { signedIn = true; return { error: null }; },
    },
    from(table) {
      catalogs.push(table);
      const result = table === 'profiles' ? [{ id: 'fixture-user', role: 'buyer' }] : table === 'orders' ? [{ id: 'fixture-order', number: 'TM-10500', status: 'placed', created_at: '2026-10-05', order_lines: [], order_events: [] }] : [];
      const query = { select() { return query; }, eq() { return query; }, order() { return query; }, range() { return query; }, returns() { return query; }, then(resolve) { return Promise.resolve({ data: result, error: null }).then(resolve); } };
      return query;
    },
    async rpc(name, args) {
      if (name === 'record_visit') visits.push(args.code);
      if (name === 'place_order') drafts.push(args.draft);
      return { data: name === 'place_order' ? { id: 'fixture-order' } : name === 'catalog_showcase' ? [{ id: 'fixture-product', name: 'Fixture', size: '10 mg', category: 'fixture', lot: 'fixture-lot' }] : null, error: null };
    },
  };
  globalThis.fixtureLive = live.createLiveAdapter(client);
  const showcase = await globalThis.fixtureLive.showcase();
  assert.equal(showcase[0].price, undefined);
  assert(!catalogs.includes('products'));
  await Promise.all([live.rememberLink(' fixture27 '), live.rememberLink('FIXTURE27')]);
  assert.deepEqual(visits, ['FIXTURE27']);
  assert.equal(live.readReferral(), 'FIXTURE27');
  await globalThis.fixtureLive.auth.signIn('fixture@fixture.test', 'fixture-password');
  await live.rememberLink('FIXTURE27');
  assert.deepEqual(visits, ['FIXTURE27']);
  assert.equal(live.readReferral(), 'FIXTURE27');
  await globalThis.fixtureLive.store.orders.place('fixture-buyer', { lines: [{ productId: 'fixture-product', quantity: 1 }], address: {}, shipping: 'cold-2day', discountCode: live.readReferral(), via: 'link' });
  assert.equal(drafts[0].discountCode, 'FIXTURE27'); assert.equal(drafts[0].via, 'link');
  const gate = await readFile(join(root, 'src/brand/Gate.tsx'), 'utf8');
  // A shopper returns to the same-site page sign-in interrupted; only the team and partners bound for the shop's
  // account pages go to their own area instead.
  assert.match(gate, /const back = from\?\.startsWith\("\/"\) && !from\.startsWith\("\/\/"\) \? from : undefined;/);
  assert.match(gate, /navigate\(own && \(!back \|\| back\.startsWith\("\/account"\)\) \? own : back \?\? "\/"/);
});
test('bootstrap follows the session and clears reload only for the full catalog', async () => {
  let signedIn = false;
  globalThis.fixtureLive = { auth: { hasSession: async () => signedIn }, products: async () => [], showcase: async () => [],
    store: { catalog: { categories: async () => [] } }, recordVisit: async () => {} };
  values.set('tm-catalog-reload', '1');
  await live.bootstrap(); assert.equal(live.catalogAccess(), 'showcase'); assert.equal(values.get('tm-catalog-reload'), '1');
  signedIn = true; await live.bootstrap(); assert.equal(live.catalogAccess(), 'full'); assert.equal(values.has('tm-catalog-reload'), false);
});
test('FIRSTLOT is absent or has its database percent in live; preview keeps the sample offer', () => {
  globalThis.fixtureOffer = null;
  assert(!liveUi.catalogMarkup().includes('First order?'));
  globalThis.fixtureOffer = { code: 'FIRSTLOT', percent: 17, active: true };
  assert.match(liveUi.catalogMarkup(), /First order\? 17% off with <span class="tm-offer-code">FIRSTLOT<\/span>/);
  assert.match(preview.catalogMarkup(), /First order\? 10% off with <span class="tm-offer-code">FIRSTLOT<\/span>/);
});
test('signed-out live header hides bag and search; preview keeps both', () => {
  globalThis.fixtureSignedIn = false;
  const locked = liveUi.headerMarkup();
  assert.match(locked, /href="\/access"[^>]*>Products/);
  assert(!locked.includes('Open cart')); assert(!locked.includes('>Search<'));
  const before = preview.headerMarkup(); assert(before.includes('Open cart')); assert(before.includes('>Search<'));
  globalThis.fixtureSignedIn = true; assert(liveUi.headerMarkup().includes('Open cart')); assert(liveUi.headerMarkup().includes('>Search<'));
});
test('QR hash paths, launch Pages restore and per-tab root entry preserve destinations and queries', async () => {
  assert.equal(live.entryUrl('https://fixture.test/truemark/live/verify?lot=TM-BPC10-2609-01', '/truemark/live/', false, true, true), '/truemark/live/#/verify?lot=TM-BPC10-2609-01');
  assert.equal(live.entryUrl('https://fixture.test/truemark/live/checkout/confirmation/TM-10500?ref=FIXTURE27', '/truemark/live/', false, true, true), '/truemark/live/#/checkout/confirmation/TM-10500?ref=FIXTURE27');
  assert.equal(live.entryUrl('https://fixture.test/truemark/live/verify?lot=fixture', './', false, true, true), '/truemark/live/#/verify?lot=fixture');
  for (const path of ['/verify', '/verify?lot=TM-BPC10-2609-01', '/products?ref=FIXTURE27']) {
    const [pathname, search] = path.split('?');
    const destination = pagesDestination('/truemark/launch' + pathname, search ? '?' + search : '');
    assert.equal(live.entryUrl('https://fixture.test' + destination, '/truemark/launch/', true, false, true), '/truemark/launch' + path);
  }
  assert.equal(pagesDestination('/truemark/live/verify', '?lot=fixture'), '/truemark/live/#/verify?lot=fixture');
  assert.equal(pagesDestination('/anything'), '/truemark/#/review');
  assert.equal(live.entryUrl('https://fixture.test/truemark/live/#/verify?lot=fixture', '/truemark/live/', false, true, true), null);
  assert.equal(live.entryUrl('https://fixture.test/truemark/', '/truemark/', false, true, false), '/truemark/#/review');
  // Anyone may see the landing: the live site opens on it, never on sign-in (the shop pages ask for an account).
  assert.equal(live.entryUrl('https://fixture.test/truemark/live/', '/truemark/live/', false, true, true), '/truemark/live/#/');
  const main = await readFile(join(root, 'src/main.tsx'), 'utf8');
  assert.doesNotMatch(main, /access\$\{window\.location\.search\}/);
  assert.equal(live.entryUrl('https://fixture.test/truemark/launch/?p=%2F%2Fevil.test', '/truemark/launch/', true, false, true), null);
});
test('application files upload before sign-up and claim afterwards; failures stop sign-up', async () => {
  const files = [new File(['fixture'], 'letter.pdf', { type: 'application/pdf' }), new File(['fixture'], 'approval.png', { type: 'image/png' })];
  const events = [];
  const api = {
    async prepare() { events.push('prepare'); return { claim: 'fixture-claim', files: files.map((file, i) => ({ uploadId: 'fixture-' + i, path: 'incoming/' + file.name, token: 'fixture-token' })) }; },
    async upload(path, token, file) { assert.equal(token, 'fixture-token'); assert.equal(path, 'incoming/' + file.name); events.push('upload:' + file.name); },
    async claim(claim, email, ids) { assert.equal(claim, 'fixture-claim'); assert.equal(email, 'fixture@fixture.test'); assert.deepEqual(ids, ['fixture-0', 'fixture-1']); events.push('claim'); return 2; },
  };
  const result = await live.submitWithDocuments(files, 'fixture@fixture.test', api, async () => { events.push('sign-up'); return 'saved'; }, (name, text) => events.push(text));
  assert.equal(result, 'saved');
  assert.deepEqual(events, ['prepare', 'Uploading letter.pdf…', 'upload:letter.pdf', 'Uploaded', 'Uploading approval.png…', 'upload:approval.png', 'Uploaded', 'sign-up', 'claim']);
  let signedUp = false;
  await assert.rejects(live.submitWithDocuments(files, 'fixture@fixture.test', { ...api, upload: async () => { throw new Error('fixture fail'); } }, async () => { signedUp = true; }, () => {}), /letter.pdf couldn't be uploaded. Remove it or try again./);
  assert.equal(signedUp, false);
  const apply = await readFile(join(root, 'src/shop/pages/account/Apply.tsx'), 'utf8');
  assert(apply.includes('For example, an institutional letter or a purchasing approval. PDF, PNG, JPG or WEBP, up to 10 MB each, at most 5 files.'));
});
test('adapter uses public track RPC and signed Storage document transport with 60-second expiry', async () => {
  const calls = [];
  const adapter = live.createLiveAdapter({
    rpc: async (name, args) => { calls.push([name, args]); return { data: null, error: null }; },
    functions: { invoke: async (name, options) => { calls.push([name, options]); return { data: { claim: 'fixture-claim', files: [] }, error: null }; } },
    storage: { from: (bucket) => { assert.equal(bucket, 'application-files'); return {
      uploadToSignedUrl: async (...args) => { calls.push(['uploadToSignedUrl', args]); return { data: {}, error: null }; },
      createSignedUrl: async (...args) => { calls.push(['createSignedUrl', args]); return { data: { signedUrl: 'https://fixture.test/signed' }, error: null }; },
    }; } },
  });
  assert.equal(await adapter.trackOrder('TM-10500', 'fixture@fixture.test'), null);
  await adapter.uploads.prepare([new File(['fixture'], 'letter.pdf', { type: 'application/pdf' })]);
  await adapter.uploads.upload('incoming/letter.pdf', 'fixture-token', 'fixture-file');
  await adapter.uploads.claim('fixture-claim', 'fixture@fixture.test', ['fixture-id']);
  assert.equal(await adapter.uploads.open('incoming/letter.pdf'), 'https://fixture.test/signed');
  assert.deepEqual(calls[0], ['track_order', { number: 'TM-10500', email: 'fixture@fixture.test' }]);
  assert.equal(calls[1][0], 'uploads/application');
  assert.deepEqual(calls[2], ['uploadToSignedUrl', ['incoming/letter.pdf', 'fixture-token', 'fixture-file']]);
  assert.deepEqual(calls[3], ['claim_application_uploads', { claim: 'fixture-claim', email: 'fixture@fixture.test', upload_ids: ['fixture-id'] }]);
  assert.deepEqual(calls[4], ['createSignedUrl', ['incoming/letter.pdf', 60]]);
});
test('catalog cards use the client-approved 95% specification, including in live', () => {
  for (const site of [preview, liveUi]) {
    const markup = site.catalogMarkup();
    assert(markup.includes('≥95%\u00a0(HPLC)'));
    assert(!markup.includes('≥99%\u00a0(HPLC)'));
  }
});
test('generated 404 fallback includes all three routes and a no-script home link', async () => {
  await writePages404(temp);
  const html = await readFile(join(temp, '404.html'), 'utf8');
  assert(html.includes('<noscript><a href="/truemark/">'));
  assert(html.includes('/truemark/live/#/')); assert(html.includes('/truemark/launch/?p=')); assert(html.includes('/truemark/#/review'));
});
test('actual entry restores routes before bootstrap, selects the Router and imports screens after catalog', async () => {
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  async function entry(href, pathRouter, signedIn) {
    const prefix = pathRouter ? '/truemark/launch/' : '/truemark/live/';
    const data = { id: 'fixture', name: 'Fixture compound', size: '10 mg', category: 'fixture', lot: 'FIXTURE-LOT', color: '#777777', colorInk: '#333333', form: 'Lyophilized powder', ...(signedIn ? { price: 123 } : {}) };
    const f = { renders: [], snapshots: [], reads: [], visits: [], signedIn, data };
    globalThis.wp27Entry = f;
    globalThis.location = window.location = new URL(href);
    globalThis.history = window.history = { state: null, replaceState(_state, _title, next) { globalThis.location = window.location = new URL(next, globalThis.location); } };
    globalThis.document.getElementById = () => ({});
    const outfile = join(temp, `entry-${Math.random()}.mjs`);
    await build({ entryPoints: [join(root, 'src/main.tsx')], outfile, bundle: true, platform: 'node', format: 'esm', loader: { '.css': 'empty' }, logLevel: 'silent',
      define: { 'import.meta.env': JSON.stringify({ VITE_PLATFORM: 'live', VITE_LAUNCH: pathRouter ? '1' : undefined, VITE_ROUTER: pathRouter ? 'path' : undefined, BASE_URL: prefix, PROD: true }), 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'entry-fixtures', setup(b) {
        b.onResolve({ filter: /^react-dom\/client$/ }, () => ({ path: 'dom', namespace: 'entry' }));
        b.onLoad({ filter: /.*/, namespace: 'entry' }, () => ({ contents: 'export default { createRoot: () => ({ render: (value) => globalThis.wp27Entry.renders.push(value) }) };' }));
        b.onLoad({ filter: /\/platform\/live\/runtime\.ts$/ }, () => ({ loader: 'ts', contents: `
          export const initialize = async () => { globalThis.wp27Entry.reads.push(location.pathname + location.search + location.hash); };
          export const live = () => ({ auth: { hasSession: async () => globalThis.wp27Entry.signedIn },
            products: async () => { globalThis.wp27Entry.reads.push('full'); return [globalThis.wp27Entry.data]; },
            showcase: async () => { globalThis.wp27Entry.reads.push('showcase'); return [globalThis.wp27Entry.data]; },
            recordVisit: async (code) => { globalThis.wp27Entry.visits.push(code); },
            store: { catalog: { categories: async () => [] } }
          });
        ` }));
        b.onLoad({ filter: /\/AppRoutes\.tsx$/ }, () => ({ loader: 'tsx', contents: `import {products} from ${JSON.stringify(join(root, 'src/data.ts'))}; globalThis.wp27Entry.snapshots.push(structuredClone(products)); export default function AppRoutes() { return null; }` }));
      } }],
    });
    await import(pathToFileURL(outfile));
    for (let i = 0; i < 20 && !f.renders.length; i++) await tick();
    assert.equal(f.renders.length, 1);
    assert.deepEqual(f.snapshots, [[data]]);
    return f;
  }
  values.clear();
  const qr = await entry('https://fixture.test/truemark/live/verify?lot=FIXTURE-LOT', false, false);
  assert.equal(qr.reads[0], '/truemark/live/#/verify?lot=FIXTURE-LOT');
  assert(qr.reads.includes('showcase'));
  assert.equal(qr.renders[0].props.children.type.name, 'GlidingHashRouter');
  values.clear();
  const restored = await entry('https://fixture.test/truemark/launch/?p=%2Fproducts%3Fref%3DFIXTURE27', true, false);
  assert.equal(restored.reads[0], '/truemark/launch/products?ref=FIXTURE27');
  assert.deepEqual(restored.visits, ['FIXTURE27']);
  assert.equal(restored.renders[0].props.children.type.name, 'GlidingBrowserRouter');
  assert.equal(restored.renders[0].props.children.props.basename, '/truemark/launch/');
  // The launch site opens on its landing for a signed-out visitor, first visit included.
  values.clear(); await entry('https://fixture.test/truemark/launch/', true, false);
  assert.equal(location.pathname, '/truemark/launch/');
  values.clear(); const full = await entry('https://fixture.test/truemark/launch/products', true, true);
  assert(full.reads.includes('full'));
});
test('launch output contains none of the review or study module marker strings', async () => {
  const directory = process.env.WP27_LAUNCH_DIR ?? join(root, 'dist/launch');
  const files = await readdir(join(directory, 'assets'));
  const modules = files.filter((f) => /\.(js|css)$/.test(f));
  const text = (await Promise.all(modules.map((file) => readFile(join(directory, 'assets', file), 'utf8')))).join('\n');
  for (const marker of ['Client review navigation', 'Design review', 'Leave notes anywhere', 'rl-welcome', 'Review tools', 'vs-study', 'type-study', 'Loading visual studies', 'Loading type studies']) assert(!text.includes(marker), marker);
  for (const file of files) assert(!/^(Review-|ReviewLayer-|TypeStudy-|VisualStudy-|LiveOrder-)/.test(file), file);
});
