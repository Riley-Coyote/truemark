import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createHandler } from '../supabase/functions/shipping/server.ts';
import type { Deps } from '../supabase/functions/shipping/server.ts';
import { createShipStation, carrierLabel, countryCode } from '../supabase/functions/shipping/provider.ts';
import type { Row, ShippingOrder } from '../supabase/functions/shipping/provider.ts';
import { DbError } from '../supabase/functions/_shared/db.ts';
import type { Db } from '../supabase/functions/_shared/db.ts';
import { hmacHex } from '../supabase/functions/_shared/signing.ts';
import { createPlatformDb } from './lib/platform-db.mjs';
import { createShipping, shipment } from '../src/platform/live/shipping.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

globalThis.fetch = async () => { throw new Error('External network forbidden in shipping tests'); };
const id = '11111111-2222-4333-8444-555555555555';
const userId = '22222222-2222-4333-8444-555555555555';
const fixtureOrder: ShippingOrder = { id, number: 'TM-10501', buyer_id: userId, created_at: '2026-10-05T12:00:00Z',
  address: { institution: 'Fixture lab', attention: 'Fixture researcher', line1: '1 Fixture St', line2: 'Lab 2', city: 'Test', region: 'TX', postal: '12345', country: 'United States of America', phone: '+15555550123' },
  shipping_method_id: 'cold-2day', shipping_price: 24, total: 124, methodLabel: 'Cold two day', customerEmail: 'buyer@fixture.test',
  order_lines: [{ product_id: 'bpc-157', products: { name: 'BPC-157', size: '5 mg' }, quantity: 2, unit_price: 50, lot: 'LOT-FIXTURE' }] };
const makeDeps = (overrides: Partial<Deps> = {}): Deps => ({ db: {
  select: async () => [], one: async () => null, rpc: async () => null as never,
}, url: 'https://supabase.fixture', serviceKey: 'service-fixture-only', functionsKey: 'functions_fixture_only_01234567890',
  webhookKey: 'webhook_fixture_only_0123456789012', simSecret: 'sim-fixture-only', shipstationKey: 'shipstation-key-fixture-only',
  shipstationSecret: 'shipstation-secret-fixture-only', fetch: globalThis.fetch, now: () => new Date('2026-10-05T12:00:00Z'),
  random: (size) => new Uint8Array(size).fill(42), ...overrides });
const request = (path: string, payload?: unknown, headers: Record<string,string> = {}) => new Request(`https://supabase.fixture/functions/v1/shipping${path}`, {
  method: payload === undefined ? 'GET' : 'POST', headers, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
});
function fakeDb(mode = 'simulated', role = 'owner') {
  const calls: { name: string; args?: Record<string, unknown> }[] = [];
  let claimed: Row[] = [];
  let status = 'pushed';
  let failRpc = '';
  const db: Db = {
    async select<T>() { return [] as T[]; },
    async one<T>(path: string) {
      if (path.startsWith('connections')) return { id: 'shipping', mode, provider: 'shipstation' } as T;
      if (path.startsWith('profiles')) return { role } as T;
      if (path.startsWith('shipments')) return { id: 'shipment-id', order_id: id, status, provider: 'simulator' } as T;
      if (path.startsWith('orders')) return fixtureOrder as T;
      if (path.startsWith('buyers')) return { email: fixtureOrder.customerEmail } as T;
      if (path.startsWith('shipping_methods')) return { label: fixtureOrder.methodLabel } as T;
      return null;
    },
    async rpc<T>(name: string, args?: Record<string,unknown>) {
      calls.push({ name, args });
      if (name === failRpc) throw new DbError('fixture private detail',500);
      if (name === 'system_claim_shipments') return claimed as T;
      return null as T;
    },
  };
  return { db, calls, claim: (value: Row[]) => { claimed = value; }, status: (value: string) => { status = value; }, fail: (value: string) => { failRpc = value; } };
}

test('ShipStation v1 request shapes, Basic auth, countries, tax and cancel with injected fetch', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fake = (async (input, init) => { calls.push({ url: String(input), init: init! }); return Response.json({ orderId: 123 }); }) as typeof fetch;
  const provider = createShipStation('fixture-key','fixture-secret',fake);
  assert.deepEqual(await provider.createOrder(fixtureOrder), { providerOrderId: '123' });
  await provider.cancelOrder({ ...fixtureOrder, tax: 8.25 });
  assert.equal(calls[0].url,'https://ssapi.shipstation.com/orders/createorder');
  assert.equal((calls[0].init.headers as Row).Authorization,`Basic ${btoa('fixture-key:fixture-secret')}`);
  const shape = JSON.parse(String(calls[0].init.body));
  assert.deepEqual(shape, { orderNumber: fixtureOrder.number, orderKey: id, orderDate: fixtureOrder.created_at, orderStatus: 'awaiting_shipment',
    customerEmail: fixtureOrder.customerEmail, billTo: { name: 'Fixture researcher', company: 'Fixture lab', street1: '1 Fixture St', street2: 'Lab 2', city: 'Test', state: 'TX', postalCode: '12345', country: 'US', phone: '+15555550123' },
    shipTo: { name: 'Fixture researcher', company: 'Fixture lab', street1: '1 Fixture St', street2: 'Lab 2', city: 'Test', state: 'TX', postalCode: '12345', country: 'US', phone: '+15555550123' },
    items: [{ sku: 'bpc-157', name: 'BPC-157 5 mg', quantity: 2, unitPrice: 50 }], amountPaid: 124, shippingAmount: 24, taxAmount: 0,
    requestedShippingService: 'Cold two day', internalNotes: 'Cold chain. Lots: LOT-FIXTURE' });
  assert.equal(JSON.parse(String(calls[1].init.body)).orderStatus,'cancelled');
  assert.equal(JSON.parse(String(calls[1].init.body)).taxAmount,8.25);
  for (const value of ['US','usa','United States','United States of America']) assert.equal(countryCode(value),'US');
  assert.equal(countryCode('ca'),'CA'); assert.throws(() => countryCode('Canada'),/Country must be a two-letter code/);
  assert.equal(carrierLabel('ups_walleted'),'UPS'); assert.equal(carrierLabel('fedex_ground'),'FedEx'); assert.equal(carrierLabel('usps'),'USPS');
  await assert.rejects(provider.fetchShipments('https://untrusted.fixture/shipments'),/Invalid ShipStation resource/);
  assert.equal(calls.length,2);
});

test('flush uses each row provider, simulator push/cancel and unsupported adapter failure; records connection outcomes', async () => {
  const f = fakeDb(); f.claim([{ id:'a',order_id:id,provider:'simulator' }, { id:'b',order_id:id,provider:'simulator',cancel_requested:true }, { id:'c',order_id:id,provider:'unknown' }]);
  const deps = makeDeps({ db:f.db }); const handler = createHandler(deps);
  assert.equal((await handler(request('/flush',{}))).status,401);
  const response = await handler(request('/flush',{}, { 'x-functions-key':deps.functionsKey })); assert.equal(response.status,200);
  assert.deepEqual((await response.json()).outcomes.map((r: Row) => r.status),['pushed','cancelled','failed']);
  assert.match(String(f.calls.find((c) => c.name==='system_shipment_pushed')?.args?.provider_order_id),/^sim_or_[0-9a-f]{24}$/);
  assert.equal(f.calls.find((c) => c.name==='system_shipment_failed')?.args?.error,'No adapter for unknown');
  assert.equal(f.calls.filter((c) => c.name==='system_connection_status').length,3);
});

test('flush sends ShipStation push and cancellation, handles provider failure, and refuses database write failure', async () => {
  const f = fakeDb('live'); f.claim([{ id:'a',order_id:id,provider:'shipstation' }, { id:'b',order_id:id,provider:'shipstation',cancel_requested:true }]);
  const sent: Row[] = [];
  const deps = makeDeps({ db:f.db, fetch: (async (_input,init) => { sent.push(JSON.parse(String(init?.body))); return Response.json({orderId:321}); }) as typeof fetch });
  assert.equal((await createHandler(deps)(request('/flush',{}, { 'x-functions-key':deps.functionsKey }))).status,200);
  assert.deepEqual(sent.map((v) => v.orderStatus),['awaiting_shipment','cancelled']);
  assert.equal(f.calls.find((c) => c.name==='system_shipment_pushed')?.args?.provider_order_id,'321');
  f.claim([{id:'c',order_id:id,provider:'shipstation'}]);
  const failure = makeDeps({ db:f.db, fetch: (async () => new Response('fixture sensitive payload', {status:500})) as typeof fetch });
  await createHandler(failure)(request('/flush',{}, { 'x-functions-key':failure.functionsKey }));
  assert.equal(f.calls.find((c) => c.name==='system_shipment_failed')?.args?.error,'ShipStation request failed');
  f.fail('system_shipment_pushed');
  const response = await createHandler(deps)(request('/flush',{}, { 'x-functions-key':deps.functionsKey }));
  assert.equal(response.status,500); assert.ok(!(await response.text()).includes('private'));
});

test('webhook key is required, only SHIP_NOTIFY is handled, voided and foreign orders are ignored', async () => {
  const f = fakeDb('live'); const reads: string[] = [];
  const db: Db = { ...f.db, async one<T>(path: string) { if (path.startsWith('orders') && !path.includes(id)) return null; return f.db.one<T>(path); } };
  const deps = makeDeps({ db, fetch:(async (input) => { reads.push(String(input)); return Response.json({shipments:[
    {shipmentId:'fixture-1',orderKey:id,carrierCode:'fedex_ground',serviceCode:'cold',trackingNumber:'123456789012',shipDate:'2026-10-05T12:00:00Z',voided:false},
    {shipmentId:'void',orderKey:id,voided:true}, {shipmentId:'foreign',orderKey:userId,voided:false}, {shipmentId:'malformed',orderKey:'foreign',voided:false},
  ]}); }) as typeof fetch });
  const handler = createHandler(deps), payload = {resource_type:'SHIP_NOTIFY',resource_url:'https://ssapi.shipstation.com/shipments?fixture=1'};
  for (const suffix of ['', '?key=wrong']) assert.equal((await handler(request('/webhook'+suffix,payload))).status,404);
  assert.equal(reads.length,0);
  assert.equal((await handler(request(`/webhook?key=${deps.webhookKey}`,{resource_type:'OTHER'}))).status,200);
  assert.equal(reads.length,0);
  assert.equal((await handler(request(`/webhook?key=${deps.webhookKey}`,payload))).status,200);
  const marks = f.calls.filter((c) => c.name==='system_mark_shipped'); assert.equal(marks.length,1);
  assert.equal(marks[0].args?.carrier,'FedEx'); assert.equal(marks[0].args?.event_id,'fixture-1');
  f.fail('system_mark_shipped');
  assert.equal((await handler(request(`/webhook?key=${deps.webhookKey}`,payload))).status,500);
});

test('simulated resource signature rejects tampering; off and live refuse resources', async () => {
  const f = fakeDb(), deps = makeDeps({db:f.db});
  const handler = createHandler(deps), batch = 'fixture-batch', sig = await hmacHex(deps.simSecret,batch);
  for (const suffix of ['', '?batch=fixture-batch&sig=wrong', `?batch=other&sig=${sig}`]) assert.equal((await handler(request('/sim/resource'+suffix))).status,404);
  assert.equal((await handler(request(`/sim/resource?batch=${batch}&sig=${sig}`))).status,200);
  for (const mode of ['off','live']) assert.equal((await createHandler(makeDeps({db:fakeDb(mode).db}))(request(`/sim/resource?batch=${batch}&sig=${sig}`))).status,404);
});

test('simulate requires owner/staff from the profile; off/live and invalid states are refused', async () => {
  for (const role of ['buyer','partner','owner','staff']) {
    const f = fakeDb('simulated',role); f.status('queued');
    const deps = makeDeps({ db:f.db, fetch:(async () => Response.json({id:userId,user_metadata:{role:'owner'}})) as typeof fetch });
    const response = await createHandler(deps)(request('/simulate',{orderId:id,action:'label'},{authorization:'Bearer fixture-team-token'}));
    assert.equal(response.status,['owner','staff'].includes(role)?400:403);
    assert.ok(!f.calls.some((c) => c.name==='system_create_simulated_label'));
  }
  for (const mode of ['off','live']) {
    const f = fakeDb(mode), deps = makeDeps({db:f.db,fetch:(async () => Response.json({id:userId})) as typeof fetch});
    assert.equal((await createHandler(deps)(request('/simulate',{orderId:id,action:'label'},{authorization:'Bearer fixture-team-token'}))).status,400);
    assert.equal((await createHandler(deps)(request('/simulate',{orderId:id,action:'label'}))).status,403);
  }
});

test('off flush and webhook leave manual shipping untouched; OPTIONS is available on every route', async () => {
  const f = fakeDb('off'), deps = makeDeps({db:f.db}), handler=createHandler(deps);
  assert.deepEqual(await (await handler(request('/flush',{}, {'x-functions-key':deps.functionsKey}))).json(),{mode:'off',outcomes:[]});
  assert.equal((await handler(request(`/webhook?key=${deps.webhookKey}`,{resource_type:'SHIP_NOTIFY',resource_url:'https://never.fixture'}))).status,200);
  assert.equal(f.calls.length,0);
  for (const path of ['/flush','/webhook','/simulate','/sim/resource']) assert.equal((await handler(new Request(`https://fixture/shipping${path}`,{method:'OPTIONS'}))).status,204);
});

test('label -> signed resource -> SHIP_NOTIFY -> shipped and delivered use real local SQL over injected HTTP', async () => {
  const h = await createPlatformDb();
  try {
    const owner=await h.person('server-owner@shipping.fixture','owner');
    const buyerUser=await h.person('server-buyer@shipping.fixture');
    const buyer=await h.scalar("insert into buyers(user_id,name,email,institution,status) values ($1,'Fixture','server-buyer@shipping.fixture','Fixture lab','verified') returning id",[buyerUser]);
    const orderId=await h.scalar("insert into orders(buyer_id,address,shipping_method_id,shipping_price,subtotal,total) values ($1,$2,'cold-2day',24,100,124) returning id",[buyer,fixtureOrder.address]);
    const product=await h.rows('select id,lot from products limit 1');
    await h.db.query('insert into order_lines(order_id,product_id,quantity,unit_price,lot) values ($1,$2,2,50,$3)',[orderId,product[0].id,product[0].lot]);
    await h.db.query("update orders set status='paid' where id=$1",[orderId]);
    const normalize = (row: unknown) => JSON.parse(JSON.stringify(row));
    const db: Db = {
      async select<T>(path:string) {
        const [table,query]=path.split('?'); assert.ok(['connections','orders','buyers','shipping_methods','profiles','shipments','simulated_labels'].includes(table));
        const fields: string[]=[], params: string[]=[];
        for (const [key,value] of new URLSearchParams(query)) if (!['select','limit'].includes(key)) { assert.match(key,/^[a-z_]+$/); assert.ok(value.startsWith('eq.')); params.push(value.slice(3)); fields.push(`${key}=$${params.length}`); }
        const found=await h.rows(`select * from ${table}${fields.length?' where '+fields.join(' and '):''}`,params);
        if (table==='orders' && query.includes('order_lines')) for (const row of found) row.order_lines = await h.rows('select l.*,to_jsonb(p) as products from order_lines l join products p on p.id=l.product_id where order_id=$1',[row.id]);
        return normalize(found) as T[];
      },
      async one<T>(path:string) { return (await this.select<T>(path))[0] ?? null; },
      async rpc<T>(name:string,args:Record<string,unknown>={}) {
        assert.match(name,/^system_[a-z_]+$/);
        const values=Object.values(args), named=Object.keys(args).map((key,i)=>{assert.match(key,/^[a-z_]+$/);return `${key} => $${i+1}`;}).join(',');
        try {
          if (name==='system_claim_shipments') return normalize(await h.service(`select * from ${name}(${named})`,values)) as T;
          const found=await h.service(`select ${name}(${named}) as value`,values); return normalize(found[0].value) as T;
        } catch (error) { throw new DbError((error as Error).message,500,(error as {code:string}).code); }
      },
    };
    let handler: ReturnType<typeof createHandler>;
    const http: string[]=[];
    const fetcher=(async (input,init) => {
      const req=input instanceof Request ? input : new Request(String(input),init); http.push(new URL(req.url).pathname);
      if (new URL(req.url).pathname==='/auth/v1/user') return Response.json({id:owner,email:'server-owner@shipping.fixture'});
      assert.equal(new URL(req.url).hostname,'supabase.fixture');
      return handler(req);
    }) as typeof fetch;
    let counter=0;
    const deps=makeDeps({db,fetch:fetcher,random:(size)=>new Uint8Array(size).fill(++counter)}); handler=createHandler(deps);
    assert.equal((await handler(request('/flush',{}, {'x-functions-key':deps.functionsKey}))).status,200);
    assert.equal(await h.scalar('select status from shipments where order_id=$1',[orderId]),'pushed');
    const headers={authorization:'Bearer fixture-owner-token'};
    const label=await handler(request('/simulate',{orderId,action:'label'},headers));
    assert.equal(label.status,200,await label.clone().text()); assert.deepEqual(await label.json(),{status:'shipped'});
    assert.ok(http.includes('/functions/v1/shipping/webhook')); assert.ok(http.includes('/functions/v1/shipping/sim/resource'));
    const tracking=await h.scalar('select tracking from shipments where order_id=$1',[orderId]);
    assert.equal((await frontend('live')).trackingError('UPS',tracking),undefined);
    assert.match(await h.scalar('select id from simulated_labels'),/^sim_sh_[0-9a-f]{24}$/);
    assert.equal(await h.scalar("select count(*) from notifications where kind='order.shipped'"),1);
    assert.equal((await handler(request('/simulate',{orderId,action:'delivered'},headers))).status,200);
    assert.equal(await h.scalar('select status from orders where id=$1',[orderId]),'delivered');
    assert.equal(await h.scalar("select count(*) from notifications where kind='order.delivered'"),1);
    assert.equal((await handler(request('/simulate',{orderId,action:'delivered'},headers))).status,400);
  } finally { await h.db.close(); }
});

test('live shipping adapter reads inactive methods, maps shipment fields, and invokes RPCs and the function', async () => {
  const calls: unknown[]=[]; let changes=0;
  const row={id:'s',order_id:id,status:'pushed',provider:'simulator',attempts:1,cancel_requested:false,next_attempt_at:'now',updated_at:'now'};
  const fake = {functions:{invoke:async (name:string,args:unknown)=>{calls.push([name,args]);return {data:{status:'shipped'},error:null};}}} as unknown as SupabaseClient;
  const api=createShipping(fake,async(table,_select,filters)=>{calls.push([table,filters]);return table==='shipments'?[row]:[{id:'cold-2day',label:'Cold',detail:'Pack',price:24,active:false}];},async<T>(name:string,args:Record<string,unknown>)=>{calls.push([name,args]);return {id:'cold-2day',label:'Cold',detail:'Pack',price:24,active:false} as T;},()=>{changes++;});
  assert.equal((await api.get(id))?.providerOrderId,null); assert.equal(shipment(row).orderId,id);
  const methods=await api.methods(); assert.equal(methods[0].active,false);
  await api.saveMethod(methods[0]); await api.retry(id); await api.simulate(id,'label'); assert.equal(changes,3);
  assert.ok(JSON.stringify(calls).includes('upsert_shipping_method')); assert.ok(JSON.stringify(calls).includes('retry_shipment')); assert.ok(JSON.stringify(calls).includes('shipping/simulate'));
});

test('preview UI gates stay in place and function credentials remain server-only', async () => {
  const drawer=await readFile(new URL('../src/admin/OrderDrawer.tsx',import.meta.url),'utf8');
  const settings=await readFile(new URL('../src/admin/Settings.tsx',import.meta.url),'utf8');
  assert.ok(drawer.includes('{LIVE && <ShipmentSection')); assert.ok(settings.includes('{LIVE && <ShippingMethods'));
  for (const file of ['src/admin/ShipmentSection.tsx','src/admin/ShippingMethods.tsx','src/platform/shipping.ts','src/platform/live/shipping.ts']) {
    const source=await readFile(new URL('../'+file,import.meta.url),'utf8'); assert.ok(!/SHIPSTATION_API_|SHIPPING_WEBHOOK_KEY|SHIPPING_SIM_SECRET|SUPABASE_SERVICE_ROLE_KEY|FUNCTIONS_KEY/.test(source));
  }
});

// Bundle the UI just as the commerce proof does: CSS is empty, no browser or network.
const frontCache = new Map<string, Promise<any>>();
function frontend(mode: string, baseline = false) {
  const key = mode + baseline;
  if (!frontCache.has(key)) frontCache.set(key, (async () => {
    const temp = await mkdtemp('/private/tmp/wp26-render-');
    const root = new URL('../', import.meta.url).pathname;
    const values = new Map<string, string>();
    Object.assign(globalThis, {
      localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) },
      sessionStorage: { getItem: () => null },
      window: Object.assign(new EventTarget(), { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), setTimeout: () => 0, clearTimeout() {} }),
      document: { hidden: false, baseURI: 'https://fixture.test/' },
      BroadcastChannel: class extends EventTarget { postMessage() {} close() {} },
    });
    const outfile = temp + '/ui.mjs';
    await build({ stdin: { resolveDir: root, loader: 'tsx', contents: `
      import { createElement as h } from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { MemoryRouter } from 'react-router-dom';
      import Settings from './src/admin/Settings.tsx';
      import { AppearanceProvider } from './src/admin/appearance.tsx';
      import { Fulfilment, trackingError } from './src/admin/fulfilment.tsx';
      import { ShipmentSection } from './src/admin/ShipmentSection.tsx';
      export { trackingError };
      export const settings = () => renderToStaticMarkup(h(MemoryRouter, {}, h(AppearanceProvider, {}, h(Settings))));
      export const fulfilment = (order, shipment) => renderToStaticMarkup(h(Fulfilment, { order, shipment, onDone() {} }));
      export const section = (shipment) => renderToStaticMarkup(h(ShipmentSection, { shipment }));
    ` }, outfile, bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', loader: { '.css': 'empty' },
      banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
      define: { 'import.meta.env': JSON.stringify({ VITE_PLATFORM: mode, BASE_URL: '/', PROD: false }), 'process.env.NODE_ENV': '\"production\"' }, logLevel: 'silent',
      plugins: [{ name: 'local-snapshots', setup(plugin) {
        plugin.onResolve({ filter: /^react$/ }, (args) => /\/admin\/(preview\.ts|notify\.tsx)$/.test(args.importer) ? { path: 'react-preview', namespace: 'fixture' } : undefined);
        plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export * from ${JSON.stringify(root + 'node_modules/react/index.js')}; export const useSyncExternalStore = (_subscribe, snapshot) => snapshot();`, resolveDir: root }));
      } }, ...(baseline ? [{ name: 'baseline', setup(build) {
        build.onLoad({ filter: /src\/admin\/(Settings|fulfilment|OrderDrawer)\.tsx$/ }, async (args) => ({
          contents: execFileSync('git', ['show', 'HEAD:' + args.path.slice(root.length)], { cwd: root, encoding: 'utf8' }), loader: 'tsx',
        }));
      } }] : [])],
    });
    return import(pathToFileURL(outfile).href);
  })());
  return frontCache.get(key)!;
}
test('preview settings and fulfilment render identically to HEAD; live shipping renders only the specified states and controls', async () => {
  const current = await frontend('preview'), before = await frontend('preview',true), live = await frontend('live');
  assert.equal(current.settings(), before.settings());
  for (const status of ['placed','paid','packed','shipped']) {
    const order = { id, number:'TM-10501', status };
    assert.equal(current.fulfilment(order),before.fulfilment(order));
  }
  const order = { id, number:'TM-10501', status:'packed' };
  assert.ok(live.fulfilment(order, {status:'pushed'}).includes('Enter tracking by hand'));
  assert.ok(live.fulfilment(order, {status:'failed'}).includes('Mark shipped'));
  assert.ok(live.fulfilment(order, {status:'cancelled'}).includes('Mark shipped'));
  assert.equal(live.section(null),'');
  for (const [status, text] of [['queued','Sending to ShipStation.'],['pushed','In ShipStation, awaiting a label.'],['cancelled','Removed from ShipStation.'],['delivered','Delivered'],['failed',"Couldn&#x27;t reach ShipStation"]]) {
    assert.ok(live.section({status,provider:'simulator',lastError:'fixture',deliveredAt:'2026-10-05T12:00:00Z'}).includes(text));
  }
  assert.ok(live.section({status:'pushed',provider:'simulator'}).includes('Print label (simulated)'));
  assert.ok(live.section({status:'shipped',provider:'simulator',carrier:'UPS',tracking:'1ZSIM0123456789ABC',service:'Cold'}).includes('Simulate delivery scan'));
  assert.ok(!live.section({status:'pushed',provider:'shipstation'}).includes('Print label (simulated)'));
});
