/** WP-25: real migrations, fixture users, no network or hosted database. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPlatformDb } from './lib/platform-db.mjs';
globalThis.fetch = async () => { throw new Error('Network forbidden'); };
const keys = ['off_unchanged','pending_in_simulated','tax_math','charge_applies_once','failure_keeps_order','late_payment_refunded','expiry_releases','refund_limits','partial_commission','cancel_refunds_and_restocks','advance_rules','rls_payments'];
const checks = Object.fromEntries(keys.map((k) => [k,false]));
const h = await createPlatformDb();
const { db, rows, scalar, auth, service, denied, anon } = h;
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=uid(1),staff=uid(2),buyer=uid(3),other=uid(4),partnerUser=uid(5);
async function fixtures(x) {
  for (const [id,role] of [[owner,'owner'],[staff,'staff'],[buyer,'buyer'],[other,'buyer'],[partnerUser,'partner']]) {
    await x.db.query('insert into auth.users(id,email) values ($1,$2)',[id,`${role}${id.slice(-1)}@fixture.test`]);
    await x.db.query('update profiles set role=$2 where id=$1',[id,role]);
  }
  for (const id of [buyer,other]) await x.db.query("insert into buyers(id,user_id,name,email,institution,status) values ($1,$1,'Fixture buyer',$2,'Fixture lab','verified')",[id,`${id}@fixture.test`]);
  await x.db.query("insert into partners(id,user_id,name,handle,email,code,rate,status,audience) values ($1,$2,'Fixture partner','fixture','partner@fixture.test','FIXTURE10',.12,'active','Fixture')",[uid(6),partnerUser]);
  await x.db.query("insert into discounts(code,kind,percent,partner_id,active) values ('FIXTURE10','partner',10,$1,true)",[uid(6)]);
  await x.db.exec("update products set stock=10000; update settings set free_shipping_threshold=null;");
}
const address={institution:'Fixture lab',attention:'Fixture buyer',line1:'1 Fixture Road',city:'Austin',region:'Texas',postal:'78701',country:'United States'};
const draft={lines:[{productId:'bpc-157-10-mg',quantity:2}],address,shipping:'cold-2day',discountCode:'FIXTURE10',via:'link'};
const place = async (d=draft,user=buyer) => (await auth(user,'select * from public.place_order($1)',[d]))[0];
const charge = async (o,user=buyer) => (await service("select * from public.system_create_charge($1,'simulator',$2)",[o.id,user]))[0];
let sequence=0;
const event = async (p,type,amount=Number(p.amount),id=`fixture-event-${++sequence}`,reason=null) => (await service('select public.system_apply_payment_event($1,$2,$3,$4,$5,$6,$7) as result',['simulator',id,type,p.id,`fixture-ref-${id}`,amount,reason]))[0].result;
const refund = async (o,amount,reason='Fixture reason',cancels=false,actor=owner) => (await service('select * from public.system_create_refund($1,$2,$3,$4,$5)',[o.id,amount,reason,cancels,actor]))[0];
const lateRefund = async (p) => (await service('select * from public.system_create_late_refund($1)',[p.id]))[0];
const paymentRow = async (p) => (await rows('select * from payments where id=$1',[p.id]))[0];
const get = (o) => rows('select * from orders where id=$1',[o.id]).then((r)=>r[0]);
const count = (table) => scalar(`select count(*)::int from ${table}`);
const pass=(key)=> { checks[key]=true; console.log(`PASS ${key}`); };
try {
 await fixtures(h);
 // WP-24's alert triggers precede payments in production. Compare against that
 // baseline so manual placement retains both the old notices and milestone alerts.
 // Normalize only generated ids/times and the explicitly new columns/source.
 const before=await createPlatformDb({through:'20261005000100_messages.sql'});
 await fixtures(before);
 await auth(owner,"select public.set_connection_mode('payments','off',null)");
 const old=(await before.auth(buyer,'select * from public.place_order($1)',[draft]))[0], manual=await place();
 const normalizedOrder=(o)=>Object.fromEntries(Object.entries(o).filter(([k])=>!['id','created_at','tax','tax_rate','tax_region','refunded','paid_at','payment_expires_at','payment_provider','referral_via','charge_id','membership_name','membership_amount','reward_points','reward_amount','reward_earn_rate'].includes(k)));
 assert.deepEqual(normalizedOrder(manual),normalizedOrder(old));
 const normalizedRows=async(x,table)=> (await x.rows(`select * from ${table}`)).map((r)=>Object.fromEntries(Object.entries(r).filter(([k])=>!['id','order_id','created_at','at','source','commission_base'].includes(k)).map(([k,v])=>[k,k==='href'&&typeof v==='string'?v.replace(/00000000-[\w-]+|[0-9a-f]{8}-[0-9a-f-]{27}/g,'<id>'):v])));
 for (const table of ['order_lines','order_events','referrals','notifications']) assert.deepEqual(await normalizedRows(h,table),await normalizedRows(before,table),table);
 await before.db.close(); pass('off_unchanged');
 await auth(owner,"select public.set_connection_mode('payments','simulated',null)");
 const notices=await count('notifications'), refs=await count('referrals'); const pending=await place();
 assert.equal(pending.payment,'pending'); assert(pending.payment_expires_at); assert.equal(pending.referral_via,'link'); assert.equal(await count('notifications'),notices);assert.equal(await count('referrals'),refs);pass('pending_in_simulated');
 await auth(owner,"select public.set_tax_settings('rates',false)"); await auth(owner,"select public.set_tax_rate('TX',.0625)");
 for (const shipping of [false,true]) {
  await auth(owner,"select public.set_tax_settings('rates',$1)",[shipping]);
  for (const [region,country,rated] of [[' TX ',' US ',true],['  t e x a s ','United States of America',true],['CA','USA',false],['Texas','Canada',false]]) {
   const o=await place({...draft,address:{...address,region,country}}),base=Number(o.subtotal)-Number(o.discount_amount);
   const expected=rated?Math.round((base+(shipping?Number(o.shipping_price):0))*.0625*100)/100:0;
   assert.equal(Number(o.tax),expected);assert.equal(Number(o.total),base+Number(o.shipping_price)+Number(o.insurance)+expected);
  }
 }
 assert.equal((await anon("select public.us_region_code('District of Columbia','united states') as code"))[0].code,'DC');
 await denied('authenticated',staff,"select public.set_tax_rate('TX',.1)");await denied('authenticated',buyer,"select public.set_tax_settings('off',false)");
 await auth(owner,"select public.set_tax_settings('off',false)");pass('tax_math');
 const p=await charge(pending); const id='fixture-duplicate';assert.equal((await event(p,'charge.succeeded',Number(p.amount),id)).result,'applied');
 const snapshot=JSON.stringify(await rows('select * from orders where id=$1',[pending.id]));const n=await count('notifications');assert.deepEqual(await event(p,'charge.succeeded',Number(p.amount),id),{result:'duplicate'});assert.equal(JSON.stringify(await rows('select * from orders where id=$1',[pending.id])),snapshot);assert.equal(await count('notifications'),n);assert.equal((await get(pending)).payment,'captured');assert.equal((await get(pending)).charge_id,p.id);pass('charge_applies_once');
 const failedOrder=await place(),failedCharge=await charge(failedOrder); const n0=await count('notifications');
 await event(failedCharge,'charge.failed',Number(failedCharge.amount),'fixture-decline','card_declined');await event(failedCharge,'charge.failed',Number(failedCharge.amount),'fixture-decline','card_declined');assert.equal(await count('notifications'),n0+1);assert.equal((await get(failedOrder)).status,'placed');assert.equal((await get(failedOrder)).payment,'pending');pass('failure_keeps_order');
 const retry=await charge(failedOrder);await denied('service_role',null,"select public.system_create_charge($1,'simulator',$2)",[failedOrder.id,other]);
 await denied('authenticated',other,'select public.cancel_unpaid_order($1)',[failedOrder.id]);
 await auth(buyer,'select public.cancel_unpaid_order($1)',[failedOrder.id]);assert.equal((await get(failedOrder)).status,'cancelled');
 assert.equal((await paymentRow(retry)).status,'abandoned');assert.equal((await paymentRow(retry)).failure_reason,'cancelled');
 const released=await get(failedOrder);
 const late=await event(retry,'charge.succeeded');assert.deepEqual(late,{result:'applied',action:'refund_needed',payment_id:retry.id});
 assert.deepEqual(await get(failedOrder),released);
 const cancellationLateRefund=await lateRefund(retry);assert.equal(cancellationLateRefund.refund_of,retry.id);assert.equal(cancellationLateRefund.late,true);
 await event(cancellationLateRefund,'refund.succeeded');assert.deepEqual(await get(failedOrder),released);
 // Replacement abandons a charge; a subsequent processor decline is recorded without disturbing the buyer.
 const replacementOrder=await place(),replacedCharge=await charge(replacementOrder);await charge(replacementOrder);
 const abandoned=await paymentRow(replacedCharge);assert.equal(abandoned.status,'abandoned');assert.equal(abandoned.failure_reason,'replaced');assert(abandoned.completed_at);
 const noticesBeforeAbandonedFailure=await count('notifications');
 assert.equal((await event(replacedCharge,'charge.failed',Number(replacedCharge.amount),undefined,'card_declined')).result,'applied');
 assert.equal((await paymentRow(replacedCharge)).status,'failed');assert.equal((await paymentRow(replacedCharge)).failure_reason,'card_declined');assert((await paymentRow(replacedCharge)).provider_ref);
 assert.equal(await count('notifications'),noticesBeforeAbandonedFailure);assert.equal((await get(replacementOrder)).payment,'pending');
 const exp=await place(),expCharge=await charge(exp);const stock=await scalar("select stock from products where id='bpc-157-10-mg'"),uses=await scalar("select uses from discounts where code='FIXTURE10'");
 await db.query("update orders set payment_expires_at=now()-interval '1 minute' where id=$1",[exp.id]);assert.equal((await service('select public.system_expire_unpaid_orders() as n'))[0].n,1);assert.equal(await scalar("select stock from products where id='bpc-157-10-mg'"),stock+2);assert.equal(await scalar("select uses from discounts where code='FIXTURE10'"),uses-1);assert.equal((await paymentRow(expCharge)).status,'abandoned');assert.equal((await paymentRow(expCharge)).failure_reason,'expired');assert.equal((await service('select public.system_expire_unpaid_orders() as n'))[0].n,0);
 const expiredOrder=await get(exp),expiredEvents=await rows('select * from order_events where order_id=$1',[exp.id]),expiredLines=await rows('select * from order_lines where order_id=$1',[exp.id]);
 assert.equal(expiredOrder.status,'cancelled');assert.equal(expiredOrder.payment,'failed');assert.equal(Number(expiredOrder.refunded),0);
 const expiredStock=await scalar("select stock from products where id='bpc-157-10-mg'"),expiredUses=await scalar("select uses from discounts where code='FIXTURE10'");
 assert.deepEqual(await event(expCharge,'charge.succeeded'),{result:'applied',action:'refund_needed',payment_id:expCharge.id});
 const expiredRefund=await lateRefund(expCharge);assert.equal(expiredRefund.late,true);assert.equal(expiredRefund.refund_of,expCharge.id);assert.equal(expiredRefund.amount,expCharge.amount);assert.equal(expiredRefund.provider,expCharge.provider);assert.equal(expiredRefund.created_by,null);assert.equal(expiredRefund.reason,'Payment arrived after the order was released');
 await assert.rejects(()=>service('select public.system_create_late_refund($1)',[expCharge.id]),e=>e.code==='22023'&&e.message==='This payment is already being refunded.');
 assert.equal(await scalar('select count(*)::int from payments where refund_of=$1',[expCharge.id]),1);
 const expiryNotices=await count('notifications');const expiryRefundEvent='fixture-expired-refund';
 await event(expiredRefund,'refund.succeeded',Number(expiredRefund.amount),expiryRefundEvent);
 assert.deepEqual(await event(expiredRefund,'refund.succeeded',Number(expiredRefund.amount),expiryRefundEvent),{result:'duplicate'});
 assert.equal((await paymentRow(expiredRefund)).status,'succeeded');assert((await paymentRow(expiredRefund)).provider_ref);assert((await paymentRow(expiredRefund)).completed_at);
 assert.equal(await count('notifications'),expiryNotices+1);assert.deepEqual(await get(exp),expiredOrder);assert.deepEqual(await rows('select * from order_events where order_id=$1',[exp.id]),expiredEvents);assert.deepEqual(await rows('select * from order_lines where order_id=$1',[exp.id]),expiredLines);
 assert.equal(await scalar("select stock from products where id='bpc-157-10-mg'"),expiredStock);assert.equal(await scalar("select uses from discounts where code='FIXTURE10'"),expiredUses);assert.equal(await scalar('select count(*)::int from referrals where order_id=$1',[exp.id]),0);
 const expiryNotice=(await rows("select * from notifications where kind='order.refunded' and href=$1",['/account/orders/'+exp.id]))[0];assert.equal(expiryNotice.title,'Refund for '+exp.number);assert.equal(expiryNotice.body,'A refund of $'+expiredRefund.amount+' is on its way.');assert.equal(expiryNotice.amount,expiredRefund.amount);assert.equal(expiryNotice.audience,'buyer:'+buyer);
 await denied('service_role',null,'select public.system_create_late_refund($1)',[expCharge.id],'22023');
 // Either of two outstanding charges may pay first. The extra successful charge is refunded without changing that paid order.
 const twoChargeOrder=await place(),firstCharge=await charge(twoChargeOrder),secondCharge=await charge(twoChargeOrder);
 assert.equal((await paymentRow(firstCharge)).status,'abandoned');await event(firstCharge,'charge.succeeded');const paidByFirst=await get(twoChargeOrder);assert.equal(paidByFirst.charge_id,firstCharge.id);assert.equal(paidByFirst.status,'paid');assert.equal(Number(paidByFirst.refunded),0);
 const paidReferral=await rows('select * from referrals where order_id=$1',[twoChargeOrder.id]),paidEvents=await rows('select * from order_events where order_id=$1',[twoChargeOrder.id]),paidLines=await rows('select * from order_lines where order_id=$1',[twoChargeOrder.id]);
 const paidStock=await scalar("select stock from products where id='bpc-157-10-mg'");
 assert.deepEqual(await event(secondCharge,'charge.succeeded'),{result:'applied',action:'refund_needed',payment_id:secondCharge.id});
 const extraRefund=await lateRefund(secondCharge);assert.equal(extraRefund.refund_of,secondCharge.id);
 const failedRefundNotices=await count('notifications');await event(extraRefund,'refund.failed',Number(extraRefund.amount),undefined,'fixture_late_refund_failure');assert.equal((await paymentRow(extraRefund)).status,'failed');assert.equal(await count('notifications'),failedRefundNotices+1);assert.deepEqual(await get(twoChargeOrder),paidByFirst);
 const retriedLateRefund=await lateRefund(secondCharge);await event(retriedLateRefund,'refund.succeeded');assert.deepEqual(await get(twoChargeOrder),paidByFirst);assert.deepEqual(await rows('select * from referrals where order_id=$1',[twoChargeOrder.id]),paidReferral);assert.deepEqual(await rows('select * from order_events where order_id=$1',[twoChargeOrder.id]),paidEvents);assert.deepEqual(await rows('select * from order_lines where order_id=$1',[twoChargeOrder.id]),paidLines);assert.equal(await scalar("select stock from products where id='bpc-157-10-mg'"),paidStock);
 await denied('service_role',null,'select public.system_create_late_refund($1)',[secondCharge.id],'22023');await denied('service_role',null,'select public.system_create_late_refund($1)',[retriedLateRefund.id],'22023');
 pass('late_payment_refunded');
 const team=await place();await auth(staff,'select public.cancel_unpaid_order($1)',[team.id]);pass('expiry_releases');
 await denied('service_role',null,'select public.system_create_refund($1,$2,$3,false,$4)',[pending.id,1,'Fixture',staff]);
 await denied('service_role',null,'select public.system_create_refund($1,$2,$3,false,$4)',[pending.id,Number(pending.total)+1,'Fixture',owner],'22023');
 for (const amount of [0,-1]) await denied('service_role',null,'select public.system_create_refund($1,$2,$3,false,$4)',[pending.id,amount,'Fixture',owner],'22023');
 const reserved=await refund(pending,1);assert.equal(reserved.refund_of,(await get(pending)).charge_id);assert.equal(reserved.late,false);await denied('service_role',null,'select public.system_create_refund($1,$2,$3,false,$4)',[pending.id,Number(pending.total),'Fixture',owner],'22023');await event(reserved,'refund.failed',1,undefined,'fixture_failure');pass('refund_limits');
 const partial=await refund(pending,10);await event(partial,'refund.succeeded');const updated=await get(pending);assert.equal(updated.payment,'partially_refunded');assert.equal(Number(updated.refunded),10);
 const referral=(await rows('select * from referrals where order_id=$1',[pending.id]))[0];assert.equal(Number(referral.commission),Math.round(Number(referral.commission_base)*Math.max(Number(referral.order_subtotal)-10,0)/Number(referral.order_subtotal)*100)/100);pass('partial_commission');
 const full=await refund(updated,Number(updated.total)-10);await event(full,'refund.succeeded');assert.equal((await get(pending)).status,'refunded');assert.equal((await rows('select status from referrals where order_id=$1',[pending.id]))[0].status,'void');
 const cancel=await place();await event(await charge(cancel),'charge.succeeded'); const stock0=await scalar("select stock from products where id='bpc-157-10-mg'");const cancellation=await refund(cancel,Number(cancel.total),'Fixture cancellation',true);await event(cancellation,'refund.succeeded');assert.equal((await get(cancel)).status,'cancelled');assert.equal((await get(cancel)).payment,'refunded');assert.equal(await scalar("select stock from products where id='bpc-157-10-mg'"),stock0+2);assert.equal((await rows('select status from referrals where order_id=$1',[cancel.id]))[0].status,'void');pass('cancel_refunds_and_restocks');
 const unpaid=await place();await denied('authenticated',owner,"select public.advance_order($1,'paid')",[unpaid.id],'22023');await denied('authenticated',owner,"select public.advance_order($1,'cancelled')",[unpaid.id],'22023');
 const paid=await place();await event(await charge(paid),'charge.succeeded');await denied('authenticated',owner,"select public.advance_order($1,'refunded')",[paid.id],'22023');await auth(staff,"select public.advance_order($1,'packed')",[paid.id]);await auth(owner,"select public.advance_order($1,'paid')",[manual.id]);pass('advance_rules');
 assert((await auth(buyer,'select * from payments')).length>0);assert.equal((await auth(other,'select * from payments')).length,0);assert.equal((await auth(partnerUser,'select * from payments')).length,0);await denied('anon',null,'select * from payments');assert.equal((await auth(buyer,'select * from payment_events')).length,0);assert((await auth(staff,'select * from payments')).length>0);
 for (const sql of ["select public.system_create_charge(null,'simulator',null)","select public.system_create_refund(null,1,'Fixture',false,null)","select public.system_apply_payment_event('simulator','x','unknown',null,null,1,null)",'select public.system_expire_unpaid_orders()','select public.system_create_late_refund(null)']) for (const [role,user] of [['anon',null],['authenticated',owner],['authenticated',buyer]]) await denied(role,user,sql);
 await denied('authenticated',owner,"insert into payments(order_id,kind,provider,amount) values ($1,'charge','simulator',1)",[paid.id]);pass('rls_payments');
 const sql=await readFile(new URL('../supabase/migrations/20261005000200_payments.sql',import.meta.url),'utf8');assert(!/[^\x00-\x7f]/.test(sql));assert.equal(await scalar("select count(*)::int from cron.job where jobname='tm-payments-expire'"),1);
 await db.exec(sql);
 for (const key of keys) assert.equal(checks[key],true,key);
 checks.sql_validated=true;console.log(JSON.stringify(checks,null,2));
} finally { await db.close(); }
