import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, advanceDrift, distance, passageFoot, pose } from '../src/brand/procession-math';

test('continuous drift starts gently and travels identically at 30, 60 and 120 fps', () => {
  const first = advanceDrift(2, 0, 1 / 60);
  assert.ok(first.position > 2 && first.position - 2 < .00003);
  const positions = [30, 60, 120].map(fps => {
    let position = 2, velocity = 0;
    for (let i = 0; i < fps * 100; i++) {
      const next = advanceDrift(position, velocity, 1 / fps);
      assert.ok(next.position > position);
      assert.ok(next.velocity >= velocity && next.velocity <= .08);
      ({ position, velocity } = next);
    }
    assert.ok(Math.abs(velocity - .08) < .000001);
    // Eight classes in 100s, less the 0.04-class distance used by the ramp.
    assert.ok(Math.abs(position - 9.96) < .000001);
    return position;
  });
  assert.ok(Math.max(...positions) - Math.min(...positions) < .0000001);
});

test('the passage reaches both original objects exactly and joins native scrolling smoothly', () => {
  const from = 650, to = 1600, scroll = 900, trough = 2400;
  assert.equal(passageFoot(0, from, to, scroll, trough), from);
  assert.equal(passageFoot(1, from, to, scroll, trough), to);
  // The document-space endpoint is stationary: the viewport inherits -scroll velocity.
  const epsilon = .00001;
  const velocity = (passageFoot(1, from, to, scroll, trough) - passageFoot(1 - epsilon, from, to, scroll, trough)) / epsilon;
  assert.ok(Math.abs(velocity) < 1);
  for (const t of [.28, .35, .42, .48]) {
    const cap = passageFoot(t, from, to, scroll, trough) - scroll * t - 300;
    assert.ok(cap > 844, `The original order must reset below the frame at ${t}`);
  }
});

test('spring behaves the same at 30, 60 and 120 fps, and cannot overshoot from rest', () => {
  for (const fps of [30, 60, 120]) {
    let p = 0, v = 0;
    for (let i = 0; i < fps * 2; i++) {
      ({ position: p, velocity: v } = advance(p, v, 1, 1 / fps));
      assert.ok(p >= 0 && p <= 1);
    }
    assert.ok(Math.abs(p - 1) < .00001);
  }
});

test('rapid reversal retains position and velocity instead of snapping to a class', () => {
  let p = 0, v = 0;
  for (let i = 0; i < 20; i++) ({ position: p, velocity: v } = advance(p, v, 1, 1 / 60));
  const next = advance(p, v, -1, 1 / 120);
  assert.ok(Math.abs(next.position - p) < .05);
  for (let i = 0; i < 240; i++) ({ position: p, velocity: v } = advance(p, v, -1, 1 / 120));
  assert.ok(Math.abs(p + 1) < .00001);
});

test('center scale has no cusp, and the loop wraps outside the visible stage', () => {
  assert.equal(pose(-.01, 300, 330).scale, pose(.01, 300, 330).scale);
  assert.ok(pose(0, 300, 330).scale - pose(.001, 300, 330).scale < .000001);
  for (const width of [320, 390, 768, 1280, 1920]) {
    const spacing = width <= 700 ? width * .37 : Math.min(350, width * .235);
    assert.ok(Math.abs(pose(distance(4, 0, 8), spacing, 330).x) - 100 > width / 2);
  }
});
