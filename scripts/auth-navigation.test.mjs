import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const temp = await mkdtemp(join(tmpdir(), 'truemark-auth-navigation-'));
globalThis.fetch = async () => { throw new Error('External network forbidden'); };
globalThis.PopStateEvent = class extends Event { constructor(type, { state }) { super(type); this.state = state; } };
globalThis.window = new EventTarget();
let navigations = 0;
window.addEventListener('popstate', () => navigations++);
function at(href) {
  globalThis.location = new URL(href);
  globalThis.history = { state: { idx: 3 }, replaceState(state, _title, next) {
    assert.deepEqual(state, { idx: 3 });
    globalThis.location = new URL(next, location);
  } };
  navigations = 0;
}

const cases = [];
for (const [name, base, paths] of [['launch-root', '/', true], ['launch-subdirectory', '/truemark/launch/', true], ['live', '/truemark/live/', false]]) {
  const outfile = join(temp, `${name}.mjs`);
  await build({ stdin: { resolveDir: root, contents: `export * from './src/platform/live/auth-navigation'; export { entryUrl } from './src/platform/mode';` }, outfile,
    bundle: true, format: 'esm', platform: 'node', logLevel: 'silent',
    define: { 'import.meta.env': JSON.stringify({ BASE_URL: base, VITE_PLATFORM: 'live', VITE_ROUTER: paths ? 'path' : undefined }) } });
  cases.push({ name, base, paths, auth: await import(pathToFileURL(outfile)) });
}
after(() => rm(temp, { recursive: true, force: true, maxRetries: 3 }));
for (const { name, base, paths, auth } of cases) {
  const prefix = `https://fixture.test${base}`;
  const address = (route) => prefix + (paths ? route : '#/' + route);
  test(`${name}: signup and password resets return to the deployment root`, () => {
    at(address('partners/sign-in') + '?ref=PARTNER');
    assert.equal(auth.authRedirectUrl(), prefix);
  });
  test(`${name}: successful and failed email links erase one-time tokens without rerunning the view`, () => {
    for (const type of ['email', 'recovery']) {
      at(address('access/confirm') + `?token_hash=fixture-secret&type=${type}&ref=PARTNER`);
      auth.clearEmailToken('/access/confirm', `?token_hash=fixture-secret&type=${type}&ref=PARTNER`);
      assert.equal(location.href, address('access/confirm') + '?ref=PARTNER');
      assert.equal(navigations, 0);
    }
  });
  test(`${name}: recovery opens the requested gate without reloading or losing the PKCE query`, () => {
    for (const gate of ['/access', '/admin', '/partners/sign-in']) {
      at(prefix + '?code=fixture-once&keep=1' + (paths ? '' : '#/access'));
      auth.replaceAuthRoute(gate);
      assert.equal(location.href, paths ? address(gate.slice(1)) + '?code=fixture-once&keep=1' : prefix + '?code=fixture-once&keep=1#' + gate);
      assert.equal(navigations, paths ? 1 : 0);
    }
  });
  if (paths) test(`${name}: existing email, order, referral and certificate hash links become real paths`, () => {
    for (const route of ['/access/confirm?token_hash=fixture&type=email', '/access/reset?token_hash=fixture&type=recovery', '/track/TM-10500', '/account/orders/fixture', '/verify?lot=TM-BPC10-2609-01', '/products?ref=PARTNER']) {
      assert.equal(auth.entryUrl(prefix + '#' + route, base, true, false, true), base.slice(0, -1) + route);
    }
    assert.equal(auth.entryUrl(prefix + '?ref=PARTNER#/verify?lot=LOT', base, true, false, true), base + 'verify?lot=LOT&ref=PARTNER');
    assert.equal(auth.entryUrl(prefix + '#access_token=fixture', base, true, false, true), null);
    assert.equal(auth.entryUrl(prefix + '#//external.test', base, true, false, true), null);
  });
}
