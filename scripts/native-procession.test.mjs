import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/brand/native-procession.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {createNativeProcession}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
class El extends EventTarget {
  style={getPropertyValue:()=>'',cssText:''}; dataset={}; map={}; attrs=new Map(); children=[];
  clientWidth=390;offsetHeight=200;offsetWidth=100;offsetLeft=145;scrollLeft=0;calls=[];
  querySelector(q){return this.map[q]??null;} querySelectorAll(){return this.children;}
  closest(){return this.home;} getAttribute(k){return this.attrs.get(k)??null;}
  setAttribute(k,v){this.attrs.set(k,v);} removeAttribute(k){this.attrs.delete(k);}
  hasAttribute(k){return this.attrs.has(k);} toggleAttribute(k,on){on?this.attrs.set(k,''):this.attrs.delete(k);}
  scrollTo(options){this.calls.push(options);this.scrollLeft=options.left;this.dispatchEvent(new Event('scroll'));}
}
function setup({shape,plate,initial=2}={}){
 const home=new El(),opening=new El(),section=new El(),stage=new El();section.home=home;
 home.map['.tm-mist']=opening;section.map['.tm-procession-stage']=stage;
 if(shape)opening.dataset.shape=shape;
 if(plate){const p=new El();p.children=plate;p.querySelector=q=>plate.find(v=>q.includes(`"${v.dataset.productId}"`))??null;opening.map['.tm-room-plate']=p;}
 stage.children=Array.from({length:8},(_,i)=>{const a=new El();a.offsetLeft=145+i*240;a.dataset.productId=`p${i}`;a.map['.tm-procession-plinth']=new El();return a;});
 let status,seen,resize,id=0;const tasks=new Map(),frames=new Map(),previous=new Map();
 const set=(k,v)=>{previous.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});};
 const win=new EventTarget();Object.assign(win,{setTimeout:f=>{tasks.set(++id,f);return id;},clearTimeout:i=>tasks.delete(i),scrollY:0});
 set('window',win);set('document',Object.assign(new EventTarget(),{hidden:false}));
 set('requestAnimationFrame',f=>{frames.set(++id,f);return id;});set('cancelAnimationFrame',i=>frames.delete(i));
 set('ResizeObserver',class{constructor(cb){resize=cb;}observe(){}disconnect(){}});
 set('IntersectionObserver',class{constructor(cb){seen=cb;}observe(){}disconnect(){}});
 set('MutationObserver',class{observe(){}disconnect(){}});
 const c=createNativeProcession(section,[0,1,2,3,4,5,6,7],initial,s=>status=s);
 const tick=()=>{const batch=[...frames.values()];frames.clear();batch.forEach(f=>f());};tick();
 return {home,section,stage,win,c,tasks,frames,status:()=>status,tick,resize,visible:on=>seen([{isIntersecting:on}]),advance(){const batch=[...tasks.values()];tasks.clear();batch.forEach(f=>f());tick();},close(){c.destroy();for(const[k,v]of previous)v?Object.defineProperty(globalThis,k,v):delete globalThis[k];}};
}
test('vertical scrolling does no carousel work and never changes its position',()=>{
 const f=setup();try{const before=f.stage.scrollLeft;f.stage.calls=[];
  for(let i=0;i<120;i++){f.win.scrollY+=15;f.win.dispatchEvent(new Event('scroll'));f.tick();}
  assert.equal(f.stage.scrollLeft,before);assert.equal(f.stage.calls.length,0);assert.equal(f.frames.size,0);
 }finally{f.close();}
});
test('browser owns touch and momentum; label follows the native scroll position',()=>{
 const f=setup();try{f.visible(true);const contact=new Event('touchstart',{cancelable:true});f.stage.dispatchEvent(contact);
  assert.equal(contact.defaultPrevented,false);assert.equal(f.tasks.size,0);
  f.stage.scrollLeft=5*240;f.stage.dispatchEvent(new Event('scroll'));f.tick();
  assert.equal(f.status().active,5);assert.equal(f.tasks.size,0);
  f.stage.dispatchEvent(new Event('touchend'));assert.equal(f.tasks.size,1);
  f.stage.scrollLeft=6*240;f.stage.dispatchEvent(new Event('scroll'));f.tick();assert.equal(f.status().active,6);
 }finally{f.close();}
});
test('toolbar resize does not recenter an in-progress swipe; real width change can relayout',()=>{
 const f=setup();try{f.stage.scrollLeft=630;f.stage.calls=[];f.resize();assert.equal(f.stage.scrollLeft,630);assert.equal(f.stage.calls.length,0);
 f.stage.clientWidth=430;f.resize();assert.equal(f.stage.calls.length,1);
 }finally{f.close();}
});
test('autoplay is quiet offscreen, advances when visible, and respects pause and reduced motion',()=>{
 const f=setup();try{assert.equal(f.tasks.size,0);f.visible(true);f.advance();assert.equal(f.status().active,3);
 f.c.pauseAutoplay();assert.equal(f.tasks.size,0);f.c.toggle();assert.equal(f.tasks.size,1);
 f.c.setMotion(false);assert.equal(f.tasks.size,0);assert.equal(f.status().reduced,true);
 f.c.step(1);f.tick();assert.equal(f.status().active,4);assert.equal(f.stage.calls.at(-1).behavior,'instant');
 f.visible(false);assert.equal(f.tasks.size,0);
 }finally{f.close();}
});
test('rapid direction changes reach the requested class without a synthetic drag spring',()=>{
 const f=setup();try{f.c.step(1);f.tick();assert.equal(f.status().active,3);f.c.step(-1);f.tick();assert.equal(f.status().active,2);
 f.stage.dispatchEvent(new Event('touchcancel'));f.c.destroy();assert.equal(f.tasks.size,0);assert.equal(f.frames.size,0);
 }finally{f.close();}
});
test('every vial stands on the centre pedestal crop as the room vial on that pedestal does, whichever class comes first',()=>{
 const seat=(id,x,y,h)=>({dataset:{productId:id},style:{getPropertyValue:k=>String({'--seat-x':x,'--seat-y':y,'--vial-h':h}[k]??'')}});
 const tops=[];
 // The live catalog can begin the strip on BPC-157, which the room shows on the left pedestal, lower and nearer.
 for(const first of [0,1,2]){
  const f=setup({shape:'tall',plate:[seat('p0',.168,.6083,.1417),seat('p1',.4963,.5714,.1417),seat('p2',.8306,.6166,.1417)],initial:first});
  try{tops.push(f.stage.children.map(a=>a.map['.tm-procession-plinth'].style.top));}finally{f.close();}
 }
 // Room px: seat 0.5714 x 1934 above the centre pedestal's back rim, over the vial's 0.1417 x 1934.
 for(const t of tops.flat())assert.equal(t,tops[0][0]);
 assert.ok(Math.abs(parseFloat(tops[0][0])-91.1)<.1,tops[0][0]);
});
