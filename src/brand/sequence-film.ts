/*
 * The opening's closer look (Sequence.tsx), as pure functions of the scroll: how far through the story the reader is
 * (p, 0 at the top of the page, 1 where the stage lets go), where the camera stands in the room, where the featured vial
 * floats, and how much of each layer shows. Nothing here touches the page, so the whole film can be read, and tested,
 * as numbers.
 *
 * Six chapters, after Motion 04 (design-lab/motion, the version the client chose), told in the opening's own room: the
 * collection at rest; the approach, the featured vial lifting off its pedestal toward the reader; its label, decoded in
 * three details; the connection, its code opening Verify; the record its printed lot finds; the certificate behind the
 * record, read finding by finding. Then the vial comes home, the room comes back into focus, and the page goes on to the
 * collection's classes. The camera only leans in: the vial comes to the reader instead, drawn from its own large cutout,
 * so nothing is ever enlarged past its detail.
 */
import type { Box, Seat } from "./Rooms";

export type Pt = { x: number; y: number };
export type Span = readonly [number, number];
export type Rect = { left: number; top: number; right: number; bottom: number };

/* ---------- The featured vial, in its cutout's own pixels (578 × 1112) ---------- */

/** The cutout every vial is drawn from, in its own pixels. */
export const CUTOUT = { w: 578, h: 1112 } as const;
const ASPECT = CUTOUT.w / CUTOUT.h;
/** The label's three details, where the decoder's markers point (measured on the featured vial's photographed label,
 *  Semax's): the end of the compound's name, the start of the printed lot number, and the QR code's middle. The two on
 *  words carry their dot out past the word (out: the side it goes; Sequence.tsx), so the dot covers none of it at any
 *  size. */
export const MARKS = [
  { x: 526, y: 530, out: 1 },
  { x: 34, y: 659, out: -1 },
  { x: 276, y: 628, out: 0 },
] as const;
/** The printed lot number's middle, where the lot lifts off the label to travel into the record. */
export const LOT_PRINT = { x: 105, y: 660 } as const;
/** The QR code's printed frame on the label, a hair outside it: where the scan's corners close in. */
export const QR_FRAME = { x: 188, y: 511, w: 180, h: 236 } as const;

/* ---------- Easing ---------- */

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** A share of the way through a span of the story: 0 before it, 1 after it, eased between (smootherstep, so nothing
 *  starts or stops with a jolt). */
export function span(p: number, [a, b]: Span) {
  const t = clamp01((p - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
}
/** Up over one span and back down over a later one. */
export const between = (p: number, rise: Span, fall: Span) => span(p, rise) * (1 - span(p, fall));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/* ---------- The story: its chapters and where it rests ---------- */

/** The six chapters, as the journey names them. */
export const CHAPTERS = ["Collection", "Approach", "Label", "Connection", "Record", "Certificate"] as const;
/** The label's three details and the certificate's three findings, as the journey names them. */
export const DETAILS = ["Identity", "Traceability", "Access"] as const;
export const FINDINGS = ["Identity", "Purity", "Content"] as const;
/** The finale: past the six chapters, the room whole again. */
export const FINALE = CHAPTERS.length;

/** A rest: where the picture holds still while the reader scrolls on (a span of p), a chapter's or one of its
 *  details'. Between two rests the picture moves, and stops wherever the reader stops. */
export type Rest = { chapter: number; detail?: number; hold: Span };
export const RESTS: readonly Rest[] = [
  { chapter: 0, hold: [0, 0.012] },
  { chapter: 1, hold: [0.095, 0.135] },
  { chapter: 2, detail: 0, hold: [0.215, 0.25] },
  { chapter: 2, detail: 1, hold: [0.285, 0.32] },
  { chapter: 2, detail: 2, hold: [0.355, 0.39] },
  { chapter: 3, hold: [0.47, 0.52] },
  { chapter: 4, hold: [0.6, 0.65] },
  { chapter: 5, detail: 0, hold: [0.74, 0.775] },
  { chapter: 5, detail: 1, hold: [0.8, 0.835] },
  { chapter: 5, detail: 2, hold: [0.86, 0.895] },
  { chapter: FINALE, hold: [0.975, 1] },
];
/** Where a rest is read: a little into its hold, so a scroll's last step doesn't leave it at once. */
export const restPoint = (rest: Rest) => mix(rest.hold[0], rest.hold[1], rest.hold[0] === 0 ? 0 : 0.3);

/** The rest the picture is nearest at p: the one whose hold it is in, or, between two, the one it is passing to past
 *  the middle. */
export function restAt(p: number): number {
  for (let i = 0; i < RESTS.length - 1; i++) {
    const end = RESTS[i].hold[1], next = RESTS[i + 1].hold[0];
    if (p < (end + next) / 2) return i;
  }
  return RESTS.length - 1;
}

/* ---------- The beats: when each thing happens, as shares of the story ---------- */

export const BEATS = {
  /** The opening's words leave on the first scroll. */
  words: [0.003, 0.035],
  /** The room's floor mist goes as the story starts, and comes back as it ends. */
  mistOut: [0.004, 0.06],
  mistBack: [0.945, 0.99],
  /** The vial lifts off its pedestal and hovers above it; comes forward to the label's place; and, once its record has
   *  been read, comes home to its pedestal. */
  lift: [0.014, 0.095],
  forward: [0.135, 0.215],
  /** The vial steps aside for the record: on a phone to the left of its figures. */
  recordPose: [0.535, 0.59],
  home: [0.65, 0.71],
  /** Its seat on the pedestal: gone once it is in the air, back as it lands. */
  shadeOut: [0.016, 0.06],
  shadeBack: [0.682, 0.71],
  /** The lens racks focus to the vial: the room softens around it as it lifts toward the reader, goes deeper behind the
   *  certificate, and comes back into focus as the story ends, deep first. */
  roomSoft: [0.03, 0.095],
  roomDeep: [0.665, 0.73],
  roomDeepBack: [0.9, 0.945],
  roomSoftBack: [0.92, 0.97],
  neighboursSoft: [0.035, 0.095],
  neighboursBack: [0.925, 0.97],
  /** The vial at home on its pedestal, softened with the room behind the certificate, sharp again for the finale. */
  vialSoft: [0.715, 0.75],
  vialSharp: [0.925, 0.965],
  /** The highlight on the floating vial's crimp and shoulders drifts across it the whole time it is in the air, so a
   *  held picture is never quite still. */
  sheen: [0.014, 0.72],
  /** A low haze near the camera, which the floor and the far vials recede into while the lens is close: in as the room
   *  softens; as it comes back into focus, settling to the floor, where it stays under the finale's principles. */
  hazeSettle: [0.92, 0.97],
  /** Each chapter's words: in as its picture arrives, out as the next begins. */
  words1: [[0.05, 0.09], [0.135, 0.158]],
  words2: [[0.176, 0.212], [0.39, 0.414]],
  words3: [[0.43, 0.466], [0.52, 0.543]],
  words4: [[0.562, 0.598], [0.65, 0.673]],
  words5: [[0.7, 0.738], [0.895, 0.918]],
  /** The label's decoder: the card and the three markers. The code's marker gives way to the scan closing in on the
   *  code as it opens Verify; the number's comes back to send the lot to its record. */
  decoder: [[0.184, 0.215], [0.39, 0.418]],
  marks: [[0.19, 0.215], [0.39, 0.412]],
  qrMark: [[0.19, 0.215], [0.39, 0.412]],
  scan: [[0.41, 0.45], [0.52, 0.54]],
  /** A line of light passes down the code once, as a phone's camera reads it. */
  scanSweep: [0.452, 0.476],
  lotMarkBack: [[0.52, 0.54], [0.585, 0.6]],
  /** Verify: the card, and the printed lot typed into it once the code is read. */
  verify: [[0.44, 0.47], [0.528, 0.556]],
  typing: [0.474, 0.498],
  /** The record: the lot travels from the label to the record's heading as the card comes in, and lands there. */
  record: [0.548, 0.596],
  recordOut: [0.658, 0.698],
  travelerIn: [0.532, 0.546],
  travel: [0.538, 0.592],
  travelerOut: [0.586, 0.598],
  /** The certificate: the page comes forward from the record's reference, its findings beside it, and leaves as the
   *  story ends. It follows the vial home a beat behind, so the one leaves before the other arrives. */
  paper: [0.666, 0.738],
  paperShown: [0.666, 0.696],
  paperOut: [0.9, 0.94],
  /** As it goes, the page dissolves into the room's light: brightening to a soft bloom, which goes with it. */
  paperLight: [0.895, 0.908],
  findings: [[0.704, 0.74], [0.895, 0.918]],
  /** While its findings are read, the window's light shifts: a soft shade passes over the page once, through all three
   *  rests, so the held page is never quite still. */
  pageShade: [RESTS[7].hold[0], RESTS[9].hold[1]],
  /** The reading glass on the page glides from one finding's print to the next between their rests. */
  reading: [[RESTS[7].hold[1], RESTS[8].hold[0]], [RESTS[8].hold[1], RESTS[9].hold[0]]],
  /** The finale's words on the wall, and the four principles one after another. */
  finale: [0.945, 0.975],
  principles: [0.946, 0.966],
  principleStep: 0.005,
  /** The journey and the way out: from the first scroll until the finale. */
  journey: [[0.004, 0.03], [0.94, 0.962]],
} as const satisfies Record<string, unknown>;

/** The label's detail at p (0–2), and the certificate's finding: each changes halfway between its rests. */
export const detailAt = (p: number) => (p < 0.2675 ? 0 : p < 0.3375 ? 1 : 2);
export const findingAt = (p: number) => (p < 0.7875 ? 0 : p < 0.8475 ? 1 : 2);

/* ---------- The camera ---------- */

/** Where the opening lays the featured vial out, the view the camera films, and the room the story's words leave the
 *  vial in each of its places. */
export type Scene = {
  /** The sticky view the camera films: the window below the header. */
  view: { w: number; h: number };
  /** The room's plate in the stage (the stage's top left is the view's), before its own transform. */
  box: Box;
  /** The plate is drawn this much larger about its centre (rooms.css .tm-room-plate). */
  plateScale: number;
  /** The featured vial's seat on the plate. */
  seat: Seat;
  /** A phone held upright: the vial is the picture, and each chapter's words its caption below it. */
  tall: boolean;
  /** The tallest the floating vial is drawn and still sharp (its cutout's own pixels at the screen's density, and a
   *  little past, where the eye can't tell), in the view's pixels. */
  sharp: number;
  /** Where the vial may float in each chapter, clear of that chapter's words and cards and of the story's controls
   *  (measured from the page, Sequence.tsx), in the view's pixels. On a wide screen the approach's is above the vial's
   *  own pedestal; on a phone the vial holds one place through the approach, the label and the connection, and steps
   *  aside for the record. */
  free: { approach: Rect; label: Rect; connection: Rect; record: Rect };
};

/** A point of the featured vial's cutout (its own pixels) where it stands in the view, the camera at rest. */
export function vialPoint(scene: Scene, u: number, v: number): Pt {
  const { box, seat, plateScale: k } = scene;
  const H = seat.h * box.height, W = H * ASPECT;
  const x = box.left + seat.x * box.width - W / 2 + (u / CUTOUT.w) * W;
  const y = box.top + seat.y * box.height - H + (v / CUTOUT.h) * H;
  const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
  return { x: cx + k * (x - cx), y: cy + k * (y - cy) };
}
/** The vial's height in the view at rest. */
export const vialHeight = (scene: Scene) => scene.seat.h * scene.box.height * scene.plateScale;

/** A camera: the view shows the plate scaled by `s` about the plate point `at`, which it puts at the view point `on`. */
export type Camera = { s: number; at: Pt; on: Pt };
/** The camera's transform of the plate (origin at the view's top left): translate(on − s·at) scale(s). */
export const toView = (cam: Camera, P: Pt): Pt => ({ x: cam.on.x + cam.s * (P.x - cam.at.x), y: cam.on.y + cam.s * (P.y - cam.at.y) });
export const cameraTransform = (cam: Camera) =>
  `translate3d(${(cam.on.x - cam.s * cam.at.x).toFixed(2)}px, ${(cam.on.y - cam.s * cam.at.y).toFixed(2)}px, 0) scale(${cam.s.toFixed(5)})`;

/** The plate's edges in the view at rest. */
function plateEdges(scene: Scene) {
  const { box, plateScale: k } = scene;
  const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
  return {
    L: cx + k * (box.left - cx),
    R: cx + k * (box.left + box.width - cx),
    T: cy + k * (box.top - cy),
    B: cy + k * (box.top + box.height - cy),
  };
}
/** The least scale at which the plate, the point `at` moved to `on`, still covers the view from side to side, and its
 *  top edge comes no lower than it stands at rest: above it is the stage's own fill, which stays where it is, and
 *  matches the room only there. (Below, the floor the camera carries runs on past the plate.) */
function coverScale(scene: Scene, at: Pt, on: Pt): number {
  const { L, R, T } = plateEdges(scene);
  const top = Math.max(T, 0);
  return Math.max(
    at.x > L ? on.x / (at.x - L) : 0,
    R > at.x ? (scene.view.w - on.x) / (R - at.x) : 0,
    at.y > T ? (on.y - top) / (at.y - T) : 0,
  );
}

/** The camera's key frames: each a moment of the story and the camera there. */
type Key = { p: number; s: number; at: Pt; on: Pt };

/** The camera leans in this little, at most: a lean, never a zoom. */
const LEAN = { approach: 1.045, label: 1.1, most: 1.24, certificate: 1.025 } as const;

/** Where the vial's foot stands on its pedestal, in the view at rest: the point the camera turns about. */
export const footPoint = (scene: Scene) => vialPoint(scene, CUTOUT.w / 2, CUTOUT.h);

/**
 * The camera while the vial floats in its label's place: leaning in, and turned so the vial's own pedestal stands
 * below it where it can (a wide window: the pedestal moves toward the vial, as far as the room covers the view without
 * leaning further than LEAN.most).
 */
function labelCamera(scene: Scene, pose: Pose): Camera {
  const foot = footPoint(scene);
  const target = { x: scene.tall ? foot.x : pose.x, y: Math.min(scene.view.h * 0.97, pose.y + pose.h / 2 + scene.view.h * 0.1) };
  for (let k = 1; k >= 0; k -= 0.1) {
    const on = { x: mix(foot.x, target.x, k), y: mix(foot.y, target.y, k) };
    const s = Math.max(LEAN.label, coverScale(scene, foot, on) * 1.003);
    if (s <= LEAN.most) return { s, at: foot, on };
  }
  return { s: LEAN.label, at: foot, on: foot };
}

export function cameraKeys(scene: Scene): Key[] {
  const foot = footPoint(scene);
  const rest = { s: 1, at: foot, on: foot };
  const approach = { s: LEAN.approach, at: foot, on: { x: foot.x, y: foot.y + scene.view.h * 0.025 } };
  const label = labelCamera(scene, posesOf(scene).label);
  const certificate = { s: LEAN.certificate, at: foot, on: foot };
  const at = (p: number, cam: Camera): Key => ({ p, ...cam });
  return [
    at(0, rest),
    at(RESTS[1].hold[0], approach),
    at(RESTS[1].hold[1], approach),
    at(RESTS[2].hold[0], label),
    at(RESTS[6].hold[1], label),
    at(RESTS[7].hold[0], certificate),
    at(RESTS[9].hold[1], certificate),
    at(RESTS[10].hold[0], rest),
    at(1, rest),
  ];
}

/**
 * Monotone cubic interpolation (Fritsch–Carlson) through (xs, ys): smooth through every key and never overshooting
 * between two (the camera never leans past a framing and comes back); flat between two equal keys, so it holds still
 * through a rest.
 */
function monotone(xs: number[], ys: number[]) {
  const n = xs.length;
  const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  const m = new Array<number>(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) continue;
    const w1 = 2 * (xs[i + 1] - xs[i]) + (xs[i] - xs[i - 1]);
    const w2 = (xs[i + 1] - xs[i]) + 2 * (xs[i] - xs[i - 1]);
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/** The camera at every p, from the scene's keys: its scale in log space (a lean reads as even), every other channel as
 *  it is. */
export function cameraPath(scene: Scene) {
  const keys = cameraKeys(scene);
  const xs = keys.map((k) => k.p);
  const channel = (pick: (k: Key) => number) => monotone(xs, keys.map(pick));
  const logS = channel((k) => Math.log(k.s));
  const ax = channel((k) => k.at.x), ay = channel((k) => k.at.y);
  const ox = channel((k) => k.on.x), oy = channel((k) => k.on.y);
  return (p: number): Camera => ({ s: Math.exp(logS(p)), at: { x: ax(p), y: ay(p) }, on: { x: ox(p), y: oy(p) } });
}

/* ---------- The vial in the air ---------- */

/** Where the floating vial stands: its middle and its height, in the view's pixels. */
export type Pose = { x: number; y: number; h: number };
const mixPose = (a: Pose, b: Pose, t: number): Pose => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), h: Math.exp(mix(Math.log(a.h), Math.log(b.h), t)) });

/** The vial on its pedestal, as the camera shows it. */
export function pedestalPose(scene: Scene, cam: Camera): Pose {
  const middle = toView(cam, vialPoint(scene, CUTOUT.w / 2, CUTOUT.h / 2));
  return { x: middle.x, y: middle.y, h: vialHeight(scene) * cam.s };
}

/** The vial as large as it stands in a free rect, at most `most` of the view's height and never past sharp, in the
 *  rect's middle. */
function fit(rect: Rect, most: number, scene: Scene): Pose {
  const h = Math.max(1, Math.min(rect.bottom - rect.top, (rect.right - rect.left) / ASPECT, scene.view.h * most, scene.sharp));
  return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2, h };
}

/** On a phone, how large the vial floats at the approach against the label's size: the label is a gentle push in. */
const APPROACH_SHARE = 0.9;

/** The vial's places: hovering just above its pedestal (the approach; on a phone, already the picture), and floating
 *  in each chapter's free room. */
export function posesOf(scene: Scene) {
  const most = scene.tall ? 0.72 : 0.68;
  const approach = fit(scene.free.approach, most, scene);
  return {
    hover: scene.tall ? { ...approach, h: approach.h * APPROACH_SHARE } : hoverPose(scene),
    label: fit(scene.free.label, most, scene),
    connection: fit(scene.free.connection, most, scene),
    record: fit(scene.free.record, most, scene),
  };
}

/** On a wide screen, the approach: hovering above its pedestal, a little larger (nearer), its foot a little clear of
 *  the pedestal, its cap clear of the words. */
function hoverPose(scene: Scene): Pose {
  const foot = footPoint(scene);
  const approachCam = { s: LEAN.approach, at: foot, on: { x: foot.x, y: foot.y + scene.view.h * 0.025 } };
  const seated = pedestalPose(scene, approachCam);
  const footY = seated.y + seated.h / 2;
  const room = footY - scene.free.approach.top;
  const h = Math.max(seated.h, Math.min(seated.h * 1.38, room / 1.12));
  return { x: seated.x, y: footY - h * 0.12 - h / 2, h };
}

/** The floating vial at p, and how far off its pedestal it is (0 seated, 1 in the air). Seated, the plate's own vial
 *  shows instead (Sequence.tsx). */
export function vialPath(scene: Scene, camera: (p: number) => Camera) {
  const poses = posesOf(scene);
  const B = BEATS;
  return (p: number): { pose: Pose; air: number } => {
    const lift = span(p, B.lift), home = span(p, B.home);
    const air = lift * (1 - home);
    // In the air: hovering, then forward to the label's place, kept through Verify, then aside for the record.
    let pose = mixPose(poses.hover, poses.label, span(p, B.forward));
    if (p > RESTS[4].hold[1]) pose = mixPose(poses.label, poses.connection, span(p, [RESTS[4].hold[1], RESTS[5].hold[0]]));
    if (p > RESTS[5].hold[1]) pose = mixPose(poses.connection, poses.record, span(p, B.recordPose));
    if (air >= 1) return { pose, air };
    return { pose: mixPose(pedestalPose(scene, camera(p)), pose, air), air };
  };
}

/** A point of the cutout (its own pixels) on the floating vial. */
export function posePoint(pose: Pose, u: number, v: number): Pt {
  const w = pose.h * ASPECT;
  return { x: pose.x - w / 2 + (u / CUTOUT.w) * w, y: pose.y - pose.h / 2 + (v / CUTOUT.h) * pose.h };
}

/**
 * The floating vial's shadow on its own pedestal's top: where it falls (the foot's place, carried a little away from the
 * window at the upper left as the vial rises), how large it is drawn (its laid-out size is the vial's width at rest), and
 * how dense it is: dense and tight just above the pedestal, thinner and wider as the vial rises, gone as it floats away
 * to the side.
 */
export function pedestalShadow(scene: Scene, cam: Camera, pose: Pose) {
  const foot = toView(cam, footPoint(scene));
  const size = vialHeight(scene) * cam.s;
  const rise = Math.max(0, (foot.y - (pose.y + pose.h / 2)) / size);
  const aside = Math.abs(pose.x - foot.x) / (size * ASPECT * 2.4);
  // The foot's point is the front of the vial's base; the pedestal's top, and the shadow, are centred a little behind it.
  return {
    x: foot.x + size * ASPECT * 0.12 * Math.min(1, rise),
    y: foot.y - size * ASPECT * 0.065,
    scale: cam.s * (0.85 + 0.5 * Math.min(1.6, rise)),
    density: clamp01(1 - rise / 1.8) * clamp01(1 - aside),
  };
}

/* ---------- The layers ---------- */

const words = (p: number, [rise, fall]: readonly [Span, Span]) => between(p, rise, fall);

/** How much of each layer shows at p (0–1), and the moving parts' own progress. */
export function layers(p: number) {
  const B = BEATS;
  const out = (s: Span) => 1 - span(p, s);
  return {
    words: out(B.words),
    mist: Math.max(out(B.mistOut), span(p, B.mistBack)),
    shade: Math.max(out(B.shadeOut), span(p, B.shadeBack)),
    roomSoft: span(p, B.roomSoft) * out(B.roomSoftBack),
    roomDeep: span(p, B.roomDeep) * out(B.roomDeepBack),
    neighboursSoft: span(p, B.neighboursSoft) * out(B.neighboursBack),
    vialSoft: span(p, B.vialSoft) * out(B.vialSharp),
    /** Where the highlight crosses the floating vial: its middle, as a share of the vial's width from its left. */
    sheen: mix(0.14, 0.52, span(p, B.sheen)),
    haze: span(p, B.roomSoft),
    hazeSettle: span(p, B.hazeSettle),
    chapters: [0, words(p, B.words1), words(p, B.words2), words(p, B.words3), words(p, B.words4), words(p, B.words5)],
    decoder: words(p, B.decoder),
    marks: [words(p, B.marks), Math.max(words(p, B.marks), words(p, B.lotMarkBack)), words(p, B.qrMark)],
    scan: words(p, B.scan),
    scanSweep: span(p, B.scanSweep),
    verify: words(p, B.verify),
    typing: span(p, B.typing),
    record: span(p, B.record) * out(B.recordOut),
    recordIn: span(p, B.record),
    recordOut: span(p, B.recordOut),
    traveler: span(p, B.travelerIn) * out(B.travelerOut),
    travel: span(p, B.travel),
    recordLot: span(p, B.travelerOut),
    paper: span(p, B.paper),
    paperShown: span(p, B.paperShown) * out(B.paperOut),
    paperOut: span(p, B.paperOut),
    paperLight: span(p, B.paperLight),
    /** At an even pace, unlike the others: eased, the shade would cross the page only between the rests. */
    pageShade: clamp01((p - B.pageShade[0]) / (B.pageShade[1] - B.pageShade[0])),
    findings: words(p, B.findings),
    /** Where the reading glass is, from the first finding's print (0) to the last's (2). */
    reading: span(p, B.reading[0]) + span(p, B.reading[1]),
    finale: span(p, B.finale),
    principles: [0, 1, 2, 3].map((i) => span(p, [B.principles[0] + i * B.principleStep, B.principles[1] + i * B.principleStep])),
    journey: words(p, B.journey),
  };
}
export type Layers = ReturnType<typeof layers>;
