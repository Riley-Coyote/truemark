import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLiveAdapter, approvalCutoff } from '../src/platform/live/adapter.ts';
import * as map from '../src/platform/live/rows.ts';
import { compareNullable, sumTracked } from '../src/platform/inventory.ts';
import type { Address, OrderDraft } from '../src/platform/types.ts';

const address: Address = { id: 'new', label: 'Lab', institution: 'Fixture lab', attention: 'Fixture', line1: '1 Test St', city: 'Test', region: 'TX', postal: '12345', country: 'US' };
const order = { id: 'order-id', number: 'TM-10500', buyer_id: 'buyer-id', created_at: '2026-09-01T12:00:00Z', status: 'placed', payment: 'authorized', address, shipping_method_id: 'cold-2day', shipping_price: '24.00', subtotal: '100.00', discount_code: 'FIXTURE10', discount_amount: '10.00', discount_partner_id: 'partner-id', total: '114.00', order_lines: [{ product_id: 'compound', quantity: 2, unit_price: '50.00', lot: 'LOT' }], order_events: [{ status: 'placed', at: '2026-09-01T12:00:00Z' }] };
const partner = { id: 'partner-id', user_id: 'user-id', name: 'Fixture Partner', handle: '@fixture', email: 'fixture@example.test', code: 'FIXTURE10', rate: '0.12', status: 'paused', joined_at: '2026-01-01T00:00:00Z', audience: 'Fixture' };
const referral = { id: 'ref-id', partner_id: 'partner-id', order_id: order.id, order_number: order.number, created_at: order.created_at, order_subtotal: '90.00', commission: '10.80', status: 'pending', via: 'link' };
function fixture() {
  const tables: Record<string, map.Row[]> = {
    profiles: [{ id: 'user-id', role: 'buyer' }], buyers: [{ id: 'buyer-id', user_id: 'user-id', name: 'Fixture', email: 'fixture@example.test', institution: 'Fixture lab', role: 'Researcher', status: 'pending', joined_at: order.created_at, verified_at: null, addresses: [address] }],
    orders: [structuredClone(order)], partners: [partner], discounts: [{ code: 'FIXTURE10', kind: 'partner', partner_id: 'partner-id', percent: '10', active: false, uses: '1' }], notifications: [], applications: [], visits: [], referrals: [referral], payouts: [], shipping_methods: [{ id: 'cold-2day', price: '24.00', label: 'Cold', detail: 'Fixture', active: true }], products: [{ id: 'compound', name: 'Compound', size: '10 mg', category: 'peptide-fragments', price: '50.00', form: 'Lyophilized powder', lot: 'LOT', active: true }],
  };
  const calls: { type: string; name: string; args: unknown }[] = [];
  const handlers = new Map<string, (payload: unknown) => void>();
  const events: unknown[] = [];
  let changes = 0;
  let error: { message: string } | null = null;
  let session: { user: { id: string } } | null = { user: { id: 'user-id' } };
  let rpcData: unknown = null;
  const subscriptions: string[] = [];
  const fake = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      let start = 0, end = 999;
      const query = {
        select(value = '*') { calls.push({ type: 'read', name: table, args: value }); return query; },
        eq(key: string, value: unknown) { filters[key] = value; calls.push({ type: 'filter', name: table, args: [key, value] }); return query; },
        order() { return query; }, range(a: number, b: number) { start = a; end = b; return query; }, returns() { return query; },
        insert(value: unknown) { calls.push({ type: 'insert', name: table, args: value }); return query; },
        update(value: unknown) { calls.push({ type: 'update', name: table, args: value }); return query; },
        async single() { return { data: { ...address, id: 'address-id' }, error }; },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: (tables[table] ?? []).filter((row) => Object.entries(filters).every(([key, value]) => String(row[key]) === String(value))).slice(start, end + 1), error }).then(resolve); },
      };
      return query;
    },
    storage: { from(bucket: string) {
      return {
        async upload(path: string, file: File, options: unknown) { calls.push({ type: 'upload', name: bucket, args: { path, file, options } }); return { data: { path }, error }; },
        getPublicUrl(path: string) { return { data: { publicUrl: `https://fixture.example/storage/v1/object/public/${bucket}/${path}` } }; },
      };
    } },
    async rpc(name: string, args: unknown) { calls.push({ type: 'rpc', name, args }); return { data: name === 'my_checkout_benefits' ? { membershipName: null, membershipAmount: 0, rewardAmount: 0, rewardPoints: 0, promoAmount: (args as {promo_amount:number}).promo_amount } : rpcData, error }; },
    auth: {
      async getSession() { return { data: { session }, error }; },
      async signInWithPassword(args: unknown) { calls.push({ type: 'auth', name: 'signIn', args }); return { data: { session }, error }; },
      async signUp(args: unknown) { calls.push({ type: 'auth', name: 'signUp', args }); return { data: { session }, error }; },
      async signOut() { session = null; return { error }; },
    },
    channel(name: string) {
      subscriptions.push(name);
      const channel = { on(_type: string, filter: { table: string }, handler: (payload: unknown) => void) { handlers.set(filter.table, handler); return channel; }, subscribe(handler: (status: string) => void) { handler('SUBSCRIBED'); return channel; } };
      return channel;
    },
    async removeChannel() { subscriptions.push('removed'); },
  };
  const adapter = createLiveAdapter(fake as unknown as SupabaseClient, { changed: () => changes++, emit: (event) => events.push(event), redirectTo: () => 'https://example.test/live/' });
  return { adapter, tables, calls, handlers, events, subscriptions, changes: () => changes, setError: (value: string | null) => error = value ? { message: value } : null, setRpc: (value: unknown) => rpcData = value, signedOut: () => session = null };
}

test('reads map RLS-scoped rows, decimals, children and unknown inventory', async () => {
  const f = fixture();
  const session = await f.adapter.store.session.get();
  assert.equal(session?.status, 'pending');
  assert.equal(session?.addresses.length, 1);
  assert.deepEqual((await f.adapter.store.orders.listForBuyer('buyer-id'))[0].lines, [{ productId: 'compound', quantity: 2, unitPrice: 50, lot: 'LOT' }]);
  assert.equal((await f.adapter.store.orders.get('TM-10500'))?.total, 114);
  assert.equal((await f.adapter.products())[0].price, 50);
  assert.equal((await f.adapter.store.catalog.shippingMethods())[0].price, 24);
  assert.equal(map.lot({ lot: 'LOT', product_id: 'compound', status: 'testing', units: null }).units, null);
  assert.equal(map.lot({ lot: 'LOT', product_id: 'compound', status: 'testing', received_at: null }).receivedAt, null);
  assert.equal(f.calls.some((c) => c.type === 'filter' && c.name === 'orders' && JSON.stringify(c.args) === '["buyer_id","buyer-id"]'), true);
});

test('pagination does not silently truncate owner history at 1000 rows', async () => {
  const f = fixture();
  f.tables.visits = Array.from({ length: 1001 }, (_, i) => ({ partner_id: 'partner-id', date: String(i), clicks: 1 }));
  assert.equal((await f.adapter.store.partners.visits('partner-id')).length, 1001);
});

test('storefront settings map numeric values and off without defaults or client writes', async () => {
  const f = fixture();
  await assert.rejects(f.adapter.store.settings.get(), /settings are unavailable/);
  f.tables.settings = [{ id: true, free_shipping_threshold: '150.00', free_shipping_method: 'cold-2day', insurance_mode: 'off', insurance_rate: null }];
  assert.deepEqual(await f.adapter.store.settings.get(), { freeShippingThreshold: 150, freeShippingMethod: 'cold-2day', insuranceMode: 'off', insuranceRate: null, taxMode: 'off', taxShipping: false, shippingRatesConfirmed: false });
  f.tables.settings[0].free_shipping_threshold = null;
  f.tables.settings[0].insurance_mode = 'optional';
  f.tables.settings[0].insurance_rate = '0.01250';
  f.tables.settings[0].shipping_rates_confirmed = true;
  f.tables.settings[0].tax_mode = 'rates';
  f.tables.settings[0].tax_shipping = true;
  assert.deepEqual(await f.adapter.store.settings.get(), { freeShippingThreshold: null, freeShippingMethod: 'cold-2day', insuranceMode: 'optional', insuranceRate: 0.0125, taxMode: 'rates', taxShipping: true, shippingRatesConfirmed: true });
  assert.equal(f.calls.some((c) => ['insert', 'update', 'rpc', 'auth'].includes(c.type)), false);
  f.setError('settings read failed');
  await assert.rejects(f.adapter.store.settings.get(), /settings read failed/);
});

test('commerce maps categories, descriptions, tracked zero stock and recorded insurance', async () => {
  const f = fixture();
  f.tables.categories = [
    { id: 'supplies', name: 'Supplies', short: 'Supplies', label_color: '#486377', position: 9, on_home: false, members_note: 'Fixture' },
    { id: 'peptides', name: 'Peptides', short: 'Peptides', label_color: '#058F93', position: 2, on_home: true, members_note: 'Fixture member' },
  ];
  assert.deepEqual((await f.adapter.store.catalog.categories()).map((category) => [category.position, category.onHome, category.members]), [[2, true, 'Fixture member'], [9, false, 'Fixture']]);
  f.tables.products[0].stock = 0; f.tables.products[0].description = 'Client description';
  const product = (await f.adapter.store.catalog.products())[0];
  assert.equal(product.stock, 0); assert.equal(product.description, 'Client description');
  f.tables.products[0].active = false;
  assert.equal((await f.adapter.store.catalog.products()).length, 0);
  assert.equal((await f.adapter.store.catalog.products(true)).length, 1);
  assert.equal(map.product({ ...f.tables.products[0], stock: null }).stock, null);
  assert.equal(map.order({ ...order, insurance: '1.88', insurance_applied: true }).insurance, 1.88);
  assert.equal(map.order({ ...order, insurance: '0.00', insurance_applied: true }).insuranceApplied, true);
});

test('product and class edits go through RPCs, with stale-stock checks and server authorization errors', async () => {
  const f = fixture();
  const product = map.product({ ...f.tables.products[0], stock: 3 });
  const category = { id: 'fixture', name: 'Fixture', short: 'Fixture', labelColor: '#123456', position: 1, onHome: true, members: 'Fixture member' };
  f.setRpc({ ...f.tables.products[0], stock: 2 });
  assert.equal((await f.adapter.store.catalog.saveProduct({ ...product, stock: 2 }, 3)).stock, 2);
  const payload = f.calls.find((call) => call.name === 'upsert_product')?.args as { draft: Record<string, unknown> };
  assert.equal(payload.draft.expectedStock, 3); assert.equal(payload.draft.stock, 2); assert.equal(payload.draft.active, true);
  f.setRpc({ id: category.id, name: category.name, short: category.short, label_color: category.labelColor, position: category.position, on_home: true, members_note: category.members });
  assert.equal((await f.adapter.store.catalog.saveCategory(category)).members, 'Fixture member');
  const changes = f.changes();
  for (const message of ['team access required', 'Stock changed. Close and reopen the product to load current values.']) {
    f.setError(message);
    await assert.rejects(f.adapter.store.catalog.saveProduct(product, 3), { message });
  }
  f.setError('team access required');
  await assert.rejects(f.adapter.store.catalog.saveCategory(category), /team access required/);
  assert.equal(f.changes(), changes);
  assert.equal(f.calls.some((call) => ['insert', 'update'].includes(call.type)), false);
});

test('settings panels send independent patches and preserve owner-only rejection', async () => {
  const f = fixture();
  f.setRpc({ free_shipping_threshold: null, free_shipping_method: 'cold-2day', insurance_mode: 'optional', insurance_rate: '0.01250' });
  assert.equal((await f.adapter.store.settings.save({ freeShippingThreshold: null })).insuranceRate, .0125);
  assert.deepEqual(f.calls.find((call) => call.name === 'update_storefront_settings')?.args, { draft: { freeShippingThreshold: null } });
  f.setError('owner access required');
  await assert.rejects(f.adapter.store.settings.save({ insuranceMode: 'automatic', insuranceRate: .01 }), /owner access required/);
  assert.equal(f.changes(), 1);
  assert.equal(f.calls.some((call) => ['insert', 'update'].includes(call.type)), false);
});

test('catalog uploads preserve bytes, enforce type/5 MB limit and use only the catalog bucket', async () => {
  const f = fixture();
  const file = new File(['fixture original bytes'], 'original.png', { type: 'image/png' });
  const url = await f.adapter.store.catalog.uploadPhoto('compound', file);
  assert.match(url, /^https:\/\/fixture.example\/storage\/v1\/object\/public\/catalog\/compound-\d+\.png$/);
  const call = f.calls.find((call) => call.type === 'upload')!;
  const payload = call.args as { file: File; options: unknown };
  assert.equal(call.name, 'catalog'); assert.equal(payload.file, file);
  assert.deepEqual(payload.options, { contentType: 'image/png', upsert: false });
  await assert.rejects(f.adapter.store.catalog.uploadPhoto('compound', new File(['x'], 'bad.svg', { type: 'image/svg+xml' })), /JPG, PNG or WebP/);
  await assert.rejects(f.adapter.store.catalog.uploadPhoto('compound', new File([new Uint8Array(5242881)], 'large.png', { type: 'image/png' })), /up to 5 MB/);
  assert.equal(f.calls.filter((call) => call.type === 'upload').length, 1);
  f.setError('new row violates row-level security policy');
  await assert.rejects(f.adapter.store.catalog.uploadPhoto('compound', file), /row-level security/);
});

test('live quote uses current public stock, insurance settings and discounted cents; place sends only opt-in', async () => {
  const f = fixture();
  f.tables.products[0].price = '166.67'; f.tables.products[0].stock = 1;
  f.tables.settings = [{ id: true, free_shipping_threshold: '150', free_shipping_method: 'cold-2day', insurance_mode: 'optional', insurance_rate: '0.01250' }];
  f.setRpc({ percent: 10, partnerName: null });
  const draft: OrderDraft = { lines: [{ productId: 'compound', quantity: 1 }], address, shipping: 'cold-2day', insurance: true, discountCode: 'FIXTURE10' };
  for (const mode of ['off', 'optional', 'automatic']) {
    f.tables.settings[0].insurance_mode = mode;
    for (const insurance of [false, true]) {
      const quote = await f.adapter.quote({ ...draft, insurance });
      const applies = mode === 'automatic' || (mode === 'optional' && insurance);
      assert.equal(quote.insurance, applies ? 1.88 : 0); assert.equal(quote.total, applies ? 151.88 : 150);
    }
  }
  f.tables.products[0].stock = 0;
  await assert.rejects(f.adapter.quote(draft), /out of stock/);
  f.tables.products[0].stock = 1;
  await assert.rejects(f.adapter.quote({ ...draft, lines: [{ productId: 'compound', quantity: 2 }] }), /Only 1 left/);
  f.setRpc(order);
  await f.adapter.store.orders.place('buyer-id', { ...draft, insuranceAmount: 999 } as OrderDraft);
  const sent = (f.calls.find((call) => call.name === 'place_order')!.args as { draft: Record<string, unknown> }).draft;
  assert.equal(sent.insurance, true); assert.equal(sent.insuranceAmount, undefined);
  f.setError('Only 0 left of Compound');
  await assert.rejects(f.adapter.store.orders.place('buyer-id', draft), /Only 0 left/);
});

test('profile-only and unauthenticated sessions do not fabricate a buyer', async () => {
  const f = fixture(); f.tables.buyers = [];
  assert.equal(await f.adapter.store.session.get(), null);
  f.signedOut(); assert.equal(await f.adapter.auth.profile(), null);
});

test('paused partner keeps their history and own discount percentage', async () => {
  const f = fixture(); f.tables.profiles[0].role = 'partner';
  const me = await f.adapter.store.partners.me();
  assert.equal(me?.status, 'paused'); assert.equal(me?.codeDiscount, 0.1);
  assert.equal((await f.adapter.store.partners.referrals(me!.id))[0].commission, 10.8);
  assert.equal(f.calls.some((call) => call.type === 'read' && call.name === 'buyers'), false);
  f.tables.profiles[0].role = 'buyer'; assert.equal(await f.adapter.store.partners.me(), null);
});

test('checkout uses only RPC and accepts server totals, rejecting price injection', async () => {
  const f = fixture(); f.setRpc(order);
  const result = await f.adapter.store.orders.place('forged-buyer-id', { lines: [{ productId: 'compound', quantity: 2, unitPrice: 1 }], address, shipping: 'cold-2day', discountCode: 'FIXTURE10', via: 'link', total: 1 } as OrderDraft);
  assert.equal(result.total, 114); assert.equal(result.payment, 'authorized');
  assert.deepEqual(f.calls.find((call) => call.name === 'place_order')?.args, { draft: { lines: [{ productId: 'compound', quantity: 2 }], address, shipping: 'cold-2day', insurance: false, rewardPoints: 0, discountCode: 'FIXTURE10', via: 'link' } });
  assert.equal(f.calls.some((call) => ['insert', 'update'].includes(call.type)), false);
});

test('server failures propagate without fake orders or notices', async () => {
  const f = fixture(); f.setError('buyer account awaits verification');
  await assert.rejects(f.adapter.store.orders.place('buyer-id', { lines: [], address, shipping: 'cold-2day' }), /awaits verification/);
  assert.equal(f.changes(), 0); assert.deepEqual(f.adapter.notices.list('owner'), []);
});

test('lot RPC handles testing, released and missing lots without early evidence', async () => {
  const f = fixture(); f.setRpc({ lot: 'LOT', productId: 'compound', status: 'testing', reference: 'private', results: [{ value: 'secret' }] });
  const pending = await f.adapter.store.lots.get(' l o t ');
  assert.deepEqual(pending?.results, []); assert.equal(pending?.reference, undefined);
  f.setRpc({ lot: 'LOT', productId: 'compound', status: 'released', reference: 'public', results: [{ value: '99%' }] });
  assert.deepEqual((await f.adapter.store.lots.get('LOT'))?.results, [{ value: '99%' }]);
  f.setRpc(null); assert.equal(await f.adapter.store.lots.get('unknown'), null);
  assert.equal(f.calls.some((call) => call.type === 'read' && call.name === 'lots'), false);
});

test('resolve_code is public and does not read private discounts or invent identities', async () => {
  const f = fixture(); f.setRpc({ percent: 10, partnerName: 'Fixture Partner' });
  const code = await f.adapter.store.catalog.validateCode(' fixture10 ');
  assert.equal(code?.code, 'FIXTURE10'); assert.equal(code?.percent, 10); assert.equal(code?.partnerId, undefined);
  f.setRpc(null); assert.equal(await f.adapter.store.catalog.validateCode('paused'), null);
  assert.equal(f.calls.some((call) => call.type === 'read'), false);
});

test('signup sends exactly the application fields and a hash-free redirect', async () => {
  const f = fixture(); f.signedOut();
  const form = { name: 'Fixture', email: 'fixture@example.test', role: 'Researcher', institution: 'Fixture lab', institutionType: 'Lab', country: 'US', researchArea: 'Assays', intendedUse: 'Laboratory assay development', attestations: ['research-only'], documents: ['reference.pdf'] };
  assert.equal((await f.adapter.auth.signUp(form, 'fixture-password')).confirmationRequired, true);
  assert.deepEqual(f.calls[0], { type: 'auth', name: 'signUp', args: { email: form.email, password: 'fixture-password', options: { data: { application: form }, emailRedirectTo: 'https://example.test/live/' } } });
  assert.equal(f.calls.some((c) => c.type === 'insert'), false);
});

test('password auth reports errors and signout clears cached alerts', async () => {
  const f = fixture(); f.setError('Invalid login credentials');
  await assert.rejects(f.adapter.auth.signIn('fixture@example.test', 'wrong'), /Invalid login/);
  f.setError(null); assert.equal((await f.adapter.auth.signIn('fixture@example.test', 'fixture-password'))?.role, 'buyer');
  f.tables.notifications = [{ id: 'n', audience: 'owner', kind: 'order.placed', at: order.created_at, read: false }];
  await f.adapter.notices.load('owner'); await f.adapter.auth.signOut();
  assert.deepEqual(f.adapter.notices.list('owner'), []);
});

test('owner actions use RPCs, UTC fourteen-day cutoff and database payout amounts', async () => {
  const f = fixture(); f.setRpc(order);
  await f.adapter.store.orders.advance(order.id, 'shipped', { carrier: 'UPS', tracking: 'fixture' });
  assert.deepEqual(f.calls.find((c) => c.name === 'advance_order')?.args, { order_id: order.id, status: 'shipped', carrier: 'UPS', tracking: 'fixture', note: null });
  f.setRpc(2); assert.equal(await f.adapter.owner.approveCommissions(new Date('2026-10-01T01:00:00+02:00')), 2);
  assert.equal(approvalCutoff(new Date('2026-10-01T01:00:00+02:00')), '2026-09-16');
  f.setRpc({ id: 'pay', partner_id: 'partner-id', period_start: '2026-09-01', period_end: '2026-09-30', amount: '10.80', referrals: 1, status: 'paid', paid_at: '2026-10-01T18:30:00Z', method: 'ACH' });
  const payout = await f.adapter.owner.recordPayout('partner-id', '2026-09-01', '2026-09-30', 'ACH');
  assert.equal(payout.amount, 10.8); assert.equal(payout.paidAt, '2026-10-01');
  assert.deepEqual(f.calls.find((c) => c.name === 'record_payout')?.args, { partner_id: 'partner-id', period_start: '2026-09-01', period_end: '2026-09-30', method: 'ACH', note: null });
});

test('application review RPC maps the server result', async () => {
  const f = fixture(); f.setRpc({ id: 'app', status: 'approved', name: 'Fixture', email: 'fixture@example.test', role: 'Researcher', institution: 'Lab', institution_type: 'Lab', research_area: 'Assays', intended_use: 'Assays', attestations: [], documents: ['ref.pdf'], submitted_at: order.created_at, reviewed_at: order.created_at });
  assert.equal((await f.adapter.store.applications.review('app', 'approved', 'Reviewed')).status, 'approved');
  assert.deepEqual(f.calls.find((c) => c.name === 'review_application')?.args, { id: 'app', status: 'approved', note: 'Reviewed' });
});

test('team partner status saves by RPC and refreshes the server discount mapping', async () => {
  const f = fixture(); f.setRpc({ ...partner, status: 'active' });
  f.tables.discounts[0].active = true;
  const saved = await f.adapter.team.setPartnerStatus(partner.id, 'active');
  assert.equal(saved.status, 'active'); assert.equal(saved.codeDiscount, 0.1);
  assert.deepEqual(f.calls.find((call) => call.name === 'set_partner_status')?.args, { partner_id: partner.id, status: 'active' });
  assert.equal(f.changes(), 1);
  assert.equal(f.calls.some((call) => ['insert', 'update'].includes(call.type)), false);
  assert.equal(partner.status, 'paused', 'No optimistic mutation of the existing row');
});

test('promo creation uses normalized code, percent units, nullable expiry and a stable retry request', async () => {
  const f = fixture();
  const row = { code: 'PROMO_21', kind: 'promo', percent: '12.34', active: true, uses: 0, expires_at: '2026-10-31T23:59:59.999Z' };
  const draft = { code: ' promo_21 ', percent: 12.34, active: true, requestId: 'fixture-request' };
  f.setRpc(row);
  let saved = await f.adapter.team.createPromo(draft);
  assert.equal(saved.code, 'PROMO_21'); assert.equal(saved.percent, 12.34); assert.equal(saved.expiresAt, row.expires_at);
  await f.adapter.team.createPromo(draft);
  const calls = f.calls.filter((call) => call.name === 'create_promo_code');
  assert.deepEqual(calls[0].args, { code: 'PROMO_21', percent: 12.34, active: true, request_id: 'fixture-request', expires_at: null });
  assert.deepEqual(calls[1].args, calls[0].args);
  saved = await f.adapter.team.createPromo({ ...draft, expiresAt: row.expires_at });
  assert.equal((f.calls.at(-1)!.args as { expires_at: string }).expires_at, row.expires_at);
  assert.equal(f.changes(), 3);
  assert.equal(f.calls.some((call) => ['insert', 'update'].includes(call.type)), false);
});

test('promo activation and deactivation return persisted rows and refresh readers', async () => {
  const f = fixture();
  for (const active of [false, true]) {
    f.setRpc({ code: 'PROMO_21', kind: 'promo', percent: '12.34', active, uses: '2' });
    const saved = await f.adapter.team.setPromoActive(' promo_21 ', active);
    assert.equal(saved.active, active); assert.equal(saved.uses, 2);
    assert.deepEqual(f.calls.at(-1)?.args, { code: 'PROMO_21', active });
    assert.equal(f.calls.at(-1)?.name, 'set_promo_active');
  }
  assert.equal(f.changes(), 2);
});

test('lot status uses the guarded team RPC, maps saved status and keeps non-public evidence hidden', async () => {
  const f = fixture();
  for (const status of ['testing', 'archived'] as const) {
    f.setRpc({ lot: 'LOT', product_id: 'compound', status, units: null, results: [{ label: 'Purity', method: 'HPLC', value: '99.31', unit: '%' }] });
    const saved = await f.adapter.store.lots.setStatus('LOT', status);
    assert.equal(saved.status, status); assert.equal(saved.units, null); assert.deepEqual(saved.results, []);
    assert.deepEqual(f.calls.at(-1)?.args, { lot: 'LOT', status }); assert.equal(f.calls.at(-1)?.name, 'set_lot_status');
  }
  assert.equal(f.changes(), 2);
});

test('every new live-save call preserves server errors and emits no fake change on failure', async () => {
  const f = fixture();
  const attempts = [
    () => f.adapter.team.setPartnerStatus(partner.id, 'paused'),
    () => f.adapter.team.createPromo({ code: 'X', percent: 10, active: true, requestId: 'fixture' }),
    () => f.adapter.team.setPromoActive('X', false),
    () => f.adapter.store.lots.setStatus('LOT', 'released'),
  ];
  for (const message of ['Team access required.', 'That code is already in use. Choose another code.', 'Invalid transition.', 'Failed to fetch']) {
    f.setError(message);
    for (const attempt of attempts) await assert.rejects(attempt, (error: Error) => error.message === message);
  }
  assert.equal(f.changes(), 0); assert.deepEqual(f.events, []);
  assert.equal(f.calls.some((call) => ['insert', 'update'].includes(call.type)), false);
});

test('mark-read uses the scoped RPC and accepts existing and Round 12 notice kinds only', async () => {
  const kinds = ['order.placed', 'order.packed', 'order.shipped', 'order.delivered', 'referral.created', 'commission.approved', 'payout.sent', 'partner.welcome', 'payment.failed', 'order.cancelled', 'order.refunded', 'application.approved', 'application.declined', 'application.submitted', 'partner_application.submitted', 'contact.received', 'system.alert', 'partner.milestone'];
  const f = fixture();
  f.tables.notifications = [...kinds, 'order.paid', 'unknown.kind'].map((kind, i) => ({ id: `n${i}`, audience: 'buyer:buyer-id', kind, at: order.created_at, read: false }));
  f.tables.notifications.push({ id: 'other-audience', audience: 'owner', kind: 'order.placed', at: order.created_at, read: false });
  f.tables.notifications.push({ id: 'already-read', audience: 'buyer:buyer-id', kind: 'order.placed', at: order.created_at, read: true });
  const loaded = await f.adapter.notices.load('buyer:buyer-id');
  assert.deepEqual(loaded.filter(n => !n.read).map(n => n.kind).sort(), [...kinds].sort());
  f.setRpc(kinds.length); assert.equal(await f.adapter.notices.markRead('buyer:buyer-id'), kinds.length);
  assert.deepEqual(f.calls.find((c) => c.name === 'mark_notifications_read')?.args, { ids: kinds.map((_, i) => `n${i}`) });
  assert.equal(f.calls.some(c => ['insert', 'update'].includes(c.type)), false);
});

test('four realtime tables feed refresh and existing events, dedupe inserts and unsubscribe on identity changes', async () => {
  const f = fixture(); f.adapter.startRealtime('user-id');
  assert.deepEqual([...f.handlers.keys()], ['orders', 'order_events', 'referrals', 'notifications']);
  const oldHandler = f.handlers.get('referrals')!;
  oldHandler({ eventType: 'INSERT', new: referral }); oldHandler({ eventType: 'INSERT', new: referral });
  assert.equal(f.events.length, 1);
  assert.deepEqual(f.events[0], { type: 'referral.created', referralId: 'ref-id', partnerId: 'partner-id', orderNumber: order.number, orderSubtotal: 90, commission: 10.8, via: 'link', at: order.created_at });
  f.handlers.get('orders')!({ eventType: 'INSERT', new: order });
  f.handlers.get('order_events')!({ eventType: 'INSERT', new: { id: 'event', order_id: order.id, status: 'shipped', at: '2026-10-01T12:00:00Z' } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((f.events[2] as { status: string }).status, 'shipped');
  f.adapter.startRealtime(null); oldHandler({ eventType: 'INSERT', new: { ...referral, id: 'stale' } });
  assert.equal(f.events.length, 3); assert(f.subscriptions.includes('removed'));
});

test('only address book writes use table mutations', async () => {
  const f = fixture(); await f.adapter.saveAddress('buyer-id', address);
  assert.deepEqual(f.calls.find((c) => c.type === 'insert'), { type: 'insert', name: 'addresses', args: { label: 'Lab', institution: 'Fixture lab', attention: 'Fixture', line1: '1 Test St', city: 'Test', region: 'TX', postal: '12345', country: 'US', buyer_id: 'buyer-id' } });
});

test('unknown inventory sorts last in both directions and never becomes zero stock', () => {
  for (const direction of ['asc', 'desc'] as const) {
    const values = [null, 4, 0, null, 20].sort((a, b) => compareNullable(a, b, direction));
    assert.deepEqual(values.slice(-2), [null, null]);
    assert.deepEqual(values.slice(0, 3), direction === 'asc' ? [0, 4, 20] : [20, 4, 0]);
    const dates = ['2026-10-01', null, '2026-09-01'].sort((a, b) => compareNullable(a, b, direction));
    assert.equal(dates.at(-1), null);
  }
  assert.equal(sumTracked([null, 4, 0, null, 20]), 24);
  assert.equal(sumTracked([null, null]), null);
  assert.equal(sumTracked([0, null]), 0);
  assert.equal(sumTracked([]), 0);
});


test('zero-percent codes preserve partner attribution while program-only benefits keep a discount record', () => {
  const zero = map.order({ ...order, discount_amount: '0.00' });
  assert.equal(zero.discount?.amount, 0);
  assert.equal(zero.discount?.code, 'FIXTURE10');
  assert.equal(zero.discount?.partnerId, 'partner-id');
  const member = map.order({ ...order, discount_code: null, discount_partner_id: null, discount_amount: '5.00', membership_name: 'Research', membership_amount: '5.00' });
  assert.equal(member.discount?.source, 'program');
  assert.equal(member.discount?.amount, 5);
  assert.equal(member.benefits?.membershipName, 'Research');
});
