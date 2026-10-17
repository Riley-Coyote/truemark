import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapScroll } from './compare-sync.js';
const desktop = [{key:'start',y:0},{key:'opening-end',y:1400},{key:'proof',y:2200},{key:'end',y:4000}];
const phone = [{key:'start',y:0},{key:'opening-end',y:1800},{key:'proof',y:2900},{key:'end',y:7000}];
test('camera passage preserves its progress across different viewport heights', () => {
  assert.equal(mapScroll(700, desktop, phone), 900);
});
test('responsive sections align locally instead of by total document percentage', () => {
  assert.equal(mapScroll(1800, desktop, phone), 2350);
  assert.equal(mapScroll(2350, phone, desktop), 1800);
});
test('ends clamp, unmatched content is skipped, reordered sections cannot reverse scrolling', () => {
  assert.equal(mapScroll(-10, desktop, phone), 0);
  assert.equal(mapScroll(9999, desktop, phone), 7000);
  assert.equal(mapScroll(1400, desktop, [...phone, {key:'extra',y:1900}]), 1800);
  assert.ok(Number.isFinite(mapScroll(1700, desktop, phone.map(p=>p.key==='proof'? {...p,y:200}:p))));
});

test('either viewport takes the lead after a route reload without echo loops', async () => {
  const { createCompareSync } = await import('./compare-sync.js');
  const saved = Object.fromEntries(['requestAnimationFrame','cancelAnimationFrame','ResizeObserver'].map(key=>[key, Object.getOwnPropertyDescriptor(globalThis,key)]));
  const pending = new Map(); let next = 0;
  globalThis.requestAnimationFrame = fn => { pending.set(++next,fn); return next; };
  globalThis.cancelAnimationFrame = id => pending.delete(id);
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  const flush = () => { const jobs = [...pending.values()]; pending.clear(); jobs.forEach(fn=>fn()); };
  const viewport = max => {
    const handlers = new Map();
    const win = { Event, CustomEvent, dispatchEvent(event) { handlers.get(event.type)?.forEach(fn=>fn(event)); }, scrollY:0, innerHeight:800, location:{href:'https://fixture.test/#/quality'},
      document:{body:{}, documentElement:{scrollHeight:max+800}, querySelector:()=>null, querySelectorAll:()=>[]},
      addEventListener(name,fn) { if (!handlers.has(name)) handlers.set(name,new Set()); handlers.get(name).add(fn); },
      removeEventListener(name,fn) { handlers.get(name)?.delete(fn); },
      scrollTo({top}) { this.scrollY=top; queueMicrotask(()=>this.emit()); },
      emit() { handlers.get('scroll')?.forEach(fn=>fn()); },
    };
    return win;
  };
  const bridge = createCompareSync();
  try {
    const desktop = viewport(1000), phone = viewport(2000);
    bridge.setEnabled(true);
    const detach = bridge.attach('desktop',desktop);
    bridge.attach('phone',phone);
    detach(); bridge.attach('desktop',desktop); // navigation changed the previous leader
    desktop.dispatchEvent(new Event("wheel")); desktop.scrollY=500; desktop.emit(); flush(); await Promise.resolve();
    assert.equal(phone.scrollY,1000);
    assert.equal(pending.size,0,'a mirrored scroll must not start an echo');
    phone.scrollY=998; phone.emit(); flush();
    assert.equal(desktop.scrollY,500,'follower layout adjustments cannot take over the source');
    phone.dispatchEvent(new Event("touchstart")); phone.scrollY=1500; phone.emit(); flush(); await Promise.resolve();
    assert.equal(desktop.scrollY,750);
    assert.equal(pending.size,0);
    const states = [];
    phone.addEventListener('tm-story-follow', event => {
      states.push(event.detail);
      phone.dispatchEvent(new CustomEvent('tm-story-state', { detail: event.detail }));
    });
    desktop.dispatchEvent(new Event('pointerdown'));
    desktop.dispatchEvent(new CustomEvent('tm-story-state', { detail: { open:true, clock:4200, paused:true } }));
    assert.deepEqual(states, [{ open:true, clock:4200, paused:true }], 'story is forwarded once without echo');
    let released = 0;
    phone.addEventListener('tm-story-release', () => released++);
    bridge.setEnabled(false);
    assert.equal(released, 1, 'unlink releases the follower clock');
    desktop.dispatchEvent(new CustomEvent('tm-story-state', { detail: { open:false, clock:0 } }));
    assert.equal(states.length, 1, 'unlinked stories remain independent');
    desktop.scrollY=100; desktop.emit(); flush(); await Promise.resolve();
    assert.equal(phone.scrollY,1500,'unlinked views remain independent');
  } finally {
    bridge.destroy();
    for (const [key,descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key];
    }
  }
});
