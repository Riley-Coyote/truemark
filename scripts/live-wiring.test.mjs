import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const tick = () => new Promise((resolve) => setImmediate(resolve));
const product = { id: 'fixture-db', name: 'Database compound', size: '10 mg', price: 123, category: 'peptide-fragments', color: '#777777', colorInk: '#333333', form: 'Lyophilized powder', lot: 'FIXTURE-LOT' };
const category = { id: 'peptide-fragments', name: 'Database class', short: 'Database', labelColor: '#058F93', position: 2, onHome: true, members: 'Database member' };
function environment(url) {
  globalThis.location = new URL(url);
  globalThis.window = Object.assign(new EventTarget(), { location: globalThis.location });
  globalThis.history = window.history = { state: null, replaceState(_state, _title, url) { globalThis.location = new URL(url, globalThis.location); window.location = globalThis.location; } };
  globalThis.document = { getElementById: () => ({}) };
  globalThis.localStorage = { getItem: () => null, setItem: () => { throw new Error('No visit expected in these tests'); } };
  globalThis.sessionStorage = globalThis.localStorage;
  globalThis.BroadcastChannel = class { constructor() { throw new Error('Live must not open a preview channel'); } };
  const fixture = { renders: [], snapshots: [], classSnapshots: [], authStarts: 0, catalogCalls: 0, classCalls: 0, classes: async () => [category], catalog: async () => [product], render(value) { this.renders.push(value); } };
  globalThis.entryFixture = fixture;
  return fixture;
}
async function bundleEntry(mode, prod) {
  const dir = await mkdtemp('/private/tmp/truemark-entry-test-');
  const file = join(dir, 'entry.mjs');
  await build({ entryPoints: [join(root, 'src/main.tsx')], outfile: file, bundle: true, format: 'esm', platform: 'node', loader: { '.css': 'empty' }, logLevel: 'silent', define: { 'import.meta.env.VITE_PLATFORM': JSON.stringify(mode), 'import.meta.env.PROD': String(prod), 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'entry-fixtures', setup(plugin) {
    plugin.onResolve({ filter: /^react-dom\/client$/ }, () => ({ path: 'dom', namespace: 'fixture' }));
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export default { createRoot: () => ({ render: (value) => globalThis.entryFixture.render(value) }) };' }));
    plugin.onLoad({ filter: /\/AppRoutes\.tsx$/ }, () => ({ contents: `import { products, compoundClasses } from ${JSON.stringify(join(root, 'src/data.ts'))}; globalThis.entryFixture.snapshots.push(structuredClone(products)); globalThis.entryFixture.classSnapshots.push(structuredClone(compoundClasses)); export default function AppRoutes() { return null; }`, loader: 'tsx' }));
    plugin.onLoad({ filter: /\/platform\/live\/runtime\.ts$/ }, () => ({ contents: 'export async function initialize() { globalThis.entryFixture.authStarts++; } export const live = () => ({ auth: { hasSession: async () => globalThis.entryFixture.signedIn ?? true }, showcase: () => { globalThis.entryFixture.catalogCalls++; return globalThis.entryFixture.catalog(); }, products: () => { globalThis.entryFixture.catalogCalls++; return globalThis.entryFixture.catalog(); }, store: { catalog: { categories: () => { globalThis.entryFixture.classCalls++; return globalThis.entryFixture.classes(); } } } });', loader: 'ts' }));
  } }] });
  return pathToFileURL(file);
}

test('live loads the database catalog before importing screens or rendering, including live dev hash routing', async () => {
  const f = environment('http://127.0.0.1:5174/');
  let deliver;
  f.catalog = () => new Promise((resolve) => { deliver = resolve; });
  await import(await bundleEntry('live', false));
  for (let n = 0; n < 10 && !deliver; n++) await tick();
  assert.equal(f.catalogCalls, 1);
  assert.equal(f.snapshots.length, 0);
  assert.equal(f.renders.length, 0);
  deliver([product]);
  for (let n = 0; n < 10 && !f.renders.length; n++) await tick();
  assert.deepEqual(f.snapshots, [[product]]);
  assert.deepEqual(f.classSnapshots, [[{ ...category, vial: product.id }]]);
  assert.equal(f.classCalls, 1);
  assert.equal(f.renders.length, 1);
  assert.equal(location.pathname, '/');
  assert.equal(location.hash, '#/');
});

test('a failed live catalog never renders static prices; the error screen retry can recover', async () => {
  const f = environment('https://example.test/truemark/live/');
  f.catalog = async () => { throw new Error('fixture network failure'); };
  await import(await bundleEntry('live', true));
  for (let n = 0; n < 10 && !f.renders.length; n++) await tick();
  assert.equal(f.snapshots.length, 0);
  assert.equal(f.renders.length, 1);
  const failure = f.renders[0];
  assert.equal(failure.type.name, 'ShopLoadFailure');
  assert.equal(typeof failure.props.retry, 'function');
  f.catalog = async () => [product];
  await failure.props.retry();
  assert.deepEqual(f.snapshots, [[product]]);
  assert.equal(f.renders.length, 2);
});

test('a failed class bootstrap never renders static categories, and retry can recover', async () => {
  const f = environment('https://example.test/truemark/live/');
  f.classes = async () => { throw new Error('fixture classes unavailable'); };
  await import(await bundleEntry('live', true));
  for (let n = 0; n < 10 && !f.renders.length; n++) await tick();
  assert.equal(f.snapshots.length, 0);
  assert.equal(f.renders[0].type.name, 'ShopLoadFailure');
  f.classes = async () => [category];
  await f.renders[0].props.retry();
  assert.deepEqual(f.classSnapshots, [[{ ...category, vial: product.id }]]);
});

test('preview startup never initializes live auth or reads the database catalog', async () => {
  const f = environment('http://127.0.0.1:5214/products');
  await import(await bundleEntry('preview', false));
  for (let n = 0; n < 10 && !f.renders.length; n++) await tick();
  assert.equal(f.catalogCalls, 0); assert.equal(f.authStarts, 0); assert.equal(f.classCalls, 0);
  assert.equal(f.snapshots[0].length, 20);
  assert.equal(f.renders.length, 1);
  assert.equal(location.pathname, '/products'); assert.equal(location.hash, '');
});

test('live share and QR links stay on their own deployment; the review site shows the brand address', async () => {
  for (const [mode, prod, url, expected] of [
    ['live', true, 'https://example.test/truemark/live/#/partners/app', 'https://example.test/truemark/live/#/products?ref=FIXTURE10'],
    ['preview', true, 'https://example.test/truemark/#/partners/app', 'https://www.truemarkbiolabs.com/products?ref=FIXTURE10'],
    ['live', false, 'http://127.0.0.1:5174/#/partners/app', 'http://127.0.0.1:5174/#/products?ref=FIXTURE10'],
    ['preview', false, 'http://127.0.0.1:5214/partners/app', 'https://www.truemarkbiolabs.com/products?ref=FIXTURE10'],
  ]) {
    environment(url);
    const dir = await mkdtemp('/private/tmp/truemark-links-test-');
    const file = join(dir, 'links.mjs');
    await build({ entryPoints: [join(root, 'src/partners/program.ts')], outfile: file, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent', define: { 'import.meta.env.VITE_PLATFORM': JSON.stringify(mode), 'import.meta.env.PROD': String(prod), 'process.env.NODE_ENV': '"production"' } });
    const { partnerLink } = await import(pathToFileURL(file));
    assert.equal(partnerLink('/products', 'FIXTURE10'), expected);
  }
});
