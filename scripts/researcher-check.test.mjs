/** The first visit's researcher verification: where it asks, how long it remembers, and what it says. Node only. */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const temp = await mkdtemp(join(tmpdir(), 'truemark-researcher-'));
after(() => rm(temp, { recursive: true, force: true }));
const values = new Map();
let blocked = false;
const storage = {
  getItem: (key) => { if (blocked) throw new Error('blocked'); return values.get(key) ?? null; },
  setItem: (key, value) => { if (blocked) throw new Error('blocked'); values.set(key, String(value)); },
  removeItem: (key) => values.delete(key),
};
globalThis.localStorage = globalThis.sessionStorage = storage;
globalThis.window = Object.assign(new EventTarget(), { setTimeout: (fn) => { queueMicrotask(fn); return 1; }, clearTimeout() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
globalThis.BroadcastChannel = class extends EventTarget { postMessage() {} close() {} };

const file = join(temp, 'researcher.mjs');
await build({ stdin: { resolveDir: root, loader: 'tsx', contents: `
  export * from './src/shop/researcher.ts';
  export { ResearcherCheckCard, DISCLAIMER } from './src/shop/ResearcherCheck.tsx';
  import { createElement as h } from 'react';
  import { renderToStaticMarkup } from 'react-dom/server';
  import { MemoryRouter } from 'react-router-dom';
  import { ResearcherCheckCard } from './src/shop/ResearcherCheck.tsx';
  export const card = (props) => renderToStaticMarkup(h(MemoryRouter, {}, h(ResearcherCheckCard, { onTick() {}, onRead() {}, closing: false, exit: { current: null }, ...props })));
` }, outfile: file, bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', loader: { '.css': 'empty' }, logLevel: 'silent',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  define: { 'import.meta.env': JSON.stringify({ VITE_PLATFORM: 'preview', BASE_URL: '/', PROD: true }), 'process.env.NODE_ENV': '"production"' } });
/** A fresh copy of the module: a new page load. */
let loads = 0;
const load = () => import(`${pathToFileURL(file).href}?load=${++loads}`);
const DAY = 86_400_000;

test('asked on the shop, its sign-in and the partner pages; not in the Command Center, the partner portal, a QR lot lookup, auth callbacks, the two legal pages it links to, or the review', async () => {
  const { confirmationExempt } = await load();
  for (const path of ['/', '/products', '/product/bpc-157-10-mg', '/cart', '/checkout', '/about', '/access', '/access/apply', '/partners', '/partners/apply', '/partners/sign-in', '/privacy-policy', '/verify-not'])
    assert.equal(confirmationExempt(path), false, path);
  for (const path of ['/admin', '/admin/orders', '/partners/app', '/partners/app/referrals', '/verify', '/terms', '/disclaimer', '/access/confirm', '/access/reset', '/access/team', '/review', '/review/live', '/visual-study', '/type-study'])
    assert.equal(confirmationExempt(path), true, path);
});

test('a confirmation is remembered for CONFIRMATION_DAYS (30) on this browser, then asked again', async () => {
  values.clear(); blocked = false;
  const fresh = await load();
  assert.equal(fresh.CONFIRMATION_DAYS, 30);
  assert.equal(fresh.researcherConfirmed(), false);
  const now = Date.UTC(2026, 9, 18, 12);
  fresh.confirmResearcher(now);
  assert.equal(values.get('tm-researcher-confirmed'), String(now));
  const later = await load();
  assert.equal(later.researcherConfirmed(now + 29 * DAY), true);
  assert.equal(later.researcherConfirmed(now + 30 * DAY), false);
  values.set('tm-researcher-confirmed', String(now + 5 * DAY));
  assert.equal(later.researcherConfirmed(now), false, 'a time ahead of the clock does not extend the window');
  values.set('tm-researcher-confirmed', 'not a time');
  assert.equal(later.researcherConfirmed(now), false);
});

test('without storage it is asked once per page load', async () => {
  values.clear(); blocked = true;
  try {
    const page = await load();
    assert.equal(page.researcherConfirmed(), false);
    page.confirmResearcher();
    assert.equal(page.researcherConfirmed(), true, 'the rest of this load');
    assert.equal((await load()).researcherConfirmed(), false, 'the next load asks again');
  } finally { blocked = false; }
});

test('the card: the client\'s wording, a live count, Enter only once both are ticked, the disclaimer and a way out', async () => {
  const { card, DISCLAIMER } = await load();
  const none = card({ ticked: [false, false], reading: false });
  assert.match(none, /role="dialog" aria-modal="true"/);
  assert.match(none, />Research use only</);
  assert.match(none, />0 of 2 confirmed</);
  assert.match(none, /<h2[^>]*>Researcher verification<\/h2>/);
  assert.match(none, />TrueMark supplies research peptides exclusively for in vitro and laboratory research\. Confirm both statements to continue\.</);
  assert.match(none, />I am at least 21 years of age\.</);
  assert.match(none, />I am a qualified researcher purchasing for in vitro or laboratory research only, not for human or veterinary use\.</);
  assert.match(none, /<button type="button" class="tm-button tm-button-primary tm-entry-enter" disabled=""[^>]*>Enter TrueMark<\/button>/);
  assert.match(none, /aria-expanded="false"[^>]*>Show disclaimer</);
  assert.match(none, /role="region" aria-label="Disclaimer" tabindex="0" hidden=""/);
  assert.match(none, /Not a researcher\? <a href="https:\/\/www\.google\.com" rel="noreferrer">Exit<\/a>/);
  // Each box is named by its own statement.
  const named = [...none.matchAll(/<input type="checkbox"[^>]*aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(named.length, 2);
  for (const id of named) assert.match(none, new RegExp(`<span id="${id}" class="tm-entry-statement">`));
  assert.match(card({ ticked: [true, false], reading: false }), />1 of 2 confirmed</);
  const both = card({ ticked: [true, true], reading: true });
  assert.match(both, />2 of 2 confirmed</);
  assert.doesNotMatch(both, /tm-entry-enter" disabled/);
  assert.match(both, /aria-expanded="true"[^>]*>Hide disclaimer</);
  assert.doesNotMatch(both, /aria-label="Disclaimer" tabindex="0" hidden/);
  for (const paragraph of DISCLAIMER) assert(both.includes(`<p>${paragraph}</p>`));
  assert.match(DISCLAIMER[0], /^All products sold by TrueMark are intended strictly for in-vitro laboratory research/);
  assert.match(DISCLAIMER[1], /See our Terms of Service for the complete terms\.$/);
  assert.match(both, /<a href="\/disclaimer"[^>]*>Disclaimer<\/a><a href="\/terms"[^>]*>Terms of Service<\/a>/);
});
