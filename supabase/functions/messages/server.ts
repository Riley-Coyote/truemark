import type { Db } from '../_shared/db.ts';
import { readConnection, reportStatus } from '../_shared/connections.ts';
import { json, message, preflight, route, text } from '../_shared/http.ts';
import { hasFunctionsKey, safeEqual } from '../_shared/signing.ts';
import { renderTemplate } from './templates.ts';
import type { Row, Rendered, TemplateData } from './templates.ts';
export type Deps = {
 db: Db; functionsKey: string; site: string; emailFrom: string; resendKey?: string;
 twilioSid?: string; twilioToken?: string; twilioFrom?: string;
 fetch: typeof fetch; now: () => string; uuid: () => string;
};
export async function twilioSignature(url: string,params: URLSearchParams,secret: string): Promise<string> {
 const input=url+[...params.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+v).join('');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(input)));
 return btoa(String.fromCharCode(...signature));
}
export async function sendResend(deps: Deps,recipient: string,rendered: Rendered): Promise<string> {
 if(!deps.resendKey)throw new Error('Email configuration missing');
 const response=await deps.fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${deps.resendKey}`,'Content-Type':'application/json'},
 body:JSON.stringify({from:deps.emailFrom,to:[recipient],subject:rendered.subject,html:rendered.html,text:rendered.text,...(rendered.reply_to?{reply_to:rendered.reply_to}:{})})});
 if(!response.ok)throw new Error(`Email provider request failed (${response.status})`);
 const data=await response.json() as {id?: unknown};if(typeof data.id!=='string'||!data.id)throw new Error('Email provider returned no message id');return data.id;
}
export async function sendTwilio(deps: Deps,recipient: string,rendered: Rendered): Promise<string> {
 if(!deps.twilioSid||!deps.twilioToken||!deps.twilioFrom)throw new Error('Text message configuration missing');
 const response=await deps.fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(deps.twilioSid)}/Messages.json`,{method:'POST',
 headers:{Authorization:'Basic '+btoa(deps.twilioSid+':'+deps.twilioToken),'Content-Type':'application/x-www-form-urlencoded'},
 body:new URLSearchParams({To:recipient,From:deps.twilioFrom,Body:rendered.text}).toString()});
 if(!response.ok)throw new Error(`Text provider request failed (${response.status})`);
 const data=await response.json() as {sid?: unknown};if(typeof data.sid!=='string'||!data.sid)throw new Error('Text provider returned no message id');return data.sid;
}
export async function fetchTemplateData(deps: Deps,row: Row): Promise<TemplateData> {
 const db=deps.db,data=row.data??{},c: TemplateData={site:deps.site,data,now:deps.now()};
 const one=(table: string,id: unknown)=>id?db.one<Row>(`${table}?id=eq.${encodeURIComponent(String(id))}&select=*&limit=1`):Promise.resolve(null);
 c.order=await one('orders',row.order_id??data.order_id)??undefined;
 if(c.order){const o=c.order;c.buyer=await one('buyers',o.buyer_id)??undefined;c.method=await db.one<Row>(`shipping_methods?id=eq.${encodeURIComponent(o.shipping_method_id)}&select=*&limit=1`)??undefined;
 [c.lines,c.events,c.products,c.lots]=await Promise.all([db.select<Row>(`order_lines?order_id=eq.${o.id}&select=*`),db.select<Row>(`order_events?order_id=eq.${o.id}&select=*&order=at.asc`),db.select<Row>('products?select=*'),db.select<Row>('lots?select=*')]);
 if(o.discount_partner_id)c.partner=await one('partners',o.discount_partner_id)??undefined;}
 if(data.partner_id)c.partner=await one('partners',data.partner_id)??undefined;
 if(c.partner){c.referrals=await db.select<Row>(`referrals?partner_id=eq.${c.partner.id}&select=*&order=created_at.desc`);c.discount=await db.one<Row>(`discounts?partner_id=eq.${c.partner.id}&select=*&limit=1`)??undefined;}
 c.referral=await one('referrals',data.referral_id)??undefined;
 c.payout=await one('payouts',data.payout_id)??undefined;
 c.application=await one(data.kind==='partner_application.submitted'?'partner_applications':'applications',data.application_id)??undefined;
 c.contact=await one('contact_messages',data.message_id)??undefined;
 if(c.contact)c.route=await db.one<Row>(`contact_routes?topic=eq.${encodeURIComponent(c.contact.topic)}&select=*&limit=1`)??undefined;
 return c;
}
export async function flush(deps: Deps): Promise<number> {
 let handled=0;
 while(handled<200){const rows=await deps.db.rpc<Row[]>('system_claim_outbox',{batch:Math.min(25,200-handled)});if(!rows.length)break;
 for(const row of rows){handled++;const channel=row.channel==='sms'?'sms':'email';const connection=await readConnection(deps.db,channel);
 if(connection.mode==='off'){await deps.db.rpc('system_suppress_outbox',{id:row.id});continue;}
 // A STOP or removed consent received after enqueue also prevents delivery.
 if(channel==='sms'){
  const p=await deps.db.one<Row>(`message_preferences?user_id=eq.${row.recipient_user}&select=*&limit=1`);
  if(!p?.phone||p.phone!==row.recipient||!p.sms_consent_at||p.sms_opted_out_at){await deps.db.rpc('system_suppress_outbox',{id:row.id});continue;}
 }
 let rendered: Rendered|undefined,provider=connection.mode==='simulated'?'simulator':connection.provider,id: string|null=null,error: string|null=null;
 try {
  if(connection.mode==='live'&&!(channel==='email'&&provider==='resend'||channel==='sms'&&provider==='twilio'))throw new Error(`No adapter for ${provider}`);
  rendered=renderTemplate(row.template,await fetchTemplateData(deps,row));
  id=connection.mode==='simulated'?'sim_'+deps.uuid():channel==='email'?await sendResend(deps,row.recipient,rendered):await sendTwilio(deps,row.recipient,rendered);
 }catch(failure){
  // Only our own bounded errors are presentable, never arbitrary payloads.
  const known=/^(No adapter for [a-z0-9-]*|(?:Email|Text message) configuration missing|(?:Email|Text) provider (?:request failed \(\d{3}\)|returned no message id)|Unknown message template)$/;
  error=failure instanceof Error&&known.test(failure.message)?failure.message:'The message could not be sent.';
 }
 await deps.db.rpc('system_finish_outbox',{id:row.id,ok:error===null,provider,provider_message_id:id,subject:rendered?.subject??null,body_html:rendered?.html??null,body_text:rendered?.text??null,error});
 await reportStatus(deps.db,channel,error===null,error??undefined);
 }}return handled;
}
export function createHandler(deps: Deps) {
 return async(req: Request): Promise<Response>=>{
 if(req.method==='OPTIONS')return preflight();
 if(req.method!=='POST')return message(405,'Use POST.');
 try {
  const path=route(req,'messages');
  if(path==='/flush'){
   if(!hasFunctionsKey(req,deps.functionsKey))return message(403,'Access refused.');
   return json(200,{handled:await flush(deps)});
  }
  if(path==='/sms/inbound'){
   const params=new URLSearchParams(await text(req,65536));
   if(!deps.twilioToken||!safeEqual(req.headers.get('X-Twilio-Signature')??'',await twilioSignature(req.url,params,deps.twilioToken)))return message(403,'Access refused.');
   const command=(params.get('Body')??'').trim().toUpperCase();
   if(['STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT','START','UNSTOP'].includes(command))await deps.db.rpc('system_sms_opt',{phone:params.get('From')??'',opted_out:!['START','UNSTOP'].includes(command)});
   return new Response('<Response/>',{status:200,headers:{'Content-Type':'text/xml','Cache-Control':'no-store'}});
  }
  return message(404,'Route not found.');
 }catch{return message(500,'The message request could not be completed.');}
 };
}
