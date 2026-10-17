import type { Order } from '../../platform/types';
import type { RetentionData, RetentionRecord } from '../../platform/retention';
import { DAY, dateKey, orderMoney } from './model';
import type { BusinessData } from './model';

export const purchaseAt = (o: Order) => o.paidAt || o.createdAt;
export const retainedPurchase = (o: Order) => orderMoney(o).paid && !['cancelled','refunded'].includes(o.status) && o.payment !== 'refunded' && orderMoney(o).collected > 0;
export function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a,b)=>a-b), i = Math.floor(s.length/2);
  return s.length%2 ? s[i] : (s[i-1]+s[i])/2;
}
export function observedPattern(orders: Order[], asOf: string) {
  const times = [...new Set(orders.map(o=>Date.parse(purchaseAt(o))))].filter(t=>t<=Date.parse(asOf)).sort((a,b)=>a-b);
  const gaps = times.slice(1).map((t,i)=>(t-times[i])/DAY);
  const daysSince = times.length ? Math.floor((Date.parse(asOf)-times.at(-1)!)/DAY) : null;
  const typical = median(gaps);
  return { daysSince, typical, shortest:gaps.length?Math.min(...gaps):null, longest:gaps.length?Math.max(...gaps):null,
    intervals:gaps.length, longer: gaps.length>=2 && daysSince!==null && daysSince > Math.max(...gaps) };
}
export type RetentionFilter = { product: string; from: string; to: string; query: string; group: string };
const time = (iso: string) => Date.parse(iso);
export function customerRows(data: BusinessData, retention: RetentionData) {
  const now = time(data.asOf);
  return data.buyers.map(buyer=>{
    const orders = data.orders.filter(o=>o.buyerId===buyer.id && time(purchaseAt(o))<=now).sort((a,b)=>time(purchaseAt(b))-time(purchaseAt(a)));
    const purchases = orders.filter(retainedPurchase);
    const records = retention.records.filter(r=>r.buyer_id===buyer.id);
    const events = retention.events.filter(e=>e.buyer_id===buyer.id);
    const contacts = [
      ...records.filter(r=>['contact','reply'].includes(r.kind) && r.status!=='cancelled').map(r=>({at:r.occurred_at,product:r.product_id})),
      ...events.filter(e=>['message.sent','chat.user','contact.form'].includes(e.kind) && e.occurred_at).map(e=>({at:e.occurred_at!,product:null})),
    ].filter(c=>time(c.at)<=now).sort((a,b)=>time(b.at)-time(a.at));
    const contact = contacts[0];
    const laterPurchases = contact ? purchases.filter(o=>time(purchaseAt(o))>time(contact.at) && (!contact.product || o.lines.some(l=>l.productId===contact.product))) : [];
    const consent = retention.contacts.find(c=>c.email.toLowerCase().trim()===buyer.email.toLowerCase().trim());
    return {buyer,orders,purchases,records,events,contact,laterPurchases,
      lifetime:Math.round(orders.reduce((s,o)=>s+orderMoney(o).revenue,0)*100)/100,
      consent:consent?.status==='subscribed' && time(consent.consent_at)<=now ? 'Opted in' : consent?.status==='suppressed' ? 'Unsubscribed' : 'No opt-in on file',
      due:records.filter(r=>r.kind==='reminder' && r.status==='open' && r.due_at && r.due_at.slice(0,10)<=data.asOf.slice(0,10)),
    };
  });
}
export type CustomerHistory = ReturnType<typeof customerRows>[number];
export function retentionView(data: BusinessData, retention: RetentionData, filter: RetentionFilter) {
  const customers = customerRows(data,retention);
  const base = customers.map(row=>{
    const scoped = row.purchases.filter(o=>!filter.product || o.lines.some(l=>l.productId===filter.product));
    const inPeriod = scoped.filter(o=>(!filter.from || dateKey(purchaseAt(o))>=filter.from) && (!filter.to || dateKey(purchaseAt(o))<=filter.to));
    return {...row,scoped,inPeriod,pattern:observedPattern(scoped,data.asOf),
      units:inPeriod.reduce((s,o)=>s+o.lines.filter(l=>!filter.product || l.productId===filter.product).reduce((n,l)=>n+l.quantity,0),0)};
  }).filter(r=>(!filter.product || r.scoped.length>0) && (!(filter.from || filter.to) || r.inPeriod.length>0) &&
    (r.buyer.name+' '+r.buyer.institution+' '+r.buyer.email).toLowerCase().includes(filter.query.toLowerCase().trim()));
  const match = (r:typeof base[number],group:string) => group==='first'?r.scoped.length===1:group==='returning'?r.scoped.length>=2:group==='loyal'?r.scoped.length>=3:group==='longer'?r.pattern.longer:group==='due'?r.due.length>0:group==='none'?r.scoped.length===0:true;
  const groups = [ ['all','All customers'],['first','Bought once'],['returning','Repeat buyers'],['loyal','3+ purchases'],['longer','Longer gap'],['due','Follow-ups due'] ].map(([id,label])=>({id,label,count:base.filter(r=>match(r,id)).length}));
  return {base,groups,rows:base.filter(r=>match(r,filter.group)).sort((a,b)=>b.due.length-a.due.length || (b.pattern.daysSince ?? -1)-(a.pattern.daysSince ?? -1))};
}
export function productHistory(data: BusinessData, row: CustomerHistory) {
  const ids = [...new Set(row.orders.flatMap(o=>o.lines.map(l=>l.productId)))];
  return ids.map(id=>{
    const product=data.products.find(p=>p.id===id), orders=row.purchases.filter(o=>o.lines.some(l=>l.productId===id));
    return {id,name:product?product.name+' '+product.size:id,orders:orders.length,
      units:orders.reduce((s,o)=>s+o.lines.filter(l=>l.productId===id).reduce((n,l)=>n+l.quantity,0),0),
      last:orders[0]?purchaseAt(orders[0]):null,pattern:observedPattern(orders,data.asOf), active:product?.active!==false};
  });
}
export function purchaseCohorts(data: BusinessData, product: string, from: string, to: string, horizon: number) {
  const orders=data.orders.filter(o=>retainedPurchase(o) && time(purchaseAt(o))<=time(data.asOf) && (!product || o.lines.some(l=>l.productId===product)));
  const first=new Map<string,string>();
  for(const o of orders) if(!first.has(o.buyerId) || time(purchaseAt(o))<time(first.get(o.buyerId)!)) first.set(o.buyerId,new Date(purchaseAt(o)).toISOString());
  const months=[...new Set([...first.values()].filter(d=>(!from||d.slice(0,10)>=from)&&(!to||d.slice(0,10)<=to)).map(d=>d.slice(0,7)))].sort();
  return months.map(month=>{
    const ids=[...first].filter(([,d])=>d.startsWith(month) && (!from||d.slice(0,10)>=from) && (!to||d.slice(0,10)<=to)).map(([id])=>id), start=new Date(month+'-01T00:00:00Z');
    const cells=Array.from({length:horizon},(_,i)=>{
      const begin=Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+i,1),end=Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+i+1,1);
      if(end>time(data.asOf)+1) return null;
      return [...new Set(orders.filter(o=>ids.includes(o.buyerId) && time(purchaseAt(o))>=begin && time(purchaseAt(o))<end).map(o=>o.buyerId))];
    });
    return {month,ids,cells};
  });
}
export const recordLabel = (r: RetentionRecord) => r.status==='cancelled'
  ? r.kind==='draft'?'Draft · archived, not sent':r.kind==='reminder'?'Reminder · cancelled':r.kind[0].toUpperCase()+r.kind.slice(1)+' · voided'
  :r.kind==='draft'?'Draft · not sent':r.kind==='reminder'?'Reminder · '+r.status:r.kind==='contact'?'Contact logged':r.kind==='reply'?'Reply logged':'Note';
