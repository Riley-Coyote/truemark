import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPlatformDb } from './lib/platform-db.mjs';
globalThis.fetch = async () => { throw new Error('External network forbidden in shipping SQL proofs'); };
const h = await createPlatformDb();
const { db, rows, scalar, auth, service, denied, person } = h;
const checks = {};
try {
  const owner = await person('owner@shipping.fixture', 'owner');
  const staff = await person('staff@shipping.fixture', 'staff');
  const buyerUser = await person('buyer@shipping.fixture');
  const partner = await person('partner@shipping.fixture', 'partner');
  const buyer = await scalar("insert into buyers(user_id,name,email,institution,status) values ($1,'Fixture','buyer@shipping.fixture','Fixture lab','verified') returning id", [buyerUser]);
  await db.exec("insert into vault.secrets values ('tm_functions_url','https://functions.fixture'),('tm_functions_key','fixture-functions-key-only-0000000000')");
  const createOrder = () => scalar("insert into orders(buyer_id,address,shipping_method_id,shipping_price,subtotal,total) values ($1,'{}','cold-2day',24,100,124) returning id", [buyer]);
  const status = (id, value) => db.query('update orders set status=$2 where id=$1', [id,value]);
  const get = (id) => rows('select * from shipments where order_id=$1', [id]).then((r) => r[0]);
  const claim = () => service('select * from system_claim_shipments()');
  const rpc = (name, sql, params) => service(`select public.${name}(${sql})`, params);
  const paid = await createOrder();
  assert.equal(await get(paid), undefined);
  await status(paid,'packed'); assert.equal(await get(paid),undefined);
  await status(paid,'paid'); assert.equal((await get(paid)).provider,'simulator');
  await status(paid,'paid'); assert.equal(await scalar('select count(*) from shipments where order_id=$1',[paid]),1);
  assert.equal(await scalar("select count(*) from net.calls where url='https://functions.fixture/shipping/flush'"),1);
  await auth(owner,"select set_connection_mode('shipping','live','shipstation')");
  const liveOrder = await createOrder(); await status(liveOrder,'paid');
  assert.equal((await get(liveOrder)).provider,'shipstation');
  await auth(owner,"select set_connection_mode('shipping','off')");
  const manual = await createOrder(); await status(manual,'paid'); assert.equal(await get(manual),undefined);
  checks.queued_on_paid = true; checks.off_is_manual = true;
  await auth(owner,"select set_connection_mode('shipping','simulated')");
  await status(liveOrder,'cancelled'); assert.equal((await get(liveOrder)).status,'cancelled');
  const claimed = await claim(); assert.equal(claimed.length,1); assert.equal(claimed[0].attempts,1);
  assert.equal(await scalar('select round(extract(epoch from (locked_until-updated_at)))::integer from shipments where order_id=$1',[paid]),120);
  assert.equal((await claim()).length,0);
  const s = await get(paid);
  await rpc('system_shipment_pushed','$1,$2',[s.id,'provider-fixture']);
  await status(paid,'refunded'); assert.equal((await get(paid)).cancel_requested,true);
  assert.equal((await claim())[0].attempts,1);
  await rpc('system_shipment_cancelled','$1',[s.id]); assert.equal((await get(paid)).status,'cancelled');
  checks.cancel_paths = true;

  const retryOrder = await createOrder(); await status(retryOrder,'paid');
  const retry = await get(retryOrder);
  for (let attempt=1; attempt<=6; attempt++) {
    await db.query('update shipments set next_attempt_at=now()-interval \'1 second\',locked_until=null where id=$1',[retry.id]);
    const c = await claim(); assert.equal(c.length,1); assert.equal(c[0].attempts,attempt);
    await rpc('system_shipment_failed','$1,$2',[retry.id,'fixture unavailable']);
    const current = await get(retryOrder); assert.equal(current.status,attempt===6?'failed':'queued');
    if (attempt<6) assert.equal(await scalar('select round(extract(epoch from (next_attempt_at-updated_at))/60)::integer from shipments where id=$1',[retry.id]),[1,5,15,60,240][attempt-1]);
  }
  assert.equal(await scalar("select count(*) from notifications where title='An order didn''t reach ShipStation'"),1);
  await denied('authenticated',buyerUser,'select retry_shipment($1)',[retryOrder]);
  await auth(staff,'select retry_shipment($1)',[retryOrder]); assert.equal((await get(retryOrder)).attempts,0);
  checks.push_retries_and_alert = true;
  await denied('service_role',null,'select system_record_shipping_label($1,$2,$3,$4,$5,$6,$7)',
    [retryOrder,'UPS','Standard','1ZSIM0123456789ABC',null,'simulator','export-race'],'40001');
  assert.equal(await scalar("select count(*) from shipping_events where event_id='label:export-race'"),0);
  await claim(); await rpc('system_shipment_pushed','$1,$2',[retry.id,'sim_or_fixture']);
  const args = [retryOrder,'UPS','Cold two day','1ZSIM0123456789ABC','2026-10-05T14:00:00Z','simulator','sim_sh_event'];
  const labelArgs = [...args];
  const label = () => rpc('system_record_shipping_label','$1,$2,$3,$4,$5,$6,$7',labelArgs);
  assert.equal((await label())[0].system_record_shipping_label.outcome,'applied');
  assert.equal((await label())[0].system_record_shipping_label.outcome,'duplicate');
  assert.equal(await scalar('select status from orders where id=$1',[retryOrder]),'paid');
  assert.equal((await get(retryOrder)).status,'pushed');
  assert.equal((await get(retryOrder)).shipped_at,null);
  assert.equal((await get(retryOrder)).provider_shipment_id,'sim_sh_event');
  assert.equal(await scalar("select count(*) from notifications where kind='order.shipped' and href='/account/orders/'||$1::text",[retryOrder]),0);
  assert.equal(await scalar("select count(*) from order_events where order_id=$1 and status='shipped'",[retryOrder]),0);
  assert.equal((await auth(buyerUser,'select tracking from orders where id=$1',[retryOrder]))[0].tracking,args[3]);
  const oldLabel = [...args]; oldLabel[4]='2026-10-04T00:00:00Z'; oldLabel[6]='old-label'; oldLabel[3]='old-tracking';
  assert.equal((await rpc('system_record_shipping_label','$1,$2,$3,$4,$5,$6,$7',oldLabel))[0].system_record_shipping_label.outcome,'ignored');
  assert.equal((await get(retryOrder)).tracking,args[3]);
  for (const user of [owner,staff,buyerUser,partner]) await denied('authenticated',user,'select system_record_shipping_label($1,$2,$3,$4,$5,$6,$7)',args);
  await denied('anon',null,'select system_record_shipping_label($1,$2,$3,$4,$5,$6,$7)',args);
  const invalid = [...args]; invalid[3]=''; invalid[6]='invalid-label';
  await denied('service_role',null,'select system_record_shipping_label($1,$2,$3,$4,$5,$6,$7)',invalid,'22023');
  // Void, replay and replacement must not resurrect an obsolete label.
  const voidArgs=[retryOrder,'simulator','sim_sh_event'];
  assert.equal((await rpc('system_void_shipping_label','$1,$2,$3',voidArgs))[0].system_void_shipping_label.outcome,'applied');
  assert.equal((await get(retryOrder)).label_created_at,null);
  assert.equal(await scalar('select tracking from orders where id=$1',[retryOrder]),null);
  assert.equal((await label())[0].system_record_shipping_label.outcome,'duplicate');
  assert.equal((await get(retryOrder)).tracking,null);
  const replacement=[...args]; replacement[6]='replacement-label';
  assert.equal((await rpc('system_record_shipping_label','$1,$2,$3,$4,$5,$6,$7',replacement))[0].system_record_shipping_label.outcome,'applied');
  assert.equal((await rpc('system_void_shipping_label','$1,$2,$3',voidArgs))[0].system_void_shipping_label.outcome,'duplicate');
  assert.equal((await get(retryOrder)).provider_shipment_id,'replacement-label');
  // A void received before its creation event also prevents that label being used.
  await rpc('system_void_shipping_label','$1,$2,$3',[retryOrder,'simulator','void-before-create']);
  const voided=[...args]; voided[6]='void-before-create';
  assert.equal((await rpc('system_record_shipping_label','$1,$2,$3,$4,$5,$6,$7',voided))[0].system_record_shipping_label.outcome,'ignored');
  assert.equal((await get(retryOrder)).provider_shipment_id,'replacement-label');
  checks.label_is_not_shipment = true;
  const mark = () => rpc('system_mark_shipped','$1,$2,$3,$4,$5,$6,$7',args);
  assert.equal((await mark())[0].system_mark_shipped.outcome,'applied');
  const snapshot = await scalar('select jsonb_build_object(\'order\',(select to_jsonb(o) from orders o where id=$1),\'shipment\',(select to_jsonb(s) from shipments s where order_id=$1),\'events\',(select jsonb_agg(e) from order_events e where order_id=$1),\'notices\',(select jsonb_agg(n) from notifications n where href=\'/account/orders/\'||$1::text))',[retryOrder]);
  assert.equal((await mark())[0].system_mark_shipped.outcome,'duplicate');
  const snapshot2 = await scalar('select jsonb_build_object(\'order\',(select to_jsonb(o) from orders o where id=$1),\'shipment\',(select to_jsonb(s) from shipments s where order_id=$1),\'events\',(select jsonb_agg(e) from order_events e where order_id=$1),\'notices\',(select jsonb_agg(n) from notifications n where href=\'/account/orders/\'||$1::text))',[retryOrder]);
  assert.deepEqual(snapshot2,snapshot);
  assert.equal(await scalar("select count(*) from notifications where kind='order.shipped' and href='/account/orders/'||$1::text",[retryOrder]),1);
  assert.equal(await scalar("select body from notifications where kind='order.shipped' and href='/account/orders/'||$1::text",[retryOrder]),'UPS · 1ZSIM0123456789ABC');
  assert.equal(await scalar("select source from order_events where order_id=$1 and status='shipped'",[retryOrder]),'shipping');
  assert.equal((await rpc('system_mark_shipped','$1,$2,$3,$4,$5,$6,$7',[...args.slice(0,6),'different-event']))[0].system_mark_shipped.outcome,'ignored');
  assert.equal((await rpc('system_mark_shipped','$1,$2,$3,$4,$5,$6,$7',[paid,...args.slice(1,6),'cancelled-event']))[0].system_mark_shipped.outcome,'ignored');
  assert.equal(await scalar("select count(*) from notifications where title='A cancelled order has a label'"),1);
  checks.ship_notify_once = true;
  const delivery = [retryOrder,'2026-10-06T14:00:00Z','simulator','sim_dl_fixture'];
  assert.equal((await rpc('system_mark_delivered','$1,$2,$3,$4',delivery))[0].system_mark_delivered.outcome,'applied');
  assert.equal((await rpc('system_mark_delivered','$1,$2,$3,$4',delivery))[0].system_mark_delivered.outcome,'duplicate');
  assert.equal((await get(retryOrder)).status,'delivered');
  assert.equal(await scalar("select body from notifications where kind='order.delivered' and href='/account/orders/'||$1::text",[retryOrder]),'Certificates for each lot are in your account.');
  checks.delivered_scan = true;
  const lateLabel = [...args]; lateLabel[6]='late-label'; lateLabel[3]='different-tracking';
  assert.equal((await rpc('system_record_shipping_label','$1,$2,$3,$4,$5,$6,$7',lateLabel))[0].system_record_shipping_label.outcome,'ignored');
  assert.equal((await get(retryOrder)).status,'delivered');
  assert.equal((await get(retryOrder)).tracking,args[3]);
  const cancelledLabel = [...args]; cancelledLabel[0]=paid; cancelledLabel[6]='cancelled-label';
  assert.equal((await rpc('system_record_shipping_label','$1,$2,$3,$4,$5,$6,$7',cancelledLabel))[0].system_record_shipping_label.outcome,'ignored');
  assert.equal((await get(paid)).status,'cancelled');
  assert.equal((await rpc('system_record_shipping_label','$1,$2,$3,$4,$5,$6,$7',cancelledLabel))[0].system_record_shipping_label.outcome,'duplicate');
  assert.equal(await scalar("select count(*) from notifications where title='A cancelled order has a label'"),2);


  const edit = "select upsert_shipping_method($1,$2,$3,$4,$5)";
  const value = ['cold-2day','Cold two day','Cold pack',0,true];
  for (const user of [staff,buyerUser,partner]) await denied('authenticated',user,edit,value);
  for (const invalid of [ ['', 'Cold pack',24], ['x'.repeat(81),'Cold pack',24], ['Cold','',24], ['Cold','x'.repeat(161),24], ['Cold','Pack',-1], ['Cold','Pack',1000], ['Cold','Pack',1.001], ['Cold','Pack',null] ]) {
    await denied('authenticated',owner,edit,['cold-2day',...invalid,true],'22023');
  }
  await denied('authenticated',owner,edit,['new','Cold','Pack',24,true],'P0002');
  assert.equal(await scalar('select shipping_rates_confirmed from settings'),false);
  await auth(owner,edit,value);
  assert.equal(await scalar('select shipping_rates_confirmed from settings'),true);
  assert.equal(await scalar("select updated_by from shipping_methods where id='cold-2day'"),owner);
  await auth(owner,edit,['cold-overnight','Overnight','Cold pack',999.99,false]);
  await denied('authenticated',owner,edit,['cold-2day','Cold','Pack',24,false],'22023');
  checks.methods_editor_rules = true; checks.rates_flag = true;

  for (const table of ['shipments','shipping_events','simulated_labels']) {
    assert.equal(await scalar('select relrowsecurity from pg_class where oid=$1::regclass',[table]),true);
    assert.ok((await auth(owner,`select * from ${table}`)).length >= (table==='simulated_labels'?0:1));
    for (const user of [buyerUser,partner]) assert.equal((await auth(user,`select * from ${table}`)).length,0);
    await denied('anon',null,`select * from ${table}`);
    await denied('authenticated',owner,`delete from ${table}`);
    await denied('service_role',null,`delete from ${table}`);
  }
  const functions = await rows("select p.oid::regprocedure::text as signature, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('system_queue_shipment','system_claim_shipments','system_shipment_pushed','system_shipment_cancelled','system_shipment_failed','system_mark_shipped','system_record_shipping_label','system_void_shipping_label','system_mark_delivered','system_create_simulated_label','retry_shipment','upsert_shipping_method')");
  assert.equal(functions.length,12);
  for (const f of functions) {
    assert.ok(f.prosecdef); assert.ok(f.proconfig.includes('search_path=public'));
    for (const role of ['anon','authenticated','service_role']) assert.equal(await scalar('select has_function_privilege($1,$2,\'execute\')',[role,f.signature]),f.signature.startsWith('system_') ? role==='service_role' : role==='authenticated');
  }
  assert.equal(await scalar("select count(*) from cron.job where jobname='tm-shipping-flush'"),1);
  assert.equal(await scalar("select schedule from cron.job where jobname='tm-shipping-flush'"),'* * * * *');
  const sql = await readFile(new URL('../supabase/migrations/20261005000300_shipping.sql',import.meta.url),'utf8');
  assert.ok(!/[^\x00-\x7f]/.test(sql));
  checks.sql_validated = true;
  console.log('PASS shipping SQL: migrations twice, paid/off, cancel, lock/backoff/alert/retry, idempotent notifications, delivery, methods, RLS and grants');
  console.log(JSON.stringify(checks,null,2));
} finally { await db.close(); }
