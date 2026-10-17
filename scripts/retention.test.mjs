import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),tmp=await mkdtemp(join(tmpdir(),'tm-retention-'));
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};globalThis.window=new EventTarget();
await build({stdin:{resolveDir:root,contents:"export * from './src/admin/intelligence/retention-model';export * from './src/platform/preview/retention';export * from './src/platform/live/retention';"},bundle:true,format:'esm',platform:'node',outfile:join(tmp,'model.mjs'),define:{'import.meta.env.VITE_PLATFORM':'"preview"','import.meta.env.VITE_LAUNCH':'"0"'},logLevel:'silent'});
const m=await import(pathToFileURL(join(tmp,'model.mjs')));
const order=(id,at,patch={})=>({id,number:id,buyerId:'b1',createdAt:at,status:'paid',payment:'captured',lines:[{productId:'p1',quantity:2,unitPrice:50}],subtotal:100,shipping:{price:0},total:100,events:[],...patch});
const data={buyers:[{id:'b1',name:'One',email:'one@fixture.test',institution:'Lab'},{id:'b2',name:'Two',email:'two@fixture.test',institution:'Lab'}],orders:[order('1','2026-01-01'),order('2','2026-01-31'),order('3','2026-03-02'),order('4','2026-09-20',{lines:[{productId:'p2',quantity:1,unitPrice:100}]})],products:[],lots:[],asOf:'2026-09-25T23:59:59Z'};
const activity={access:{allowed:true,owner:true,members:[]},records:[],events:[],contacts:[]};
const filter={product:'',from:'',to:'',query:'',group:'all'};
test('product history separates last product purchase from latest customer purchase without a universal deadline',()=>{
 const r=m.retentionView(data,activity,{...filter,product:'p1'}).rows[0];assert.equal(r.scoped.length,3);assert.equal(r.purchases.length,4);assert(r.pattern.longer);assert.equal(r.pattern.typical,30);
 assert.equal(m.retentionView(data,activity,filter).rows.find(r=>r.buyer.id==='b1').pattern.longer,false);
 assert.equal(m.observedPattern(data.orders.slice(0,2),data.asOf).longer,false);
});
test('history filters do not turn a repeat customer into a first-time buyer; unpaid, cancelled, full refunds and future orders are excluded',()=>{
 const augmented={...data,orders:[...data.orders,order('5','2026-09-21',{payment:'pending'}),order('6','2026-09-22',{status:'cancelled'}),order('7','2026-09-23',{payment:'refunded',status:'refunded'}),order('8','2027-01-01')]};
 const r=m.retentionView(augmented,activity,{...filter,from:'2026-09-01'}).rows[0];assert.equal(r.scoped.length,4);assert.equal(r.inPeriod.length,1);assert.equal(r.units,1);
 assert.equal(m.retentionView(augmented,activity,{...filter,from:'2026-09-01',group:'first'}).rows.length,0);
 assert.equal(m.retentionView(data,activity,{...filter,product:'missing'}).rows.length,0);
});
test('cohorts distinguish zero from unobserved months and keep history beyond six months',()=>{
 const c=m.purchaseCohorts(data,'p1','','',12)[0];assert.equal(c.month,'2026-01');assert.deepEqual(c.cells[1],[]);assert.equal(c.cells[8],null);assert.deepEqual(c.cells[0],['b1']);
});
test('drafts and simulated emails are not contacts; follow-up outcomes use actual dates and product scope',()=>{
 const r={id:'r',buyer_id:'b1',kind:'contact',occurred_at:'2026-03-01',product_id:'p1',status:'open'};
 const a={...activity,records:[r,{...r,id:'draft',kind:'draft',occurred_at:'2026-09-25'},{...r,id:'rem',kind:'reminder',due_at:'2026-09-25'}],events:[{buyer_id:'b1',kind:'message.status',occurred_at:'2026-09-24'}]};
 const row=m.customerRows(data,a)[0];assert.equal(row.contact.at,r.occurred_at);assert.equal(row.laterPurchases.length,1);assert.equal(row.due.length,1);
 const voided={...r,status:'cancelled'};assert.equal(m.customerRows(data,{...activity,records:[voided]})[0].contact,undefined);assert.equal(m.recordLabel(voided),'Contact · voided');
});
test('preview saves, edits, reloads, separates lab storage and retains old versions; blocked storage never reports success',async()=>{
 const api=m.createPreviewRetention('test'),draft={id:'draft',buyer_id:'b1',product_id:null,kind:'draft',channel:'email',subject:'Test',body:'Unsent',occurred_at:'2026-09-01',due_at:null,status:'open'};
 const saved=await api.save(draft);assert.equal((await api.save(draft)).version,1);await api.save({...saved,body:'Edited'});assert.equal((await api.load()).events.length,2);assert.equal((await m.createPreviewRetention('test').load()).records[0].body,'Edited');assert.equal((await m.createPreviewRetention('other').load()).records.length,0);
 await assert.rejects(api.save({...saved,body:'Stale'}),/changed/);await assert.rejects(api.save({...saved,id:'bad',version:undefined,status:'done'}),/cannot be marked sent/);
 const original=localStorage.setItem;localStorage.setItem=()=>{throw Error('Storage unavailable');};await assert.rejects(api.save({...draft,id:'new'}),/Storage unavailable/);localStorage.setItem=original;
 memory.set('tm-preview-retention-broken-v1','bad json');await assert.rejects(m.createPreviewRetention('broken').load(),/preserved/);
});
test('live adapter avoids private reads for denied staff and surfaces denied saves',async()=>{
 const tables=[];const api=m.createRetention(async t=>{tables.push(t);return[];},async name=>{if(name==='retention_access')return{allowed:false,owner:false,members:[]};throw Error('Denied');},()=>{});
 assert.equal((await api.load()).records.length,0);assert.deepEqual(tables,[]);await assert.rejects(api.save({}),/Denied/);
});

test('purchase date filters use UTC even when source timestamps have offsets',()=>{
 const d={...data,orders:[order('tz','2026-09-01T23:30:00-05:00')]};
 assert.equal(m.retentionView(d,activity,{...filter,from:'2026-09-02',to:'2026-09-02'}).rows.length,1);
 assert.equal(m.retentionView(d,activity,{...filter,from:'2026-09-01',to:'2026-09-01'}).rows.length,0);
});
