import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/brand/pinned-passage.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {createPinnedPassage}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

// A phone's page, as small as the passage needs: the opening's room with three seated vials, and the collection below.
class Style{constructor(){this.props=new Map();this.writes=[];}setProperty(k,v){this.props.set(k,v);this.writes.push(k);}removeProperty(k){this.props.delete(k);}getPropertyValue(k){return this.props.get(k)??'';}}
class El extends EventTarget{
  constructor(name,rect={}){super();this.name=name;this.style=new Style();this.map={};this.all={};this.attrs=new Map();this.rect={left:0,top:0,width:430,height:800,...rect};this.offsetHeight=this.rect.height;this.dataset={};}
  querySelector(q){return this.map[q]??null;} querySelectorAll(q){return this.all[q]??[];}
  getBoundingClientRect(){return {...this.rect,top:this.rect.top-globalThis.window.scrollY,bottom:this.rect.top+this.rect.height-globalThis.window.scrollY};}
  toggleAttribute(k,on){on?this.attrs.set(k,''):this.attrs.delete(k);} setAttribute(k,v){this.attrs.set(k,v);} removeAttribute(k){this.attrs.delete(k);}
  hasAttribute(k){return this.attrs.has(k);} closest(){return null;} prepend(){} append(){} remove(){} animate(){return {cancel(){}};} getAnimations(){return [];}
}
function setup(){
  const previous=new Map(),set=(k,v)=>{previous.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});};
  const home=new El('home'),opening=new El('opening'),hero=new El('hero',{top:140,height:815}),plate=new El('plate'),camera=new El('camera');
  const copy=new El('copy'),word=new El('word'),cue=new El('cue'),lead=new El('lead'),section=new El('section',{top:1170,height:760}),stage=new El('stage',{top:1320,height:300}),heading=new El('heading'),header=new El('header');
  home.map['.tm-mist']=opening;opening.map['.tm-mist-stage']=hero;opening.map['.tm-mist-foot']=lead;
  Object.assign(hero.map,{'.tm-room-plate':plate,'.tm-seq-camera':camera,'.tm-mist-copy':copy,'.tm-mist-word':word,'.tm-story-cue':cue});
  section.map['.tm-procession-stage']=stage;section.map['.tm-procession-heading']=heading;
  plate.all['.tm-room-vial']=[.2,.5,.8].map(x=>{const v=new El('vial');v.style.props=new Map([['--seat-x',String(x)],['--seat-y','.7'],['--vial-h','.2']]);return v;});
  plate.map['.tm-room-still']={currentSrc:'room.webp',complete:false,naturalWidth:0,addEventListener(){}};header.offsetHeight=69;
  stage.all['.tm-procession-actor']=[new El('actor'),new El('actor')];
  let frames=[],now=0,resized,id=0;
  const win=Object.assign(new EventTarget(),{scrollY:0,innerWidth:430,innerHeight:932});
  set('window',win);set('document',Object.assign(new EventTarget(),{documentElement:new El('html'),querySelector:q=>q==='.tm-header'?header:null,createElement:()=>new El('made'),fonts:{ready:new Promise(()=>{})}}));
  set('getComputedStyle',el=>el===plate?{width:'430px',height:'800px',left:'0px',top:'0px'}:{top:'0px'});
  set('requestAnimationFrame',f=>{frames.push(f);return ++id;});set('cancelAnimationFrame',()=>{});
  set('ResizeObserver',class{constructor(cb){resized=cb;}observe(){}disconnect(){}});
  set('IntersectionObserver',class{observe(){}disconnect(){}});
  set('MutationObserver',class{observe(){}disconnect(){}});
  const passage=createPinnedPassage(home,section);
  const tick=()=>{for(let i=0;i<60&&frames.length;i++){const batch=frames;frames=[];now+=16.7;batch.forEach(f=>f(now));}};
  tick();
  return {home,camera,copy,heading,lead,word,win,passage,tick,
    scroll(y){win.scrollY=y;win.dispatchEvent(new Event('scroll'));tick();},
    resize(w,h){win.innerWidth=w;win.innerHeight=h;win.dispatchEvent(new Event('resize'));resized?.();tick();},
    close(){passage.destroy();for(const[k,v]of previous)v?Object.defineProperty(globalThis,k,v):delete globalThis[k];}};
}

test('at the top the held room rests exactly where the page laid it', () => {
  const t=setup();
  try {
    assert.ok(t.home.hasAttribute('data-procession-pinned'));
    assert.equal(t.home.style.getPropertyValue('--tm-pin-top'),'140px');
    assert.match(t.camera.style.getPropertyValue('transform'),/^translate3d\(0\.00px,0\.00px,0\) scale\(1\.0000\)$/);
  } finally { t.close(); }
});

test('scrolling moves only the held camera: nothing in the page\'s flow is moved to keep pace', () => {
  const t=setup();
  try {
    for(const y of [40,160,320,520,760]) t.scroll(y);
    assert.notEqual(t.camera.style.getPropertyValue('transform'),'translate3d(0.00px,0.00px,0) scale(1.0000)');
    for(const el of [t.copy,t.heading,t.lead,t.word]) {
      const moved=el.style.writes.filter(k=>k!=='opacity');
      assert.deepEqual(moved,[],`${el.name} was moved by ${moved.join(', ')}`);
    }
  } finally { t.close(); }
});

test('a toolbar\'s change of height mid-scroll does not measure the room again; turning the phone does', () => {
  const t=setup();
  try {
    t.scroll(300);
    t.home.style.props.set('--tm-pin-top','sentinel');
    t.resize(430,874);
    assert.equal(t.home.style.getPropertyValue('--tm-pin-top'),'sentinel');
    t.resize(932,430);
    assert.notEqual(t.home.style.getPropertyValue('--tm-pin-top'),'sentinel');
  } finally { t.close(); }
});

test('motion off lets the room go: no pin, and the camera\'s own styles removed', () => {
  const t=setup();
  try {
    t.scroll(300);
    t.passage.setMotion(false); t.tick();
    assert.ok(!t.home.hasAttribute('data-procession-pinned'));
    assert.equal(t.camera.style.getPropertyValue('transform'),'');
    assert.equal(t.camera.style.getPropertyValue('opacity'),'');
  } finally { t.close(); }
});

test('without the opening\'s room it holds nothing', () => {
  const section=new El('section');
  const passage=createPinnedPassage(new El('home'),section);
  assert.doesNotThrow(()=>{passage.setMotion(false);passage.destroy();});
});

test('what another writer changes (a page flight home) is written again on the next frame', () => {
  const t=setup();
  try {
    t.scroll(400);
    const held=t.camera.style.getPropertyValue('transform'), faded=t.copy.style.getPropertyValue('opacity');
    t.camera.style.removeProperty('transform'); t.copy.style.setProperty('opacity','1');
    t.scroll(401); t.scroll(400);
    const scale=v=>Number(/scale\(([\d.]+)\)/.exec(v)?.[1]);
    assert.ok(Math.abs(scale(t.camera.style.getPropertyValue('transform'))-scale(held))<0.01,'the held camera is set again');
    assert.equal(t.copy.style.getPropertyValue('opacity'),faded);
  } finally { t.close(); }
});
