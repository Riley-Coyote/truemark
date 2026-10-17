import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, request } from 'node:http';
import { readFileSync, existsSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentMiddleware, releaseBase } from './content-server.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const content = resolve(root, 'studio-content');
const json = path => JSON.parse(readFileSync(resolve(root, path)));
const manifest = json('design-lab/universe/inventory/content-manifest.json');
const catalog = json('design-lab/universe/inventory/catalog.json');
const runtime = json('studio-content/design-lab/universe/inventory/runtime.json');
const mapping = json('studio-content/asset-map.json').mapping;
function disk(url) {
  const path = decodeURIComponent(new URL(url, 'http://studio.test').pathname).replace(releaseBase, '/');
  return resolve(content, '.' + (mapping[path] || path));
}

test('all 3,179 checked-in content files match the verified public release', () => {
  assert.equal(manifest.files.length, 3179);
  for (const entry of manifest.files) {
    const path = resolve(content, entry.path);
    assert.ok(path.startsWith(content + '/'));
    assert.ok(!lstatSync(path).isSymbolicLink());
    const bytes = readFileSync(path);
    assert.equal(bytes.length, entry.bytes, entry.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.path);
  }
});

test('every asset alias resolves inside the committed collection', () => {
  assert.equal(Object.keys(mapping).length, 7621);
  for (const [alias, target] of Object.entries(mapping)) {
    assert.ok(target.startsWith('/history/shared/'), alias);
    assert.ok(existsSync(disk(alias)), alias);
  }
});

test('every photograph, film, brand asset and design capture is delivered', () => {
  for (const photo of catalog.photography) {
    assert.ok(existsSync(disk(`/design-lab/universe/generated/thumbs/${photo.id}.webp`)), photo.id);
  }
  for (const group of ['photography', 'films', 'brandAssets', 'designs']) {
    for (const item of catalog[group]) {
      for (const key of ['url', 'thumbnail', 'desktop', 'phone', 'captureUrl']) {
        if (group === 'designs' && key === 'url') continue; // Interactive routes use runtime.json.
        if (item[key]?.startsWith('/')) assert.ok(existsSync(disk(item[key])), `${item.id}: ${key}`);
      }
    }
  }
});

const routes = [...runtime.entries, ...runtime.additions, ...runtime.checkpoints, ...runtime.tools]
  .flatMap(item => [item.url, item.packagedUrl]).filter(Boolean);
test('historical navigation uses packaged local routes with existing entry points', () => {
  assert.ok(routes.length > 80);
  for (const url of routes) {
    assert.ok(url.startsWith(releaseBase), url);
    assert.ok(existsSync(disk(url)), url);
  }
  assert.doesNotMatch(JSON.stringify(catalog), /https?:\/\/(localhost|127\.0\.0\.1):/);
});

test('local server resolves assets, history, media ranges, and rejects traversal', async t => {
  const server = createServer(contentMiddleware(content));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const route of new Set(routes)) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 200, route);
    const text = await response.text();
    assert.match(response.headers.get('content-type'), /html/, route);
    assert.doesNotMatch(text, /<script data-studio-bootstrap>/, route);
  }
  const alias = catalog.photography[0].url;
  const response = await fetch(origin + alias);
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), readFileSync(disk(alias)));
  const movie = catalog.films[0].url;
  const partial = await fetch(origin + movie, { headers: { range: 'bytes=10-29' } });
  assert.equal(partial.status, 206);
  assert.equal((await partial.arrayBuffer()).byteLength, 20);
  assert.match(partial.headers.get('content-range'), /^bytes 10-29\//);
  const head = await fetch(origin + movie, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  const invalid = await fetch(origin + movie, { headers: { range: 'bytes=999999999-' } });
  assert.equal(invalid.status, 416);
  for (const path of ['/%2e%2e/package.json', '/%ZZ', '/%00', '/..%5cpackage.json']) {
    const status = await new Promise((resolve, reject) => {
      const req = request(origin, { path }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end();
    });
    assert.equal(status, 400, path);
  }
  assert.equal((await fetch(origin + '/missing-file.png')).status, 404);
});
