/** Node bundle/render proofs. Preview components are read, never changed. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root=resolve(import.meta.dirname,'..'),temp=await mkdtemp('/private/tmp/wp24-copy-');
globalThis.fetch=async()=>{throw new Error('Network forbidden in message copy tests');};
const values=new Map();globalThis.localStorage=globalThis.sessionStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
globalThis.window=Object.assign(new EventTarget(),{setTimeout,clearTimeout,matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})});
globalThis.document={baseURI:'https://fixture.test/'};globalThis.BroadcastChannel=class extends EventTarget{postMessage(){}close(){}};
async function bundle(selected='earned',mode='preview',base=false){
 const outfile=join(temp,`${selected}-${mode}-${base}.mjs`);
 await build({stdin:{resolveDir:root,loader:'tsx',contents:`
 import {createElement as h} from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {MemoryRouter} from 'react-router-dom';
 import {BuyerEmail,buyerEmailsFor} from './src/shop/pages/account/emails';
 import {WhatYouReceive,saleText} from './src/partners/portal/Receive';
 import {NewOrderEmail,newOrderText,NewOrderAlerts} from './src/admin/notify';
 import Connections from './src/admin/Connections';import Inbox from './src/admin/Inbox';import SentMessages from './src/admin/SentMessages';
 import Profile from './src/shop/pages/account/Profile';import {AccountContext} from './src/shop/pages/account/parts';
 import PartnerSettings from './src/partners/portal/Settings';import {PartnerContext} from './src/partners/portal/context';
 import Contact from './src/shop/pages/content/Contact';
 import {OrderDrawer} from './src/admin/OrderDrawer';
 export * as seed from './src/platform/seed';export * as momentum from './src/partners/momentum';export * as metrics from './src/partners/metrics';
 export {DEFAULT_PREFS} from './src/partners/prefs'; export {saleText,newOrderText,buyerEmailsFor};
 export {renderTemplate,date,time} from './supabase/functions/messages/templates';
 export {createAccounts} from './src/platform/live/accounts';
 export {verifyEmailLink} from './src/platform/live/EmailLink';
 export {createMessages} from './src/platform/live/messages';
 const wrap=(e,path='/')=>renderToStaticMarkup(h(MemoryRouter,{initialEntries:[path]},e));
 export const connections=(owner)=>wrap(h(Connections,{owner}));export const inbox=(path)=>wrap(h(Inbox),path);export const sent=()=>wrap(h(SentMessages));export const alerts=()=>wrap(h(NewOrderAlerts));
 export const profile=(buyer)=>wrap(h(AccountContext.Provider,{value:{buyer,signOut(){}}},h(Profile)));
 export const partnerSettings=(partner)=>wrap(h(PartnerContext.Provider,{value:partner},h(PartnerSettings)));
 export const buyer=(props)=>wrap(h(BuyerEmail,props));export const partner=(props)=>wrap(h(WhatYouReceive,props));export const team=(props)=>wrap(h(NewOrderEmail,props));
 export const contact=()=>wrap(h(Contact)); export const drawer=(id)=>wrap(h(OrderDrawer,{id,onClose(){}}));
 `},outfile,bundle:true,format:'esm',platform:'node',jsx:'automatic',loader:{'.css':'empty'},
 banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},
 define:{'import.meta.env':JSON.stringify({VITE_PLATFORM:mode,BASE_URL:'/',PROD:false}),'process.env.NODE_ENV':'"production"'},logLevel:'silent',plugins:[{
 name:'fixture-components',setup(b){
 b.onLoad({filter:/\/src\/platform\/live\/runtime\.ts$/},()=>({loader:'ts',contents:'export const live=()=>globalThis.__live;export function initialize(){}'}));
 b.onLoad({filter:/\/src\/platform\/store\.ts$/},()=>({loader:'ts',contents:`export const store={};export function useResource(){return {data:globalThis.__resources.shift(),loading:false,error:null,reload(){}};}`}));
 b.onLoad({filter:/\/src\/(admin\/notify\.tsx|admin\/OrderDrawer\.tsx|partners\/portal\/Settings\.tsx|partners\/prefs\.ts|shop\/pages\/account\/Profile\.tsx|shop\/pages\/content\/Contact\.tsx)$/},async args=>({loader:args.path.endsWith('tsx')?'tsx':'ts',contents:base?execFileSync('git',['show','e1a9487:'+args.path.slice(root.length+1)],{cwd:root,encoding:'utf8'}):await readFile(args.path,'utf8')}));
 b.onLoad({filter:/\/src\/partners\/portal\/Receive\.tsx$/},async args=>({loader:'tsx',contents:(await readFile(args.path,'utf8')).replace('useState<PreviewId>("earned")',`useState<PreviewId>("${selected}")`)}));
 }}]});return import(pathToFileURL(outfile));
}
const current=await bundle();
const sourceOrder=current.seed.orders.find(o=>o.status==='delivered');assert(sourceOrder);
const buyer=current.seed.buyers.find(b=>b.id===sourceOrder.buyerId),partner=current.seed.partners[0],prefs=current.DEFAULT_PREFS;
const sourceRefs=current.seed.referrals.filter(r=>r.partnerId===partner.id),sourcePays=current.seed.payouts.filter(p=>p.partnerId===partner.id),visits=current.seed.visitsFor(partner.id);
const rawRef=r=>({id:r.id,partner_id:r.partnerId,order_number:r.orderNumber,order_subtotal:r.orderSubtotal,commission:r.commission,created_at:r.createdAt,status:r.status,via:r.via});
const rawPartner={id:partner.id,name:partner.name,email:partner.email,code:partner.code,rate:partner.rate};
const context={site:'https://fixture.test/live/',now:current.metrics.TODAY_ISO,data:{},
 order:{id:sourceOrder.id,number:sourceOrder.number,created_at:sourceOrder.createdAt,total:sourceOrder.total,subtotal:sourceOrder.subtotal,address:sourceOrder.address,shipping_price:sourceOrder.shipping.price,shipping_method_id:sourceOrder.shipping.method,carrier:sourceOrder.shipping.carrier,tracking:sourceOrder.shipping.tracking,insurance:sourceOrder.insurance,insurance_applied:sourceOrder.insuranceApplied,discount_code:sourceOrder.discount?.code,discount_amount:sourceOrder.discount?.amount},buyer,
 lines:sourceOrder.lines.map(l=>({product_id:l.productId,quantity:l.quantity,unit_price:l.unitPrice,lot:l.lot})),products:current.seed.products??[],events:sourceOrder.events,lots:current.seed.lots,
 partner:rawPartner,referrals:sourceRefs.map(rawRef),goal:prefs.goal,
};
// Live date/time typography and delivered CTA are explicit brief changes. Normalize
// those prescribed differences; all other visible words must match exactly.
function decode(s){return s.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-f]+);/gi,v=>({ '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[v]??String.fromCodePoint(v[2]==='x'?parseInt(v.slice(3),16):parseInt(v.slice(2),10))));}
function visible(s){return decode(s.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();}
function canonical(s){return s.replace(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day|sday|nesday|rsday|urday)?\s+(\d+)\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)/g,(_,d,m)=>`${d} ${m.slice(0,3)}`).replace(/(\d+) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) 2026/g,'$1 $2').replace(/\d{2}:\d{2} UTC|\d{1,2}:\d{2} [AP]M ET/g,'[time]').replace('Read your certificates','View your order');}
function parts(preview,rendered){
 const subject=visible(preview.match(/<dd class="tm-email-subject">([\s\S]*?)<\/dd>/)?.[1]??'');
 const preheader=visible(preview.match(/<dd class="tm-email-preheader">([\s\S]*?)<\/dd>/)?.[1]??'');
 const body=preview.slice(preview.indexOf('<div class="tm-email-content">')+'<div class="tm-email-content">'.length,preview.indexOf('<footer class="tm-email-foot">'));
 const footer=preview.match(/<footer class="tm-email-foot">([\s\S]*?)<\/footer>/)?.[1]??'';
 const server=rendered.html.slice(rendered.html.indexOf('<td style="padding:32px">')+'<td style="padding:32px">'.length,rendered.html.indexOf('</td></tr><tr><td style="padding:24px 32px;color:'));
 const serverFooter=rendered.html.match(/<td style="padding:24px 32px;color:[^"]*">([\s\S]*?)<\/td>/)?.[1]??'';
 assert.equal(canonical(subject),canonical(rendered.subject),'subject');assert.equal(canonical(preheader),canonical(rendered.preheader),'preheader');assert.equal(canonical(visible(body+footer)),canonical(visible(server+serverFooter)),'visible copy');
}
function stableReactIds(html){
 // Live-only JSX slots change React's generated ids in preview too. Preserve
 // every id/reference relationship while comparing all other markup verbatim.
 const ids=new Map();
 return html.replace(/_R_[a-z0-9]+_/gi,id=>{if(!ids.has(id))ids.set(id,`react-id-${ids.size}`);return ids.get(id);});
}
test('ported buyer and team email subjects, preheaders and visible copy match the React previews',async()=>{
 // Product fixtures come from the actual source catalog.
 const {products:catalog}=await importCatalog();context.products=catalog;
 const method=current.seed.shippingMethods.find(m=>m.id===sourceOrder.shipping.method);context.method=method;
 for(const kind of ['confirmed','shipped','delivered'])parts(current.buyer({kind,order:sourceOrder,to:buyer,method,lots:current.seed.lots}),current.renderTemplate('buyer.order_'+kind,context));
 const linked=current.seed.partners.find(p=>p.id===sourceOrder.discount?.partnerId);parts(current.team({context:{order:sourceOrder,buyer,partner:linked,method},to:{name:'Fixture',email:'team@fixture.test'}}),current.renderTemplate('team.new_order',{...context,partner:linked?{code:linked.code}:undefined}));
 assert.equal(current.newOrderText({order:sourceOrder,buyer,partner:linked}),current.renderTemplate('team.new_order_sms',{...context,partner:linked?{code:linked.code}:undefined}).text);
});
async function importCatalog(){const outfile=join(temp,'catalog.mjs');await build({entryPoints:[join(root,'src/data.ts')],outfile,bundle:true,format:'esm',platform:'node',logLevel:'silent'});return import(pathToFileURL(outfile));}
test('ported partner emails and sale text match the actual preview component for the same fixture',async()=>{
 const records=current.momentum.latestRecords(sourceRefs,sourcePays),week=current.momentum.lastWeek(sourceRefs,visits);
 for(const [selected,template] of [['earned','partner.new_order'],['approved','partner.commission_approved'],['payout','partner.payout_sent'],['week','partner.weekly']]){
  const module=selected==='earned'?current:await bundle(selected);globalThis.__resources=[sourceRefs,sourcePays,visits];
  const c={...context,referral:rawRef(selected==='approved'?records.approved:records.referral),data:{...week,week_start:new Date(current.metrics.END-7*86400000).toISOString(),week_end:new Date(current.metrics.END-86400000).toISOString()}};
  if(selected==='payout'){const p=records.payout;c.payout={id:p.id,period_start:p.periodStart,period_end:p.periodEnd,paid_at:p.paidAt+'T12:00:00Z',amount:p.amount,method:p.method,referrals:p.referrals};c.referrals=records.payoutLines.map(r=>({...rawRef(r),payout_id:p.id}));}
  parts(module.partner({partner,prefs}),module.renderTemplate(template,c));
 }
 assert.equal(current.saleText(records.referral),current.renderTemplate('partner.new_order_sms',{...context,order:undefined,referral:rawRef(records.referral)}).text);
});
test('preview contact and order drawer render identically to base; live-only branches stay separate',async()=>{
 // The mobile polish (2026-10-05) gave the form a heading on purpose, and the client's mailing address (2026-10-06)
 // joined the directory; everything else matches the base.
 const base=await bundle('earned','preview',true);assert.equal(current.contact().replace('<h2 class="tm-contact-route-title tm-contact-compose-title">Send a message</h2>','').replace(' aria-label="Send a message"','').replace(/<div class="tm-contact-post"[^]*?<\/address><\/div>/,''),base.contact());
 const context=[current.seed.buyers,current.seed.partners,current.seed.shippingMethods,current.seed.lots],program=[current.seed.referrals,current.seed.payouts];
 globalThis.__resources=[sourceOrder,context,program];const before=base.drawer(sourceOrder.id);
 // WP-26 adds a shipment resource before context; WP-24 adds the outbox after program.
 globalThis.__resources=[sourceOrder,null,context,program,[]];assert.equal(stableReactIds(current.drawer(sourceOrder.id)),stableReactIds(before));
});
test('token-hash links need only verifyOtp, and recovery gate comes from the verified account role',async()=>{
 for(const role of ['owner','staff','partner','buyer']){
  const session={user:{id:'fixture-user',email:'fixture@fixture.test'}},calls=[];
  const client={auth:{verifyOtp:async args=>{calls.push(args);return {data:{session},error:null};}}};
  const verified=await current.verifyEmailLink(client,'fixture-one-time-token','recovery');assert.equal(verified,session);assert.deepEqual(calls,[{token_hash:'fixture-one-time-token',type:'recovery'}]);
  let recoveryGate;const accounts=current.createAccounts(client,async()=>[],async()=>null,async()=>({id:session.user.id,role}),()=>{},async()=>{}, {onRecovery:gate=>{recoveryGate=gate;}});
  await accounts.auth.recoverVerifiedSession(verified);assert.equal(recoveryGate,role==='owner'||role==='staff'?'team':role==='partner'?'partner':'shop');assert.equal(accounts.auth.recovery().userId,session.user.id);
 }
 for(const type of ['email','signup']){let request;await current.verifyEmailLink({auth:{verifyOtp:async args=>{request=args;return {data:{session:{user:{id:'fixture'}}},error:null};}}},'fixture-token',type);assert.equal(request.type,type);}
 await assert.rejects(current.verifyEmailLink({auth:{verifyOtp:async()=>({data:{session:null},error:{message:'used'}})}},'fixture-token','email'),/Invalid link/);
 await assert.rejects(current.verifyEmailLink({auth:{}},null,'email'),/Invalid link/);
 for(const [file,type,path] of [['confirm-signup','email','confirm'],['reset-password','recovery','reset']]){const html=await readFile(join(root,'supabase/templates/'+file+'.html'),'utf8');assert(html.includes('{{ .TokenHash }}'));assert(html.includes('#/access/'+path+'?token_hash='));assert(html.includes('type='+type));}
 const component=await readFile(join(root,'src/platform/live/EmailLink.tsx'),'utf8');assert(component.includes('if(started.current)return;started.current=true;'));assert.equal((component.match(/clearEmailToken\(location.pathname, location.search\)/g)??[]).length,2);assert(component.includes('await live().auth.signOut()'));
});
test('messages browser adapter uses only caller RPCs and reads full rows',async()=>{
 const calls=[];const adapter=current.createMessages(async(table,select,filters)=>{calls.push({table,select,filters});return [];},async(name,args)=>{calls.push({name,args});return {alerts:{}};},()=>{});
 await adapter.preferences();await adapter.savePreferences({shipping:{text:true}},'+13125550100',true);await adapter.teamPreferences();await adapter.outbox('fixture-order');await adapter.contacts();await adapter.routes();await adapter.setContactStatus('fixture-contact','handled');await adapter.sendContact({topic:'general-support',name:'Fixture',email:'fixture@fixture.test',organization:'',message:'fixture',website:''});
 assert.deepEqual(calls.find(c=>c.name==='save_message_preferences').args,{alerts:{shipping:{text:true}},phone:'+13125550100',sms_consent:true});assert.deepEqual(calls.find(c=>c.table==='outbox'),{table:'outbox',select:'*',filters:{order_id:'fixture-order'}});assert(!calls.some(c=>c.name?.startsWith('system_')));
});

test('live screen fixtures show specified connection controls, own-only switches, consent, inbox and stored messages',async()=>{
 const ui=await bundle('earned','live'),prefs={phone:'+13125550100',smsConsent:true,smsOptedOut:false,alerts:{newOrder:{email:true,text:false},applications:{email:true}}};
 const connections=['payments','email','sms','shipping'].map(id=>({id,mode:'simulated',provider:'',lastOkAt:null,lastErrorAt:null}));
 globalThis.__resources=[connections];const owner=ui.connections(true);assert.match(owner,/No processor adapter yet/);assert.match(owner,/Sent messages/);assert.match(owner,/Emails are written and kept under Sent messages. None are delivered./);assert.equal((owner.match(/>Live<\/button>/g)??[]).length,4);assert.match(owner,/<button[^>]*disabled=""[^>]*>Live<\/button>/);
 globalThis.__resources=[connections];const staff=ui.connections(false);assert(!staff.includes('provider&#x27;s keys'));assert(!staff.includes('kit-segmented'));
 globalThis.__resources=[[{user_id:'owner',email:'owner@fixture.test',role:'owner',new_order_email:true,new_order_text:false,applications_email:true},{user_id:'staff',email:'staff@fixture.test',role:'staff',new_order_email:false,new_order_text:false,applications_email:false}],{profile:{id:'owner',role:'owner'},prefs}];const alerts=ui.alerts();assert.equal((alerts.match(/role="switch"/g)??[]).length,3);assert.match(alerts,/Each person chooses their own alerts. In-app alerts are always on./);assert.match(alerts,/Text me TrueMark team alerts at this number/);
 globalThis.__resources=[{...prefs,alerts:{shipping:{text:true}}}];const profile=ui.profile(buyer);assert.match(profile,/Text updates/);assert.match(profile,/Order and account emails always go to/);assert.match(profile,/Text me when my orders ship and arrive/);assert.match(profile,/tm-acct-consent-box/);
 const partnerPrefs={...prefs,alerts:Object.fromEntries(['newOrder','approved','payout','milestone','weekly'].map(k=>[k,{email:true,text:false}]))};
 globalThis.__resources=[partnerPrefs,sourceRefs,sourcePays,visits];const portal=ui.partnerSettings(partner);assert.match(portal,/Saved to your account/);assert.match(portal,/Every alert also rises in your portal. The bell keeps them all./);assert.match(portal,/Text me TrueMark partner alerts/);const table=portal.match(/<table class="pp-prefs">[\s\S]*?<\/table>/)[0];assert(!table.includes('Dashboard'));assert.match(table,/>Text<\/th>/);
 const contact={id:'fixture-contact',name:'Fixture Sender',organization:'Fixture Org',email:'sender@fixture.test',topic:'general-support',message:'Line 1\nLine 2',created_at:'2026-10-05T12:00:00Z',status:'new'};
 globalThis.__resources=[[contact],[{topic:'general-support',label:'General support'}]];const inbox=ui.inbox('/admin/inbox?message=fixture-contact');assert.match(inbox,/Reply by email/);assert.match(inbox,/Mark handled/);assert.match(inbox,/mailto:sender@fixture.test\?subject=Re%3A%20General%20support/);assert.match(inbox,/Line 1\nLine 2/);
 const outbox={id:'fixture',template:'buyer.order_confirmed',channel:'email',recipient:'buyer@fixture.test',status:'sent',provider:'simulator',created_at:'2026-10-05T12:00:00Z',subject:'Fixture subject',body_html:'<p>Fixture stored email</p>'};
 globalThis.__resources=[[outbox]];const sent=ui.sent();assert.match(sent,/Fixture subject/);assert.match(sent,/Simulated/);assert.match(sent,/>Not sent<\/button>/);
 globalThis.__resources=[sourceOrder,null,[current.seed.buyers,current.seed.partners,current.seed.shippingMethods,current.seed.lots],[current.seed.referrals,current.seed.payouts],[{...outbox,created_at:sourceOrder.createdAt}],[],{id:'owner',role:'owner'}];const drawer=ui.drawer(sourceOrder.id);assert.match(drawer,/Customer notified/);assert.match(drawer,/Simulated/);assert(!drawer.includes('Emails are previews.'));
 const contactHtml=ui.contact();assert.match(contactHtml,/name="website"/);assert.match(contactHtml,/aria-hidden="true" tabindex="-1" autocomplete="off"/i);assert.match(contactHtml,/clip-path:inset\(50%\)/);
 const stored=await readFile(join(root,'src/admin/SentMessages.tsx'),'utf8');assert.match(stored,/sandbox="" srcDoc={html}/);
});
