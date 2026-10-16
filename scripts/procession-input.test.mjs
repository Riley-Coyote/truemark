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
function fixture(scrollY = 450) {
  let time = 0, id = 0, reported;
  const frames = new Map();
  const win = new EventTarget(); Object.assign(win, { innerWidth: 390, innerHeight: 844, scrollY, setTimeout: () => 1, clearTimeout() {} });
  const home = new Element(), opening = new Element(), hero = new Element(), plate = new Element(), stage = new Element(), section = new Element();
  stage.children = Array.from({length: 8}, (_, i) => { const el = new Element(); el.dataset.productId = `vial-${i}`; return el; });
  plate.children = stage.children;
  section.closest = () => home;
  home.map['.tm-mist'] = opening; opening.map['.tm-mist-stage'] = hero; hero.map['.tm-room-plate'] = plate;
  section.map['.tm-procession-stage'] = stage;
  const previous = new Map();
  const install = (name, value) => { previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, {value, configurable:true,writable:true}); };
  install('window', win);
  install('document', Object.assign(new EventTarget(), { hidden:false, body:new Element(), createElement:()=>new Element(), querySelector:()=>null, fonts:{ready:Promise.resolve()} }));
  install('matchMedia',()=>({matches:false}));
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
  return { stage, section, win, event, tick, status:()=>reported, close(){controller.destroy();for(const [name,desc] of previous) desc?Object.defineProperty(globalThis,name,desc):delete globalThis[name];} };
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
