/** Read-only hosted smoke checks; builds use only the key already published by the review site. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const project = 'https://gydihnfzmuqmbnykaihg.supabase.co';
async function publicConfig() {
  if (process.env.VITE_REVIEW_SUPABASE_URL && process.env.VITE_REVIEW_SUPABASE_ANON_KEY) return { url: process.env.VITE_REVIEW_SUPABASE_URL, key: process.env.VITE_REVIEW_SUPABASE_ANON_KEY };
  const page = await fetch('https://riley-coyote.github.io/truemark/');
  assert(page.ok, 'Published review could not be loaded; set the two public env values');
  const html = await page.text();
  for (const match of html.matchAll(/src="([^"]+\.js)"/g)) {
    const response = await fetch(new URL(match[1], page.url));
    assert(response.ok);
    const source = await response.text();
    if (!source.includes(project)) continue;
    const key = source.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
    if (key) return { url: project, key };
  }
  throw new Error('No publishable configuration in the review build; set the two public env values');
}
const config = await publicConfig();
assert(config.url === project, 'Smoke checks are restricted to the specified project');
assert(config.key.startsWith('sb_publishable_'), 'Only a publishable key is accepted');
const headers = { apikey: config.key, 'Content-Type': 'application/json' };
const products = await fetch(`${project}/rest/v1/products?select=id,price,lot&order=id`, { headers });
assert(products.ok); const catalog = await products.json(); assert.equal(catalog.length, 20);
for (const [name, args, verify] of [
  ['lot_lookup', { lot: 'TM-RET10-2609-01' }, (value) => { assert.equal(value.status, 'testing'); assert.deepEqual(value.results, []); assert.equal(value.reference, null); }],
  ['lot_lookup', { lot: 'UNKNOWN-WP13-SMOKE' }, (value) => assert.equal(value, null)],
  ['resolve_code', { code: 'UNKNOWN-WP13-SMOKE' }, (value) => assert.equal(value, null)],
]) {
  const response = await fetch(`${project}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args) });
  assert(response.ok); verify(await response.json());
}
console.log('PASS hosted anon reads: 20 products, masked testing lot, unknown lot/code null. No Auth endpoints or write RPCs called.');
const env = { ...process.env, VITE_REVIEW_SUPABASE_URL: config.url, VITE_REVIEW_SUPABASE_ANON_KEY: config.key };
for (const [mode, outDir] of [['preview', 'dist'], ['live', 'dist/live']]) {
  execFileSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], { cwd: root, env: { ...env, VITE_PLATFORM: mode }, stdio: 'inherit' });
}
async function walk(path, skipLive = false) {
  const files = [];
  for (const item of await readdir(path, { withFileTypes: true })) {
    if (skipLive && item.name === 'live') continue;
    if (item.isDirectory()) files.push(...await walk(join(path, item.name)));
    else files.push(join(path, item.name));
  }
  return files;
}
const previewFiles = (await walk(join(root, 'dist'), true)).filter((p) => p.endsWith('.js'));
const liveFiles = (await walk(join(root, 'dist/live'))).filter((p) => p.endsWith('.js'));
const previewJS = (await Promise.all(previewFiles.map((p) => readFile(p, 'utf8')))).join('\n');
const liveJS = (await Promise.all(liveFiles.map((p) => readFile(p, 'utf8')))).join('\n');
assert(!previewJS.includes('tm-live-auth'), 'Preview includes the live Auth adapter');
assert(liveJS.includes('tm-live-auth'), 'Live Auth adapter missing');
assert(liveJS.includes('Payments connect at launch; this order is placed and held as authorized.'));
for (const id of ['tm-card-number', 'tm-card-expiry', 'tm-card-code']) assert(!liveJS.includes(id), `Live contains ${id}`);
console.log('PASS bundle isolation and simulated-payment note; live has no card inputs.');

// Grep-like scanning prints paths only, never any potential credential value.
const sourceFiles = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
const candidates = [...new Set([...sourceFiles.map((p) => join(root, p)), ...previewFiles, ...liveFiles])];
const matches = [];
for (const file of candidates) {
  if (!/\.(?:[cm]?[jt]sx?|json|html|css|sql|md|ya?ml|example)$/.test(file)) continue;
  let text; try { text = await readFile(file, 'utf8'); } catch { continue; }
  if (/sb_secret_[A-Za-z0-9_-]{10,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) matches.push(file);
  for (const jwt of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try { if (JSON.parse(Buffer.from(jwt[1], 'base64url').toString()).role === 'service_role') matches.push(file); } catch { /* Not a JWT. */ }
  }
}
assert.deepEqual(matches, [], 'Privileged credential patterns found in these files (values withheld)');
console.log(`PASS no_secret_keys: scanned ${candidates.length} source/build files, no secret keys or service-role JWTs.`);
console.log(JSON.stringify({ build: true, no_secret_keys: true, payment_simulated_note: true, preview_bundle_has_no_live_adapter: true, no_accounts_created: true }, null, 2));
