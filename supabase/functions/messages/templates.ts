/** Provider-independent, escaped email and text templates. No runtime or network. */
export type Row = Record<string, any>;
export type TemplateData = {
 site: string; data: Row; order?: Row; buyer?: Row; partner?: Row; referral?: Row; payout?: Row;
 application?: Row; contact?: Row; route?: Row; method?: Row; lines?: Row[]; products?: Row[];
 events?: Row[]; lots?: Row[]; referrals?: Row[]; discount?: Row; now: string;
 /** Only supplied when an account-backed goal is available. */
 goal?: number;
};
export type Rendered = { text: string; subject?: string; preheader?: string; html?: string; reply_to?: string };
export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
export const money = (n: unknown) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n ?? 0));
export const date = (iso: string) => {
 const d=new Date(iso); return `${new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'UTC'}).format(d)} ${d.getUTCDate()} ${new Intl.DateTimeFormat('en-US',{month:'long',timeZone:'UTC'}).format(d)}`;
};
export const time = (iso: string) => new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}).format(new Date(iso))+' ET';
const plural=(n: number,s: string)=>`${new Intl.NumberFormat('en-US').format(n)} ${s}${n===1?'':'s'}`;
const pct=(n: unknown)=>String(Number(n ?? 0));
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const day=(iso: string)=>{const d=new Date(iso);return `${d.getUTCDate()} ${months[d.getUTCMonth()].slice(0,3)}`;};
const period=(p: Row)=>{const a=new Date(p.period_start);return `${months[a.getUTCMonth()]} ${a.getUTCFullYear()}`;};
const cold=['When applicable, vials ship in insulated packs sized to the transit time, with gel packs rated for the route.','Orders ship with signature on delivery.'];
const disclose='Disclose your partnership in every post.';
const why=(event: string)=>`You’re a TrueMark partner. You receive this because ${event} are on in your alert preferences.`;
const orderFooter='You receive this because you placed an order with your TrueMark research account.';
const accountFooter='You receive this because you applied for a TrueMark research account.';
const legal='For research use only. Not for human consumption.';
const e=escapeHtml;
export function frame(site: string,preheader: string,content: string,footer: string): string {
 return `<!doctype html><html><body style="margin:0;background:#F4F5F8;font-family:Helvetica,Arial,sans-serif;color:#241A4A"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${e(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border-radius:12px"><tr><td style="padding:24px 32px;border-bottom:1px solid #E6E3EC"><img src="${e(site)}images/brand/email/lockup-black@2x.png" width="164" height="40" alt="TrueMark BioLabs"></td></tr><tr><td style="padding:32px">${content}</td></tr><tr><td style="padding:24px 32px;color:#706A80;font-size:12px;line-height:1.6">${e(footer)}<br>${legal}<br>TrueMark BioLabs</td></tr></table></td></tr></table></body></html>`;
}
export function renderTemplate(template: string,c: TemplateData): Rendered {
 if ((/^(buyer\.order_|buyer\.payment_failed|team\.new_order)/.test(template) && !c.order)
   || (/^partner\.(new_order|commission_approved)/.test(template) && !c.referral)
   || (/^partner\.payout_sent/.test(template) && !c.payout)
   || (template === 'partner.welcome' && !c.partner)
   || (template === 'team.application' && !c.application)
   || (template === 'team.contact' && (!c.contact || !c.route))) throw new Error('Message data missing');
 const o=c.order??{},p=c.partner??{},r=c.referral??{},pay=c.payout??{};
 // Manual (legacy) refunds write no amount on the notification; the order itself
 // says what went back: its recorded refunds, or its whole total when refunded by hand.
 const refundedByOrder=Number(o.refunded??0)>0?Number(o.refunded):['refunded','partially_refunded'].includes(o.payment)?Number(o.total):null;
 const d=c.data.amount==null&&(template==='buyer.order_refunded'||template==='buyer.order_cancelled')&&refundedByOrder!=null?{...c.data,amount:refundedByOrder}:c.data;
 if (d.amount == null && template === 'buyer.order_refunded') throw new Error('Message data missing');
 const site=c.site, number=(template.startsWith('partner.')?r.order_number:o.number)??o.number??r.order_number??'', id=o.id??d.order_id??'';
 const link=(route: string)=>site+'#'+route;
 const institution=c.buyer?.institution??o.address?.institution??'';
 const vials=(c.lines??[]).reduce((n,l)=>n+Number(l.quantity),0);
 const productName=(line: Row)=>{const product=c.products?.find(p=>p.id===line.product_id);return product?`${product.name} ${product.size}`:line.product_id;};
 const lineRows=(c.lines??[]).map(l=>[`${productName(l)} × ${l.quantity}`,money(Number(l.unit_price)*Number(l.quantity))]);
 const via=c.partner?.code?` · via ${c.partner.code}`:'';
 if(template.endsWith('_sms')) {
  let text: string;
  switch(template) {
   case 'buyer.order_shipped_sms':text=`TrueMark: Order ${number} has shipped. ${o.carrier??''} ${o.tracking??''}. Track it: ${link('/track/'+number)} Reply STOP to opt out.`;break;
   case 'buyer.order_delivered_sms':text=`TrueMark: Order ${number} was delivered. Certificates for your lots are in your account. Reply STOP to opt out.`;break;
   case 'partner.new_order_sms':text=`TrueMark: New order ${number} through your ${r.via}. You earned ${money(r.commission)}, pending until delivered. Details in your partner portal. Reply STOP to opt out.`;break;
   case 'partner.commission_approved_sms':text=`TrueMark: Commission approved: ${money(d.amount??r.commission)} on order ${number}. Paid with your next payout. Reply STOP to opt out.`;break;
   case 'partner.payout_sent_sms':text=`TrueMark: Payout sent: ${money(d.amount??pay.amount)}. Details in your partner portal. Reply STOP to opt out.`;break;
   case 'partner.milestone_sms':text=`TrueMark: ${d.title}. Thank you! Reply STOP to opt out.`;break;
   case 'partner.weekly_sms':text=`TrueMark: Your week: ${plural(Number(d.orders),'order')}, ${money(d.earned)} earned, ${plural(Number(d.clicks),'click')}. Reply STOP to opt out.`;break;
   case 'team.new_order_sms':text=`TrueMark: new order ${number} · ${money(o.total)} · ${institution}${via}`;break;
   default:throw new Error('Unknown message template');
  }
  return {text};
 }
 let subject='',preheader='',footer=template.startsWith('buyer.account')?accountFooter:orderFooter,html='',parts: string[]=[];
 const add=(tag: string,value: string,style: string)=>{html+=`<${tag} style="${style}">${e(value).replace(/\n/g,'<br>')}</${tag}>`;parts.push(value);};
 const heading=(s: string)=>add('h2',s,'font-size:28px;font-weight:400;line-height:1.15;margin:0 0 24px');
 const text=(s: string)=>add('p',s,'font-size:16px;line-height:1.6;margin:0 0 24px');
 const note=(s: string)=>add('p',s,'font-size:12px;line-height:1.55;color:#706A80;margin:24px 0 0');
 const figure=(label: string,value: string,caption?: string)=>{
  html+=`<div style="padding:20px;background:#F4F5F8;border-radius:8px;margin-bottom:24px"><p style="font-size:11px;letter-spacing:1.4px;margin:0">${e(label)}</p><p style="font-size:40px;margin:8px 0">${e(value)}</p>${caption?`<p style="font-size:14px;margin:0">${e(caption)}</p>`:''}</div>`;parts.push(label,value,...(caption?[caption]:[]));
 };
 const rows=(values: string[][],tracking?: string)=>{
  html+='<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;border-top:1px solid #E6E3EC">';
  for(const [label,value] of values){let v=e(value).replace(/\n/g,'<br>');if(label==='Tracking number'&&tracking)v=`<a href="${e(tracking)}" style="color:#241A4A">${v}</a>`;
  html+=`<tr><td style="padding:12px 0;border-bottom:1px solid #E6E3EC;color:#706A80">${e(label)}</td><td align="right" style="padding:12px 0;border-bottom:1px solid #E6E3EC">${v}</td></tr>`;parts.push(label,value);}
  html+='</table>';
 };
 const button=(label: string,url: string)=>{html+=`<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#241A4A" style="border-radius:24px"><a href="${e(url)}" style="display:inline-block;padding:14px 24px;color:#fff;text-decoration:none;font-size:14px">${e(label)}</a></td></tr></table>`;parts.push(label,url);};
 const event=(s: string)=>c.events?.find(e=>e.status===s)?.at;
 switch(template) {
 case 'buyer.order_confirmed':
  subject=`Order confirmed · ${number}`;preheader="We'll write again when it ships.";
  heading('Your order is confirmed.');text(`Order ${number} is on file in your research account, with the lot number of every vial.`);
  figure('Order total',money(o.total),`${plural(vials,'vial')} · ${c.method?.label??'Cold chain'}`);
  rows([...lineRows,...(o.discount_code?[[`Code ${o.discount_code}`,`−${money(o.discount_amount)}`]]:[]),['Shipping',money(o.shipping_price)],
  ...(o.insurance_applied||Number(o.insurance)>0?[['Insurance',money(o.insurance)]]:[]),...(Number(o.tax)>0?[['Tax',money(o.tax)]]:[]),['Total',money(o.total)]]);
  text('We’ll write again when it ships.');button('View your order',link('/account/orders/'+id));break;
 case 'buyer.order_shipped': {
  const shipped=event('shipped');let estimate='';
  if(shipped){const day=new Date(shipped);let n=o.shipping_method_id==='cold-overnight'?1:2;while(n){day.setUTCDate(day.getUTCDate()+1);if(day.getUTCDay()!==0&&day.getUTCDay()!==6)n--;}estimate=date(day.toISOString());}
  subject=`Your order has shipped · ${number}`;preheader=[o.carrier,o.tracking,estimate&&`Estimated ${estimate}`].filter(Boolean).join(' · ');
  heading('Your order has shipped.');if(estimate)figure('Estimated delivery',estimate,`${c.method?.label??'Cold chain'}. Delivery times are estimates and are not guaranteed.`);
  const tracking=o.carrier==='UPS'?`https://www.ups.com/track?tracknum=${encodeURIComponent(o.tracking??'')}`:o.carrier==='FedEx'?`https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(o.tracking??'')}`:undefined;
  rows([['Carrier',o.carrier??'—'],['Tracking number',o.tracking??'—'],['Order',number],['Ship to',`${o.address?.institution}, ${o.address?.city}, ${o.address?.region}`]],tracking);
  text(cold[0]);button('Track your order',link('/track/'+number));note(cold[1]);break;
 }
 case 'buyer.order_delivered': {
  const delivered=event('delivered');const day=delivered?date(delivered):'';
  subject=`Delivered — certificates for your lots · ${number}`;preheader=`Delivered ${day}. The certificate for each lot you receive is kept in your account.`;
  heading('Your order was delivered.');figure('Delivered',day,`Order ${number} · ${plural(vials,'vial')}`);
  text('Move vials to −20 °C promptly, check seals, and verify each lot number against its CoA.');text('Certificates for your lots:');
  rows((c.lines??[]).map(l=>[productName(l),`${l.lot}\n${c.lots?(['released','archived'].includes(c.lots.find(x=>x.lot===l.lot)?.status)?'Certificate published':'Certificate pending'):'On record'}`]));
  button('View your order',link('/account/orders/'+id));note('The certificate for each lot you receive is kept in your account.');break;
 }
 case 'buyer.order_cancelled': {
  const refund=Number(d.amount??0);
  subject=`Order cancelled · ${number}`;preheader=refund>0?`A refund of ${money(refund)} is on its way.`:'Nothing was charged.';
  heading('Your order is cancelled.');text(refund>0?`Order ${number} won't ship. We've refunded ${money(refund)} to the card you paid with. It appears once your bank processes it.`:`Order ${number} won't ship. No payment was taken.`);
  button('Shop again',link('/products'));break;
 }
 case 'buyer.order_refunded':subject=`Refund issued · ${number}`;preheader=`A refund of ${money(d.amount)} is on its way.`;heading('Your refund is on its way.');figure('Refunded',money(d.amount));text(`We've refunded ${money(d.amount)} to the card you paid with for order ${number}. It appears once your bank processes it.`);button('View your order',link('/account/orders/'+id));break;
 case 'buyer.payment_failed': {
  const expiry=o.payment_expires_at?time(o.payment_expires_at):null;
  subject=`Payment didn't go through · ${number}`;preheader=expiry?`Complete payment by ${expiry} to keep your order.`:'Complete payment to keep your order.';
  heading("Your payment didn't go through.");text(expiry?`We're holding order ${number} until ${expiry}. Complete payment before then to keep it.`:`Complete payment to keep order ${number}.`);button('Complete payment',link('/checkout/pay/'+id));break;
 }
 case 'buyer.account_approved':subject='Your research account is approved';heading('Your research account is approved.');text('You can now order from the TrueMark catalog. Sign in with the email and password you chose.');button('Sign in',link('/access'));break;
 case 'buyer.account_declined':subject='About your research account application';heading("We couldn't approve your application.");text("Thank you for applying. We weren't able to approve a research account from the information we received. If you'd like us to take another look, write to accounts@truemarkbiolabs.com.");break;
 case 'partner.new_order':
  subject=`You earned ${money(r.commission)} on order ${number}`;preheader=`An order came through your ${r.via}. Pending until 14 days after delivery.`;footer=why('new-order emails');
  heading(`An order came through your ${r.via}.`);figure('You earned',money(r.commission),`${pct(Number(p.rate)*100)}% of the ${money(r.order_subtotal)} order subtotal, after your audience’s discount`);
  rows([['Order',number],['Placed',date(r.created_at)],['Via',r.via==='link'?'Your link':`Your code, ${p.code}`],['Status',r.status==='pending'?'Pending until 14 days after delivery':r.status==='approved'?'Approved':'Paid']]);
  text('Approved commissions are paid on the 5th of each month (sample terms). Your referrals list this order by its number and amounts; the buyer’s details stay with TrueMark.');button('See your referrals',link('/partners/app/referrals'));note(disclose);break;
 case 'partner.commission_approved': {
  const refs=c.referrals??[],now=new Date(c.now),next=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+(now.getUTCDate()<5?0:1),5,12)).toISOString();
  const approved=refs.filter(r=>r.status==='approved').reduce((n,r)=>n+Number(r.commission),0),pending=refs.filter(r=>r.status==='pending');
  subject=`Commission approved: ${money(r.commission)}`;preheader=`Order ${number} joins your ${date(next)} payout.`;footer=why('approval emails');
  heading('Your commission is approved.');figure('Approved',money(r.commission),`On order ${number}, placed ${date(r.created_at)}`);
  rows([['Paid on',`${date(next)}, sample schedule`],['Approved for that payout',money(approved)],['Still pending',`${money(pending.reduce((n,r)=>n+Number(r.commission),0))} · ${plural(pending.length,'order')}`]]);
  text('It is paid by bank transfer with every commission approved by then.');button('See your payouts',link('/partners/app/payouts'));note(disclose);break;
 }
 case 'partner.payout_sent': {
  const label=period(pay),paid=date(pay.paid_at);
  subject=`Payout sent: ${money(pay.amount)} for ${label}`;preheader=`${plural(Number(pay.referrals),'order')} · ${pay.method} · ${paid}`;footer=why('payout emails');
  heading(`Your ${label.replace(/ \d{4}$/,'')} payout has been sent.`);figure('Paid',money(pay.amount),`${pay.method}, ${paid}`);
  rows([...(c.referrals??[]).filter(r=>r.payout_id===pay.id).sort((a,b)=>a.created_at.localeCompare(b.created_at)).map(r=>[`Order ${r.order_number}`,money(r.commission)]),[`Total, ${plural(Number(pay.referrals),'order')}`,money(pay.amount)]]);button('See the statement',link('/partners/app/payouts'));note(disclose);break;
 }
 case 'partner.weekly': {
  const a=new Date(d.week_start),b=new Date(d.week_end);const range=a.getUTCMonth()===b.getUTCMonth()?`${a.getUTCDate()}–${day(d.week_end)}`:`${day(d.week_start)} – ${day(d.week_end)}`;
  subject=`Your week: ${plural(Number(d.orders),'order')}, ${money(d.earned)} earned`;preheader=`${range} · ${plural(Number(d.clicks),'click')} on your links`;footer=why('weekly summaries');
  heading(`Your week, ${range}.`);figure('Earned this week',money(d.earned),`${plural(Number(d.orders),'order')} from ${plural(Number(d.clicks),'click')} on your links`);
  rows([['Clicks on your links',new Intl.NumberFormat('en-US').format(d.clicks)],['Referred orders',new Intl.NumberFormat('en-US').format(d.orders)],['Earned',money(d.earned)],['Through your links',`${new Intl.NumberFormat('en-US').format(d.viaLink)} of ${new Intl.NumberFormat('en-US').format(d.orders)}`],['With your code',`${new Intl.NumberFormat('en-US').format(d.viaCode)} of ${new Intl.NumberFormat('en-US').format(d.orders)}`]]);
  if(c.goal!==undefined){const now=new Date(c.now),earned=(c.referrals??[]).filter(r=>r.status!=='void'&&r.created_at.slice(0,7)===c.now.slice(0,7)).reduce((n,r)=>n+Number(r.commission),0);text(`${months[now.getUTCMonth()]} so far: ${money(earned)} of your ${money(c.goal).replace(/\.00$/,'')} monthly goal.`);}
  button('Open your dashboard',link('/partners/app'));note(disclose);break;
 }
 case 'partner.milestone':subject=d.title;footer=why('milestone emails');heading(d.title);text('Thank you for everything you do for TrueMark.');button('See your progress',link('/partners/app'));break;
 case 'partner.welcome':subject='Welcome to the TrueMark partner program';footer="You're a TrueMark partner.";heading("You're in.");text(`Your code is ${p.code}. Buyers save ${pct(c.discount?.percent)}% with it, and you earn ${pct(Number(p.rate)*100)}% on every order it brings in.`);button('Open your portal',link('/partners/sign-in'));break;
 case 'team.new_order':
  subject=`New order ${number} · ${money(o.total)}`;preheader=institution+via;footer='You receive this because new-order alerts are on for you in Settings.';
  heading(`New order ${number}`);figure('Order total',money(o.total),institution+via);
  rows([...lineRows,['Buyer',c.buyer?.name??o.address?.attention??''],['Shipping',c.method?.label??'Cold chain'],...(o.insurance_applied||Number(o.insurance)>0?[['Insurance',money(o.insurance)]]:[]),['Placed',`${date(o.created_at)}, ${time(o.created_at)}`]]);
  text(`${plural(vials,'vial')} to pack cold for ${o.address?.city}, ${o.address?.region}.`);button('Open the order',link('/admin/orders?order='+id));break;
 case 'team.application': {
  const a=c.application??{},research=d.kind==='application.submitted';subject=research?`New research application · ${a.institution}`:`New partner application · ${a.name}`;footer='You receive this because application alerts are on for you in Settings.';
  heading(research?'A research account application is waiting.':'A partner application is waiting.');rows(research?[['Name',a.name],['Institution',a.institution],['Research area',a.research_area]]:[['Name',a.name],['Email',a.email]]);button('Review it',link(research?'/admin/applications':'/admin/partners?view=applications'));break;
 }
 case 'team.contact': {
  const m=c.contact??{},label=c.route?.label??'';subject=`${label}: message from ${m.name}`;footer=`Sent to the ${label} address from the contact form.`;
  heading(`Message from ${m.name}`);rows([['Email',m.email],...(m.organization?[['Organization',m.organization]]:[])]);text(m.message);button('Open the inbox',link('/admin/inbox?message='+m.id));break;
 }
 case 'team.system_alert':subject=`Needs attention: ${d.title}`;footer='Sent to every owner when a connected service needs attention.';heading(d.title);text(d.body);button('Open the command center',link('/admin/settings?section=connections'));break;
 default:throw new Error('Unknown message template');
 }
 return {subject,preheader,html:frame(site,preheader,html,footer),text:[...parts,footer,legal,'TrueMark BioLabs'].join('\n\n'),...(template==='team.contact'?{reply_to:c.contact?.email}: {})};
}
