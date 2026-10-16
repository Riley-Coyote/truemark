import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';

// Run the real player, geometry and clock. Only React's effect/ref scheduling and
// the DOM are fixtures, so a viewport rebuild can be tested without browser timing.
const hookSource = `
let host;
export function useRef(value) {
  const index = host.index++;
  return host.refs[index] ??= { current: value };
}
export function useLayoutEffect(effect) { host.effect = effect; }
export function useEffect() {}
export function useState() { throw Error('Unexpected state hook'); }
export function useSyncExternalStore() { throw Error('Unexpected store hook'); }
export function createHooks() {
  const state = { refs: [], index: 0, effect: null, cleanup: null };
  return {
    render(callback) {
      state.cleanup?.(); state.cleanup = null;
      state.index = 0; state.effect = null; host = state;
      try { callback(); } finally { host = null; }
      state.cleanup = state.effect?.();
    },
    close() { state.cleanup?.(); state.cleanup = null; },
  };
}`;
const bundle = await build({
  stdin: { contents: `export { useFilm } from './src/brand/Sequence.tsx'; export { createHooks } from 'film-test-hooks';`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm', loader: { '.css': 'empty' },
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'film-hook-fixture', setup(b) {
    b.onResolve({ filter: /^film-test-hooks$/ }, () => ({ path: 'hooks', namespace: 'film-hooks' }));
    b.onLoad({ filter: /.*/, namespace: 'film-hooks' }, () => ({ contents: hookSource, loader: 'js' }));
    b.onLoad({ filter: /[/\\]brand[/\\]Sequence\.tsx$/ }, async ({ path }) => ({
      contents: (await readFile(path, 'utf8')).replace('from "react";', 'from "film-test-hooks";') + '\nexport { useFilm };',
      loader: 'tsx', resolveDir: resolve(path, '..'),
    }));
  } }],
});
const { useFilm, createHooks } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

class Element extends EventTarget {
  attrs = new Map(); nodes = {}; lists = {};
  clientWidth = 1280; clientHeight = 620;
  offsetLeft = 0; offsetTop = 0; offsetWidth = 1280; offsetHeight = 620;
  style = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
  querySelector(selector) { return this.nodes[selector] ?? null; }
  querySelectorAll(selector) { return this.lists[selector] ?? []; }
  closest() { return null; }
  contains() { return false; }
  setAttribute(k, v) { this.attrs.set(k, v); }
  getAttribute(k) { return this.attrs.get(k) ?? null; }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }
  toggleAttribute(k, value) { value ? this.attrs.set(k, '') : this.attrs.delete(k); }
  getBoundingClientRect() { return { left: 0, top: 100, width: this.clientWidth, height: this.clientHeight }; }
}
function fixture(scrollY = 0) {
  let time = 0, id = 0;
  const frames = new Map(), timers = new Map(), states = [], previous = new Map(), fonts = [];
  const hooks = createHooks(), win = new EventTarget();
  const root = new Element(), section = new Element(), view = new Element(), camera = new Element(), html = new Element(), body = new Element();
  root.nodes['.tm-seq-view'] = view; root.nodes['.tm-seq-camera'] = camera;
  root.closest = selector => selector === '.tm-mist' ? section : null;
  Object.assign(win, { scrollY, devicePixelRatio: 1, scrollTo() {},
    setTimeout(fn) { timers.set(++id, fn); return id; }, clearTimeout(key) { timers.delete(key); },
  });
  const doc = Object.assign(new EventTarget(), { documentElement: html, body, querySelector: () => null, getElementById: () => null, activeElement: null, fonts: { ready: { then(fn) { fonts.push(fn); } } } });
  const install = (key, value) => {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  };
  install('window', win); install('document', doc); install('Element', Element);
  install('CSS', { escape: value => value });
  install('ResizeObserver', class { observe() {} disconnect() {} });
  install('performance', { now: () => time });
  install('requestAnimationFrame', fn => { frames.set(++id, fn); return id; });
  install('cancelAnimationFrame', key => frames.delete(key));
  win.addEventListener('tm-story-state', e => states.push(e.detail));
  const track = { current: root }, go = { current() {} }, skip = { current() {} };
  let base = { box: { left: 0, top: 0, width: 1280, height: 720 }, seat: { x: .5, y: .6, h: .2 }, plateScale: 1, tall: false };
  const render = (on = true) => hooks.render(() => useFilm(track, on, base, true, go, skip));
  render();
  const key = key => { const event = new Event('keydown', { cancelable: true }); Object.assign(event, { key }); win.dispatchEvent(event); };
  const tick = (count = 1) => { for (let i = 0; i < count; i++) { time += 16; const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn(time)); } };
  return { win, root, section, html, states, frames, key, tick, render,
    open() { win.dispatchEvent(new Event('tm-story-open')); },
    resize() { base = { ...base, box: { ...base.box, width: 390 }, tall: true }; render(); },
    takeFrames() { const batch = [...frames.values()]; frames.clear(); return () => batch.forEach(fn => fn(time)); },
    timers() { const batch = [...timers.values()]; timers.clear(); batch.forEach(fn => fn()); },
    fonts() { fonts.forEach(fn => fn()); },
    close() { hooks.close(); for (const [key, descriptor] of previous) descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]; },
    unmount() { hooks.close(); },
  };
}

test('viewport rebuild retains the clock and pause state without broadcasting a closed story', () => {
  const f = fixture(); try {
    f.open(); f.tick(50); f.key(' ');
    const before = f.states.at(-1); assert.ok(before.clock > 0); assert.equal(before.paused, true);
    f.states.length = 0; f.resize();
    assert.equal(f.section.getAttribute('data-story'), 'open');
    assert.equal(f.states.at(-1).clock, before.clock);
    assert.equal(f.states.at(-1).paused, true);
    assert.ok(f.states.every(state => state.open), 'Compare must not receive a temporary close or restart');
    f.key('Escape'); f.timers();
    assert.equal(f.html.style.overflow, '');
    assert.equal(f.section.getAttribute('data-story'), null);
  } finally { f.close(); }
});

test('repeated opening requests share one frame and Escape cancels the pending open', () => {
  const f = fixture(200); try {
    f.open(); f.open(); assert.equal(f.frames.size, 1);
    f.key('Escape'); f.win.scrollY = 0; f.tick(100);
    assert.equal(f.frames.size, 0);
    assert.equal(f.section.getAttribute('data-story'), null);
    assert.notEqual(f.html.style.overflow, 'hidden');
  } finally { f.close(); }
});

for (const end of ['unmount', 'motion off']) test(`an already queued opening callback cannot lock scrolling after ${end}`, () => {
  const f = fixture(200); try {
    f.open(); const late = f.takeFrames();
    if (end === 'unmount') f.unmount(); else f.render(false);
    f.win.scrollY = 0; late(); f.tick(100);
    assert.equal(f.section.getAttribute('data-story'), null);
    assert.notEqual(f.html.style.overflow, 'hidden');
    assert.equal(f.frames.size, 0);
  } finally { f.close(); }
});

test('an opening in progress transfers to the replacement player after resizing', () => {
  const f = fixture(200); try {
    f.open(); const late = f.takeFrames(); f.resize();
    f.win.scrollY = 0; late(); f.tick();
    assert.equal(f.section.getAttribute('data-story'), 'open');
    assert.equal(f.html.style.overflow, 'hidden');
    f.key('Escape'); f.timers();
    assert.equal(f.html.style.overflow, '');
  } finally { f.close(); }
});

test('a resize during closing completes the close and releases scrolling', () => {
  const f = fixture(); try {
    f.open(); f.tick(20); f.key('Escape'); f.resize(); f.timers();
    assert.equal(f.section.getAttribute('data-story'), null);
    assert.equal(f.html.style.overflow, '');
    assert.equal(f.frames.size, 0);
  } finally { f.close(); }
});

test('late font loading cannot write the disposed player geometry', () => {
  const f = fixture(); try {
    f.open(); f.unmount();
    assert.equal(f.root.style['--tm-seq-hero-h'], undefined);
    f.fonts();
    assert.equal(f.root.style['--tm-seq-hero-h'], undefined);
    assert.equal(f.section.getAttribute('data-story'), null);
  } finally { f.close(); }
});
