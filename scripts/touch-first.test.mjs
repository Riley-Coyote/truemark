import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Which devices get the home page's phone/tablet path (Procession.tsx, WallLight.tsx). A touchscreen laptop reports a
// fine main pointer that hovers and, besides it, a coarse one: it must keep the desktop page.
const bundle = await build({ entryPoints: ['src/brand/touch-first.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { TOUCH_FIRST } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

/** A media query list read as a browser reads these features: any comma-separated query, every "and" of it. */
function matches(query, device) {
  return query.split(',').some((part) => part.split(/\band\b/).every((feature) => {
    const [, name, value] = /\(\s*([\w-]+)\s*:\s*([\w.]+)\s*\)/.exec(feature.trim()) ?? [];
    if (name === 'max-width') return device.width <= parseFloat(value);
    if (name === 'pointer') return device.pointer === value;
    if (name === 'hover') return device.hover === value;
    if (name === 'any-pointer') return device.anyPointer.includes(value);
    if (name === 'any-hover') return device.anyHover.includes(value);
    throw new Error(`unread feature ${feature}`);
  }));
}

const devices = {
  'desktop with a mouse': [{ width: 1440, pointer: 'fine', hover: 'hover', anyPointer: ['fine'], anyHover: ['hover'] }, false],
  'touchscreen laptop with a trackpad': [{ width: 1440, pointer: 'fine', hover: 'hover', anyPointer: ['fine', 'coarse'], anyHover: ['hover'] }, false],
  'touchscreen laptop, narrow window': [{ width: 640, pointer: 'fine', hover: 'hover', anyPointer: ['fine', 'coarse'], anyHover: ['hover'] }, true],
  'phone': [{ width: 393, pointer: 'coarse', hover: 'none', anyPointer: ['coarse'], anyHover: ['none'] }, true],
  'tablet held sideways': [{ width: 1366, pointer: 'coarse', hover: 'none', anyPointer: ['coarse'], anyHover: ['none'] }, true],
  'narrow desktop window': [{ width: 700, pointer: 'fine', hover: 'hover', anyPointer: ['fine'], anyHover: ['hover'] }, true],
};

for (const [name, [device, phonePath]] of Object.entries(devices)) {
  test(`${name} ${phonePath ? 'gets' : 'does not get'} the phone/tablet home page`, () => {
    assert.equal(matches(TOUCH_FIRST, device), phonePath);
  });
}
