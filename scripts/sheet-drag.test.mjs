import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';

// Exercise the real event handlers. Only React's ref and the browser's geometry,
// pointer capture and clock are fixtures; no copied gesture implementation.
const bundle = await build({
  stdin: { contents: `export { useSheetDrag } from './src/shop/sheet';`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm', loader: { '.css': 'empty' },
  plugins: [{ name: 'sheet-ref-fixture', setup(b) {
    b.onResolve({ filter: /^sheet-test-hooks$/ }, () => ({ path: 'hooks', namespace: 'sheet-hooks' }));
    b.onLoad({ filter: /.*/, namespace: 'sheet-hooks' }, () => ({
      contents: `export * from 'react'; export function useRef(value) { return { current: value }; }`,
      loader: 'js', resolveDir: process.cwd(),
    }));
    b.onLoad({ filter: /[/\\]shop[/\\]sheet\.tsx$/ }, async ({ path }) => ({
      contents: (await readFile(path, 'utf8')).replace('from "react";', 'from "sheet-test-hooks";'),
      loader: 'tsx', resolveDir: resolve(path, '..'),
    }));
  } }],
});
const { useSheetDrag } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

function fixture({ origin = 0, phone = true, control = false } = {}) {
  let time = 0, closes = 0;
  const previous = new Map(), captures = new Set();
  const panel = { style: { transition: '', transform: '' } };
  const install = (key, value) => {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  };
  install('window', { matchMedia: () => ({ matches: phone }) });
  install('performance', { now: () => time });
  install('getComputedStyle', () => ({ transform: origin ? `matrix(1, 0, 0, 1, 0, ${origin})` : 'none' }));
  install('DOMMatrixReadOnly', class { constructor() { this.m42 = origin; } });
  const handlers = useSheetDrag({ current: panel }, () => closes++);
  const target = { closest: () => control ? {} : null };
  const currentTarget = {
    setPointerCapture: id => captures.add(id),
    hasPointerCapture: id => captures.has(id),
    releasePointerCapture: id => captures.delete(id),
  };
  return {
    panel, captures,
    closes: () => closes,
    tick: ms => { time += ms; },
    send(type, y, extra = {}) {
      handlers[type]({ target, currentTarget, pointerType: 'touch', isPrimary: true, pointerId: 1, clientY: y, ...extra });
    },
    close() {
      for (const [key, descriptor] of previous) descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key];
    },
  };
}

for (const cancel of ['onPointerCancel', 'onLostPointerCapture']) test(`${cancel} settles a long drag without dismissing`, () => {
  const f = fixture(); try {
    f.send('onPointerDown', 20); f.tick(30); f.send('onPointerMove', 180);
    f.send(cancel, 180);
    assert.equal(f.closes(), 0);
    assert.equal(f.panel.style.transform, '');
    assert.equal(f.panel.style.transition, '');
    assert.equal(f.captures.size, 0);
    f.send('onPointerUp', 180);
    assert.equal(f.closes(), 0);
  } finally { f.close(); }
});

test('a second finger cannot steal the active sheet drag', () => {
  const f = fixture(); try {
    f.send('onPointerDown', 20); f.tick(30); f.send('onPointerMove', 80);
    f.send('onPointerDown', 300, { pointerId: 2, isPrimary: false });
    f.send('onPointerMove', 400, { pointerId: 2, isPrimary: false });
    assert.equal(f.panel.style.transform, 'translateY(60px)');
    f.tick(30); f.send('onPointerMove', 100);
    assert.equal(f.panel.style.transform, 'translateY(80px)');
    f.send('onPointerCancel', 100);
  } finally { f.close(); }
});

test('a quick final flick works after holding the sheet still', () => {
  const f = fixture(); try {
    f.send('onPointerDown', 20); f.tick(1500);
    f.send('onPointerMove', 80);
    f.send('onPointerUp', 80);
    assert.equal(f.closes(), 1);
    assert.equal(f.captures.size, 0);
  } finally { f.close(); }
});

test('pausing a short pull or moving back toward rest cancels its flick', () => {
  for (const reverse of [false, true]) {
    const f = fixture(); try {
      f.send('onPointerDown', 20); f.tick(30); f.send('onPointerMove', 110);
      if (reverse) { f.tick(30); f.send('onPointerMove', 70); }
      else f.tick(140);
      f.send('onPointerUp', reverse ? 70 : 110);
      assert.equal(f.closes(), 0);
    } finally { f.close(); }
  }
});

test('taking over an unfinished transition preserves the current position', () => {
  const f = fixture({ origin: 72 }); try {
    f.send('onPointerDown', 100);
    assert.equal(f.panel.style.transform, 'translateY(72px)');
    f.tick(30); f.send('onPointerMove', 110);
    assert.equal(f.panel.style.transform, 'translateY(82px)');
    f.send('onPointerCancel', 110);
  } finally { f.close(); }
});

test('upward movement has bounded resistance and returns to rest', () => {
  const f = fixture(); try {
    f.send('onPointerDown', 100); f.tick(30); f.send('onPointerMove', -100);
    const y = parseFloat(f.panel.style.transform.slice('translateY('.length));
    assert.ok(y < 0 && y > -24);
    f.send('onPointerUp', -100);
    assert.equal(f.closes(), 0);
    assert.equal(f.panel.style.transform, '');
  } finally { f.close(); }
});

test('mouse input, controls and wide screens do not initiate a sheet drag', () => {
  for (const config of [{}, { control: true }, { phone: false }]) {
    const f = fixture(config); try {
      f.send('onPointerDown', 20, Object.keys(config).length ? {} : { pointerType: 'mouse' });
      assert.equal(f.captures.size, 0);
      assert.equal(f.panel.style.transition, '');
    } finally { f.close(); }
  }
});
