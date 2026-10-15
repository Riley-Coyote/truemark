import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPlatformDb } from './lib/platform-db.mjs';
globalThis.fetch=async()=>{throw new Error('Network forbidden in messages SQL proofs');};
const h=await createPlatformDb(),{db,rows,scalar,auth,anon,service,denied,person}=h;
const checks={sql_validated:false,enqueue_map:false,off_suppresses:false,dedupe:false,retry_backoff:false,prefs_rules:false,sms_consent_required:false,contact_form_rules:false,milestones_once:false,weekly_summary:false,rls_outbox:false};
const pass=key=>{checks[key]=true;console.log('PASS '+key);};
try {
 const sql=await readFile(new URL('../supabase/migrations/20261005000100_messages.sql',import.meta.url),'utf8');
 assert(!/[^\x00-\x7f]/.test(sql));assert.equal(await scalar("select count(*) from cron.job where jobname in ('tm-messages-flush','tm-partner-weekly')"),2);
 const owner=await person('owner@fixture.test','owner'),staff=await person('staff@fixture.test','staff'),buyer=await person('buyer@fixture.test'),partner=await person('partner@fixture.test','partner'),other=await person('other@fixture.test');
 const bid=await scalar("insert into buyers(user_id,name,email,institution,status) values($1,'Fixture Buyer','buyer@fixture.test','Fixture Lab','verified') returning id",[buyer]);
 const pid=await scalar("insert into partners(user_id,name,email,code,rate,status) values($1,'Fixture Partner','partner@fixture.test','FIXTURE',.12,'active') returning id",[partner]);
 const pref=(user)=>auth(user,'select my_message_preferences() p').then(r=>r[0].p);
 const save=(user,a,phone=null,consent=false)=>auth(user,'select save_message_preferences($1,$2,$3) p',[a,phone,consent]).then(r=>r[0].p);
 assert.deepEqual((await pref(buyer)).alerts,{shipping:{text:false}});
 assert.deepEqual((await pref(owner)).alerts,{newOrder:{email:false,text:false},applications:{email:false}});
 assert(Object.values((await pref(partner)).alerts).every(a=>a.email===true&&a.text===false));
 for(const user of [owner,staff,buyer,partner]){
  await denied('authenticated',user,"select save_message_preferences('{\"unknown\":{\"email\":true}}',null,false)",[],'22023');
  await denied('authenticated',user,"select save_message_preferences('[]',null,false)",[],'22023');
 }
 await denied('authenticated',partner,"select save_message_preferences('{\"newOrder\":{\"email\":1}}',null,false)",[],'22023');
 await denied('authenticated',buyer,"select save_message_preferences('{\"shipping\":{\"email\":true}}',null,false)",[],'22023');
 for(const phone of ['abc','+442071234567','123','+1 (123) 555-0100'])await denied('authenticated',buyer,'select save_message_preferences($1,$2,true)',[{shipping:{text:true}},phone],'22023');
 const all=Object.fromEntries(['newOrder','approved','payout','milestone','weekly'].map(k=>[k,{email:true,text:true}]));
 await denied('authenticated',partner,'select save_message_preferences($1,null,false)',[all],'22023');
 await denied('authenticated',partner,'select save_message_preferences($1,$2,false)',[all,'3125550100'],'22023');
 const p=await save(partner,all,'(312) 555-0100',true);assert.equal(p.phone,'+13125550100');assert(p.smsConsent);
 assert.equal(await scalar('select sms_consent_text from message_preferences where user_id=$1',[partner]),'Text me TrueMark partner alerts at this number. Message and data rates may apply. Reply STOP to opt out.');
 await save(owner,{newOrder:{email:true,text:true},applications:{email:true}},'312.555.0101',true);
 await save(staff,{newOrder:{email:true,text:true},applications:{email:true}},'+1 312 555 0102',true);
 await save(buyer,{shipping:{text:true}},'1-312-555-0103',true);
 pass('prefs_rules');
 // Submission triggers retain the exact application ids, including duplicate labels.
 const applicant2=await person('applicant2@fixture.test');
 const bid2=await scalar("insert into buyers(user_id,name,email,institution) values($1,'Fixture Applicant','applicant2@fixture.test','Fixture Lab') returning id",[applicant2]);
 const apps=await rows("insert into applications(buyer_id,name,email,institution) values($1,'Fixture Applicant','buyer@fixture.test','Fixture Lab'),($2,'Fixture Applicant','applicant2@fixture.test','Fixture Lab') returning id",[bid,bid2]);
 for(const app of apps)assert.equal(await scalar("select count(*) from outbox where template='team.application' and data->>'application_id'=$1",[app.id]),2);
 const beforeApproval=await scalar("select count(*) from notifications where kind='application.approved'");
 await db.query("update applications set status='approved' where id=$1",[apps[0].id]);await db.query("update applications set status='approved' where id=$1",[apps[0].id]);
 assert.equal(await scalar("select count(*) from notifications where kind='application.approved'"),beforeApproval+1);
 assert.equal(await scalar("select body from notifications where kind='application.approved' order by at desc limit 1"),'You can now place orders.');
 await db.query("update applications set status='declined' where id=$1",[apps[1].id]);
 assert.equal(await scalar("select body from notifications where kind='application.declined' order by at desc limit 1"),"We couldn't approve your application.");
 const partnerApp=await scalar("insert into partner_applications(user_id,name,email,channel,audience,feature) values($1,'Fixture Partner Applicant','other@fixture.test','Fixture','Fixture','Fixture') returning id",[other]);
 assert.equal(await scalar("select count(*) from outbox where template='team.application' and data->>'application_id'=$1",[partnerApp]),2);
 const method=await scalar('select id from shipping_methods limit 1');
 async function order(){return scalar("insert into orders(buyer_id,address,shipping_method_id,shipping_price,subtotal,total) values($1,'{\"institution\":\"Fixture Lab\",\"city\":\"Chicago\",\"region\":\"IL\"}',$2,24,1000,1024) returning id",[bid,method]);}
 const oid=await order(),number=await scalar('select number from orders where id=$1',[oid]);
 const rid=await scalar("insert into referrals(partner_id,order_id,order_number,order_subtotal,commission,via) values($1,$2,$3,1000,120,'code') returning id",[pid,oid,number]);
 const payout=await scalar("insert into payouts(partner_id,period_start,period_end,amount,referrals,status,paid_at,method,created_by) values($1,'2026-09-01','2026-09-30',120,1,'paid',now(),'Bank transfer',$2) returning id",[pid,owner]);
 await db.query('update referrals set payout_id=$1 where id=$2',[payout,rid]);
 async function notification(audience,kind,title='Fixture',body='Fixture',href=null,amount=null){return scalar('insert into notifications(audience,kind,title,body,href,amount) values($1,$2,$3,$4,$5,$6) returning id',[audience,kind,title,body,href,amount]);}
 const cases=[
 ['buyer:'+bid,'order.placed','buyer.order_confirmed',1],['buyer:'+bid,'order.shipped','buyer.order_shipped',2],['buyer:'+bid,'order.delivered','buyer.order_delivered',2],['buyer:'+bid,'order.cancelled','buyer.order_cancelled',1],['buyer:'+bid,'order.refunded','buyer.order_refunded',1],['buyer:'+bid,'payment.failed','buyer.payment_failed',1],['buyer:'+bid,'application.approved','buyer.account_approved',1],['buyer:'+bid,'application.declined','buyer.account_declined',1],
 ['partner:'+pid,'referral.created','partner.new_order',2],['partner:'+pid,'commission.approved','partner.commission_approved',2],['partner:'+pid,'payout.sent','partner.payout_sent',2],['partner:'+pid,'partner.milestone','partner.milestone',2],['partner:'+pid,'partner.welcome','partner.welcome',1],['owner','order.placed','team.new_order',4],['owner','application.submitted','team.application',2],['owner','partner_application.submitted','team.application',2],['owner','system.alert','team.system_alert',1],
 ];
 for(const [audience,kind,template,count] of cases){const n=await notification(audience,kind,'Order '+number,'Order '+number+' · Fixture','/account/orders/'+oid,120);
 const found=await rows('select * from outbox where notification_id=$1',[n]);assert.equal(found.length,count,kind);assert(found.every(r=>r.template===template||r.template===template+'_sms'));assert(found.every(r=>r.dedupe_key===n+':'+r.channel+':'+r.recipient));
 if(kind==='referral.created'||kind==='commission.approved')assert(found.every(r=>r.data.referral_id===rid));if(kind==='payout.sent')assert(found.every(r=>r.data.payout_id===payout));
 }
 for(const [audience,kind] of [['buyer:'+bid,'order.paid'],['owner','order.shipped'],['partner:'+pid,'order.packed']]){const n=await notification(audience,kind);assert.equal(await scalar('select count(*) from outbox where notification_id=$1',[n]),0);}
 // Preferences off for the selectable events; mandatory buyer and welcome emails remain.
 await save(partner,Object.fromEntries(Object.keys(all).map(k=>[k,{email:false,text:false}])),p.phone,true);
 await save(owner,{newOrder:{email:false,text:false},applications:{email:false}},null,false);await save(staff,{newOrder:{email:false,text:false},applications:{email:false}},null,false);
 for(const [audience,kind] of cases.filter(([a,k])=>a.startsWith('partner:')&&k!=='partner.welcome'||a==='owner'&&k!=='system.alert')){const n=await notification(audience,kind);assert.equal(await scalar('select count(*) from outbox where notification_id=$1',[n]),0,kind+' disabled');}
 await save(buyer,{shipping:{text:false}},'+13125550103',true);
 const noText=await notification('buyer:'+bid,'order.shipped','Order '+number,'Fixture','/account/orders/'+oid);
 assert.equal(await scalar('select count(*) from outbox where notification_id=$1',[noText]),1);
 await save(buyer,{shipping:{text:true}},'+13125550103',true);
 pass('enqueue_map');
 await save(partner,all,p.phone,true);
 await service('select system_sms_opt($1,true)',[p.phone]);assert((await pref(partner)).smsOptedOut);
 let n=await notification('partner:'+pid,'referral.created','Fixture','Order '+number+' · fixture');assert.equal(await scalar("select count(*) from outbox where notification_id=$1 and channel='sms'",[n]),0);
 await save(partner,all,p.phone,true);assert((await pref(partner)).smsOptedOut,'ordinary saving must not clear STOP');
 await service('select system_sms_opt($1,false)',[p.phone]);assert(!(await pref(partner)).smsOptedOut);
 await save(partner,all,null,false);assert(Object.values((await pref(partner)).alerts).every(a=>!a.text));
 await save(partner,all,p.phone,true);await service('select system_sms_opt($1,true)',[p.phone]);await save(partner,all,p.phone,false);await save(partner,all,p.phone,true);assert(!(await pref(partner)).smsOptedOut,'new consent clears opt-out');
 pass('sms_consent_required');
 await db.exec("update connections set mode='off' where id in ('email','sms')");
 n=await notification('buyer:'+bid,'order.shipped','Order '+number,'Fixture','/account/orders/'+oid);
 assert((await rows('select * from outbox where notification_id=$1',[n])).every(r=>r.status==='suppressed'));pass('off_suppresses');
 const original=await rows('select * from notifications where id=$1',[n]);
 await db.query('delete from notifications where id=$1',[n]);await db.query('insert into notifications(id,audience,kind,title,body,href) values($1,$2,$3,$4,$5,$6)',[n,original[0].audience,original[0].kind,original[0].title,original[0].body,original[0].href]);
 assert.equal(await scalar('select count(*) from outbox where dedupe_key like $1',[n+':%']),2);pass('dedupe');
 await db.exec("update connections set mode='simulated';update outbox set status='suppressed';");
 const retry=await scalar("insert into outbox(channel,template,recipient,dedupe_key) values('email','buyer.account_approved','retry@fixture.test','retry') returning id");
 for(let attempt=1;attempt<=5;attempt++){
  const claimed=await service('select * from system_claim_outbox(25)');assert.equal(claimed.length,1);assert.equal(claimed[0].attempts,attempt);assert.equal(claimed[0].status,'sending');
  assert.equal((await service('select * from system_claim_outbox(25)')).length,0,'leased row not reclaimed');
  await service('select system_finish_outbox($1,false,null,null,null,null,null,$2)',[retry,'x'.repeat(600)]);
  const row=(await rows('select *,round(extract(epoch from (next_attempt_at-now()))/60) wait from outbox where id=$1',[retry]))[0];assert.equal(row.status,attempt<5?'queued':'failed');assert.equal(row.last_error.length,500);assert.equal(row.locked_until,null);
  if(attempt<5){assert.equal(Number(row.wait),[1,5,15,60][attempt-1]);await db.query("update outbox set next_attempt_at=now()-interval '1 second' where id=$1",[retry]);}
 }
 await db.query("update outbox set status='sending',locked_until=now()-interval '1 second' where id=$1",[retry]);assert.equal((await service('select * from system_claim_outbox()'))[0].id,retry);
 await service("select system_finish_outbox($1,true,'simulator','sim_fixture','Subject','<p>body</p>','body',null)",[retry]);assert.equal(await scalar('select status from outbox where id=$1',[retry]),'sent');
 await service("select system_finish_outbox($1,false,null,null,null,null,null,'duplicate')",[retry]);assert.equal(await scalar('select status from outbox where id=$1',[retry]),'sent');pass('retry_backoff');
 const send=(email,website='',message='Fixture\nmessage')=>anon('select send_contact_message($1,$2,$3,$4,$5,$6)', ['general-support',' Fixture Sender ',email,'Fixture Org',message,website]);
 const before=await scalar('select count(*) from contact_messages');await send('bad','robot');assert.equal(await scalar('select count(*) from contact_messages'),before);
 for(const args of [['bad','Name','sender@fixture.test',null,'message',''],['general-support','','sender@fixture.test',null,'message',''],['general-support','Name','bad',null,'message',''],['general-support','Name','sender@fixture.test',null,'x'.repeat(5001),'']])await denied('anon',null,'select send_contact_message($1,$2,$3,$4,$5,$6)',args,'22023');
 await send(' Fixture@fixture.test ');await send('fixture@fixture.test');await send('FIXTURE@fixture.test');await denied('anon',null,'select send_contact_message($1,$2,$3,$4,$5,$6)',['general-support','Name','fixture@fixture.test',null,'message',''],'22023');
 const contact=(await rows('select * from contact_messages order by created_at limit 1'))[0];assert.equal(contact.name,'Fixture Sender');const contactOut=(await rows("select * from outbox where template='team.contact' and data->>'message_id'=$1",[contact.id]))[0];assert.equal(contactOut.recipient,'help@truemarkbiolabs.com');
 await auth(staff,"select set_contact_status($1,'handled')",[contact.id]);assert.equal(await scalar('select handled_by from contact_messages where id=$1',[contact.id]),staff);await auth(owner,"select set_contact_status($1,'new')",[contact.id]);assert.equal(await scalar('select handled_at from contact_messages where id=$1',[contact.id]),null);
 await denied('authenticated',buyer,"select set_contact_status($1,'handled')",[contact.id]);await denied('authenticated',staff,"select set_contact_route('general-support','new@fixture.test')");await auth(owner,"select set_contact_route('general-support','new@fixture.test')");
 await db.exec("insert into contact_messages(topic,name,email,message) select 'general-support','Fixture','limit'||n||'@fixture.test','message' from generate_series(1,97) n");
 await denied('anon',null,'select send_contact_message($1,$2,$3,$4,$5,$6)',['general-support','Name','fresh@fixture.test',null,'message',''],'22023');pass('contact_form_rules');
 // Existing first-order is already recorded. All remaining rules reach once.
 for(let i=1;i<26;i++){const id=await order();const num=await scalar('select number from orders where id=$1',[id]);await db.query("insert into referrals(partner_id,order_id,order_number,order_subtotal,commission,via) values($1,$2,$3,1000,120,'link')",[pid,id,num]);}
 assert.equal(await scalar('select count(*) from partner_milestones where partner_id=$1',[pid]),5);
 assert.deepEqual((await rows("select title from notifications where kind='partner.milestone' and title like 'You %' order by at,ctid",[])).map(r=>r.title),['You reached first referred order','You passed $500 earned','You passed $1,000 earned','You reached 10 referred orders','You reached 25 referred orders']);pass('milestones_once');
 // Fixture week derives from UTC, so this proof is independent of today's date.
 const start=await scalar("select (date_trunc('week',now() at time zone 'UTC')-interval '7 days')::date::text");
 await db.query("update referrals set created_at=($1::date-1)::timestamp at time zone 'UTC'",[start]);
 await db.query("update referrals set created_at=($1::date)::timestamp at time zone 'UTC',status='pending',via='code' where id=$2",[start,rid]);
 await db.query("insert into visits(partner_id,date,clicks) values($1,$2,42),($1,$2::date-1,900),($1,$2::date+7,900)",[pid,start]);
 await service('select system_queue_weekly_summaries()');await service('select system_queue_weekly_summaries()');
 const week=await rows("select * from outbox where dedupe_key like 'weekly:%'");assert.equal(week.length,2);for(const r of week){assert.equal(r.data.orders,1);assert.equal(r.data.clicks,42);assert.equal(r.data.earned,120);assert.equal(r.data.viaCode,1);assert.equal(r.data.viaLink,0);assert.equal(r.data.week_start,start);assert.equal(r.dedupe_key,`weekly:${pid}:${start}:${r.channel}`);}pass('weekly_summary');
 for(const t of ['outbox','contact_messages','contact_routes']){
  assert((await auth(owner,`select * from ${t}`)).length>0);assert((await auth(staff,`select * from ${t}`)).length>0);
  for(const u of [buyer,partner,other])assert.equal((await auth(u,`select * from ${t}`)).length,0);
  await denied('anon',null,`select * from ${t}`);await denied('authenticated',owner,`delete from ${t}`);
 }
 assert.equal((await auth(partner,'select * from partner_milestones')).length,5);assert.equal((await auth(other,'select * from partner_milestones')).length,0);
 for(const fn of ['system_claim_outbox(1)',"system_finish_outbox(null,true,null,null,null,null,null,null)",'system_suppress_outbox(null)',"system_sms_opt('+13125550100',true)",'system_queue_weekly_summaries()'])for(const u of [owner,staff,buyer,partner])await denied('authenticated',u,'select '+fn);
 pass('rls_outbox');pass('sql_validated');console.log(JSON.stringify(checks,null,2));
} finally {await db.close();}
