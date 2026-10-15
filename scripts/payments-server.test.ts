import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHandler } from '../supabase/functions/payments/server.ts';
import type { Deps } from '../supabase/functions/payments/server.ts';
import type { Db } from '../supabase/functions/_shared/db.ts';
import type { Caller } from '../supabase/functions/_shared/identity.ts';
import { simulator } from '../supabase/functions/payments/providers.ts';
import { signedHeader } from '../supabase/functions/_shared/signing.ts';

globalThis.fetch = async () => { throw new Error('External network forbidden in payments tests'); };
const buyer = '00000000-0000-4000-8000-000000000001';
const orderId = '00000000-0000-4000-8000-000000000002';
const paymentId = '00000000-0000-4000-8000-000000000003';
const refundId = '00000000-0000-4000-8000-000000000004';
const latePaymentId = '00000000-0000-4000-8000-000000000005';
const secret = 'payments_fixture_only_0123456789abcdef';
const now = Date.UTC(2026,9,5,12);
type Row = Record<string, unknown>;
function fixture(extra: Partial<Deps> = {}) {
  const calls: { name: string; args: Record<string,unknown> }[] = [];
  const reads: string[] = [];
  const refunds: { chargeRef: string; amount: number; paymentId: string }[] = [];
  let mode = 'simulated', role: Caller['role'] = 'buyer', signedIn = true, late = false, broken = false;
  const order: Row = { id: orderId, number: 'TM-FIXTURE', buyer_id: buyer, total: 100, refunded: 20, payment: 'captured', payment_provider: 'simulator', charge_id: paymentId };
  const charge: Row = { id: paymentId, order_id: orderId, kind: 'charge', provider: 'simulator', amount: 100, status: 'pending', provider_ref: 'sim_ch_fixture' };
  const lateCharge: Row = { ...charge, id: latePaymentId, status: 'succeeded', provider_ref: 'sim_ch_late_fixture' };
  const events = new Set<string>();
  const db: Db = {
    async select<T>() { return [] as T[]; },
    async one<T>(path: string) {
      reads.push(path);
      let value: Row | null = null;
      if (path.startsWith('connections?')) value = { id: 'payments', mode, provider: mode==='live'?'fixture-provider':'' };
      if (path.startsWith(`payments?id=eq.${paymentId}&`)) value = charge;
      if (path.startsWith(`payments?id=eq.${latePaymentId}&`)) value = lateCharge;
      if (path.startsWith('orders?')) value = order;
      if (path.startsWith('buyers?')) value = { id: buyer, user_id: buyer };
      return value as T | null;
    },
    async rpc<T>(name: string,args: Record<string, unknown> = {}) {
      calls.push({name,args});
      if (broken && name === 'system_apply_payment_event') throw new Error('Fixture database failure');
      if (name === 'system_create_charge') { charge.status='pending'; return charge as T; }
      if (name === 'system_create_refund') return { id: refundId, order_id: orderId, provider: 'simulator', amount: args.amount, refund_of: order.charge_id } as T;
      if (name === 'system_create_late_refund') return { id: refundId, order_id: orderId, provider: 'simulator', amount: lateCharge.amount, refund_of: args.charge_id, late: true } as T;
      if (name === 'system_apply_payment_event') {
        if (events.has(String(args.event_id))) return { result:'duplicate' } as T;
        events.add(String(args.event_id));
        if (args.type==='charge.succeeded' && late) return {result:'applied',action:'refund_needed',payment_id:args.payment_id} as T;
        return {result:'applied'} as T;
      }
      return null as T;
    },
  };
  let handler: ReturnType<typeof createHandler>;
  const deliveries: Request[]=[];
  const deps: Deps={ db,url:'https://local.fixture',serviceKey:'service_fixture_only',functionsKey:'functions_fixture_only_0123456789abcdef',simSecret:secret,now:()=>now,randomHex:()=>String(deliveries.length+1).padStart(24,'0'),
    identify: async(req)=> signedIn && req.headers.get('authorization')==='Bearer fixture-token' ? {id:buyer,email:'buyer@fixture.test',role} : null,
    fetcher: async(input,init)=> { const req=new Request(input,init);assert.equal(req.url,'https://local.fixture/functions/v1/payments/webhook');deliveries.push(req.clone());return handler(req); },...extra };
  const simulatedProvider=simulator({secret:deps.simSecret,url:deps.url,fetcher:deps.fetcher!,now:deps.now!,randomHex:deps.randomHex!});
  deps.provider ??= { ...simulatedProvider, async refund(input) { refunds.push(input); return simulatedProvider.refund(input); } };
  handler=createHandler(deps);
  const request=(path: string,input: unknown = {}, token=true)=>handler(new Request(`https://local.fixture/functions/v1/payments${path}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer fixture-token'}:{})},body:JSON.stringify(input)}));
  const webhook=async(payload: Row, offset=0, signature?: string)=> { const raw=JSON.stringify(payload);return handler(new Request('https://local.fixture/functions/v1/payments/webhook',{method:'POST',headers:{'x-sim-signature':signature??await signedHeader(secret,raw,now+offset)},body:raw})); };
  return {handler,request,webhook,calls,reads,refunds,deliveries,charge,lateCharge,order,mode:(v:string)=>{mode=v;},role:(v:Caller['role'])=>{role=v;},signIn:(v:boolean)=>{signedIn=v;},late:()=>{late=true;},broken:()=>{broken=true;}};
}
const event={id:'sim_evt_fixture',type:'charge.succeeded',paymentId,ref:'sim_ch_fixture',amount:100};

test('every route enforces its own authorization, handles preflight and unknown routes',async()=>{
 const f=fixture();
 for (const path of ['/start','/simulate','/refund','/cancel']) assert.equal((await f.request(path,{},false)).status,401,path);
 f.role('staff');for(const path of ['/refund','/cancel']) {const r=await f.request(path,{orderId,reason:'Fixture'});assert.equal(r.status,403);assert.deepEqual(await r.json(),{message:'Only an owner can move money.'});}
 for(const path of ['/start','/simulate']) assert.equal((await f.request(path,{})).status,403);
 assert.equal((await f.request('/unknown')).status,404);
 assert.equal((await f.handler(new Request('https://local.fixture/payments/start',{method:'OPTIONS'}))).status,204);
 assert.equal((await f.handler(new Request('https://local.fixture/payments/start'))).status,404);
 assert.equal((await f.request('/webhook',{})).status,401);
});
test('off and live refuse adapter work and live records the connection failure',async()=>{
 const f=fixture();f.mode('off');let response=await f.request('/start',{orderId});assert.equal(response.status,409);assert.deepEqual(await response.json(),{message:'Payments are handled manually for this shop.'});
 f.mode('live');response=await f.request('/start',{orderId});assert.equal(response.status,409);assert.deepEqual(await response.json(),{message:'No payment adapter for fixture-provider'});assert(f.calls.some(c=>c.name==='system_connection_status'&&c.args.ok===false));assert(!f.calls.some(c=>c.name==='system_create_charge'));
});
test('start creates the buyer charge and returns only public parameters',async()=>{
 const f=fixture();const response=await f.request('/start',{orderId});assert.equal(response.status,200);assert.deepEqual(await response.json(),{paymentId,amount:100,mode:'simulated',provider:'simulator',clientParams:{paymentId}});assert.equal(f.calls.find(c=>c.name==='system_create_charge')?.args.buyer_user,buyer);
});
test('approve and decline send awaited signed webhooks to the local fake',async()=>{
 for(const outcome of ['approve','decline']) {
  const f=fixture();const response=await f.request('/simulate',{paymentId,outcome});assert.equal(response.status,200);
  assert.equal((await response.json()).status,outcome==='approve'?'succeeded':'failed');assert.equal(f.deliveries.length,1);assert.match(f.deliveries[0].headers.get('x-sim-signature')!,/^t=\d+,v1=[0-9a-f]{64}$/);
  const applied=f.calls.find(c=>c.name==='system_apply_payment_event')!;assert.equal(applied.args.type,outcome==='approve'?'charge.succeeded':'charge.failed');assert.match(String(applied.args.provider_ref),/^sim_ch_[0-9a-f]{24}$/);assert.match(String(applied.args.event_id),/^sim_evt_[0-9a-f]{24}$/);
  assert.equal(applied.args.failure_reason,outcome==='decline'?'card_declined':null);
 }
});
test('delay responds while the injected eight-second background wait is pending',async()=>{
 let release!:()=>void;let task:Promise<void>|undefined;let delay=0;
 const f=fixture({sleep:ms=>{delay=ms;return new Promise<void>(r=>{release=r;});},background:p=>{task=p;}});
 const response=await f.request('/simulate',{paymentId,outcome:'delay'});assert.deepEqual(await response.json(),{status:'processing',orderId});assert.equal(delay,8000);assert.equal(f.deliveries.length,0);release();await task;assert.equal(f.deliveries.length,1);
});
test('webhook refuses bad and stale signatures; replay reaches the idempotent database',async()=>{
 const f=fixture();assert.equal((await f.webhook(event,0,'bad')).status,401);assert.equal((await f.webhook(event,-301000)).status,401);
 assert.equal((await f.webhook(event)).status,200);assert.equal((await f.webhook(event)).status,200);assert.equal(f.calls.filter(c=>c.name==='system_apply_payment_event').length,2);
 f.broken();assert.equal((await f.webhook({...event,id:'failure'})).status,500);
});
test('refund and cancellation move money as owner with full remainder on cancel',async()=>{
 for(const path of ['/refund','/cancel']) {
  const f=fixture();f.role('owner');const response=await f.request(path,{orderId,amount:12.34,reason:'Fixture reason'});assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'succeeded'});
  const creation=f.calls.find(c=>c.name==='system_create_refund')!;assert.equal(creation.args.actor,buyer);assert.equal(creation.args.cancels,path==='/cancel');assert.equal(creation.args.amount,path==='/cancel'?80:12.34);
  assert(f.calls.some(c=>c.name==='system_apply_payment_event'&&c.args.type==='refund.succeeded'));
  assert.deepEqual(f.refunds,[{chargeRef:'sim_ch_fixture',amount:path==='/cancel'?80:12.34,paymentId:refundId}]);
  assert(f.reads.includes(`payments?id=eq.${paymentId}&select=*&limit=1`));
  assert(!f.reads.some(path=>path.includes('created_at.desc')));
 }
});
test('late-payment webhook uses the late-refund RPC and the specific late charge reference',async()=>{
 for (const payment of ['failed','captured']) {
  const f=fixture();f.late();f.order.payment=payment;f.order.status=payment==='failed'?'cancelled':'paid';f.order.refunded=0;
  const snapshot=structuredClone(f.order),lateEvent={...event,paymentId:latePaymentId,ref:'sim_ch_late_fixture'};
  const response=await f.webhook(lateEvent);assert.equal(response.status,200);
  const creation=f.calls.find(c=>c.name==='system_create_late_refund')!;assert.deepEqual(creation.args,{charge_id:latePaymentId});
  assert(!f.calls.some(c=>c.name==='system_create_refund'));assert(f.calls.some(c=>c.name==='system_apply_payment_event'&&c.args.type==='refund.succeeded'));
  assert.deepEqual(f.refunds,[{chargeRef:'sim_ch_late_fixture',amount:100,paymentId:refundId}]);assert(f.reads.includes(`payments?id=eq.${latePaymentId}&select=*&limit=1`));assert(!f.reads.some(path=>path.includes('created_at.desc')));assert.deepEqual(f.order,snapshot);
  // A replay is acknowledged without creating or sending another refund.
  assert.equal((await f.webhook(lateEvent)).status,200);assert.equal(f.calls.filter(c=>c.name==='system_create_late_refund').length,1);assert.equal(f.refunds.length,1);
 }
});
test('simulation refuses a foreign buyer, a completed charge and invalid outcomes',async()=>{
 const f=fixture();f.charge.status='succeeded';assert.equal((await f.request('/simulate',{paymentId,outcome:'approve'})).status,409);
 f.charge.status='pending';f.order.buyer_id='another-buyer'; // DB fixture identity returns the session buyer; override its DB lookup below.
 const foreign=fixture({identify:async()=>({id:'00000000-0000-4000-8000-000000000099',email:'other@fixture.test',role:'buyer'})});assert.equal((await foreign.request('/simulate',{paymentId,outcome:'approve'})).status,403);
 assert.equal((await f.request('/simulate',{paymentId,outcome:'invented'})).status,400);
});
test('invalid JSON, object shape and oversized requests return safe errors',async()=>{
 const f=fixture();for(const raw of ['bad','[]']) {const r=await f.handler(new Request('https://local.fixture/payments/start',{method:'POST',body:raw}));assert.equal(r.status,400);assert.deepEqual(await r.json(),{message:'Check the request and try again.'});}
 assert.equal((await f.handler(new Request('https://local.fixture/payments/start',{method:'POST',body:'x'.repeat(65537)}))).status,413);
 assert.equal((await f.request('/start',{orderId:'invalid'})).status,400);
 f.role('owner');assert.equal((await f.request('/refund',{orderId,amount:0,reason:'Fixture'})).status,400);
});
test('production identify path resolves the profile through an injected fake auth endpoint',async()=>{
 const f=fixture({identify:undefined,fetcher:async(input)=> { assert.match(String(input),/\/auth\/v1\/user$/);return new Response(JSON.stringify({id:buyer,email:'buyer@fixture.test'}));},db:{async one<T>(path:string){if(path.startsWith('profiles?'))return {role:'buyer'} as T;if(path.startsWith('connections?'))return {mode:'off'} as T;return null;},async select<T>(){return [] as T[];},async rpc<T>(){return null as T;}}});
 assert.equal((await f.request('/start',{orderId})).status,409);
});
