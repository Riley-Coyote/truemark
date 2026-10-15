/**
 * The light on the home page: where the page stands in each of its two passages (atmosphere.css).
 *
 * A passage is the space between the last words lit by one light and the first lit by the other: the catalog's last
 * rows and the night's first, the record's last and the closing's first. It is ordinary section spacing; the light
 * changes behind the words on either side of it, not in added space. Seen as a view timeline over the whole screen, it
 * has three phases, as CSS names them: entry (the passage coming up from the screen's foot: only the words above it
 * are on screen), contain (both are) and exit (only the words below). `phaseProgress` gives how far through them the
 * page is, 0 to 3, a phase each. Before its entry each passage has a lead-in (`passageAt`, -1 to 0): the light
 * begins to change while the words above it are still passing.
 *
 * The light itself is drawn as the sky stands at a few moments of each passage (DUSK, DAWN): each moment a still plate
 * (atmosphere.css), and between two moments the later plate fades in over the earlier, so the browser only ever
 * changes a layer's opacity, never repaints (Atmosphere.tsx). Each moment also carries how light the sky is
 * overhead and low down, which is what the words and the header are inked for. Every plate and every blend between
 * two was checked against both inks before it was written (tools/landing/r9/layout/sky.py).
 */

/** Whether the header follows the light on the home page, white glass by day and dark glass by night. Riley
 *  hasn't decided on it: false switches it off cleanly, and the header stays as it is everywhere. */
export const HEADER_FOLLOWS_LIGHT = true;

/** Whether evening mist drifts low through the dusk passage (dusk-mist.ts). Off: in the render it reads as a faint
 *  lift rather than air, and it spends the contrast margin of the night's first words. True turns it on. */
export const DUSK_MIST = false;

/** The passage's top edge on screen, its height, and the screen's band below the header (its top and foot). */
export type Passage = { top: number; height: number; viewTop: number; viewFoot: number };

/** How far through a passage's three phases the page is: 0 before its entry, 3 once it has left, a phase each. */
export function phaseProgress({ top, height, viewTop, viewFoot }: Passage): number {
  const view = Math.max(1, viewFoot - viewTop);
  const span = Math.max(1, height);
  // How far the passage has risen since its top edge met the screen's foot (the start of its cover range).
  const risen = viewFoot - top;
  const short = Math.min(span, view), long = Math.max(span, view);
  if (risen <= 0) return 0;
  if (risen < short) return risen / short;
  if (risen < long) return long === short ? 2 : 1 + (risen - short) / (long - short);
  if (risen < long + short) return 2 + (risen - long) / short;
  return 3;
}


/** A moment of a passage: where it stands (-1 to 3: the lead-in, then a phase each), and how light the sky is then
 *  overhead (top) and low, at the screen's foot (foot), in OKLab lightness. Its colours are the plate of the same
 *  number (tokens.css). */
export type Moment = { at: number; top: number; foot: number };

/** How long each passage's lead-in is, as a share of the screen's height: the light begins to change while the words
 *  above the passage are still passing. */
export const LEAD = 0.45;

/** Where the dusk turns: the catalog's words turn from deep ink to light (home.css, data-ink), the header to its night
 *  glass, and the sky steps once across the narrow band where neither ink keeps AA, just before the night's first words
 *  can come on screen (at 1, as the passage's foot reaches the screen's foot). */
export const DUSK_TURN = 0.895;

/** The dusk. Over the lead-in the sky darkens from overhead first, gathering colour, while low down a rose afterglow
 *  gathers; every pixel stays light enough for the catalog's deep ink (Y 0.196 and above). Either side of the turn the
 *  sky steps as little as AA allows (0.59 to 0.565 overhead), and the catalog's words turn to light. Then the night
 *  comes on, overhead first, the rose low the last of it to go, dark enough for white everywhere (Y 0.176 and below). */
export const DUSK: Moment[] = [
  { at: -1, top: 0.994, foot: 0.994 },
  { at: -0.62, top: 0.93, foot: 0.976 },
  { at: -0.3, top: 0.835, foot: 0.93 },
  { at: 0, top: 0.735, foot: 0.85 },
  { at: 0.4, top: 0.665, foot: 0.735 },
  { at: 0.72, top: 0.628, foot: 0.66 },
  { at: 0.89, top: 0.5896, foot: 0.6 },
  { at: 0.9, top: 0.5652, foot: 0.5736 },
  { at: 1.25, top: 0.49, foot: 0.53 },
  { at: 1.65, top: 0.4, foot: 0.465 },
  { at: 2.05, top: 0.31, foot: 0.38 },
  { at: 2.45, top: 0.235, foot: 0.285 },
  { at: 2.75, top: 0.19, foot: 0.21 },
  { at: 3, top: 0.162, foot: 0.162 },
];

/** The dawn, its own event, cool and clear. Over the lead-in and the entry the light comes back low first, while
 *  everywhere the record's words can be it stays dark enough for their white. Through the middle phase the light rises
 *  behind the gap between the record and the closing: the plates' turn from dark enough for white to light enough
 *  for deep ink rides that gap up the screen (at every size, for any gap from a tenth of the screen), and the light
 *  settles into the paper as the closing's first words reach the top. */
export const DAWN: Moment[] = [
  { at: -1, top: 0.162, foot: 0.162 },
  { at: -0.5, top: 0.168, foot: 0.29 },
  { at: 0, top: 0.18, foot: 0.45 },
  { at: 0.5, top: 0.19, foot: 0.535 },
  { at: 1, top: 0.2504, foot: 0.5873 },
  { at: 1.1, top: 0.2504, foot: 0.6193 },
  { at: 1.2, top: 0.2504, foot: 0.6584 },
  { at: 1.3, top: 0.2504, foot: 0.7173 },
  { at: 1.4, top: 0.2504, foot: 0.8086 },
  { at: 1.5, top: 0.2504, foot: 0.9422 },
  { at: 1.6, top: 0.3454, foot: 0.985 },
  { at: 1.7, top: 0.4175, foot: 0.985 },
  { at: 1.8, top: 0.4728, foot: 0.985 },
  { at: 1.9, top: 0.5167, foot: 0.985 },
  { at: 2, top: 0.5534, foot: 0.985 },
  { at: 2.4, top: 0.74, foot: 0.985 },
  { at: 2.8, top: 0.994, foot: 0.994 },
];

/** Where the sky stands: the plate below and the plate fading in over it (each named for its passage and moment, as
 *  atmosphere.css draws it), how far that one has faded in, and the light overhead and low down. */
export type Sky = { under: string; over: string; mix: number; top: number; foot: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Smooth from 0 at `a` to 1 at `b` (either way round). */
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function within(moments: Moment[], name: string, t: number): Sky {
  let k = 0;
  while (k < moments.length - 2 && t >= moments[k + 1].at) k++;
  const a = moments[k], b = moments[k + 1];
  const mix = clamp01((t - a.at) / (b.at - a.at));
  return { under: `${name}${k}`, over: `${name}${k + 1}`, mix, top: a.top + (b.top - a.top) * mix, foot: a.foot + (b.foot - a.foot) * mix };
}

/** The sky at a scroll position, from how far through each passage the page is (passageAt, -1 to 3). */
export function skyAt(duskT: number, dawnT: number): Sky {
  const last = (moments: Moment[]) => moments[moments.length - 1].at;
  return dawnT > -1 ? within(DAWN, "dawn-", Math.min(last(DAWN), dawnT)) : within(DUSK, "dusk-", Math.max(-1, Math.min(3, duskT)));
}

/** How far through a passage the page is, with its lead-in: -1 to 0 while the passage is still below the screen, by at
 *  most `lead` pixels; then its three phases (phaseProgress). */
export function passageAt(passage: Passage, lead: number): number {
  const below = passage.top - passage.viewFoot;
  if (below <= 0) return phaseProgress(passage);
  return -clamp01(below / Math.max(1, lead));
}

/** The window light through the dusk (atmosphere.css, .tm-atmo-window): how strongly it shows (0 to 1), how far it
 *  has blushed to rose, and how far the sun has gone down (0 to 1: the panes lengthen and sink with it). It shows as
 *  the room darkens enough to see light in it, over the catalog's deep ink only (it only ever lightens the sky), and
 *  goes out as the dusk turns, with the night's own beam coming up on the vial (`stage`, 0 to 1). Not at dawn: the
 *  dawn is clear. */
export function windowLight(duskT: number, dawnT: number, stage: number): { on: number; rose: number; down: number } {
  if (dawnT > -1) return { on: 0, rose: 1, down: 1 };
  const on = smooth(-0.75, -0.2, duskT) * (1 - smooth(DUSK_TURN - 0.5, DUSK_TURN - 0.06, duskT)) * (1 - clamp01(stage));
  return { on, rose: smooth(-0.45, 0.6, duskT), down: clamp01((duskT + 1) / (DUSK_TURN + 1)) };
}

/** How far each ink follows the light, 0 (at rest) to 1, so it keeps AA wherever the sky stands, and whether the
 *  catalog's words have turned to light (from the dusk's turn until the dawn begins, by which time they are long gone). */
export function inkFollow(duskT: number, dawnT: number, sky: Sky): { catalog: number; lit: boolean; night: number; closing: number } {
  const dawn = dawnT > -1;
  // The catalog's dark ink deepens to the night floor's as the light overhead (where its last words go) falls.
  const catalog = dawn ? 1 : clamp01((0.99 - sky.top) / 0.08);
  const lit = !dawn && duskT >= DUSK_TURN;
  // The night's light ink is lit to the paper's white while the sky behind its words is lighter than the night: low
  // down as the dusk brings them up, and wherever the dawn's light has reached while they are still on screen.
  const behind = dawn ? Math.max(sky.top, sky.foot) : duskT >= 3 ? 0.162 : sky.foot;
  const night = smooth(0.2, 0.3, behind);
  // The closing's dark ink stays deep until the light overhead is all but paper.
  const closing = dawn ? clamp01((0.99 - sky.top) / 0.08) : 1;
  return { catalog, lit, night, closing };
}

/** The header's glass is tinted along the sky overhead (--tm-sky-0 to 6, tokens.css): how far down it, 0 to 1. */
const OVERHEAD = [0.994, 0.905, 0.775, 0.615, 0.455, 0.31, 0.168];
export function overheadDark(top: number): number {
  if (top >= OVERHEAD[0]) return 0;
  for (let k = 1; k < OVERHEAD.length; k++) if (top >= OVERHEAD[k]) return (k - 1 + (OVERHEAD[k - 1] - top) / (OVERHEAD[k - 1] - OVERHEAD[k])) / 6;
  return 1;
}

/**
 * Which glass the header wears, by the light overhead: night from the dusk's turn (the catalog's words turn to light
 * with it), day again once the dawn has lightened the sky overhead past the turn the other way (the record's words have
 * gone by then), with a little slack either way so a page left resting at a turn doesn't flicker.
 */
export function headerSkyAt(duskT: number, dawnT: number, was: "day" | "night"): "day" | "night" {
  const slack = was === "night" ? -0.04 : 0.04;
  return duskT >= DUSK_TURN + slack && dawnT < 2.1 - slack ? "night" : "day";
}

/** A value kept to steps of `step`, so a style is written only when it would visibly change. */
export const step = (v: number, size: number) => Math.round(v / size) * size;

/**
 * Which glass the header wears: night once the dusk passage is past the middle of the screen and until the dawn
 * passage is, with a little hysteresis, so a page left resting at the turn doesn't flicker.
 */
export function headerSky(dusk: Passage, dawn: Passage, was: "day" | "night", slack = 24): "day" | "night" {
  const middle = (dusk.viewTop + dusk.viewFoot) / 2;
  const duskCentre = dusk.top + dusk.height / 2;
  const dawnCentre = dawn.top + dawn.height / 2;
  const margin = was === "night" ? -slack : slack;
  return duskCentre < middle - margin && dawnCentre > middle + margin ? "night" : "day";
}
