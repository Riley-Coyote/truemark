import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Exercise the actual controller's event handlers and frame loop without GPU or
// browser timing. Visibility and arrival deliberately remain below their gates.
const bundled = await build({ entryPoints: ['src/brand/procession-controller.ts'], bundle: true, write: false, platform: 'node', format: 'esm', define: { 'import.meta.env.DEV': 'false' } });
const { createProcession } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
class Element extends EventTarget {
  style = { getPropertyValue: () => '0.5', removeProperty() {} };
  dataset = {}; attrs = new Set(); children = []; captures = new Set(); map = {};
  rect = { top: 1000, left: 0, width: 390, height: 270 };
  querySelector(key) { return this.map[key] ?? new Element(); }
  querySelectorAll() { return this.children; }
  getBoundingClientRect() { return this.rect; }
  append(...children) { this.children.push(...children); }
  prepend() {} remove() {} setAttribute(k) { this.attrs.add(k); }
  hasAttribute(k) { return this.attrs.has(k); }
  toggleAttribute(k, on) { on ? this.attrs.add(k) : this.attrs.delete(k); }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
  cloneNode() { return new Element(); }
  closest() { return null; }
}
function fixture(scrollY = 450, touch = false) {
  let time = 0, id = 0, reported;
  const frames = new Map();
  const win = new EventTarget(); Object.assign(win, { innerWidth: 390, innerHeight: 844, scrollY, setTimeout: () => 1, clearTimeout() {} });
  const home = new Element(), opening = new Element(), hero = new Element(), plate = new Element(), stage = new Element(), section = new Element();
  stage.rect.top = 180;
  stage.children = Array.from({length: 8}, (_, i) => { const el = new Element(); el.dataset.productId = `vial-${i}`; return el; });
  plate.children = stage.children;
  section.closest = selector => selector === ".tm-home" ? home : null;
  home.map['.tm-mist'] = opening; opening.map['.tm-mist-stage'] = hero; hero.map['.tm-room-plate'] = plate;
  section.map['.tm-procession-stage'] = stage; hero.map['.tm-seq-camera'] = new Element();
  const previous = new Map();
  const install = (name, value) => { previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, {value, configurable:true,writable:true}); };
  install('window', win);
  install('document', Object.assign(new EventTarget(), { hidden:false, body:new Element(), createElement:()=>new Element(), querySelector:()=>null, fonts:{ready:Promise.resolve()} }));
  install('matchMedia',()=>({matches:touch}));
  install('getComputedStyle',()=>({height:'200',width:'390',bottom:'66',left:'0',top:'0'}));
  install('ResizeObserver',class {observe() {} disconnect() {}});
  install('MutationObserver',class {observe() {} disconnect() {}});
  install('IntersectionObserver',class {observe() {} disconnect() {}});
  install('requestAnimationFrame',fn=>{frames.set(++id,fn);return id;});
  install('cancelAnimationFrame',i=>frames.delete(i));
  const controller = createProcession(section,[0,1,2,3,4,5,6,7],2,s=>reported=s);
  const tick = (n=1) => {for(let i=0;i<n;i++){time+=1000/60;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(time));}};
  const event = (type,x,y=120) => { const e=new Event(type,{cancelable:true});Object.assign(e,{isPrimary:true,pointerId:1,button:0,clientX:x,clientY:y});Object.defineProperty(e,'timeStamp',{value:time});(type==='pointerup'||type==='pointercancel'?win:stage).dispatchEvent(e);tick(); };
  tick();
  return { home, hero, stage, section, win, event, tick, controller, status:()=>reported, close(){controller.destroy();for(const [name,desc] of previous) desc?Object.defineProperty(globalThis,name,desc):delete globalThis[name];} };
}

for (const scrollY of [100, 450, 1800]) test(`short swipe advances independently of arrival and visibility at scroll ${scrollY}`,()=>{
 const f=fixture(scrollY);try{
  assert.equal(f.status().arrived,false);
  f.event('pointerdown',200);f.event('pointermove',155);f.tick(12);f.event('pointerup',155);f.tick(120);
  assert.equal(f.status().active,3);
  assert.equal(f.stage.captures.size,0);
  // Immediately reverse, without scrolling the page to a magic position.
  f.event('pointerdown',150);f.event('pointermove',195);f.tick(12);f.event('pointerup',195);f.tick(120);
  assert.equal(f.status().active,2);
 }finally{f.close();}
});
test('cancelled capture and vertical pan do not strand the next swipe',()=>{
 const f=fixture();try{
  f.event('pointerdown',200);f.event('pointermove',190,170);f.event('pointercancel',190,170);
  assert.equal(f.stage.captures.size,0);
  f.event('pointerdown',200);f.event('pointermove',160);f.event('lostpointercapture',160);f.tick(120);
  assert.equal(f.stage.dataset.dragging,undefined);
  f.event('pointerdown',200);f.event('pointermove',150);f.tick(12);f.event('pointerup',150);f.tick(120);
  assert.equal(f.status().active,3);
 }finally{f.close();}
});


test('touch enables the camera, follows scroll without damping, and resets manual ownership',()=>{
 const f=fixture(100,true);try{
  assert.equal(f.home.hasAttribute('data-procession-still'),false);
  const before=f.section.dataset.passage;
  f.win.scrollY=220;f.win.dispatchEvent(new Event('scroll'));f.tick();
  assert.notEqual(f.section.dataset.passage,before);
  assert.equal(Number(f.section.dataset.passage),Number((220/Number(f.section.dataset.scrollEnd)).toFixed(4)));
  f.event('pointerdown',200);f.event('pointermove',150);f.event('pointerup',150);f.tick(120);
  assert.equal(f.home.hasAttribute('data-procession-still'),true);
  f.win.scrollY=0;f.win.dispatchEvent(new Event('scroll'));f.tick();
  assert.equal(f.home.hasAttribute('data-procession-still'),false);
 }finally{f.close();}
});
test('touch-generated focus does not pause but keyboard focus does',()=>{
 const f=fixture();try{
  const touchFocus=new Event('focusin');f.section.matches=()=>false;f.section.dispatchEvent(touchFocus);f.tick();
  assert.equal(f.status().paused,false);
  f.section.matches=()=>true;f.section.dispatchEvent(new Event('focusin'));f.tick();
  assert.equal(f.status().paused,true);
 }finally{f.close();}
});

for (const end of ['pointerup', 'pointercancel']) test(`vertical touch keeps hero timeline through ${end}`,()=>{
 const f=fixture(450,true);try{
  const before=f.section.dataset.passage;
  f.event('pointerdown',200);
  assert.equal(f.home.hasAttribute('data-procession-still'),false,'contact must not skip to arrival');
  f.event('pointermove',195,180);f.event(end,195,180);
  assert.equal(f.home.hasAttribute('data-procession-still'),false);
  assert.equal(f.section.dataset.passage,before);
 }finally{f.close();}
});
test('phone toolbar height changes do not rewrite the camera path',()=>{
 const f=fixture(100,true);try{
  const camera=f.hero.map['.tm-seq-camera'];
  const before=camera.style.transform;
  f.win.innerHeight+=100;f.win.dispatchEvent(new Event('resize'));f.tick();
  assert.equal(camera.style.transform,before);
 }finally{f.close();}
});

// The fixture's section stands 1000px below the screen's top, under an 80px header: its scroll end is 896px past the
// fixture's scroll.
const scrollTo = (f, y) => { f.win.scrollY = y; f.win.dispatchEvent(new Event('scroll')); f.tick(90); };
test('the collection stands real and usable short of its scroll end, with its copies put away', () => {
  const f = fixture(9000); try {
    const end = Number(f.section.dataset.scrollEnd);
    assert.ok(9000 / end > .9 && 9000 / end < .95, 'stopped between arrival and the exact end');
    assert.equal(f.status().arrived, true);
    assert.equal(f.home.hasAttribute('data-procession-flight'), false);
    assert.equal(f.stage.children[0].style.opacity, '1');
  } finally { f.close(); }
});
test('scrolling back up part way keeps the class; only the opening itself starts the collection again', () => {
  const f = fixture(9000); try {
    const end = Number(f.section.dataset.scrollEnd);
    f.controller.step(1); f.tick(60);
    assert.equal(f.status().active, 3);
    scrollTo(f, Math.round(end * .5));
    scrollTo(f, 9000);
    assert.equal(f.status().active, 3, 'the reader keeps the class they were on');
    scrollTo(f, 0);
    scrollTo(f, 9000);
    assert.equal(f.status().active, 2, 'back at the opening, the collection starts in the room\'s order');
  } finally { f.close(); }
});
