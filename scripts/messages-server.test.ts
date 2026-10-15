import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { createHandler, flush, sendResend, sendTwilio, twilioSignature } from '../supabase/functions/messages/server.ts';
import type { Deps } from '../supabase/functions/messages/server.ts';
import type { Db } from '../supabase/functions/_shared/db.ts';
import { renderTemplate, date, time } from '../supabase/functions/messages/templates.ts';
import type { Row } from '../supabase/functions/messages/templates.ts';
import { site, now, order, partner, referral, fixture, emailTemplates, smsTemplates } from './fixtures/messages.ts';
globalThis.fetch=async()=>{throw new Error('Network forbidden in messages server tests');};
function harness(rows: Row[],mode='simulated',provider='',fetcher: typeof fetch=globalThis.fetch){
 const calls: {name:string;args: Record<string,unknown>}[]=[],queue=[...rows];
 const db: Db={
  async one<T>(path: string){const table=path.split('?')[0];const values: Record<string,Row>={connections:{mode,provider},message_preferences:{phone:'+13125550100',sms_consent_at:now,sms_opted_out_at:null},orders:order,buyers:fixture.buyer!,shipping_methods:fixture.method!,partners:partner,referrals:referral,payouts:fixture.payout!,applications:fixture.application!,contact_messages:fixture.contact!,contact_routes:fixture.route!,discounts:fixture.discount!};return (values[table]??null) as T|null;},
  async select<T>(path: string){const values: Record<string,Row[]>= {order_lines:fixture.lines!,order_events:fixture.events!,products:fixture.products!,lots:fixture.lots!,referrals:fixture.referrals!};return (values[path.split('?')[0]]??[]) as T[];},
  async rpc<T>(name: string,args: Record<string,unknown>={}){calls.push({name,args});if(name==='system_claim_outbox')return queue.splice(0,Number(args.batch)) as T;return undefined as T;}
 };
 const deps: Deps={db,functionsKey:'fixture-functions-key-'.repeat(3),site,emailFrom:'TrueMark BioLabs <orders@truemarkbiolabs.com>',resendKey:'fixture-resend-key',twilioSid:'fixture-sid',twilioToken:'fixture-token',twilioFrom:'+13125550999',fetch:fetcher,now:()=>now,uuid:()=> 'fixture-uuid'};
 return {deps,calls};
}
const row=(template: string,channel='email')=>({id:template,template,channel,order_id:order.id,recipient_user:'user-fixture',recipient:channel==='sms'?'+13125550100':'recipient@fixture.test',data:{...fixture.data,partner_id:partner.id,referral_id:referral.id,payout_id:fixture.payout!.id,message_id:'contact-fixture',application_id:'application-fixture'}});
test('every template renders the specified subjects, copy and routes from fixtures',()=>{
 for(const template of emailTemplates){const r=renderTemplate(template,fixture);assert(r.subject);assert(r.html?.includes('width="600"'));assert(r.html?.includes('width="164" height="40"'));assert(r.text.includes('For research use only. Not for human consumption.'));assert(!r.html?.includes('<style'));}
 for(const template of smsTemplates){const r=renderTemplate(template,fixture);assert(r.text.startsWith('TrueMark:'));assert.equal(r.html,undefined);}
 assert.equal(renderTemplate('buyer.order_confirmed',fixture).subject,'Order confirmed · TM-10500');
 assert.equal(renderTemplate('buyer.order_confirmed',fixture).preheader,"We'll write again when it ships.");
 assert.match(renderTemplate('buyer.order_shipped',fixture).html!,/https:\/\/www.ups.com\/track\?tracknum=FIXTURE_TRACK/);
 assert.match(renderTemplate('buyer.order_shipped',{...fixture,order:{...order,carrier:'FedEx'}}).html!,/fedex.com\/fedextrack/);
 assert.match(renderTemplate('buyer.order_shipped',{...fixture,order:{...order,carrier:'Other'}}).text,/Other/);
 assert.match(renderTemplate('buyer.order_confirmed',{...fixture,order:{...order,tax:8}}).text,/Insurance\n\n\$2.00\n\nTax\n\n\$8.00/);
 assert(!renderTemplate('buyer.order_confirmed',fixture).text.includes('Tax'));
 assert.match(renderTemplate('buyer.order_delivered',fixture).text,/Certificate published/);
 assert.match(renderTemplate('buyer.order_cancelled',fixture).text,/We've refunded \$12.00/);
 assert.match(renderTemplate('buyer.order_cancelled',{...fixture,data:{amount:0}}).text,/No payment was taken/);
 assert.equal(renderTemplate('buyer.order_cancelled',{...fixture,data:{amount:0}}).preheader,'Nothing was charged.');
 // A manual refund carries no amount on its notification; the order's total stands in.
 const manual=renderTemplate('buyer.order_cancelled',{...fixture,order:{...order,payment:'refunded',refunded:0},data:{amount:null}}) as { text: string };
 assert.match(manual.text,/We've refunded \$[0-9,]+\.[0-9]{2} to the card you paid with/);
 assert.throws(()=>renderTemplate('buyer.order_refunded',{...fixture,data:{amount:null}}),/Message data missing/);
 assert.match(renderTemplate('buyer.order_refunded',fixture).text,/We've refunded \$12.00 to the card you paid with for order TM-10500/);
 assert.equal(renderTemplate('buyer.payment_failed',fixture).preheader,'Complete payment to keep your order.');
 assert.equal(renderTemplate('buyer.payment_failed',{...fixture,order:{...order,payment_expires_at:now}}).preheader,'Complete payment by 2:35 PM ET to keep your order.');
 assert.match(renderTemplate('buyer.account_approved',fixture).text,/You can now order from the TrueMark catalog. Sign in with the email and password you chose./);
 assert.match(renderTemplate('buyer.account_declined',fixture).text,/If you'd like us to take another look, write to accounts@truemarkbiolabs.com./);
 assert.equal(renderTemplate('partner.welcome',fixture).subject,'Welcome to the TrueMark partner program');assert.match(renderTemplate('partner.welcome',fixture).text,/Buyers save 10% with it, and you earn 12%/);
 assert.equal(renderTemplate('partner.milestone',fixture).subject,fixture.data.title);
 assert.equal(renderTemplate('partner.weekly_sms',fixture).text,'TrueMark: Your week: 1 order, $12.00 earned, 1 click. Reply STOP to opt out.');
 assert.equal(renderTemplate('buyer.order_shipped_sms',fixture).text,'TrueMark: Order TM-10500 has shipped. UPS FIXTURE_TRACK. Track it: https://fixture.test/live/#/track/TM-10500 Reply STOP to opt out.');
 assert.equal(renderTemplate('buyer.order_delivered_sms',fixture).text,'TrueMark: Order TM-10500 was delivered. Certificates for your lots are in your account. Reply STOP to opt out.');
 assert.equal(renderTemplate('partner.commission_approved_sms',fixture).text,'TrueMark: Commission approved: $12.00 on order TM-10500. Paid with your next payout. Reply STOP to opt out.');
 assert.equal(renderTemplate('partner.payout_sent_sms',fixture).text,'TrueMark: Payout sent: $12.00. Details in your partner portal. Reply STOP to opt out.');
 assert.equal(renderTemplate('partner.milestone_sms',fixture).text,'TrueMark: You reached first referred order. Thank you! Reply STOP to opt out.');
 assert.match(renderTemplate('team.application',fixture).text,/Research area\n\nAnalytical methods/);
 assert.equal(renderTemplate('team.application',{...fixture,data:{kind:'partner_application.submitted'}}).subject,'New partner application · Fixture Applicant');
 const contact=renderTemplate('team.contact',fixture);assert.equal(contact.reply_to,'sender@fixture.test');assert(contact.html?.includes('First line<br>Second line'));
 assert.equal(renderTemplate('team.system_alert',fixture).subject,'Needs attention: You reached first referred order');
 assert.equal(date(now),'Monday 5 October');assert.equal(time(now),'2:35 PM ET');
});
test('every database or person value is escaped in HTML and plain in text',()=>{
 const attack='<script>alert("fixture")</script>&';
 for(const template of emailTemplates){const c={...fixture,data:{...fixture.data,title:attack,body:attack},order:{...order,number:attack,address:{...order.address,institution:attack}},application:{...fixture.application,name:attack,institution:attack},contact:{...fixture.contact,name:attack,message:attack},partner:{...partner,code:attack},referral:{...referral,order_number:attack}};const r=renderTemplate(template,c);assert(!r.html!.includes('<script>'),template);}
 const contact=renderTemplate('team.contact',{...fixture,contact:{...fixture.contact,name:attack}});assert(contact.html!.includes('&lt;script&gt;'));assert(contact.text.includes(attack));
});
test('simulated flush stores rendered bodies without a provider fetch',async()=>{
 const {deps,calls}=harness([row('buyer.order_confirmed'),row('partner.new_order_sms','sms')]);assert.equal(await flush(deps),2);
 const finish=calls.filter(c=>c.name==='system_finish_outbox');assert.equal(finish.length,2);assert(finish.every(c=>c.args.ok&&c.args.provider==='simulator'&&c.args.provider_message_id==='sim_fixture-uuid'));assert(finish[0].args.body_html);assert(finish[0].args.subject);assert.match(String(finish[1].args.body_text),/New order TM-10500/);assert.equal(calls.filter(c=>c.name==='system_connection_status').length,2);
});
test('flush stops at 200 rows and claims one message at a time',async()=>{
 const {deps,calls}=harness(Array.from({length:205},()=>row('buyer.account_approved')));assert.equal(await flush(deps),200);assert.equal(calls.filter(c=>c.name==='system_finish_outbox').length,200);
 assert(calls.filter(c=>c.name==='system_claim_outbox').every(c=>c.args.batch===1),'no row waits for earlier sends while its lease runs down');
});
test('a slow render cannot send or finish a row whose lease is about to expire',async()=>{
 const {deps,calls}=harness([{...row('buyer.order_confirmed'),locked_until:'2026-10-05T18:35:30Z'}],'live','resend');
 assert.equal(await flush(deps),0);
 assert(!calls.some(c=>c.name==='system_finish_outbox'),'leave the lease to recover without overwriting another worker');
});
test('message links normalize the deployment root and refuse unsafe configuration before sending',async()=>{
 for(const root of ['https://truemarkbiolabs.com','https://fixture.test/launch','http://127.0.0.1:5285']){
  const rendered=renderTemplate('buyer.order_confirmed',{...fixture,site:root});
  assert(rendered.text.includes(root+'/#/account/orders/'+order.id));
  assert(rendered.html?.includes(root+'/images/brand/email/lockup-black@2x.png'));
 }
 for(const root of ['', 'invalid', 'javascript:alert(1)', 'http://truemarkbiolabs.com', 'https://user:private@fixture.test', 'https://fixture.test/?private=1', 'https://fixture.test/#/access']){
  const {deps,calls}=harness([row('buyer.order_confirmed')],'live','resend');deps.site=root;
  await flush(deps);
  assert.equal(calls.find(c=>c.name==='system_finish_outbox')?.args.error,'Message site configuration missing or invalid');
 }
});
test('live adapters emit the exact Resend and Twilio shapes',async()=>{
 const requests: {url:string;init:RequestInit}[]=[];const fetcher=(async(url: RequestInfo|URL,init?:RequestInit)=>{requests.push({url:String(url),init:init!});return new Response(JSON.stringify(String(url).includes('resend')?{id:'fixture_resend'}:{sid:'fixture_twilio'}));}) as typeof fetch;
 const email=harness([row('team.contact')],'live','resend',fetcher);await flush(email.deps);
 assert.equal(requests[0].url,'https://api.resend.com/emails');assert.equal(requests[0].init.method,'POST');assert.equal((requests[0].init.headers as Row).Authorization,'Bearer fixture-resend-key');
 assert(requests[0].init.signal instanceof AbortSignal);
 const payload=JSON.parse(String(requests[0].init.body));assert.deepEqual(payload.to,['recipient@fixture.test']);assert.equal(payload.from,email.deps.emailFrom);assert.equal(payload.reply_to,'sender@fixture.test');assert(payload.subject&&payload.html&&payload.text);
 const sms=harness([row('partner.new_order_sms','sms')],'live','twilio',fetcher);await flush(sms.deps);
 assert.equal(requests[1].url,'https://api.twilio.com/2010-04-01/Accounts/fixture-sid/Messages.json');assert.equal((requests[1].init.headers as Row).Authorization,'Basic '+btoa('fixture-sid:fixture-token'));const form=new URLSearchParams(String(requests[1].init.body));assert.equal(form.get('To'),'+13125550100');assert.equal(form.get('From'),'+13125550999');assert.match(form.get('Body')!,/New order TM-10500/);
 assert(requests[1].init.signal instanceof AbortSignal);
 assert(email.calls.some(c=>c.name==='system_finish_outbox'&&c.args.provider_message_id==='fixture_resend'));assert(sms.calls.some(c=>c.name==='system_finish_outbox'&&c.args.provider_message_id==='fixture_twilio'));
});
test('unknown provider fails precisely, off suppresses, revoked SMS consent suppresses',async()=>{
 const unknown=harness([row('buyer.order_confirmed')],'live','fixture-unknown');await flush(unknown.deps);assert.equal(unknown.calls.find(c=>c.name==='system_finish_outbox')!.args.error,'No adapter for fixture-unknown');
 const off=harness([row('buyer.order_confirmed')],'off');await flush(off.deps);assert(off.calls.some(c=>c.name==='system_suppress_outbox'));assert(!off.calls.some(c=>c.name==='system_finish_outbox'));
 const stop=harness([row('partner.new_order_sms','sms')]);const original=stop.deps.db.one;stop.deps.db.one=async<T>(path: string)=>path.startsWith('message_preferences')?{phone:'+13125550100',sms_consent_at:now,sms_opted_out_at:now} as T:original<T>(path);await flush(stop.deps);assert(stop.calls.some(c=>c.name==='system_suppress_outbox'));
});
test('provider error payloads never enter the outbox or responses',async()=>{
 const bad=(async()=>new Response('private payload',{status:503})) as typeof fetch;
 const {deps,calls}=harness([row('buyer.order_confirmed')],'live','resend',bad);await flush(deps);assert.equal(calls.find(c=>c.name==='system_finish_outbox')!.args.error,'Email provider request failed (503)');
 const malformed=harness([row('buyer.order_confirmed')],'live','resend',async()=>new Response('private payload'));await flush(malformed.deps);assert.equal(malformed.calls.find(c=>c.name==='system_finish_outbox')!.args.error,'The message could not be sent.');
 await assert.rejects(sendResend({...deps,resendKey:''},'fixture', {text:''}),/configuration missing/);await assert.rejects(sendTwilio({...deps,twilioSid:''},'fixture',{text:''}),/configuration missing/);
});
test('Twilio signatures match independent HMAC, refuse tampering, and STOP/START write only via RPC',async()=>{
 const {deps,calls}=harness([]),handler=createHandler(deps),url='https://fixture.test/functions/v1/messages/sms/inbound?fixture=1';
 for(const command of ['STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT','START','UNSTOP','Hello']){
  const params=new URLSearchParams({From:'+13125550100',Body:' '+command.toLowerCase()+' ',To:'+13125550999'});
  const signature=createHmac('sha1','fixture-token').update(url+'Body'+params.get('Body')+'From'+params.get('From')+'To'+params.get('To')).digest('base64');assert.equal(await twilioSignature(url,params,'fixture-token'),signature);
  const req=(sig: string,body=params.toString())=>new Request(url,{method:'POST',headers:{'X-Twilio-Signature':sig,'Content-Type':'application/x-www-form-urlencoded'},body});
  assert.equal((await handler(req('bad'))).status,403);assert.equal((await handler(req(signature,params.toString()+'&extra=changed'))).status,403);
  const before=calls.length,res=await handler(req(signature));assert.equal(res.status,200);assert.equal(await res.text(),'<Response/>');assert.equal(res.headers.get('Content-Type'),'text/xml');
  if(command==='Hello')assert.equal(calls.length,before);else assert.deepEqual(calls.at(-1),{name:'system_sms_opt',args:{phone:'+13125550100',opted_out:!['START','UNSTOP'].includes(command)}});
 }
 assert.equal((await handler(new Request(url,{method:'OPTIONS'}))).status,204);
 assert.equal((await handler(new Request('https://fixture.test/messages/flush',{method:'POST'}))).status,403);
 assert.equal((await handler(new Request('https://fixture.test/messages/flush',{method:'POST',headers:{'x-functions-key':deps.functionsKey}}))).status,200);
});

test('local SQL notification runs through the real claim/render/finish plumbing without a network',async()=>{
 const {createPlatformDb}=await import('./lib/platform-db.mjs');
 const h=await createPlatformDb();
 try {
  const uid=await h.person('plumbing@fixture.test'),bid=await h.scalar("insert into buyers(user_id,name,email,institution,status) values($1,'<script>Fixture</script>','plumbing@fixture.test','Fixture Lab','verified') returning id",[uid]);
  const method=await h.scalar('select id from shipping_methods limit 1'),oid=await h.scalar("insert into orders(buyer_id,address,shipping_method_id,shipping_price,subtotal,total) values($1,'{\"institution\":\"Fixture Lab\",\"city\":\"Chicago\",\"region\":\"IL\"}',$2,24,100,124) returning id",[bid,method]);
  const number=await h.scalar('select number from orders where id=$1',[oid]);
  await h.db.query("insert into notifications(audience,kind,title,body,href) values($1,'order.placed',$2,'Fixture',$3)",['buyer:'+bid,'Order '+number,'/account/orders/'+oid]);
  const select=async<T>(path: string)=>{
   const [table,query='']=path.split('?');assert(/^[a-z_]+$/.test(table));const params=new URLSearchParams(query),values: string[]=[],where: string[]=[];
   for(const [key,value] of params){if(value.startsWith('eq.')){assert(/^[a-z_]+$/.test(key));values.push(value.slice(3));where.push(`${key}=$${values.length}`);}}
   const order=params.get('order');assert(!order||order==='at.asc'||order==='created_at.desc');
   const sql=`select * from public.${table}${where.length?' where '+where.join(' and '):''}${order?' order by '+order.replace('.', ' '):''}${params.has('limit')?' limit 1':''}`;
   return JSON.parse(JSON.stringify(await h.service(sql,values))) as T[];
  };
  const db: Db={select,async one<T>(path: string){return (await select<T>(path))[0]??null;},async rpc<T>(name: string,args: Record<string,unknown>={}){
   const keys: Record<string,string[]>={system_claim_outbox:['batch'],system_finish_outbox:['id','ok','provider','provider_message_id','subject','body_html','body_text','error'],system_suppress_outbox:['id'],system_connection_status:['connection','ok','error']};assert(keys[name]);
   const values=keys[name].map(k=>args[k]??null),found=await h.service(`select * from public.${name}(${values.map((_,i)=>'$'+(i+1)).join(',')})`,values);
   return (name==='system_claim_outbox'?found:undefined) as T;
  }};
  const {deps}=harness([]);deps.db=db;assert.equal(await flush(deps),1);assert.equal(await flush(deps),0,'second flush changes nothing');
  const sent=(await h.rows('select * from outbox'))[0];assert.equal(sent.status,'sent');assert.equal(sent.attempts,1);assert.equal(sent.provider,'simulator');assert.equal(sent.provider_message_id,'sim_fixture-uuid');assert.equal(sent.subject,'Order confirmed · '+number);assert.match(sent.body_html,/Your order is confirmed/);assert.match(sent.body_text,/View your order/);assert.equal(await h.scalar("select last_ok_at is not null from connections where id='email'"),true);
 }finally{await h.db.close();}
});
