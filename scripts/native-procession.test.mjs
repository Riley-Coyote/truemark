import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/brand/native-procession.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {createNativeProcession}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const PITCH=240,COUNT=8,AUTOPLAY_MS=6500;
/** Strip position p (copies at 0-7 and 16-23, the real collection at 8-15) is centred at scrollLeft p * PITCH. */
const at=p=>p*PITCH;
class El extends EventTarget {
  style={getPropertyValue:()=>'',cssText:''}; dataset={}; map={}; attrs=new Map(); children=[]; added=[];
  clientWidth=390;clientLeft=0;offsetHeight=200;offsetWidth=100;scrollLeft=0;calls=[];
  querySelector(q){return this.map[q]??null;} querySelectorAll(){return this.children;}
  closest(){return this.home;} getAttribute(k){return this.attrs.get(k)??null;}
  setAttribute(k,v){this.attrs.set(k,v);} removeAttribute(k){this.attrs.delete(k);}
  hasAttribute(k){return this.attrs.has(k);} toggleAttribute(k,on){on?this.attrs.set(k,''):this.attrs.delete(k);}
  scrollTo(options){this.calls.push(options);this.scrollLeft=options.left;this.dispatchEvent(new Event('scroll'));}
  cloneNode(){const c=new El();c.dataset={...this.dataset};c.attrs=new Map(this.attrs);c.map={'.tm-procession-plinth':new El()};c.stage=this.stage;return c;}
  append(child){this.added.push(child);child.parent=this;}
  remove(){this.parent.added.splice(this.parent.added.indexOf(this),1);}
  // An actor is laid out by its flex order, as the strip lays it out.
  getBoundingClientRect(){
    if(!this.stage)return {left:0,width:this.clientWidth};
    const order=Number(/order:(-?\d+)/.exec(this.style.cssText)?.[1]??0);
    return {left:145+(order+COUNT)*PITCH-this.stage.scrollLeft,width:this.offsetWidth};
  }
}
function setup({shape,plate,initial=2}={}){
 const home=new El(),opening=new El(),section=new El(),stage=new El();section.home=home;
 home.map['.tm-mist']=opening;section.map['.tm-procession-stage']=stage;
 if(shape)opening.dataset.shape=shape;
 if(plate){const p=new El();p.children=plate;p.querySelector=q=>plate.find(v=>q.includes(`"${v.dataset.productId}"`))??null;opening.map['.tm-room-plate']=p;}
 stage.children=Array.from({length:COUNT},(_,i)=>{const a=new El();a.stage=stage;a.dataset.productId=`p${i}`;a.setAttribute('aria-hidden','true');a.map['.tm-procession-plinth']=new El();return a;});
 let status,seen,resize,id=0;const tasks=new Map(),frames=new Map(),previous=new Map();
 const set=(k,v)=>{previous.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});};
 const win=new EventTarget();Object.assign(win,{setTimeout:(f,ms)=>{tasks.set(++id,{f,ms});return id;},clearTimeout:i=>tasks.delete(i),scrollY:0});
 set('window',win);set('document',Object.assign(new EventTarget(),{hidden:false}));
 set('requestAnimationFrame',f=>{frames.set(++id,f);return id;});set('cancelAnimationFrame',i=>frames.delete(i));
 set('ResizeObserver',class{constructor(cb){resize=cb;}observe(){}disconnect(){}});
 set('IntersectionObserver',class{constructor(cb){seen=cb;}observe(){}disconnect(){}});
 set('MutationObserver',class{observe(){}disconnect(){}});
 const c=createNativeProcession(section,[0,1,2,3,4,5,6,7],initial,s=>status=s);
 const tick=()=>{const batch=[...frames.values()];frames.clear();batch.forEach(f=>f());};tick();
 const run=ms=>{const due=[...tasks].filter(([,t])=>t.ms===ms);due.forEach(([k])=>tasks.delete(k));due.forEach(([,t])=>t.f());tick();return due.length;};
 const autoplays=()=>[...tasks.values()].filter(t=>t.ms===AUTOPLAY_MS).length;
 return {home,section,stage,win,c,tasks,frames,status:()=>status,tick,resize,autoplays,visible:on=>seen([{isIntersecting:on}]),
  /** The autoplay's 6.5s passes. */
  advance(){run(AUTOPLAY_MS);},
  /** The strip lies still: every pending rest check runs, and any it leads to. */
  rest(){for(let i=0;i<20&&[...tasks.values()].some(t=>t.ms!==AUTOPLAY_MS);i++)for(const ms of new Set([...tasks.values()].map(t=>t.ms).filter(ms=>ms!==AUTOPLAY_MS)))run(ms);},
  /** One rest check: the strip has lain still a moment. */
  check(){for(const ms of new Set([...tasks.values()].map(t=>t.ms).filter(ms=>ms!==AUTOPLAY_MS)))run(ms);},
  swipeTo(left){this.stage.scrollLeft=left;this.stage.dispatchEvent(new Event('scroll'));tick();},
  close(){c.destroy();for(const[k,v]of previous)v?Object.defineProperty(globalThis,k,v):delete globalThis[k];}};
}
test('vertical scrolling does no carousel work and never changes its position',()=>{
 const f=setup();try{f.rest();const before=f.stage.scrollLeft;f.stage.calls=[];
  for(let i=0;i<120;i++){f.win.scrollY+=15;f.win.dispatchEvent(new Event('scroll'));f.tick();}
  assert.equal(f.stage.scrollLeft,before);assert.equal(f.stage.calls.length,0);assert.equal(f.frames.size,0);
 }finally{f.close();}
});
test('browser owns touch and momentum; label follows the native scroll position',()=>{
 const f=setup();try{f.visible(true);const contact=new Event('touchstart',{cancelable:true});f.stage.dispatchEvent(contact);
  assert.equal(contact.defaultPrevented,false);assert.equal(f.autoplays(),0);
  f.swipeTo(at(COUNT+5));
  assert.equal(f.status().active,5);assert.equal(f.autoplays(),0);
  f.stage.dispatchEvent(new Event('touchend'));assert.equal(f.autoplays(),1);
  f.swipeTo(at(COUNT+6));assert.equal(f.status().active,6);
 }finally{f.close();}
});
test('toolbar resize does not recenter an in-progress swipe; real width change can relayout',()=>{
 const f=setup();try{f.stage.scrollLeft=at(COUNT+2)+150;f.stage.calls=[];f.resize();assert.equal(f.stage.scrollLeft,at(COUNT+2)+150);assert.equal(f.stage.calls.length,0);
 f.stage.clientWidth=430;f.resize();assert.equal(f.stage.calls.length,1);
 }finally{f.close();}
});
test('autoplay is quiet offscreen, advances when visible, and respects pause and reduced motion',()=>{
 const f=setup();try{assert.equal(f.autoplays(),0);f.visible(true);f.advance();assert.equal(f.status().active,3);
 f.c.pauseAutoplay();assert.equal(f.autoplays(),0);f.c.toggle();assert.equal(f.autoplays(),1);
 f.c.setMotion(false);assert.equal(f.autoplays(),0);assert.equal(f.status().reduced,true);
 f.c.step(1);f.tick();assert.equal(f.status().active,4);assert.equal(f.stage.calls.at(-1).behavior,'instant');
 f.visible(false);assert.equal(f.autoplays(),0);
 }finally{f.close();}
});
test('rapid direction changes reach the requested class without a synthetic drag spring',()=>{
 const f=setup();try{f.c.step(1);f.tick();assert.equal(f.status().active,3);f.c.step(-1);f.tick();assert.equal(f.status().active,2);
 f.stage.dispatchEvent(new Event('touchcancel'));f.c.destroy();assert.equal(f.tasks.size,0);assert.equal(f.frames.size,0);
 }finally{f.close();}
});
test('autoplay goes round one way: after the last class the first, then on, never back',()=>{
 const f=setup({initial:7});try{f.visible(true);
  const seen=[f.status().active];
  for(let i=0;i<20;i++){
   const from=f.stage.scrollLeft;f.advance();
   // Every advance is one step to the right, the step past the last class included; none is a rewind.
   assert.equal(f.stage.calls.at(-1).left,from+PITCH);assert.equal(f.stage.calls.at(-1).behavior,'smooth');
   f.rest();seen.push(f.status().active);
  }
  assert.deepEqual(seen,Array.from({length:21},(_,i)=>(7+i)%COUNT));
  // At rest it is always back in the middle collection, with a whole collection to go on into either way.
  assert.ok(f.stage.scrollLeft>=at(COUNT)&&f.stage.scrollLeft<at(2*COUNT));
 }finally{f.close();}
});
test('a step past either end goes round to the other, then rests on the twin in the middle at once',()=>{
 const f=setup({initial:7});try{
  f.c.step(1);f.tick();assert.equal(f.status().active,0);assert.equal(f.stage.scrollLeft,at(2*COUNT));
  f.stage.calls=[];f.rest();
  // One instant move by one collection's length: the copy and its twin are drawn the same, so nothing is seen to move.
  assert.deepEqual(f.stage.calls,[{left:at(COUNT),behavior:'instant'}]);assert.equal(f.status().active,0);
  f.c.step(-1);f.tick();assert.equal(f.status().active,7);assert.equal(f.stage.scrollLeft,at(COUNT-1));
  f.stage.calls=[];f.rest();
  assert.deepEqual(f.stage.calls,[{left:at(2*COUNT-1),behavior:'instant'}]);assert.equal(f.status().active,7);
  // Twenty steps back from there: round twice and a half, the class following each step.
  for(let i=1;i<=20;i++){f.c.step(-1);f.tick();f.rest();assert.equal(f.status().active,((7-i)%COUNT+COUNT)%COUNT);}
 }finally{f.close();}
});
test('a swipe past the last class reaches the first; it is not moved under a finger or before it snaps',()=>{
 const f=setup({initial:7});try{
  f.stage.dispatchEvent(new Event('touchstart'));
  f.swipeTo(at(2*COUNT));assert.equal(f.status().active,0);
  f.stage.calls=[];f.rest();assert.equal(f.stage.calls.length,0,'never under a finger');
  f.stage.dispatchEvent(new Event('touchend'));
  // Stopped between two vials (WebKit snaps later): left alone until the snap has come.
  f.swipeTo(at(2*COUNT)+60);f.stage.calls=[];
  for(let i=0;i<5;i++)f.check();
  assert.equal(f.stage.calls.length,0);
  f.swipeTo(at(2*COUNT));f.rest();
  assert.deepEqual(f.stage.calls,[{left:at(COUNT),behavior:'instant'}]);assert.equal(f.status().active,0);
  // The other way: from the first class, back past it onto the last.
  f.swipeTo(at(COUNT-1));assert.equal(f.status().active,7);f.stage.calls=[];f.rest();
  assert.deepEqual(f.stage.calls,[{left:at(2*COUNT-1),behavior:'instant'}]);
 }finally{f.close();}
});
test('going to a class takes its nearest copy, never the long way round',()=>{
 const f=setup({initial:7});try{f.c.select(0);f.tick();assert.equal(f.stage.scrollLeft,at(2*COUNT));assert.equal(f.status().active,0);
 }finally{f.close();}
});
test('the copies are hidden from screen readers and focus, drawn as the class they copy, and taken away with the strip',()=>{
 const f=setup();try{
  assert.equal(f.stage.added.length,2*COUNT);
  for(const copy of f.stage.added){assert.equal(copy.getAttribute('aria-hidden'),'true');assert.equal(copy.getAttribute('inert'),'');assert.equal(copy.getAttribute('data-copy'),'');}
  for(const actor of f.stage.children)assert.equal(actor.hasAttribute('data-copy'),false);
  const current=[...f.stage.children,...f.stage.added].filter(a=>a.hasAttribute('data-current')).map(a=>a.dataset.productId);
  assert.deepEqual(current,['p2','p2','p2']);
  f.c.destroy();assert.equal(f.stage.added.length,0);
  for(const actor of f.stage.children)assert.equal(actor.hasAttribute('data-current'),false);
 }finally{f.close();}
});
test('every vial stands on the centre pedestal crop as the room vial on that pedestal does, whichever class comes first',()=>{
 const seat=(id,x,y,h)=>({dataset:{productId:id},style:{getPropertyValue:k=>String({'--seat-x':x,'--seat-y':y,'--vial-h':h}[k]??'')}});
 const tops=[];
 // The live catalog can begin the strip on BPC-157, which the room shows on the left pedestal, lower and nearer.
 for(const first of [0,1,2]){
  const f=setup({shape:'tall',plate:[seat('p0',.168,.6083,.1417),seat('p1',.4963,.5714,.1417),seat('p2',.8306,.6166,.1417)],initial:first});
  try{tops.push([...f.stage.children,...f.stage.added].map(a=>a.map['.tm-procession-plinth'].style.top));}finally{f.close();}
 }
 // Room px: seat 0.5714 x 1934 above the centre pedestal's back rim, over the vial's 0.1417 x 1934.
 for(const t of tops.flat())assert.equal(t,tops[0][0]);
 assert.ok(Math.abs(parseFloat(tops[0][0])-91.1)<.1,tops[0][0]);
});
