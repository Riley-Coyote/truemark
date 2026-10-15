/** WP-22: server-rendered UI contracts. No browser or hosted service. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const directory = await mkdtemp('/private/tmp/truemark-team-wiring-');
globalThis.window = Object.assign(new EventTarget(), { matchMedia: () => ({ matches: false }), setTimeout });
globalThis.document = { hidden: false, baseURI: 'https://fixture.example/' };
const localWrites = [];
globalThis.localStorage = globalThis.sessionStorage = { getItem: () => null, setItem(key, value) { localWrites.push({ key, value }); }, removeItem() {} };
globalThis.BroadcastChannel = undefined;
let profile = { id: 'owner', role: 'owner' };
const members = [
  { id: 'owner', email: 'owner@fixture.example', role: 'owner', joinedAt: '2026-01-01T00:00:00Z', lastSignInAt: '2026-10-01T15:00:00Z' },
  { id: 'staff', email: 'staff@fixture.example', role: 'staff', joinedAt: '2026-02-01T00:00:00Z', lastSignInAt: null },
];
const teamAlerts = members.map(member => ({ user_id: member.id, email: member.email, role: member.role, new_order_email: false, new_order_text: false, applications_email: false }));
const preferences = { phone: null, smsConsent: false, smsOptedOut: false, alerts: { newOrder: { email: false, text: false }, applications: { email: false } } };
const connections = ['payments', 'email', 'sms', 'shipping'].map(id => ({ id, mode: 'simulated', provider: '', lastOkAt: null, lastErrorAt: null, lastError: null }));
const invitation = { email: 'invited@fixture.example', role: 'staff', expiresAt: '2026-10-08T23:16:00Z' };
let invites = [{ id: 'invite', ...invitation }];
let teamError = null, teamLoading = false;
let acceptance = { data: { invitation, account: null }, loading: false, error: null, reload() {} };
globalThis.wp22Live = {
  auth: { profile: () => profile }, team: { members: () => members, invites: () => invites },
  payments: { rates: () => [] }, shipping: { methods: () => [] }, connections: { list: () => connections },
  messages: { teamPreferences: () => teamAlerts, preferences: () => structuredClone(preferences) },
};
globalThis.wp22Store = { settings: { get: () => ({ freeShippingThreshold: 150, freeShippingMethod: 'cold-2day', insuranceMode: 'off', insuranceRate: null, taxMode: 'off', taxShipping: false, shippingRatesConfirmed: false }) } };
globalThis.wp22Resource = (read) => {
  if (globalThis.wp22Acceptance) return acceptance;
  // SSR does not run effects. The renderer queues resolved shipping/own-alert
  // resources in hook order; synchronous team reads retain failure/loading states.
  const data = read.constructor.name === 'AsyncFunction' ? globalThis.wp22AsyncResources.shift() ?? null : read();
  const isTeam = data === members || data === invites || data === teamAlerts;
  return { data: isTeam && (teamError || teamLoading) ? undefined : data, loading: isTeam && teamLoading, error: isTeam ? teamError : null, reload() {} };
};

async function renderers(mode) {
  const outfile = join(directory, `${mode}.cjs`);
  await build({ stdin: { resolveDir: root, loader: 'tsx', contents: `
    import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
    import { MemoryRouter } from 'react-router-dom';
    import Settings from './src/admin/Settings'; import TeamInvite from './src/platform/live/TeamInvite';
    import { NewOrderAlerts } from './src/admin/notify'; import { AppearanceProvider } from './src/admin/appearance';
    import { LIVE } from './src/platform/mode';
    import { TEAM_PERMISSIONS } from './src/admin/team'; export { TEAM_PERMISSIONS };
    const render = (element, path) => renderToStaticMarkup(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);
    const ownAlerts = () => ({ profile: globalThis.wp22Live.auth.profile(), prefs: globalThis.wp22Live.messages.preferences() });
    export const settings = (query='') => {
      globalThis.wp22Acceptance = false;
      globalThis.wp22AsyncResources = LIVE ? [...(globalThis.wp22Live.auth.profile().role === 'owner' ? [globalThis.wp22Live.shipping.methods()] : []), ownAlerts()] : [];
      return render(<AppearanceProvider><Settings/></AppearanceProvider>, '/admin/settings' + query);
    };
    export const alerts = () => { globalThis.wp22Acceptance = false; globalThis.wp22AsyncResources = LIVE ? [ownAlerts()] : []; return render(<NewOrderAlerts/>, '/admin/settings'); };
    export const invite = () => { globalThis.wp22Acceptance = true; return render(<TeamInvite/>, '/access/team?invite=fixture-token'); };
  ` }, outfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', logLevel: 'silent', loader: { '.css': 'empty' },
    define: { 'import.meta.env': JSON.stringify({ VITE_PLATFORM: mode, BASE_URL: '/', PROD: false }), 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'team-fixtures', setup(plugin) {
      plugin.onLoad({ filter: /\/platform\/live\/runtime\.ts$/ }, () => ({ loader: 'ts', contents: 'export const live = () => globalThis.wp22Live; export async function initialize() {}' }));
      plugin.onLoad({ filter: /\/platform\/store\.ts$/ }, () => ({ loader: 'ts', contents: 'export const store = globalThis.wp22Store; export const useResource = (read) => globalThis.wp22Resource(read);' }));
      plugin.onResolve({ filter: /^react$/ }, (args) => /\/admin\/(preview\.ts|notify\.tsx)$/.test(args.importer) ? { path: 'react-fixture', namespace: 'fixture' } : undefined);
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export { useId, useEffect, useRef, useState } from ${JSON.stringify(join(root, 'node_modules/react/index.js'))}; export const useSyncExternalStore = (_subscribe, snapshot) => snapshot();`, resolveDir: root }));
    } }],
  });
  return require(outfile);
}
const live = await renderers('live');
const preview = await renderers('preview');

test('live settings use real email/role/dates, owner invitations and pending revocation; preview keeps both samples', () => {
  const html = live.settings();
  assert.match(html, /owner@fixture.example/); assert.match(html, /staff@fixture.example/);
  assert.match(html, /Last sign-in/); assert.match(html, /Never/); assert.match(html, /Invite a team member/);
  assert.match(html, /Pending invitations/); assert.match(html, /invited@fixture.example/); assert.match(html, /Revoke/);
  assert.match(html, /<time[^>]*>8 Oct 2026, 23:16 UTC<\/time>/);
  assert.doesNotMatch(html, /Expires 8 Oct/);
  assert.doesNotMatch(html, /Morgan|Dana|Sample operator|Fulfilment|arrive with the backend/);
  const before = preview.settings();
  assert.match(before, /Morgan Hale/); assert.match(before, /Dana Whitfield/); assert.match(before, /Fulfilment/);
  assert.match(before, /Two sample operators\. Invitations arrive with the backend\./);
  assert.match(before, /<button[^>]*disabled=""[^>]*>Invite an operator/);
  assert.doesNotMatch(before, /Invite a team member|Pending invitations/);
});

test('staff can read the real team and permission drawer but cannot invite, revoke, change roles or change owner settings', () => {
  profile.role = 'staff';
  try {
    const html = live.settings('?operator=staff');
    assert.match(html, /staff@fixture.example/); assert.match(html, /Only owners can change team roles/);
    assert.match(html, /Pending invitations/); assert.match(html, /invited@fixture.example/);
    assert.match(html, /Create and switch promo codes in Discounts/);
    assert.doesNotMatch(html, />Invite a team member<|>Revoke<|>Make owner<|>Remove from team<|Choose models that support tool use/);
    assert.match(html, /id="connections"/);
    const connectionBlock = html.match(/<section[^>]*id="connections"[\s\S]*?<\/section>/)?.[0];
    assert(connectionBlock);
    assert.doesNotMatch(connectionBlock, /kit-segmented|Live needs the provider/);
    assert.doesNotMatch(html, /Tax shipping|Add a state|Checkout shows these prices/);
    assert.match(html, /Cannot change/);
    for (const line of live.TEAM_PERMISSIONS.staff.cannot) assert(html.includes(line));
  } finally { profile.role = 'owner'; }
  assert.match(live.settings('?operator=staff'), />Make owner<|>Make owner<\/button>/);
  assert.match(live.settings('?operator=owner'), /Make staff/);
  assert.match(live.settings('?operator=staff'), /Remove from team/);
  assert.match(live.settings('?operator=missing'), /no longer on the team/);
});

test('live team and alert failures, loading and empty invitations stay honest and retryable', () => {
  invites = [];
  assert.match(live.settings(), /No pending invitations/);
  teamError = new Error('Fixture team unavailable');
  assert.match(live.settings(), /Fixture team unavailable/); assert.match(live.settings(), /Try again/);
  assert.match(live.alerts(), /Fixture team unavailable/);
  assert.doesNotMatch(live.alerts(), /Morgan|Dana|owner@fixture/);
  teamError = null; teamLoading = true;
  assert.match(live.settings(), /kit-skeleton-row/);
  assert.match(live.alerts(), /kit-skeleton-row/);
  teamLoading = false;
});

test('live alerts expose real team, always-on in-app alerts and own-only saved switches without local preference writes', () => {
  const writesBefore = localWrites.length;
  for (const member of members) {
    profile = { id: member.id, role: member.role };
    const html = live.alerts();
    assert.match(html, /owner@fixture.example/); assert.match(html, /staff@fixture.example/);
    const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
    const own = rows.find(row => row.includes(member.email));
    const other = rows.find(row => row.includes(members.find(m => m.id !== member.id).email));
    assert(own); assert(other);
    const switches = own.match(/<button[^>]*role="switch"[^>]*>/g) ?? [];
    assert.equal(switches.length, 3);
    for (const control of switches) { assert.match(control, /aria-checked="false"/); assert.doesNotMatch(control, /disabled=""/); }
    assert.doesNotMatch(other, /role="switch"/);
    assert.equal((other.match(/>Off<\/td>/g) ?? []).length, 3);
    for (const label of ['New orders: Email', 'New orders: Text', 'Applications: Email']) assert(html.includes(label));
    assert.match(html, /Mobile number for text alerts/);
    assert.match(html, /Text me TrueMark team alerts at this number\. Message and data rates may apply\. Reply STOP to opt out\./);
    assert.match(html, /type="checkbox"/); assert.match(html, />Save<\/button>/);
    assert.match(html, /Each person chooses their own alerts\. In-app alerts are always on\./);
    assert.doesNotMatch(html, /Sample|Morgan|Dana|What they receive|Preview:/);
  }
  profile = { id: 'owner', role: 'owner' };
  assert.equal(localWrites.length, writesBefore);
  assert.match(preview.alerts(), /role="switch"/); assert.match(preview.alerts(), /Sample team/);
});

test('invite acceptance keeps the themed gate, locked email and password-manager contracts', async () => {
  const html = live.invite();
  assert.match(html, /class="kit cc-gate"/); assert.match(html, /class="cc-gate-card"/); assert.match(html, /TrueMark BioLabs/);
  assert.match(html, /Join the TrueMark team/); assert.match(html, /Sign in to accept/);
  const email = html.match(/<input[^>]*name="email"[^>]*>/)?.[0];
  assert.match(email, /type="email"/); assert.match(email, /autoComplete="username"/); assert.match(email, /readOnly=""/); assert.match(email, /value="invited@fixture.example"/);
  const password = html.match(/<input[^>]*name="new-password"[^>]*>/)?.[0];
  assert.match(password, /type="password"/); assert.match(password, /autoComplete="new-password"/); assert.match(password, /minLength="10"/);
  // The existing-account branch uses the same field with the current-password contract.
  const source = await readFile(join(root, 'src/platform/live/TeamInvite.tsx'), 'utf8');
  assert.match(source, /autoComplete=\{existing \? "current-password" : "new-password"\}/);
  assert.match(source, /Confirm your email, then sign in to the command center\./);
  assert.match(source, /navigate\("\/admin", \{ replace: true \}\)/);
  const routes = await readFile(join(root, 'src/AppRoutes.tsx'), 'utf8');
  assert.match(routes, /TeamInvite = LIVE \? lazy/); assert.match(routes, /path="\/access\/team"/);
});

test('unknown, expired or used invite state never shows signup; failed loads can retry', () => {
  acceptance.data = { invitation: null, account: null };
  let html = live.invite(); assert.match(html, /invitation is no longer available/); assert.doesNotMatch(html, /<input/);
  acceptance = { data: undefined, loading: true, error: null, reload() {} };
  assert.match(live.invite(), /Checking invitation…/);
  acceptance = { data: undefined, loading: false, error: new Error('Fixture lookup failed'), reload() {} };
  html = live.invite(); assert.match(html, /Fixture lookup failed/); assert.match(html, /Try again/);
  acceptance = { data: { invitation, account: null }, loading: false, error: null, reload() {} };
});

test('an existing session can accept only the matching email; a different account gets sign-out before any form', () => {
  acceptance.data.account = { id: 'existing', email: invitation.email };
  let html = live.invite(); assert.match(html, /Accept invitation/); assert.doesNotMatch(html, /type="password"/);
  acceptance.data.account = { id: 'other', email: 'other@fixture.example' };
  html = live.invite(); assert.match(html, /other@fixture.example/); assert.match(html, /Sign out to continue with the invited email/);
  assert.match(html, />Sign out<\/button>/); assert.doesNotMatch(html, /Accept invitation|<form/);
  acceptance.data.account = null;
});
