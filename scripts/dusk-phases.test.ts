/** The home page's light reads each passage in three phases, as CSS's view timeline names them (entry, contain, exit); the script-driven fallback must place the page in them exactly as the scroll-driven form does. Run: npx tsx --test scripts/dusk-phases.test.ts */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { headerSky, phaseProgress } from '../src/brand/dusk.ts';

const view = { viewTop: 70, viewFoot: 900 }; // 830px below the header

test('a passage shorter than the screen: entry, both on screen, exit', () => {
  const at = (top: number) => phaseProgress({ top, height: 600, ...view });
  assert.equal(at(950), 0); // still below the screen
  assert.equal(at(900), 0); // its top edge at the screen's foot: entry begins
  assert.equal(at(600), 0.5); // half risen
  assert.equal(at(300), 1); // its foot at the screen's foot: contain begins
  assert.equal(at(185), 1.5); // halfway through the 230px both are on screen
  assert.equal(at(70), 2); // its top at the header: exit begins
  assert.equal(at(-230), 2.5);
  assert.equal(at(-530), 3); // its foot at the header: gone
});

test('a passage taller than the screen: the middle phase is the stretch with neither on screen', () => {
  const at = (top: number) => phaseProgress({ top, height: 1030, ...view });
  assert.equal(at(70), 1); // entry is the screen's height
  assert.equal(at(-30), 1.5);
  assert.equal(at(-130), 2);
  assert.equal(at(-960), 3);
});

test('progress never runs backwards as the page scrolls on', () => {
  let was = -1;
  for (let top = 1200; top > -900; top -= 7) {
    const t = phaseProgress({ top, height: 640, ...view });
    assert.ok(t >= was - 1e-9 && t >= 0 && t <= 3);
    was = t;
  }
});

test('the header turns to night past the dusk and back before the closing, with hysteresis', () => {
  const passage = (top: number, height = 600) => ({ top, height, ...view });
  const middle = 485;
  assert.equal(headerSky(passage(middle - 300 + 30), passage(4000), 'day'), 'day'); // the dusk's centre not yet past
  assert.equal(headerSky(passage(middle - 300 - 30), passage(4000), 'day'), 'night');
  assert.equal(headerSky(passage(middle - 300 + 10), passage(4000), 'night'), 'night'); // held within the slack
  assert.equal(headerSky(passage(-3000), passage(middle - 300 - 30), 'night'), 'day'); // the dawn's centre past
});

test('each passage has a lead-in before its entry: -1 to 0 while it is still below the screen', async () => {
  const { passageAt } = await import('../src/brand/dusk.ts');
  const at = (top: number) => passageAt({ top, height: 180, viewTop: 0, viewFoot: 900 }, 400);
  assert.equal(at(1400), -1); // further below than the lead-in
  assert.equal(at(1300), -1); // the lead-in begins
  assert.equal(at(1100), -0.5);
  assert.equal(at(900), 0); // its top edge at the screen's foot: entry begins, as phaseProgress has it
  assert.equal(at(720), 1);
  let was = -2;
  for (let top = 1500; top > -400; top -= 7) {
    const t = at(top);
    assert.ok(t >= was - 1e-9 && t >= -1 && t <= 3);
    was = t;
  }
});

test('the sky darkens overhead first at dusk, the afterglow low down is the last of it, and every moment keeps the inks readable', async () => {
  const { DUSK, DAWN, DUSK_TURN, skyAt, inkFollow } = await import('../src/brand/dusk.ts');
  for (const m of DUSK) assert.ok(m.top <= m.foot + 1e-9, `dusk ${m.at}: overhead no lighter than low down`);
  for (let k = 1; k < DUSK.length; k++) assert.ok(DUSK[k].top <= DUSK[k - 1].top && DUSK[k].foot <= DUSK[k - 1].foot, 'the dusk only darkens');
  for (let k = 1; k < DAWN.length; k++) assert.ok(DAWN[k].top >= DAWN[k - 1].top && DAWN[k].foot >= DAWN[k - 1].foot, 'the dawn only lightens');
  for (const m of DAWN) assert.ok(m.foot >= m.top - 1e-9, `dawn ${m.at}: the light comes back low first`);
  // Until the turn the catalog's deep ink is read everywhere on screen: overhead, the darkest, stays light enough.
  for (let t = -1; t < DUSK_TURN - 0.006; t += 0.01) assert.ok(skyAt(t, -1).top >= 0.585, `dusk ${t}`);
  // From the turn its words, and the night's, are light: low down, the lightest, is dark enough for white.
  for (let t = DUSK_TURN + 0.006; t <= 3; t += 0.01) assert.ok(skyAt(t, -1).foot <= 0.575, `dusk ${t}`);
  // The dawn: while the record's words can be anywhere on screen the light stays dark enough for white; it is paper
  // by the time the closing's first words reach the top.
  for (let t = -1; t <= 0.5; t += 0.01) assert.ok(skyAt(3, t).foot <= 0.54, `dawn ${t}`);
  assert.equal(skyAt(3, 3).top, DAWN[DAWN.length - 1].top);
  // The catalog's ink is all the way deep before the light overhead falls below 0.9, and turns to light at the turn.
  assert.equal(inkFollow(0, -1, skyAt(0, -1)).catalog, 1);
  assert.equal(inkFollow(DUSK_TURN - 0.01, -1, skyAt(DUSK_TURN - 0.01, -1)).lit, false);
  assert.equal(inkFollow(DUSK_TURN, -1, skyAt(DUSK_TURN, -1)).lit, true);
  assert.equal(inkFollow(3, 0, skyAt(3, 0)).lit, false);
  // The closing's ink stays deep until the light overhead is all but paper.
  assert.equal(inkFollow(3, 2.2, skyAt(3, 2.2)).closing, 1);
  assert.equal(inkFollow(3, 3, skyAt(3, 3)).closing, 0);
});

test('the plates hand over without a jump: at a moment the plate fading in has fully arrived', async () => {
  const { DUSK, DAWN, skyAt } = await import('../src/brand/dusk.ts');
  for (let k = 1; k < DUSK.length - 1; k++) {
    const before = skyAt(DUSK[k].at - 1e-6, -1), at = skyAt(DUSK[k].at, -1);
    assert.equal(before.over, at.under);
    assert.ok(before.mix > 0.999 && at.mix < 1e-3);
  }
  for (let k = 1; k < DAWN.length - 1; k++) {
    const before = skyAt(3, DAWN[k].at - 1e-6), at = skyAt(3, DAWN[k].at);
    assert.equal(before.over, at.under);
    assert.ok(before.mix > 0.999 && at.mix < 1e-3);
  }
  // The dusk's last plate is the dawn's first: the night between them is one.
  assert.ok(Math.abs(skyAt(3, -1).top - skyAt(3, -0.999999).top) < 1e-4 && skyAt(3, -1).over === "dusk-13" && skyAt(3, -1).mix === 1 && skyAt(3, -0.999999).under === "dawn-0");
});

test('the header turns to night at the dusk\'s turn and back once the dawn is up, with hysteresis', async () => {
  const { headerSkyAt } = await import('../src/brand/dusk.ts');
  assert.equal(headerSkyAt(0.85, -1, 'day'), 'day');
  assert.equal(headerSkyAt(0.95, -1, 'day'), 'night');
  assert.equal(headerSkyAt(0.87, -1, 'night'), 'night'); // held within the slack
  assert.equal(headerSkyAt(0.84, -1, 'night'), 'day');
  assert.equal(headerSkyAt(3, 2.0, 'night'), 'night');
  assert.equal(headerSkyAt(3, 2.2, 'night'), 'day');
});

test('the window light shows through the dusk only, over the deep ink, and is out by the turn and once the night beam is up', async () => {
  const { windowLight, DUSK_TURN } = await import('../src/brand/dusk.ts');
  assert.equal(windowLight(-1, -1, 0).on, 0);
  assert.ok(windowLight(0, -1, 0).on > 0.9);
  assert.equal(windowLight(DUSK_TURN, -1, 0).on, 0);
  assert.equal(windowLight(0, -1, 1).on, 0);
  assert.equal(windowLight(3, 1, 1).on, 0);
  assert.ok(windowLight(0.7, -1, 0).rose > 0.95 && windowLight(-0.5, -1, 0).rose === 0);
});
