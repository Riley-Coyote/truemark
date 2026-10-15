/** WP-21: Node-rendered screen contracts, with local data and no hosted service. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const temp = await mkdtemp('/private/tmp/truemark-live-saves-');
globalThis.window = Object.assign(new EventTarget(), { matchMedia: () => ({ matches: false }), setTimeout });
globalThis.document = { hidden: false, baseURI: 'https://fixture.example/' };
globalThis.localStorage = globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.BroadcastChannel = undefined;
const partner = { id: 'partner-21', name: 'Fixture Partner', handle: '@fixture', email: 'fixture@example.test', code: 'PARTNER21',
  rate: .1, codeDiscount: .1234, status: 'active', joinedAt: '2026-01-01T00:00:00Z', audience: 'Fixture' };
const referrals = [
  { id: 'ref-1', partnerId: partner.id, orderId: 'order-1', orderNumber: 'TM-10001', createdAt: '2026-09-01T00:30:00+02:00', status: 'approved', orderSubtotal: 100, commission: 10, via: 'code' },
  { id: 'ref-2', partnerId: partner.id, orderId: 'order-2', orderNumber: 'TM-10002', createdAt: '2026-09-20T23:30:00-02:00', status: 'approved', orderSubtotal: 200, commission: 20, via: 'link' },
];
const codes = [{ code: partner.code, kind: 'partner', percent: 12.34, partnerId: partner.id, active: true, uses: 2 },
  { code: 'PROMO21', kind: 'promo', percent: 9.99, active: false, uses: 0 }];
const payouts = [{ id: 'paid-21', partnerId: partner.id, periodStart: '2026-07-14', periodEnd: '2026-08-13', amount: 12.5, referrals: 1, status: 'paid', paidAt: '2026-08-14', method: 'Fixture transfer' }];
let profile = { id: 'owner', role: 'owner' };
let resourceError = null;
globalThis.wp21Store = {
  partners: { list: () => [partner], referrals: () => referrals, payouts: () => payouts, discounts: () => codes },
  orders: { list: () => [] }, settings: { get: () => ({ freeShippingThreshold: 150, freeShippingMethod: 'cold-2day', insuranceMode: 'off', insuranceRate: null, taxMode: 'off', taxShipping: false, shippingRatesConfirmed: false }) },
};
globalThis.wp21Live = {
  auth: { profile: () => profile }, partnerApplications: { list: () => [] }, team: { members: () => [], invites: () => [] },
  payments: { rates: () => [] }, shipping: { methods: () => [] },
  connections: { list: () => ['payments', 'email', 'sms', 'shipping'].map(id => ({ id, mode: 'simulated', provider: '', lastOkAt: null, lastErrorAt: null, lastError: null })) },
  messages: { teamPreferences: () => [] },
};
// Async effects are not run by SSR; the alerts preview stays in its empty state.
globalThis.wp21Resource = (read) => ({ data: resourceError ? undefined : read.constructor.name === 'AsyncFunction' ? null : read(), loading: false, error: resourceError, reload() {} });

async function bundle(mode) {
  const outfile = join(temp, `${mode}.cjs`);
  await build({ stdin: { resolveDir: root, loader: 'tsx', contents: `
    import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
    import { MemoryRouter } from 'react-router-dom';
    import Partners from './src/admin/Partners'; import Discounts from './src/admin/Discounts'; import Settings from './src/admin/Settings';
    import { AppearanceProvider } from './src/admin/appearance'; import { PayoutDrawer } from './src/admin/PayoutDrawer';
    export * as program from './src/admin/program'; export { preview, PREVIEW_NOTE } from './src/admin/preview';
    const render = (element, path) => renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><AppearanceProvider>{element}</AppearanceProvider></MemoryRouter>);
    export const partners = (query='') => render(<Partners/>, '/admin/partners' + query);
    export const discounts = (query='') => render(<Discounts/>, '/admin/discounts' + query);
    export const settings = () => render(<Settings/>, '/admin/settings');
    export const payout = (line, props={}) => render(<PayoutDrawer line={line} loading={false} error={null} onRetry={() => {}} onClose={() => {}} onSaved={() => {}} {...props}/>, '/admin/partners');
  ` }, outfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty' }, logLevel: 'silent',
    define: { 'import.meta.env': JSON.stringify({ VITE_PLATFORM: mode, BASE_URL: '/', PROD: false }), 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'local-data', setup(plugin) {
      plugin.onLoad({ filter: /\/platform\/live\/runtime\.ts$/ }, () => ({ loader: 'ts', contents: 'export const live = () => globalThis.wp21Live; export async function initialize() {}' }));
      plugin.onLoad({ filter: /\/platform\/store\.ts$/ }, () => ({ loader: 'ts', contents: 'export const store = globalThis.wp21Store; export const useResource = (read) => globalThis.wp21Resource(read);' }));
      plugin.onResolve({ filter: /^react$/ }, (args) => /\/admin\/(preview\.ts|notify\.tsx)$/.test(args.importer) ? { path: 'react-preview', namespace: 'fixture' } : undefined);
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export * from ${JSON.stringify(join(root, 'node_modules/react/index.js'))}; export const useSyncExternalStore = (_subscribe, snapshot) => snapshot();`, resolveDir: root }));
    } }],
  });
  return require(outfile);
}
const live = await bundle('live');
const preview = await bundle('preview');
const blank = { prices: {}, partnerStatus: {}, codeActive: {}, codes: [], batches: [], rates: {} };
const line = { partner: { ...partner, referrals, count: 2, revenue: 300, owed: 30, pending: 0, paid: 12.5, edited: false }, referrals, amount: 30, since: referrals[0].createdAt };

test('live program reads ignore memory overrides, retain decimal terms and use actual payout periods', () => {
  const overrides = { ...blank, partnerStatus: { [partner.id]: 'paused' }, codeActive: { [partner.code]: true }, codes: [{ ...codes[1], code: 'MEMORY_ONLY' }] };
  assert.equal(live.program.partnerStatus(partner, overrides), 'active');
  assert.equal(preview.program.partnerStatus(partner, overrides), 'paused');
  const values = live.program.codeRows([{ ...codes[0], active: false }], [partner], [], overrides);
  assert.equal(values.length, 1); assert.equal(values[0].active, false); assert.equal(values[0].edited, false);
  assert.equal(live.program.percent(.1234), '12.34%');
  assert.equal(live.program.payoutHistory(payouts, [], referrals)[0].period, '14 Jul 2026 to 13 Aug 2026');
  assert.equal(preview.program.payoutHistory(payouts, [], referrals)[0].period, 'Jul 2026');
});

test('live payouts expose one per-partner record action, persisted history and no memory batch even through a deep link', () => {
  live.preview.addBatch({ id: 'MEMORY_BATCH', scheduledFor: '2026-10-05', createdAt: '2026-10-01', method: 'Memory only', lines: [{ partnerId: partner.id, referralIds: referrals.map((r) => r.id), amount: 30 }], total: 30 });
  for (const query of ['?view=payouts', '?view=payouts&batch=new']) {
    const html = live.partners(query);
    assert.match(html, /Approve eligible commissions/); assert.match(html, /14-day holding period/);
    assert.match(html, /Record payout/); assert.match(html, /Fixture transfer/); assert.match(html, /14 Jul 2026 to 13 Aug 2026/);
    assert.doesNotMatch(html, /Create payout batch|Confirm payout batch|Commissions and payouts|sample schedule|Memory only|Saving arrives next/);
  }
  assert.match(preview.partners('?view=payouts'), /Create payout batch/);
  assert.match(preview.partners('?view=payouts&batch=new'), /Confirm payout batch/);
  assert.doesNotMatch(live.partners('?view=applications'), /Record payout|Approve eligible commissions/);
});

test('payout drawer preselects the partner, prefills UTC bounds in kit columns and requires manual transfer details', () => {
  const html = live.payout(line);
  assert.match(html, /This action does not send money\./); assert.match(html, /Fixture Partner/);
  assert.equal((html.match(/class="kit-span-6"/g) ?? []).length, 2);
  assert.match(html, /type="date"[^>]*value="2026-08-31"/); assert.match(html, /type="date"[^>]*value="2026-09-21"/);
  assert.match(html, /Transfer method/); assert.match(html, /Transfer reference/);
  assert.equal((html.match(/type="text"[^>]*value=""/g) ?? []).length, 2);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Record completed transfer/);
  assert.match(html, /2 approved referrals/);
  // Background resource refresh must not replace an in-progress form.
  assert.match(live.payout(line, { loading: true }), /Transfer reference/);
  assert.match(live.payout(undefined, { loading: true }), /Loading the payout/);
  assert.match(live.payout(undefined), /Nothing waiting to be paid/);
  assert.match(live.payout(line, { error: new Error('Fixture failure') }), /Fixture failure/);
  assert.match(live.payout(line, { error: new Error('Fixture failure') }), /Try again/);
});

test('staff can see payouts but cannot approve commissions or record a transfer', () => {
  profile.role = 'staff';
  try {
    const html = live.partners('?view=payouts');
    assert.match(html, /Only the owner can approve commissions and record payouts/);
    assert.match(html, /<button[^>]*disabled=""[^>]*>Record payout/);
    assert.doesNotMatch(html, />Approve eligible commissions<\/button>/);
    assert.match(live.payout(line), /Only the owner can record payouts/);
  } finally { profile.role = 'owner'; }
});

test('live partner drawers offer pause/resume, pending goes to Applications, and preview retains demo approval', () => {
  for (const [status, action] of [['active', 'Pause partner'], ['paused', 'Resume partner'], ['pending', 'Review new partners in']]) {
    partner.status = status;
    const html = live.partners('?partner=' + partner.id);
    assert(html.includes(action)); assert.doesNotMatch(html, /Approve partner|Saving arrives next|on the 5th of each month/);
    if (status === 'pending') assert.match(html, /href="\/admin\/partners\?view=applications"/);
  }
  assert.match(preview.partners('?partner=' + partner.id), /Approve partner/);
  partner.status = 'active';
});

test('partner codes have a locked switch and reverse link; promos have an editable switch and live creation rules', () => {
  const html = live.discounts('?code=' + partner.code);
  assert.match(html, /Managed with partner/); assert.match(html, /Only pause or resume changes this code/);
  assert.match(html, /href="\/admin\/partners\?partner=partner-21"/);
  const locked = html.match(/<button[^>]*role="switch"[^>]*>/)?.[0]; assert(locked); assert.match(locked, /disabled=""/);
  const promo = live.discounts('?code=PROMO21').match(/<button[^>]*role="switch"[^>]*>/)?.[0]; assert(promo); assert.doesNotMatch(promo, /disabled=/);
  const form = live.discounts('?create=code');
  assert.match(form, /1 to 64 characters/); assert.match(form, /From 0 to 100, with up to two decimals/); assert.match(form, /day in UTC/);
  assert.doesNotMatch(form, /aria-label="Kind"|Choose a partner|Saving arrives next/);
  assert.match(preview.discounts('?create=code'), /aria-label="Kind"/);
});

test('all three compliance guardrails are checked and locked in both modes; no live save notice remains', async () => {
  for (const api of [live, preview]) {
    const html = api.settings();
    // Connections now sits between Compliance and Team and has its own controls.
    const section = html.match(/>Compliance<\/h2>([\s\S]*?)<\/section>/)?.[1];
    assert(section, 'Compliance block is present');
    assert.equal((section.match(/Always on/g) ?? []).length, 3);
    const switches = section.match(/<button[^>]*role="switch"[^>]*>/g);
    assert.equal(switches?.length, 3);
    for (const control of switches) { assert.match(control, /disabled=""/); assert.match(control, /aria-checked="true"/); }
    if (api === live) assert.doesNotMatch(html, /Saving arrives next/);
  }
  assert.equal(live.PREVIEW_NOTE, ''); assert.equal(preview.PREVIEW_NOTE, 'Preview: changes are not saved');
  assert.equal(preview.preview.setCompliance, undefined);
  assert.doesNotMatch(await readFile(join(root, 'src/platform/live/adapter.ts'), 'utf8'), /savingNext|Saving arrives next/);
});
