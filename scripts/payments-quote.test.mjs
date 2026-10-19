/** WP-25 quotes and preview render proofs. Node, fixtures only, no network. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createPlatformDb } from './lib/platform-db.mjs';
const root=resolve(import.meta.dirname,'..'),temp=await mkdtemp('/private/tmp/wp25-quotes-');
globalThis.fetch=async()=>{throw new Error('External network forbidden in payment quote tests');};
const sqlDb=await createPlatformDb();
const values=new Map();
globalThis.localStorage=globalThis.sessionStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
globalThis.window=Object.assign(new EventTarget(),{setTimeout:fn=>{queueMicrotask(fn);return 1;},clearTimeout(){},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})});
globalThis.document={hidden:false,baseURI:'https://local.fixture/'};
globalThis.BroadcastChannel=class extends EventTarget{postMessage(){}close(){}};
async function bundle(directory,label) {
 const outfile=join(temp,`${label}.mjs`);
 await build({stdin:{resolveDir:directory,loader:'tsx',contents:`
 export { createLiveAdapter } from './src/platform/live/adapter.ts';
 export * as pricing from './src/platform/pricing.ts';
 export * as data from './src/data.ts';
 export * as preview from './src/platform/preview/store.ts';
 import {createElement as h} from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
 import {MemoryRouter} from 'react-router-dom'; import {ShopContext} from './src/shop/context.tsx';
 import Checkout from './src/shop/pages/checkout/Checkout.tsx'; import Confirmation from './src/shop/pages/checkout/Confirmation.tsx';
 import Settings from './src/admin/Settings.tsx'; import {AppearanceProvider} from './src/admin/appearance.tsx'; import { OrderTable } from './src/shop/pages/account/Orders.tsx';
 import { orders } from './src/platform/seed.ts';
 const wrap=element=>renderToStaticMarkup(h(ShopContext.Provider,{value:{cart:[{id:'bpc-157-10-mg',quantity:1}],clear(){},add(){},change(){},openCart(){},closeCart(){}}},h(MemoryRouter,{},element)));
 export const checkout=()=>wrap(h(Checkout)); export const confirmation=()=>wrap(h(Confirmation));
 export const settings=()=>wrap(h(AppearanceProvider,{},h(Settings))); export const ordersRender=()=>wrap(h(OrderTable,{orders:orders.slice(0,2),label:'Fixture orders'}));
 `},outfile,jsx:'automatic',bundle:true,format:'esm',platform:'node',nodePaths:[join(root,'node_modules')],loader:{'.css':'empty'},define:{'import.meta.env':JSON.stringify({VITE_PLATFORM:'preview',BASE_URL:'/',PROD:false}),'process.env.NODE_ENV':'"production"'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},logLevel:'silent'});
 return import(pathToFileURL(outfile));
}
const current=await bundle(root,'current');
const baselineDir=join(temp,'baseline');await mkdir(baselineDir);
execFileSync('git',['archive','e1a9487','src'],{cwd:root,stdio:['ignore',await import('node:fs').then(m=>m.openSync(join(temp,'baseline.tar'),'w')),'pipe']});
execFileSync('tar',['-xf',join(temp,'baseline.tar'),'-C',baselineDir]);
const baseline=await bundle(baselineDir,'baseline');

// The shopper's bag is called a cart since round 5 of the landing: the base is read with that one rename.
const asCart=html=>html.replaceAll('Edit bag','Edit cart').replaceAll('Your bag is empty.','Your cart is empty.').replaceAll(' to your bag',' to your cart');
// An unpaid order reads "Awaiting payment" since Oct 18, not "Placed": the base is read with that rename too.
const asAwaiting=html=>html.replaceAll('</i>Placed</span>','</i>Awaiting payment</span>').replace(/(placed \d{1,2} \w{3} \d{4}), placed"/g,'$1, awaiting payment"');
// Conditional live-only controls can shift React useId positions; keep references consistent.
const normalizeIds=html=>{const ids=new Map();return html.replace(/_R_[A-Za-z0-9]+_/g,id=>{if(!ids.has(id))ids.set(id,`generated-${ids.size}`);return ids.get(id);});};
test('preview checkout, confirmation and account orders retain base markup apart from generated ids',()=>{
 for(const key of ['checkout','confirmation','ordersRender']) assert.equal(normalizeIds(current[key]()),normalizeIds(asAwaiting(asCart(baseline[key]()))),key);
});
test('preview quote retains base totals, shipping, discount and insurance',()=>{
 const draft={lines:[{productId:'bpc-157-10-mg',quantity:2}],address:{region:'TX',country:'US'},shipping:'cold-2day'};
 const before=baseline.preview.quote(draft),after=current.preview.quote(draft);
 assert.deepEqual(after,before);
});
test('live adapter tax quote agrees with PostgreSQL numeric for rated, unrated and non-US fixtures',async()=>{
 const h=sqlDb;
 try {
  const rates=[{region:'TX',rate:.0625},{region:'NY',rate:.08875},{region:'DC',rate:.06}];let settings;
  const product={...current.data.products[0],id:'fixture-product',price:40,stock:null,active:true};
  const client={from(table){let found=table==='products'?[product]:table==='settings'?[{id:true,free_shipping_threshold:null,free_shipping_method:'cold-2day',insurance_mode:settings.insuranceMode,insurance_rate:settings.insuranceRate,tax_mode:settings.taxMode,tax_shipping:settings.taxShipping}]:table==='tax_rates'?rates:table==='shipping_methods'?[{id:'cold-2day',label:'Fixture delivery',detail:'Fixture',price:24,active:true}]:[];
   const q={select(){return q;},eq(k,v){found=found.filter(r=>String(r[k])===String(v));return q;},order(){return q;},range(){return q;},returns(){return q;},then(resolve){return Promise.resolve({data:found,error:null}).then(resolve);}};return q;},rpc:async(name,args)=>({data:name==='my_checkout_benefits'?{membershipName:null,membershipAmount:0,rewardAmount:0,rewardPoints:0,promoAmount:args.promo_amount}:{percent:10,partnerName:null},error:null})};
  const adapter=current.createLiveAdapter(client);
  for(const mode of ['off','rates']) for(const shipping of [false,true]) for(const insurance of ['off','automatic']) for(const price of [.01,1.05,16.99,40,166.67,999.99]) for(const [region,country] of [['TX','US'],[' t e x a s ',' United States '],['NY','USA'],['District of Columbia','United States of America'],['California','US'],['Texas','Canada']]) {
   settings={...current.pricing.defaultSettings,freeShippingThreshold:null,insuranceMode:insurance,insuranceRate:.03755,taxMode:mode,taxShipping:shipping};product.price=price;
   const draft={lines:[{productId:product.id,quantity:1}],shipping:'cold-2day',discountCode:'FIXTURE10',address:{region,country}};
   const quote=await adapter.quote(draft);
   const code=(await h.anon('select public.us_region_code($1,$2) as code',[region,country]))[0].code;
   const rate=mode==='rates'?rates.find(r=>r.region===code)?.rate??0:0;
   const expected=Number(await h.scalar('select round(($1::numeric + $2::numeric) * $3::numeric,2)',[quote.base,shipping?quote.shipping:0,rate]));
   assert.equal(quote.tax,expected,`${mode} ${shipping} ${price} ${region} ${country}`);
   assert.equal(quote.total,current.pricing.roundMoney(quote.base+quote.shipping+quote.insurance+expected));
  }
 } finally {await h.db.close();}
});
test('live payment controls use outcomes and collect no card data',async()=>{
 for(const file of ['src/shop/pages/checkout/Pay.tsx','supabase/functions/payments/providers.ts','supabase/functions/payments/server.ts']) assert.doesNotMatch(await readFile(join(root,file),'utf8'),/card-number|card-expiry|card-code|\bCVC\b/);
 const checkout=await readFile(join(root,'src/shop/pages/checkout/Checkout.tsx'),'utf8');assert.match(checkout,/!LIVE && <>\s*<div className="tm-fields">/);
});
test('new package files contain no real credentials',async()=>{
 const files=['supabase/functions/payments/index.ts','supabase/functions/payments/providers.ts','supabase/functions/payments/server.ts','src/platform/live/payments.ts'];
 for(const file of files) assert.doesNotMatch(await readFile(join(root,file),'utf8'),/eyJ[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9]+|sk_live_[A-Za-z0-9]+/);
});

test('live payment history renders abandoned charges and late-refund reasons; Settings retains locked guardrails',async()=>{
 const payments=[
  {id:'abandoned',kind:'charge',provider:'simulator',amount:100,status:'abandoned',createdAt:'2026-10-05T00:00:00Z',failureReason:'replaced'},
  {id:'late',kind:'refund',provider:'simulator',amount:100,status:'succeeded',createdAt:'2026-10-05T00:01:00Z',reason:'Payment arrived after the order was released'},
 ];
 globalThis.wp25ScreenStore={settings:{get:()=>({...current.pricing.defaultSettings,taxMode:'rates'})}};
 globalThis.wp25ScreenLive={auth:{profile:()=>({id:'owner',role:'owner'})},payments:{list:()=>payments,rates:()=>[{region:'TX',rate:.0625}]},team:{members:()=>[],invites:()=>[]},shipping:{methods:()=>[]},connections:{list:()=>['payments','email','sms','shipping'].map(id=>({id,mode:'simulated',provider:'',lastOkAt:null,lastErrorAt:null,lastError:null}))},messages:{teamPreferences:()=>[]}};
 const outfile=join(temp,'live-screens.mjs');
 await build({stdin:{resolveDir:root,loader:'tsx',contents:`
  import {createElement as h} from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
  import {MemoryRouter} from 'react-router-dom'; import {PaymentSection} from './src/admin/PaymentSection';
  import Settings from './src/admin/Settings'; import {AppearanceProvider} from './src/admin/appearance';
  export {paymentLabel} from './src/shop/pages/account/lib';
  export const payment=()=>renderToStaticMarkup(h(MemoryRouter,{},h(PaymentSection,{order:{id:'order',number:'TM-FIXTURE',total:100,refunded:0,payment:'captured',status:'paid',paymentProvider:'simulator'}})));
  export const settings=()=>renderToStaticMarkup(h(MemoryRouter,{},h(AppearanceProvider,{},h(Settings))));
 `},outfile,bundle:true,format:'esm',platform:'node',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent',define:{'import.meta.env':JSON.stringify({VITE_PLATFORM:'live',BASE_URL:'/',PROD:false}),'process.env.NODE_ENV':'"production"'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},plugins:[{name:'local-payment-screen-fixtures',setup(plugin){
  plugin.onLoad({filter:/\/platform\/live\/runtime\.ts$/},()=>({loader:'ts',contents:'export const live=()=>globalThis.wp25ScreenLive; export async function initialize() {}'}));
  plugin.onLoad({filter:/\/platform\/store\.ts$/},()=>({loader:'ts',contents:'export const store=globalThis.wp25ScreenStore; export const useResource=read=>({data:read.constructor.name==="AsyncFunction"?null:read(),loading:false,error:null,reload(){}});'}));
  plugin.onResolve({filter:/^react$/},args=>/\/admin\/(preview\.ts|notify\.tsx)$/.test(args.importer)?{path:'react-preview',namespace:'fixture'}:undefined);
  plugin.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export * from ${JSON.stringify(join(root,'node_modules/react/index.js'))}; export const useSyncExternalStore=(_subscribe,snapshot)=>snapshot();`,resolveDir:root}));
 }}]});
 const api=await import(pathToFileURL(outfile)),html=api.payment();
 assert.match(html,/Charge · \$100\.00<\/span><span class="cc-payment-status">(?:<span[^>]*><\/span>)?Not completed/);assert.doesNotMatch(html,/Abandoned/);assert.match(html,/Replaced by a newer attempt/);assert.doesNotMatch(html,/>replaced</);
 assert.match(html,/Refund · \$100\.00<\/span><span class="cc-payment-status">(?:<span[^>]*><\/span>)?Succeeded/);assert.match(html,/Payment arrived after the order was released/);
 assert.equal(api.paymentLabel.pending,'Awaiting payment');assert.equal(api.paymentLabel.partially_refunded,'Partly refunded');
 const settings=api.settings();assert.match(settings,/Sales tax/);assert.match(settings,/Texas/);assert.match(settings,/6.25%/);
 const compliance=settings.match(/>Compliance<\/h2>([\s\S]*?)<\/section>/)?.[1];assert(compliance,'Compliance block is present');
 const switches=compliance.match(/<button[^>]*role="switch"[^>]*>/g);assert.equal(switches?.length,3);
 for(const control of switches){assert.match(control,/disabled=""/);assert.match(control,/aria-checked="true"/);}
});
