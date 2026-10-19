import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const directory = await mkdtemp('/private/tmp/truemark-accounts-wiring-');
globalThis.window = Object.assign(new EventTarget(), { matchMedia: () => ({ matches: false }), setTimeout });
globalThis.document = { hidden: false, baseURI: 'https://fixture.example/' };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.BroadcastChannel = undefined;

async function renderers(mode) {
  const outfile = join(directory, `${mode}.cjs`);
  await build({ stdin: { resolveDir: root, loader: 'tsx', contents: `
    import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
    import { MemoryRouter } from 'react-router-dom';
    import Gate from './src/brand/Gate'; import SignIn from './src/partners/public/SignIn';
    import Apply from './src/partners/public/Apply'; import { TeamGate } from './src/platform/live/TeamGate';
    import { AppearanceProvider } from './src/admin/appearance';
    import { PasswordReset } from './src/platform/PasswordReset';
    import { PartnerPending } from './src/platform/live/PartnerPending';
    import { PartnerApplicationDrawer } from './src/admin/PartnerApplicationDrawer';
    import Partners from './src/admin/Partners';
    import { submitApplication } from './src/partners/applications';
    import { signIn } from './src/partners/session';
    const render = (element, path = '/') => renderToStaticMarkup(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);
    export { submitApplication, signIn };
    export const gate = () => render(<Gate/>);
    export const partner = () => render(<SignIn/>);
    export const apply = () => render(<Apply/>);
    export const team = () => render(<AppearanceProvider><TeamGate><p>Owner tools</p></TeamGate></AppearanceProvider>);
    export const reset = (gate) => render(<PasswordReset gate={gate} onBack={() => {}}/>);
    export const pending = () => render(<PartnerPending onRefresh={() => {}}/>);
    export const partners = (view) => render(<Partners/>, '/admin/partners?view=' + view);
    export const drawer = (application) => render(<PartnerApplicationDrawer application={application} onClose={() => {}} onSaved={() => {}}/>);
  ` }, outfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', logLevel: 'silent', loader: { '.css': 'empty' },
    define: { 'import.meta.env': JSON.stringify({ VITE_PLATFORM: mode, BASE_URL: '/', PROD: false }), 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'local-auth-and-hook-fixtures', setup(plugin) {
      plugin.onLoad({ filter: /\/platform\/live\/runtime\.ts$/ }, () => ({ loader: 'ts', contents: 'export const live = () => globalThis.wp19Live; export async function initialize() {}' }));
      plugin.onLoad({ filter: /\/platform\/store\.ts$/ }, () => ({ loader: 'ts', contents: 'export const store = { partners: { list: () => [], referrals: () => [], payouts: () => [] }, orders: { list: () => [] } }; export const useResource = (read) => typeof globalThis.wp19Resource === "function" ? globalThis.wp19Resource(read) : globalThis.wp19Resource;' }));
      // SSR has no client subscriptions. Inject only that hook's snapshot to render
      // recovery events captured before mount, while keeping React's other hooks real.
      plugin.onResolve({ filter: /^react$/ }, (args) => /\/(platform\/PasswordReset\.tsx|admin\/preview\.ts)$/.test(args.importer) ? { path: 'react-recovery', namespace: 'fixture' } : undefined);
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export { useEffect, useId, useRef, useState } from ${JSON.stringify(join(root, 'node_modules/react/index.js'))}; export const useSyncExternalStore = (_subscribe, snapshot) => snapshot();`, resolveDir: root }));
    } }],
  });
  return require(outfile);
}
let recovery = null;
let application = null;
let profile = { id: 'user', role: 'buyer' };
let linked = null;
globalThis.wp19Live = { auth: { recovery: () => recovery, subscribeRecovery: () => () => {}, profile: () => profile, signIn: async () => profile },
  partnerApplications: { mine: async () => application, list: () => [] }, store: { partners: { me: async () => linked } } };
globalThis.wp19Resource = { data: null, loading: false, error: null, reload() {} };
const live = await renderers('live');
const preview = await renderers('preview');

function input(html, name) {
  const field = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0];
  assert(field, `Missing input name ${name}`); return field;
}
test('all three live sign-in gates expose working reset controls and password-manager names/autocomplete', () => {
  for (const html of [live.gate(), live.partner(), live.team()]) {
    assert.match(html, /Forgot password\?/);
    assert.match(input(html, 'email'), /type="email"/); assert.match(input(html, 'email'), /autoComplete="username"/);
    assert.match(input(html, 'password'), /type="password"/); assert.match(input(html, 'password'), /autoComplete="current-password"/);
    assert.doesNotMatch(html, /href="\/contact"[^>]*>Forgot password/);
  }
});
test('recovery preempts signed-in team access and renders two full password fields in each existing gate', () => {
  recovery = { userId: 'user', email: 'fixture@example.test', gate: 'team' };
  globalThis.wp19Resource.data = { id: 'user', role: 'owner' };
  try {
    for (const html of [live.gate(), live.partner(), live.team()]) {
      assert.match(html, /Set a new password/);
      for (const name of ['new-password', 'confirm-password']) {
        const field = input(html, name); assert.match(field, /type="password"/); assert.match(field, /autoComplete="new-password"/); assert.match(field, /minLength="10"/);
      }
      assert.doesNotMatch(html, /Owner tools|>Sign in<|Create account/);
    }
    // Purple is the command center's default appearance (2026-10-05), with the white lockup.
    assert.match(live.team(), /class="cc-gate-card"/); assert.match(live.team(), /data-theme="violet"/); assert.match(live.team(), /lockup-white\.svg/);
    assert.match(live.partner(), /class="tm pp-signin"/); assert.match(live.gate(), /class="tm tm-gate"/);
  } finally { recovery = null; globalThis.wp19Resource.data = null; }
});
test('preview reset is an honest message; partner preview still has no password or submission', async () => {
  for (const gate of ['shop', 'partner', 'team']) {
    const html = preview.reset(gate); assert.match(html, /Password resets work in the live platform\./); assert.doesNotMatch(html, /<input/);
  }
  assert.doesNotMatch(preview.apply(), /type="password"/);
  assert.match(preview.apply(), /Design preview: accounts are kept on this page and not sent/);
  assert.match(input(live.apply(), 'password'), /autoComplete="new-password"/);
  assert.match(input(live.apply(), 'password'), /minLength="10"/);
  const draft = { name: 'Fixture', email: 'fixture@example.test', channel: 'https://fixture.example', otherChannels: [], audience: 'Fixture', feature: 'Fixture', commitments: [] };
  const receipt = await preview.submitApplication(draft);
  assert.equal(receipt.status, 'submitted'); assert.equal(receipt.confirmationRequired, undefined); assert.equal(receipt.name, draft.name);
});
test('a submitted partner signs in without a linked row, gets the calm state, then opens the approved portal', async () => {
  application = { id: 'application', status: 'submitted' };
  await assert.doesNotReject(live.signIn('fixture@example.test', 'fixture-password'));
  globalThis.wp19Resource.data = application;
  assert.match(live.pending(), /Your application is with the team/);
  assert.match(live.pending(), /Check status/);
  globalThis.wp19Resource.data = { ...application, status: 'declined', reviewNote: 'Fixture review note' };
  assert.match(live.pending(), /Your application has been reviewed/); assert.match(live.pending(), /Fixture review note/);
  profile = { id: 'user', role: 'partner' }; linked = { id: 'partner' }; application = { ...application, status: 'approved' };
  await assert.doesNotReject(live.signIn('fixture@example.test', 'fixture-password'));
  profile = { id: 'user', role: 'buyer' }; linked = null; application = null;
  await assert.rejects(live.signIn('fixture@example.test', 'fixture-password'), /linked partner profile/);
  globalThis.wp19Resource.data = null;
});
test('application drawer retains all answers and escapes user-authored content', () => {
  const html = live.drawer({ id: 'fixture', name: 'Fixture <script>', email: 'fixture@example.test', status: 'submitted', submittedAt: '2026-10-01T12:00:00Z',
    channel: 'javascript:alert(1)', otherChannels: ['https://fixture.example/other'], audience: 'Fixture audience', feature: 'Fixture feature <img onerror=x>', commitments: ['research'] });
  for (const text of ['Fixture &lt;script&gt;', 'fixture@example.test', 'https://fixture.example/other', 'Fixture audience', 'Fixture feature &lt;img onerror=x&gt;', 'Commitments', 'Approve', 'Decline']) assert(html.includes(text), text);
  assert.doesNotMatch(html, /<script>|href="javascript:/);
});

test('pending, declined and approved applicants keep the public partner chrome, copy and actions', () => {
  const resource = globalThis.wp19Resource;
  try {
    for (const [status, title, note] of [
      ['submitted', 'Your application is with the team', "We review every application; you&#x27;ll hear from us by email."],
      ['declined', 'Your application has been reviewed', 'Fixture review note'],
      ['approved', 'Your application is approved', 'Your portal is ready. Refresh to open it.'],
    ]) {
      globalThis.wp19Resource = { ...resource, data: { status, reviewNote: 'Fixture review note' } };
      const html = live.pending();
      assert.match(html, /class="brand-refinement pp-public"/);
      assert.match(html, /<header class="tm-header">/);
      assert.match(html, /class="brand-logo/); assert.match(html, /Partner program/);
      assert.match(html, /<main id="pp-main">/); assert.match(html, /class="tm pp-signin"/);
      assert.match(html, /class="pp-application-state"/); assert.doesNotMatch(html, /pp-portal-loading|kit-empty/);
      assert(html.includes(title)); assert(html.includes(note));
      assert.match(html, /class="tm-button tm-button-primary"[^>]*>Check status<\/button>/);
      assert.match(html, /class="tm-textlink"[^>]*href="\/partners\/sign-out"[^>]*>Sign out<\/a>/);
    }
  } finally { globalThis.wp19Resource = resource; }
});

test('application loading and retryable failures stay inside the public page', () => {
  const resource = globalThis.wp19Resource;
  try {
    globalThis.wp19Resource = { ...resource, loading: true, data: undefined };
    let html = live.pending();
    assert.match(html, /class="brand-refinement pp-public"/); assert.match(html, /Checking your application…/); assert.match(html, /aria-busy="true"/);
    globalThis.wp19Resource = { ...resource, data: null, error: new Error('Fixture loading failure') };
    html = live.pending();
    assert.match(html, /class="brand-refinement pp-public"/); assert.match(html, /Your application could not be loaded/);
    assert.match(html, /role="alert">Fixture loading failure/); assert.match(html, /Check status/);
  } finally { globalThis.wp19Resource = resource; }
});

test('live payouts have one approval action and no batch or separate payment card; preview keeps batches', () => {
  const resource = globalThis.wp19Resource, oldProfile = profile;
  globalThis.wp19Resource = (read) => ({ data: read(), loading: false, error: null, reload() {} });
  profile = { id: 'owner', role: 'owner' };
  try {
    for (const view of ['partners', 'applications', 'payouts']) {
      const html = live.partners(view);
      if (view === 'payouts') {
        assert.equal((html.match(/>Approve eligible commissions<\/button>/g) ?? []).length, 1);
        assert.match(html, /class="kit-note">Captured orders before .*14-day holding period/);
        assert.match(html, /Approved, not yet paid/); assert.match(html, /Payout history/);
      } else assert.doesNotMatch(html, /Commissions and payouts|Approve eligible commissions|Record completed transfer/);
      assert.doesNotMatch(html, /Saving arrives next|Commissions and payouts|Create payout batch|sample schedule/);
    }
    for (const view of ['partners', 'payouts']) {
      const html = preview.partners(view);
      assert.doesNotMatch(html, /Commissions and payouts|Saving arrives next/);
      assert.match(html, /Preview: changes are not saved/);
      if (view === 'payouts') assert.match(html, /Create payout batch/);
    }
  } finally { globalThis.wp19Resource = resource; profile = oldProfile; }
});

test('actual runtime subscribes before exchange, removes only code, and routes recovery into the original gate', async () => {
  const outfile = join(directory, 'runtime.cjs');
  await build({ entryPoints: [join(root, 'src/platform/live/runtime.ts')], outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent', define: { 'import.meta.env.VITE_PLATFORM': '"live"' },
    plugins: [{ name: 'mock-client', setup(plugin) { plugin.onLoad({ filter: /\/platform\/live\/client\.ts$/ }, () => ({ loader: 'ts', contents: 'export const getClient = () => globalThis.wp19Client;' })); } }] });
  const storage = new Map([['tm-live-recovery-gate', 'team']]);
  const touched = []; globalThis.localStorage = { 'tm-live-auth-code-verifier': 'fixture-verifier', getItem: (key) => { touched.push(key); return storage.get(key) ?? null; }, setItem: (key, value) => { touched.push(key); storage.set(key, value); }, removeItem: (key) => { touched.push(key); storage.delete(key); } };
  globalThis.location = new URL('https://fixture.example/live/?code=fixture-once&keep=1#/access');
  globalThis.history = { state: null, replaceState(_state, _title, url) { globalThis.location = new URL(url, location); } };
  let handler, initialized = 0;
  globalThis.wp19Client = {
    auth: { onAuthStateChange(callback) { handler = callback; }, async initialize() { initialized++; assert(handler); delete localStorage['tm-live-auth-code-verifier']; handler('PASSWORD_RECOVERY', { user: { id: 'fixture', email: 'fixture@example.test' } }); return { error: null }; } },
    channel() { const channel = { on() { return channel; }, subscribe() {} }; return channel; }, removeChannel() {},
  };
  const runtime = require(outfile); await runtime.initialize(); await runtime.initialize();
  assert.equal(initialized, 1); assert.equal(location.hash, '#/admin'); assert.equal(location.search, '?keep=1');
  assert.equal(runtime.live().auth.recovery().gate, 'team'); assert(touched.every((key) => key.startsWith('tm-live-')));
  assert.equal(runtime.live().auth.recovery().userId, 'fixture'); assert.equal(runtime.live().auth.recovery().error, undefined);
  const client = await readFile(join(root, 'src/platform/live/client.ts'), 'utf8');
  assert.match(client, /flowType: "pkce"/); assert.match(client, /storageKey: "tm-live-auth"/);
  delete require.cache[require.resolve(outfile)];
  globalThis.location = new URL('https://fixture.example/live/?code=expired-fixture#/access');
  globalThis.wp19Client.auth.initialize = async () => ({ error: { message: 'Invalid exchange code' } });
  const expired = require(outfile); await expired.initialize();
  assert.equal(location.hash, '#/admin'); assert.equal(location.search, '');
  assert.equal(expired.live().auth.recovery()?.userId, '');
  assert.match(expired.live().auth.recovery()?.error ?? '', /Request a new reset link/);
  delete require.cache[require.resolve(outfile)];
  globalThis.location = new URL('https://fixture.example/live/?code=other-browser#/access');
  globalThis.wp19Client.auth.initialize = async () => ({ error: null });
  const elsewhere = require(outfile); await elsewhere.initialize();
  assert.equal(location.search, ''); assert.equal(location.hash, '#/admin');
  assert.equal(elsewhere.live().auth.recovery()?.userId, '');
  assert.match(elsewhere.live().auth.recovery()?.error ?? '', /only works in the browser where it was requested/);
});

test('an expired-link state offers a fresh request within the same team card', () => {
  recovery = { userId: '', email: '', gate: 'team', error: 'That link has expired or could not be used. Request a new reset link.' };
  try {
    const html = live.team(); assert.match(html, /Reset your password/); assert.match(html, /Request a new reset link/);
    assert.match(html, /Send reset link/); assert.doesNotMatch(html, /type="password"/);
  } finally { recovery = null; }
});
