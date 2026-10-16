import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, advanceDrift, distance, HANDOFF, pose, scene, swipeTarget } from '../src/brand/procession-math';

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

test('the entire seated room clears the frame before copies can take over', () => {
  for (const [height, pivotY, capTop, depth] of [[900, 580, 450, 2.1], [844, 570, 420, 2.1], [568, 370, 280, 1.6]]) {
    const fall = height + 32 - (pivotY + (capTop - pivotY) * depth);
    const start = scene(0, 720, pivotY, depth, fall);
    assert.equal(start.zoom, 1); assert.equal(start.x, 0); assert.equal(start.y, 0);
    const end = scene(HANDOFF, 720, pivotY, depth, fall);
    assert.ok(Math.abs(end.y + capTop * end.zoom - height - 32) < .000001);
    for (const progress of [.05, .1, .2, .3, HANDOFF]) {
      const camera = scene(progress, 720, pivotY, depth, fall);
      const foot = capTop + 200, heroOffset = 80, localFoot = foot - heroOffset;
      const localCameraY = camera.y + heroOffset * (camera.zoom - 1);
      // A camera-local seat and its photographic copy share one matrix under any header.
      assert.ok(Math.abs(heroOffset + localCameraY + localFoot * camera.zoom - (camera.y + foot * camera.zoom)) < .000001);
      const vialCap = camera.y + capTop * camera.zoom;
      const vialFoot = camera.y + foot * camera.zoom;
      assert.ok(Math.abs(vialFoot - vialCap - 200 * camera.zoom) < .000001);
    }
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
    const spacing = Math.max(width <= 700 ? width * .56 : Math.min(350, width * .235), 330 * 1.12);
    assert.ok(Math.abs(pose(distance(4, 0, 8), spacing, 330).x) - 100 > width / 2);
  }
});


test('short deliberate swipes advance from any drifting phase in either direction', () => {
  for (const spacing of [180, 220, 350]) {
    for (const start of [0, .3, .7, 7.95]) {
      assert.ok(swipeTarget(start, start + 40 / spacing, 0, spacing) >= Math.round(start) + 1);
      assert.ok(swipeTarget(start, start - 40 / spacing, 0, spacing) <= Math.round(start) - 1);
    }
  }
  assert.equal(swipeTarget(2, 2.05, 0, 220), 2);
  assert.equal(swipeTarget(2, 4.2, 0, 220), 4);
  assert.equal(swipeTarget(2, 2.2, 4, 220, true), 2);
});
