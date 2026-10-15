/*
 * The move from the opening into a product, and back: one room, one camera. The product page is the opening's own
 * room with the camera close on the vial's pedestal (pages/Product.tsx), so the move is one continuous push into the
 * opening's plate (its loop, its floor mist and its vials) that settles exactly on the product page's framing. As it
 * arrives, the lens racks focus to that pedestal: the room around it softens (Rooms.tsx RoomFocus). Nothing dissolves,
 * ever. At the end the room's living parts, its loop and its mist, are handed from the opening's plate to the product
 * page's, which frames the room exactly as the camera then does (share.ts); going back they are handed the other way
 * before the camera pulls out. The camera's easing and timings are the approved study's
 * (tools/landing/board/flight/flight.js).
 *
 * Web Animations over composited layers, not a view transition. The whole move is one pure function of a
 * camera progress `c` (0 = the opening's framing, 1 = the product's): the opening's plate, the product page's plate
 * (carrying only its vial while the camera moves) and the one vial are similarity transforms about the vial's foot,
 * so they move as one physical scene. A path over time (forward, back, or a re-aim from wherever the move is) is
 * sampled into keyframes for every layer and played on the compositor, so the camera keeps gliding while the main
 * thread is busy, and a second click, Escape or Back rebuilds the path from the exact current state, velocity
 * included.
 *
 * Both pages are drawn while the camera moves. The router's page is rendered into view slots (FlightViews.tsx),
 * each pinned to its own address: the departing page stays mounted, and drawn, until the move settles. The opening a
 * move left stays mounted after it, unseen and inert under the product page (parked), so Back starts from a page that
 * is already laid out and decoded: the camera pulls out in the frame after the reader asks, with nothing to build.
 */
import type { Location, NavigateFunction } from "react-router-dom";
import { holdPopScroll, keepScroll, READER_INPUT, releaseScroll, scrollFor, setPopHook } from "../Navigation";
import type { PopUpdate } from "../Navigation";
import { productById, productCutout } from "../shop/catalog";
import { collectionIds } from "./carousel";
import { FOCUS, focusMask } from "./fog";
import { TALL_SCREEN } from "./opening-media";
import { fogSceneOf } from "./Rooms";
import { claimRoom } from "./share";
import { ProductPage } from "../pages";
import type { Box, Room, Seat } from "./Rooms";

type Pt = { x: number; y: number };
type Dir = "in" | "out";
type Kind = "camera" | "fade";

/* ---------- The two scenes, as their pages register them ---------- */

/** The opening: its stage, the plate it moves, the vials on it and the words that leave. */
export type HomeScene = {
  slot: number;
  stage: HTMLElement;
  plate: HTMLElement;
  /** The plate's layout box in the stage, before any transform. */
  box: Box;
  /** Each vial, and the pedestal it stands on (its place in the room's seats). */
  vials: Map<string, { el: HTMLElement; glass: HTMLElement; seat: Seat; pedestal: number }>;
  /** Each fades and drifts on its own (on a portrait screen their wrapper has no box). */
  copy: HTMLElement[];
  /** The way into the featured vial's story, on its pedestal's face (stories.css .tm-story-cue). It lies on the plate, so
   *  the camera would carry it up large: it leaves with the words instead, and comes back with them. */
  cue: HTMLElement | null;
  /** The room's first frame, under its loop: the camera waits for it before it pulls back to the opening. */
  still: HTMLImageElement | null;
  /** The room the opening shows, and its lens's focus layer, which the camera racks to a pedestal as it arrives. */
  room: Room;
  focus: HTMLElement | null;
};

/** The product page: the same room up close on one pedestal, its vial, and the details that rise beside it. */
export type ProductScene = {
  slot: number;
  id: string;
  scene: HTMLElement;
  plate: HTMLElement;
  /** The plate's layout box in the scene. Its transform origin is its top left. */
  box: Box;
  seat: Seat;
  /** The room it frames, and the pedestal it stands on: the camera flies here only from that pedestal of that room. */
  framed: Room;
  pedestal: number;
  /** The room on the plate: hidden while the camera moves (the opening's plate shows the room), shown as it settles. */
  room: HTMLElement;
  /** Arrive as the camera does: the fade into the page at the room's foot, and the page below. */
  fade: HTMLElement;
  ground: HTMLElement;
  /** The vial's picture, set down from the hover lift it was clicked with. */
  glass: HTMLElement;
  /** The vial's soft contact with its pedestal, which only the close framing has: it arrives with the camera. */
  contact: HTMLElement | null;
  image: HTMLImageElement | null;
  still: HTMLImageElement | null;
  /** The details, in the order they rise. */
  rise: HTMLElement[];
  heading: HTMLElement;
};

/* ---------- Easing ---------- */

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const smoother = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
const hermite = (p0: number, m0: number, p1: number, t: number) => (2 * t ** 3 - 3 * t ** 2 + 1) * p0 + (t ** 3 - 2 * t ** 2 + t) * m0 + (-2 * t ** 3 + 3 * t ** 2) * p1;

/** The camera: a slow start, a long settle, no overshoot. */
const EASE_CAMERA = bezier(0.45, 0, 0.15, 1);
/** The site's entrance ease (--tm-ease-enter), for the details. */
const EASE_ENTER = bezier(0.2, 0.7, 0.1, 1);
/** Words leaving: they go at once and slow as they vanish. */
const EASE_LEAVE = bezier(0.3, 0, 0.2, 1);
const EASE_IN = bezier(0.4, 0, 1, 1);

/* ---------- Timing (ms) and the camera's shape ---------- */

/* The camera's 960ms has the neighbours gone by 576ms; the lens softens the room around the pedestal through the
   camera's second half, and the details rise in a short, tight stagger once it is all but settled,
   so the whole move settles in about 1.25s. Back runs the same beats in reverse in about 1.2s. */
const T = {
  camera: 960,
  copyOut: 340,
  copyDrift: -12,
  panelStagger: 18,
  panelDur: 320,
  panelRise: 16,
  backDelay: 60,
  panelOut: 180,
  panelOutStagger: 10,
  copyInAt: 0.62,
  copyInDur: 440,
  hurry: 300,
  fade: 180,
};
/** The camera's progress at a share of its own forward ease: where the move stands at that moment of its time. */
const cameraAt = (share: number) => EASE_CAMERA(share);
/** The neighbours' softening and the foot's travel, as functions of the camera, so any path keeps them aligned.
 *  The foot arrives a little before the push ends: the last of the move is the camera closing in. */
const soften = (c: number) => smooth(0, 0.55, c);
const travel = (c: number) => 1 - Math.pow(1 - clamp01(c / 0.92), 1.5);
/** The neighbours are gone by 60% of the move: the camera arrives on one vial. */
const NEIGHBOURS_GONE = [cameraAt(0.35), cameraAt(0.6)] as const;
/** "Verified." on the room's back wall fades from the click to halfway through the camera, before it grows large, as
 *  it does when the story starts (mist-word.css); going back, it comes in again over the camera's last half. */
const WORD_GONE = [0, cameraAt(0.5)] as const;
/** The camera is this close to settled when the details rise (and, going back, they have left before it moves further). */
const SETTLED = 0.97;
/** The lens racks focus to the pedestal over this stretch of the camera's progress: the room softens as it arrives. */
const RACK = [0.3, 1] as const;
const rack = (c: number) => smoother(RACK[0], RACK[1], c);
/** The page arrives with the camera: the fade into it at the room's foot, and the page below. */
const ARRIVE = [0.55, 0.99] as const;
const arrive = (c: number) => smooth(ARRIVE[0], ARRIVE[1], c);
/** On screen, at the furthest neighbour. */
const BLUR_MAX = 14;
const DIM_MAX = 0.72;
const STEP = 1000 / 60;
/** How long a move may wait for the product's pictures before it crossfades instead. */
const IMAGE_PATIENCE = 1200;

/* ---------- The views the router's page is drawn into ---------- */

export type Slot = {
  id: number;
  /** The address this slot shows. Null: the router's current address. */
  location: Location | null;
  /** Mounted and laid out, but not drawn until its move starts. */
  pending: boolean;
  /** The page a move is leaving. */
  leaving: boolean;
  /** The opening, kept mounted but unseen and inert under the product page the camera moved into, for Back. */
  parked?: boolean;
};
export type Views = { slots: Slot[]; moving: boolean };

let views: Views = { slots: [{ id: 0, location: null, pending: false, leaving: false }], moving: false };
let nextSlot = 1;
const subscribers = new Set<() => void>();
function setViews(next: Views) {
  views = next;
  for (const notify of subscribers) notify();
}
export const flightViews = {
  subscribe(listener: () => void) {
    subscribers.add(listener);
    return () => { subscribers.delete(listener); };
  },
  snapshot: () => views,
};

const slotElements = new Map<number, HTMLElement>();
let container: HTMLElement | null = null;
let router: { location: Location; navigate: NavigateFunction } | null = null;

export function bindViews(element: HTMLElement | null) {
  container = element;
}
export function bindSlot(id: number, element: HTMLElement | null) {
  if (element) slotElements.set(id, element);
  else slotElements.delete(id);
}
export function bindRouter(location: Location, navigate: NavigateFunction) {
  router = { location, navigate };
  // The reader went on from the product page by another way: the opening kept for Back is let go (FlightViews has
  // already stopped drawing it).
  if (!move && !pending && views.slots.some((slot) => slot.parked) && !keepsParked(location)) {
    releaseParked();
    setViews({ slots: views.slots.filter((slot) => !slot.parked), moving: views.moving });
  }
}
/** The slots that are pages now: every one but a parked opening. */
const live = () => views.slots.filter((slot) => !slot.parked);

/** Which page an address shows, for the move's purposes. */
export const pageOf = (pathname: string): "home" | "product" | "other" =>
  pathname === "/" ? "home" : /^\/product\/[^/]+\/?$/.test(pathname) ? "product" : "other";
export const productOf = (pathname: string) => /^\/product\/([^/]+)\/?$/.exec(pathname)?.[1] ?? null;

/** The marker a move leaves on the entry it pushed, so Back and "The collection" know to fly home. */
export const arrivedByFlight = (location: Location) => Boolean((location.state as { flight?: unknown } | null)?.flight);

/** A parked opening is kept only while the reader stays on a product page the camera brought them to (its sizes too). */
export const keepsParked = (location: Location) => pageOf(location.pathname) === "product" && arrivedByFlight(location);

/* ---------- Scenes ---------- */

const homes = new Map<number, HomeScene>();
const products = new Map<number, ProductScene>();

export function registerHome(scene: HomeScene) {
  homes.set(scene.slot, scene);
  sceneChanged(scene.slot);
  return () => { if (homes.get(scene.slot) === scene) homes.delete(scene.slot); };
}
export function registerProduct(scene: ProductScene) {
  products.set(scene.slot, scene);
  sceneChanged(scene.slot);
  return () => { if (products.get(scene.slot) === scene) products.delete(scene.slot); };
}

/* ---------- Media ---------- */

const reduced = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const matches = (query: string) => typeof window.matchMedia === "function" && window.matchMedia(query).matches;
/** The product page's room is cut for a portrait screen below this (ProductPage's stacked layout). */
export const STACKED = "(max-width: 760px), (max-aspect-ratio: 11/10)";

/** Rooms and their loops hold still while the camera moves (Rooms.tsx RoomVideo listens for this). */
export const FLIGHT_EVENT = "tm-flight";
const announce = () => window.dispatchEvent(new Event(FLIGHT_EVENT));
export const holding = (element: Element) => Boolean(element.closest(".tm-views[data-moving]"));

const warmed = new Set<string>();
/** Once the pictures the page is still fetching have arrived: a picture readied for later never competes with the first
 *  screen's own, nor fetches a second time one the page is fetching now. */
function afterPictures(run: () => void) {
  const waiting = [...document.images].filter((image) => !image.complete && image.loading !== "lazy");
  if (!waiting.length) return run();
  let left = waiting.length;
  const one = () => { if (--left === 0) run(); };
  for (const image of waiting) {
    image.addEventListener("load", one, { once: true });
    image.addEventListener("error", one, { once: true });
  }
}
function warm(src: string) {
  if (warmed.has(src) || typeof Image === "undefined") return;
  warmed.add(src);
  afterPictures(() => {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    image.decode().catch(() => warmed.delete(src));
  });
}
/** Ready the product's vial at product size and the product page's code, so the move never waits on them (its room is
 *  the one already showing). */
export function preloadProduct(id: string) {
  const product = productById(id);
  if (!product) return;
  warm(productCutout(product, "lg"));
  // Fetched once; a failed fetch is tried again by the next vial pointed at, or by the page itself.
  void ProductPage.preload().catch(() => undefined);
}

/* ---------- The move ---------- */

type State = { c: number; copy: number; panel: number[] };
type Path = { duration: number; at: (t: number) => State };
type Frozen = { plate: HTMLElement; s0: number; t: Pt; style: { transform: string; transition: string } };
type Geometry = {
  id: string;
  home: HomeScene;
  product: ProductScene;
  /** The vial's foot in the opening and on the product page, and how much larger it stands there. */
  F0: Pt;
  F1: Pt;
  k: number;
  lift0: number;
  /** The opening's plate: its layout box on screen, its own resting transform (scale about its centre, then
   *  a shift: the pointer's depth, frozen at the click), and so where it shows. */
  P: Box;
  s0: number;
  t0: Pt;
  V0: Pt;
  Q: Pt;
  neighbours: { el: HTMLElement; w: number }[];
  /** The opening's way in, where it shows (a way in still waiting for its story's pictures is unseen, and left so). */
  cue: HTMLElement | null;
  /** "Verified." on the room's back wall, where the opening has room for it. It is on the plate, so the camera would
   *  carry it up large, and the product page's room has none: it fades as the camera starts. */
  word: HTMLElement | null;
  /** The lens's full blur in the opening plate's own pixels (it is scaled with the plate). */
  focus: number;
  /** The opening stage's own floor fade, which gives way to the product page's as the camera arrives. */
  floor: Target;
};
/** A layer the camera moves: an element, or one of its pseudo-elements. */
type Target = HTMLElement | { el: HTMLElement; pseudo: string };
type Active = {
  kind: Kind;
  dir: Dir;
  id: string;
  home: number;
  product: number;
  anims: Animation[];
  path: Path | null;
  G: Geometry | null;
  frozen: Frozen | null;
  /** Where each page was scrolled, by slot: it is held there while the window stands at the top for the move, and the
   *  page that stays lands there. */
  places: Map<number, number>;
};
type Pending = {
  kind: Kind;
  dir: Dir;
  id: string;
  home: number;
  product: number;
  places: Map<number, number>;
  waiting: boolean;
  /** A second click came before the camera started: it starts already hurrying. */
  hurry: boolean;
  /** Its pictures have been decoded, not just loaded. */
  decoded: boolean;
  /** Going in, the product page has been drawn once, unseen, at its own framing (prime). */
  primed?: boolean;
};

let pending: Pending | null = null;
let move: Active | null = null;
/**
 * The opening parked under a product page (FlightViews), held exactly as the camera left it: its plate pushed in on the
 * pedestal, its words and neighbours gone, all as the move's own last frame (its animations, finished and
 * filling). It is drawn, under the product page that covers it, so the browser keeps it rasterised at that framing:
 * Back's first frame has nothing new to draw. `frozen` is the plate's rest from before the move in, kept for Back.
 */
type Parked = { slot: number; anims: Animation[]; frozen: Frozen | null };
let parked: Parked | null = null;
/** Let the held opening go: back to rest (unless a move now owns its plate). */
function releaseParked(rest = true) {
  const held = parked;
  if (!held) return;
  parked = null;
  for (const anim of held.anims) anim.cancel();
  if (rest) thaw(held.frozen);
}
let queued = false;
const log: { type: string; t: number; [key: string]: unknown }[] = [];
const note = (type: string, extra: Record<string, unknown> = {}) => {
  log.push({ type, t: Math.round(performance.now()), ...extra });
  if (log.length > 200) log.shift();
};

function camera(G: Geometry, c: number) {
  const f = travel(c);
  const s = Math.pow(G.k, c);
  return { Fx: G.F0.x + (G.F1.x - G.F0.x) * f, Fy: G.F0.y + (G.F1.y - G.F0.y) * f, s, sigma: s / G.k };
}
const px = (v: number) => `${v.toFixed(3)}px`;

/** The opening plate's own resting transform, read from the page (the pointer's depth, mid-ease if it is). */
function freeze(plate: HTMLElement): Frozen {
  const value = getComputedStyle(plate).transform;
  let s0 = 1, t = { x: 0, y: 0 };
  const m = /^matrix\(([^)]+)\)$/.exec(value);
  const m3 = /^matrix3d\(([^)]+)\)$/.exec(value);
  if (m) {
    const [a, , , , e, f] = m[1].split(",").map(Number);
    s0 = a; t = { x: e, y: f };
  } else if (m3) {
    const v = m3[1].split(",").map(Number);
    s0 = v[0]; t = { x: v[12], y: v[13] };
  }
  const style = { transform: plate.style.transform, transition: plate.style.transition };
  // Held exactly where it is: no ease toward the pointer while the camera owns the plate.
  plate.style.transition = "none";
  plate.style.transform = value === "none" ? "" : value;
  return { plate, s0, t, style };
}
function thaw(frozen: Frozen | null) {
  if (!frozen) return;
  // Released together, so the plate eases from where it was held back to where the pointer puts it.
  frozen.plate.style.transform = frozen.style.transform;
  frozen.plate.style.transition = frozen.style.transition;
}

/** Where everything stands at rest, in viewport pixels, with both pages drawn and nothing animating. Null when the
 *  product page doesn't stand on this vial's pedestal of this room (the window changed shape): the pages then crossfade. */
function geometry(home: HomeScene, product: ProductScene, id: string, frozen: Frozen, lift: boolean): Geometry | null {
  const hv = home.vials.get(id);
  if (!hv || !home.box.width || !product.box.width || product.framed !== home.room || product.pedestal !== hv.pedestal) return null;
  // A stage clips its room; if anything ever scrolled it (it can't, rooms.css: overflow clip), its room sits that far off.
  const hb = home.stage.getBoundingClientRect();
  const P = { left: hb.left + home.box.left - home.stage.scrollLeft, top: hb.top + home.box.top - home.stage.scrollTop, width: home.box.width, height: home.box.height };
  const O = { x: P.left + P.width / 2, y: P.top + P.height / 2 };
  const { s0, t: t0 } = frozen;
  const V0 = { x: O.x + t0.x + s0 * (P.left - O.x), y: O.y + t0.y + s0 * (P.top - O.y) };
  const W = P.width * s0, H = P.height * s0;
  const F0 = { x: V0.x + hv.seat.x * W, y: V0.y + hv.seat.y * H };
  const h0 = hv.seat.h * H;
  const pb = product.scene.getBoundingClientRect();
  const Q = { x: pb.left + product.box.left - product.scene.scrollLeft, y: pb.top + product.box.top - product.scene.scrollTop };
  const F1 = { x: Q.x + product.seat.x * product.box.width, y: Q.y + product.seat.y * product.box.height };
  const h1 = product.seat.h * product.box.height;
  const reach = W * 0.26;
  const neighbours = [...home.vials].filter(([other]) => other !== id).map(([, v]) => {
    const d = Math.hypot(V0.x + v.seat.x * W - F0.x, V0.y + v.seat.y * H - F0.y);
    return { el: v.el, w: Math.pow(Math.min(1, d / reach), 0.85) };
  });
  let lift0 = 0;
  if (lift) lift0 = hv.glass.getBoundingClientRect().top - hv.el.getBoundingClientRect().top;
  return {
    id, home, product, F0, F1, k: h1 / h0, lift0, P, s0, t0, V0, Q, neighbours,
    cue: home.cue && !home.cue.matches(":disabled") ? home.cue : null,
    // Looked for at the click: the opening sets it on the wall only once it has measured the words above it.
    word: home.plate.querySelector<HTMLElement>(".tm-mist-word"),
    // The room's blur in the opening plate's own pixels: at the camera's end it is the product page's, on screen.
    focus: (FOCUS.blur * P.width) / home.room.w,
    floor: { el: home.stage, pseudo: "::after" },
  };
}

/** Every layer's style for one state of the move. */
function compose(G: Geometry, st: State): [Target, Keyframe][] {
  const out: [Target, Keyframe][] = [];
  const { home, product } = G;
  const c = st.c;
  const { Fx, Fy, s, sigma } = camera(G, c);
  const S = G.s0 * s;
  // The opening's plate turns about its centre (its own transform origin); the foot stays the fixed point.
  const O = { x: G.P.left + G.P.width / 2, y: G.P.top + G.P.height / 2 };
  const Tx = Fx + s * (G.V0.x - G.F0.x), Ty = Fy + s * (G.V0.y - G.F0.y);
  out.push([home.plate, { transform: `translate(${px(Tx - O.x - S * (G.P.left - O.x))}, ${px(Ty - O.y - S * (G.P.top - O.y))}) scale(${S.toFixed(5)})` }]);
  // The product page's plate moves with the opening's exactly (it frames the same room), carrying its vial; its room
  // is drawn only once the camera has handed the room over. The hover lift the vial had when it was clicked is set
  // down as the camera starts: carried by the plate itself (only the vial shows on it), so the vial is drawn as part of
  // the plate, at the largest size the move gives it, and never sharpens as the move settles.
  const lift = G.lift0 * (1 - smooth(0, 0.4, c));
  out.push([product.plate, { transform: `translate(${px(Fx + sigma * (G.Q.x - G.F1.x) - G.Q.x)}, ${px(Fy + sigma * (G.Q.y - G.F1.y) - G.Q.y + lift)}) scale(${sigma.toFixed(5)})` }]);
  // The lens racks focus to the pedestal as the camera arrives: the room around it softens.
  if (home.focus) out.push([home.focus, { backdropFilter: `blur(${(G.focus * rack(c)).toFixed(3)}px)` }]);
  // The product page arrives with the camera: its fade at the room's foot, and the page below (on a phone, beneath the
  // room). Drawn from the first frame at a trace of opacity, so they are rasterised at the click, not as they come in.
  const a = arrive(c);
  for (const el of [product.fade, product.ground]) out.push([el, { opacity: Math.max(a, 0.003) }]);
  if (product.contact) out.push([product.contact, { opacity: Math.max(a, 0.003) }]);
  out.push([G.floor, { opacity: 1 - a }]);
  const r = soften(c);
  const gone = smooth(NEIGHBOURS_GONE[0], NEIGHBOURS_GONE[1], c);
  for (const n of G.neighbours) {
    out.push([n.el, { filter: `blur(${((BLUR_MAX * n.w * r) / S).toFixed(3)}px)`, opacity: (1 - DIM_MAX * n.w * r) * (1 - gone) }]);
  }
  const drift = px((1 - st.copy) * T.copyDrift);
  for (const el of home.copy) out.push([el, { opacity: st.copy, transform: `translateY(${drift})` }]);
  if (G.cue) out.push([G.cue, { opacity: st.copy }]);
  if (G.word) out.push([G.word, { opacity: 1 - smooth(WORD_GONE[0], WORD_GONE[1], c) }]);
  product.rise.forEach((el, i) => {
    const p = st.panel[i] ?? 1;
    // A trace of opacity rather than none, so the details' text is rasterised at the click, not as it rises.
    out.push([el, { opacity: Math.max(p, 0.003), transform: `translateY(${px((1 - p) * T.panelRise)})` }]);
  });
  return out;
}

/** When the camera reaches progress c on its forward ease, in ms. */
function cameraTime(c: number) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (EASE_CAMERA(mid) < c) lo = mid;
    else hi = mid;
  }
  return hi * T.camera;
}

function forwardPath(G: Geometry): Path {
  const n = G.product.rise.length;
  // One thing at a time: the camera, then the details. They rise only once the camera is all but settled, so they never
  // stand over the collection's neighbours.
  const start = cameraTime(SETTLED);
  const duration = Math.max(T.camera, start + (n - 1) * T.panelStagger + T.panelDur);
  return {
    duration,
    at: (t) => ({
      c: EASE_CAMERA(clamp01(t / T.camera)),
      copy: 1 - EASE_LEAVE(clamp01(t / T.copyOut)),
      panel: Array.from({ length: n }, (_, i) => EASE_ENTER(clamp01((t - (start + i * T.panelStagger)) / T.panelDur))),
    }),
  };
}

function backPath(G: Geometry): Path {
  const n = G.product.rise.length;
  // The way in, reversed: the details leave at once, and the camera has moved little before they have gone: it sets off
  // early enough that its first, slowest stretch runs while they go.
  const gone = T.panelOut + (n - 1) * T.panelOutStagger;
  const delay = Math.max(T.backDelay, gone - cameraTime(1 - SETTLED));
  const copyStart = delay + T.copyInAt * T.camera;
  const duration = Math.max(delay + T.camera, copyStart + T.copyInDur);
  return {
    duration,
    at: (t) => ({
      c: 1 - EASE_CAMERA(clamp01((t - delay) / T.camera)),
      copy: EASE_ENTER(clamp01((t - copyStart) / T.copyInDur)),
      panel: Array.from({ length: n }, (_, i) => 1 - EASE_IN(clamp01((t - i * T.panelOutStagger) / T.panelOut))),
    }),
  };
}

/**
 * Re-aim a move from wherever it is: toward the product (`in`) or back to the opening (`out`), quickly
 * (a second click) or at the camera's own pace (a change of mind). The camera leaves with the speed it
 * had, so nothing jerks: a cubic from (c, velocity) to rest, never past the end it is heading for.
 */
function turnPath(st: State, v: number, dir: Dir, quick: boolean): Path {
  const target = dir === "in" ? 1 : 0;
  const dist = Math.abs(target - st.c);
  const D = quick ? Math.max(140, T.hurry * Math.min(1, dist * 2.5)) : Math.max(360, T.camera * dist * 1.05);
  const toward = Math.sign(target - st.c) === Math.sign(v);
  let m = v * D;
  if (toward) m = Math.sign(m) * Math.min(Math.abs(m), 3 * dist);
  else m *= 0.5;
  const n = st.panel.length;
  const cOf = (t: number) => clamp01(hermite(st.c, m, target, clamp01(t / D)));
  // Heading in, the details still wait for the camera to all but settle, however quickly it gets there.
  let settling = 0;
  if (dir === "in") while (settling < D && cOf(settling) < SETTLED) settling += STEP / 2;
  const panelDelay = dir === "in" ? Math.min(D, settling) : 0;
  const panelDur = quick ? 220 : dir === "in" ? 400 : 180;
  const copyDelay = dir === "out" ? (quick ? Math.max(0, D - 220) : D * 0.58) : 0;
  const copyDur = dir === "out" ? (quick ? 220 : 380) : 200;
  const duration = Math.max(D, panelDelay + 30 * (n - 1) + panelDur, copyDelay + copyDur);
  return {
    duration,
    at: (t) => ({
      c: cOf(t),
      copy: dir === "in"
        ? st.copy * (1 - EASE_LEAVE(clamp01(t / copyDur)))
        : st.copy + (1 - st.copy) * EASE_ENTER(clamp01((t - copyDelay) / copyDur)),
      panel: st.panel.map((p0, i) => (dir === "in"
        ? p0 + (1 - p0) * EASE_ENTER(clamp01((t - panelDelay - 30 * i) / panelDur))
        : p0 * (1 - EASE_IN(clamp01(t / panelDur))))),
    }),
  };
}

function animate(target: Target, keyframes: Keyframe[], duration: number): Animation | null {
  const options: KeyframeAnimationOptions = { duration, easing: "linear", fill: "both" };
  if (target instanceof HTMLElement) return target.animate(keyframes, options);
  try {
    return target.el.animate(keyframes, { ...options, pseudoElement: target.pseudo });
  } catch {
    // A browser that can't animate a pseudo-element: the opening's floor fade simply stays under the product's.
    return null;
  }
}

function play(active: Active, path: Path, G: Geometry, at = 0) {
  const N = Math.max(2, Math.ceil(path.duration / STEP) + 1);
  // A layer's blur is its own animation: a filter can keep an animation off the compositor, and the camera's
  // transforms and fades must run there, so they glide on while the main thread is busy drawing the new page.
  const frames = new Map<Target, { moves: Keyframe[]; blurs: Keyframe[] }>();
  for (let i = 0; i < N; i++) {
    const offset = i / (N - 1);
    for (const [target, { filter, backdropFilter, ...props }] of compose(G, path.at(offset * path.duration))) {
      let tracks = frames.get(target);
      if (!tracks) frames.set(target, (tracks = { moves: [], blurs: [] }));
      if (Object.keys(props).length) tracks.moves.push({ offset, ...props });
      if (filter !== undefined) tracks.blurs.push({ offset, filter });
      if (backdropFilter !== undefined) tracks.blurs.push({ offset, backdropFilter });
    }
  }
  const old = active.anims;
  // The new animations exist before the old ones go, so no frame shows a layer at rest.
  active.anims = [...frames].flatMap(([target, tracks]) => [tracks.moves, tracks.blurs].filter((keyframes) => keyframes.length).flatMap((keyframes) => {
    const anim = animate(target, keyframes, path.duration);
    if (!anim) return [];
    if (at) anim.currentTime = at;
    return [anim];
  }));
  for (const anim of old) anim.cancel();
  active.path = path;
  active.G = G;
  note("play", { dir: active.dir, duration: Math.round(path.duration), k: +G.k.toFixed(3) });
  const first = active.anims[0];
  first?.finished.then(() => { if (move === active && active.anims[0] === first) settle(); }, () => undefined);
}

function elapsed(active: Active) {
  const time = Number(active.anims[0]?.currentTime ?? 0) || 0;
  return Math.min(active.path?.duration ?? 0, Math.max(0, time));
}

/** Turn the move toward `dir` from exactly where it is. */
function retarget(dir: Dir, quick = false) {
  const active = move;
  if (!active) return;
  if (active.kind === "fade") {
    if (active.dir === dir) for (const anim of active.anims) anim.finish();
    else {
      for (const anim of active.anims) anim.reverse();
      active.dir = dir;
      direct(active);
    }
    return;
  }
  if (!active.path || !active.G) return;
  const path = active.path;
  const t = elapsed(active);
  const st = path.at(t);
  const h = 6;
  const a = Math.max(0, t - h), b = Math.min(path.duration, t + h);
  const v = (path.at(b).c - path.at(a).c) / (b - a || 1);
  note("retarget", { from: active.dir, dir, quick, at: Math.round(t), c: +st.c.toFixed(3) });
  active.dir = dir;
  direct(active);
  play(active, turnPath(st, v, dir, quick), active.G);
}
const hurry = () => { if (move) retarget(move.dir, true); };

/** The views say which way the move is heading: which page leaves, and so which one stays. */
function direct(active: Active) {
  if (container) {
    container.dataset.moving = active.dir;
    // The camera owns the room while it moves: the product page's room stays hidden under the opening's plate.
    if (active.kind === "camera") container.dataset.camera = "";
    else delete container.dataset.camera;
  }
  const leaving = active.dir === "in" ? active.home : active.product;
  for (const [id, el] of slotElements) el.toggleAttribute("inert", id === leaving);
  setViews({ slots: views.slots.map((slot) => ({ ...slot, leaving: slot.id === leaving })), moving: true });
}

/** The opening's lens, focused on a pedestal for the move (its blur is the move's own animation), or released. */
function focusOn(home: HomeScene, pedestal: number | null) {
  const el = home.focus;
  if (!el) return;
  const scene = fogSceneOf(home.room);
  const mask = pedestal !== null && scene ? focusMask(scene, pedestal) : null;
  if (mask) {
    el.style.setProperty("--tm-focus-mask", mask);
    el.setAttribute("data-focus", "");
  } else {
    el.style.removeProperty("--tm-focus-mask");
    el.removeAttribute("data-focus");
  }
}

/* ---------- Starting ---------- */

function sceneChanged(slot: number) {
  // A page laid out again mid-move (a late font, a stage that grew) is followed from where the camera is.
  if (move && move.kind === "camera" && (slot === move.home || slot === move.product)) refit(move);
  if (pending && (slot === pending.home || slot === pending.product)) schedule();
}

function schedule() {
  if (queued) return;
  queued = true;
  // After the commit that laid the scene out (and React's strict second mount), before the frame is painted.
  queueMicrotask(() => {
    queued = false;
    tryStart();
  });
}

function imageReady(image: HTMLImageElement | null) {
  return !image || (image.complete && image.naturalWidth > 0);
}

function tryStart() {
  const p = pending;
  if (!p) return;
  const home = homes.get(p.home);
  const product = products.get(p.product);
  if (!home || !product || product.id !== p.id) return;
  if (p.kind === "camera" && !home.vials.has(p.id)) p.kind = "fade";
  // The pictures the move shows must be there from its first frame: the vial that travels, and the room that
  // arrives (the product's going in, the opening's coming back). Coming back, the opening's room shows within a
  // few frames and was just mounted, so its picture is decoded first, not merely loaded.
  const pictures = [product.image, p.dir === "in" ? product.still : home.still];
  if (p.kind === "camera" && (!pictures.every(imageReady) || (p.dir === "out" && !p.decoded))) {
    if (p.waiting) return;
    p.waiting = true;
    note("wait", { ready: pictures.map(imageReady) });
    const decode = (image: HTMLImageElement | null) => (image ? image.decode().catch(() => undefined) : Promise.resolve());
    const late = new Promise<void>((done) => window.setTimeout(done, IMAGE_PATIENCE));
    void Promise.race([Promise.all(pictures.map(decode)), late]).then(() => {
      if (pending !== p) return;
      p.waiting = false;
      p.decoded = true;
      if (!pictures.every(imageReady)) p.kind = "fade";
      tryStart();
    });
    return;
  }
  // Going in, the product page is drawn once first, unseen, its plate at its own size: the vial that travels is then
  // drawn at the size it arrives at, so it never sharpens as the move settles. The opening stays as it is meanwhile.
  if (p.kind === "camera" && p.dir === "in" && !p.primed) {
    prime(p);
    return;
  }
  pending = null;
  start(p, home, product);
}

/** Two frames of the arriving product page at a trace of opacity, taking no input; then the move starts. */
function prime(p: Pending) {
  const view = slotElements.get(p.product);
  p.primed = true;
  if (!view) return schedule();
  view.removeAttribute("data-pending");
  view.style.opacity = "0.003";
  view.style.pointerEvents = "none";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    view.style.opacity = "";
    view.style.pointerEvents = "";
    if (pending === p) tryStart();
  }));
}

function start(p: Pending, home: HomeScene, product: ProductScene) {
  const active: Active = { kind: p.kind, dir: p.dir, id: p.id, home: p.home, product: p.product, anims: [], path: null, G: null, frozen: null, places: p.places };
  move = active;
  // Each page stands where its reader left it (the opening coming back, too) before the camera measures it.
  for (const [slot, y] of p.places) hold(slot, y);
  // A parked opening held at the camera's last frame starts from there: its plate's rest is the one read before the move
  // in (its transform now is the camera's), and the held frame gives way only once the move's own animations exist.
  const held = parked && parked.slot === p.home && p.kind === "camera" ? parked : null;
  if (!held) releaseParked();
  if (p.kind === "camera") {
    const frozen = held?.frozen ?? freeze(home.plate);
    const G = geometry(home, product, p.id, frozen, p.dir === "in");
    if (G) {
      active.frozen = frozen;
      home.vials.get(p.id)?.el.setAttribute("data-flying", "");
      focusOn(home, G.home.vials.get(p.id)?.pedestal ?? null);
      reveal(active);
      play(active, p.dir === "in" ? forwardPath(G) : backPath(G), G);
      if (held) releaseParked(false);
      // Going back, the camera starts on the product page's own framing: the room's loop and mist come over to the
      // opening's plate, which now frames the room exactly as the product page did, in this same frame.
      if (p.dir === "out") claimRoom(slotElements.get(active.home));
    } else {
      if (held) releaseParked(false);
      thaw(frozen);
      active.kind = "fade";
    }
  }
  if (active.kind === "fade") {
    reveal(active);
    // A crossfade draws the arriving page's room from its first frame: the room's living parts go to it.
    claimRoom(slotElements.get(p.dir === "in" ? active.product : active.home));
    const view = slotElements.get(active.product);
    if (view) {
      const anim = view.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.fade, easing: "ease-out", fill: "both", direction: p.dir === "in" ? "normal" : "reverse" });
      active.anims = [anim];
      anim.finished.then(() => { if (move === active && active.anims[0] === anim) settle(); }, () => undefined);
    }
    note("play", { dir: p.dir, kind: "fade" });
  }
  listen(true);
  announce();
  note("start", { dir: p.dir, kind: active.kind, id: p.id, places: [...p.places] });
  if (p.hurry) hurry();
}

/** The arriving page is drawn from this frame on; the leaving one stops taking input. */
function reveal(active: Active) {
  const arriving = active.dir === "in" ? active.product : active.home;
  // Drawn now, whether or not React has drawn the views since (a parked opening is shown by the same frame).
  slotElements.get(arriving)?.removeAttribute("data-pending");
  slotElements.get(arriving)?.removeAttribute("data-parked");
  direct(active);
  setViews({ slots: views.slots.map((slot) => (slot.id === arriving ? { ...slot, pending: false } : slot)), moving: true });
}

/** The camera follows a page that was laid out again while it moved: same path, same moment, new places. */
function refit(active: Active) {
  if (!active.path || !active.G || !active.frozen) return;
  const home = homes.get(active.home), product = products.get(active.product);
  if (!home || !product) return;
  const G = geometry(home, product, active.id, active.frozen, false);
  if (!G) return;
  G.lift0 = active.G.lift0;
  const same = (a: Box, b: Box) => Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5;
  if (same(active.G.P, G.P) && Math.abs(active.G.Q.x - G.Q.x) < 0.5 && Math.abs(active.G.Q.y - G.Q.y) < 0.5 && Math.abs(active.G.k - G.k) < 1e-3) return;
  note("refit", { dir: active.dir, P: [G.P.left - active.G.P.left, G.P.top - active.G.P.top, G.P.width - active.G.P.width].map((v) => +v.toFixed(2)), Q: [G.Q.x - active.G.Q.x, G.Q.y - active.G.Q.y].map((v) => +v.toFixed(2)), k: +(G.k - active.G.k).toFixed(4) });
  play(active, active.path, G, elapsed(active));
}

/* ---------- Where each page stands ---------- */

/** Hold a page where it was scrolled while the window stands at the top for the move (0: let it go). */
function hold(slot: number, y: number) {
  const el = slotElements.get(slot);
  if (el) el.style.transform = y ? `translateY(${-y}px)` : "";
}

/** A page waiting to land: call it to land it now (or, with false, to let it go where it is, as a new move begins). */
let landing: ((now?: boolean) => void) | null = null;
const roomToScroll = () => document.documentElement.scrollHeight - window.innerHeight;

/**
 * The page that stays takes its place again: let go, with the window scrolled to where it was held, in one step, so
 * nothing on screen moves. A page that is still too short to stand there (what lies below the opening is drawn once the
 * move has settled) stays held until it is tall enough, the reader does something, or a moment has passed.
 */
function land(slot: number, y: number) {
  landing?.(false);
  if (!y) {
    hold(slot, 0);
    releaseScroll();
    return;
  }
  const begun = performance.now();
  let frame = 0;
  const finish = (now = true) => {
    cancelAnimationFrame(frame);
    for (const type of READER_INPUT) window.removeEventListener(type, onInput, true);
    landing = null;
    hold(slot, 0);
    if (now) window.scrollTo({ top: Math.min(y, Math.max(0, roomToScroll())), behavior: "instant" });
    releaseScroll();
  };
  const onInput = () => finish();
  // Checked from the next frame, once the page that left is gone from the document.
  const check = () => {
    if (roomToScroll() >= y - 1 || performance.now() - begun > 2500) finish();
    else frame = requestAnimationFrame(check);
  };
  for (const type of READER_INPUT) window.addEventListener(type, onInput, { capture: true, passive: true });
  landing = finish;
  frame = requestAnimationFrame(check);
}

/* ---------- Ending ---------- */

/** The move ends: the page it was heading for becomes the page. */
function settle() {
  const active = move;
  if (!active) return;
  move = null;
  listen(false);
  const stays = active.dir === "in" ? active.product : active.home;
  const home = homes.get(active.home);
  // Going in, the opening stays mounted under the product page, inert and covered by it, pinned to its address, so Back
  // has nothing to build (FlightViews). After a camera move it is held as the camera left it (Parked): the move's
  // animations on the opening's plate, words, way in, neighbours and floor stay, finished; the rest are let go.
  const parks = active.dir === "in" && Boolean(home);
  const mine = new Set<Element>();
  if (parks && active.kind === "camera" && active.G) {
    const G = active.G;
    for (const el of [G.home.plate, G.home.stage, ...G.home.copy, ...G.neighbours.map((n) => n.el)]) mine.add(el);
    if (G.cue) mine.add(G.cue);
    if (G.word) mine.add(G.word);
  }
  const keep = active.anims.filter((anim) => {
    const target = (anim.effect as KeyframeEffect | null)?.target;
    return Boolean(target && mine.has(target));
  });
  for (const anim of active.anims) if (!keep.includes(anim)) anim.cancel();
  // The camera has arrived on the product page's own framing: the room's loop and mist go to its plate, which frames
  // the room exactly as the opening's now does, and is drawn from this frame on. Nothing on screen changes.
  if (active.dir === "in") claimRoom(slotElements.get(stays));
  home?.vials.get(active.id)?.el.removeAttribute("data-flying");
  // The lens is released either way (a parked opening keeps no blur running under the product page). Coming back, the
  // opening is the page and its plate goes back to the pointer; going in, it is held as the camera left it.
  if (home) focusOn(home, null);
  if (keep.length) parked = { slot: active.home, anims: keep, frozen: active.frozen };
  else thaw(active.frozen);
  if (container) {
    delete container.dataset.moving;
    delete container.dataset.camera;
  }
  for (const [id, el] of slotElements) el.toggleAttribute("inert", parks && id === active.home);
  setViews({
    slots: views.slots
      .filter((slot) => slot.id === stays || (parks && slot.id === active.home))
      .map((slot) => (slot.id === stays
        ? { ...slot, location: null, pending: false, leaving: false, parked: false }
        : { ...slot, pending: false, leaving: false, parked: true })),
    moving: false,
  });
  // The page that stays takes its place again where its reader left it: the opening, scrolled as it was tapped.
  land(stays, active.places.get(stays) ?? 0);
  announce();
  // Focus lands on the product's name. Back on the opening, a reader on the keyboard is returned to the vial
  // they opened; a pointer's reader isn't given a focus ring they never asked for.
  if (active.dir === "in") products.get(stays)?.heading.focus({ preventScroll: true });
  else if (keyboard) home?.vials.get(active.id)?.el.focus({ preventScroll: true });
  note("settle", { dir: active.dir, kind: active.kind });
}

/** Straight to an address, no animation (Safari's own swipe back has already shown the way). */
function snap(location: Location) {
  const active = move;
  landing?.(false);
  pending = null;
  move = null;
  listen(false);
  releaseParked();
  if (active) {
    for (const anim of active.anims) anim.cancel();
    const home = homes.get(active.home);
    home?.vials.get(active.id)?.el.removeAttribute("data-flying");
    if (home) focusOn(home, null);
    thaw(active.frozen);
  }
  if (container) {
    delete container.dataset.moving;
    delete container.dataset.camera;
  }
  for (const el of slotElements.values()) {
    el.removeAttribute("inert");
    el.style.transform = "";
  }
  // The slot already showing that page keeps it (no remount); otherwise the last one takes the address.
  const want = pageOf(location.pathname);
  const keep = views.slots.find((slot) => slot.location && pageOf(slot.location.pathname) === want && (want !== "product" || productOf(slot.location.pathname) === productOf(location.pathname)))
    ?? live()[live().length - 1] ?? views.slots[views.slots.length - 1];
  setViews({ slots: [{ ...keep, location: null, pending: false, leaving: false, parked: false }], moving: false });
  // The page that stays shows the room's loop and mist (if it shows the room).
  claimRoom(slotElements.get(keep.id));
  announce();
  note("snap", { to: location.pathname });
}

/* ---------- While a move runs ---------- */

function onClick(event: MouseEvent) {
  // A second click (a double click, a tap on anything) finishes the move quickly, even one that comes before
  // the camera has started.
  if (!move && !pending) return;
  event.preventDefault();
  event.stopPropagation();
  if (move) hurry();
  else if (pending) pending.hurry = true;
}
function onKey(event: KeyboardEvent) {
  // Escape turns the camera back; the address goes back with it. Before the camera has started (its pictures still
  // coming, the product page being drawn unseen), nothing has moved yet: going back simply stays on the opening.
  if (event.key !== "Escape") return;
  if ((move && move.dir === "in") || (!move && pending?.dir === "in")) {
    event.preventDefault();
    router?.navigate(-1);
  }
}
function onScroll(event: Event) {
  if (move) event.preventDefault();
}
function onResize() {
  hurry();
}
function listen(on: boolean) {
  if (on) {
    document.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onScroll, { passive: false });
    window.addEventListener("touchmove", onScroll, { passive: false });
    window.addEventListener("resize", onResize);
  } else {
    document.removeEventListener("click", onClick, true);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("wheel", onScroll);
    window.removeEventListener("touchmove", onScroll);
    window.removeEventListener("resize", onResize);
  }
}

/* ---------- Beginning a move ---------- */

/** The vials the opening shows on this screen: a phone held upright shows the middle three. */
function openingShows(id: string) {
  const ids = matches(TALL_SCREEN) ? collectionIds.slice(1, 4) : collectionIds;
  return ids.includes(id) && Boolean(productById(id));
}

function inView(element: Element) {
  const r = element.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
}

/**
 * Into a product from the opening: the camera moves in on its vial. Returns false when the move can't
 * run here, so the vial's link simply navigates.
 */
export function flyToProduct(id: string, vial: HTMLElement): boolean {
  if (move) { hurry(); return true; }
  // An opening still landing from the last move lands now, so its place is read where its reader sees it.
  landing?.();
  if (pending || !router || live().length !== 1) return false;
  const shown = live()[0];
  const home = homes.get(shown.id);
  if (!home || pageOf(router.location.pathname) !== "home" || !productById(id)) return false;
  const kind: Kind = reduced() || !home.vials.has(id) || !inView(vial) ? "fade" : "camera";
  // Both pages start at the top. The opening is held where it was if it had scrolled, and that place is kept for it,
  // so the camera brings it back there.
  const scrolled = Math.round(window.scrollY);
  keepScroll(router.location.key, scrolled);
  if (scrolled) {
    hold(shown.id, scrolled);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const to = `/product/${id}`;
  const arriving: Slot = {
    id: nextSlot++,
    location: { pathname: to, search: "", hash: "", state: { flight: "in" }, key: `flight-${nextSlot}` } as Location,
    pending: true,
    leaving: false,
  };
  pending = { kind, dir: "in", id, home: shown.id, product: arriving.id, places: new Map([[shown.id, scrolled]]), waiting: false, hurry: false, decoded: false };
  listen(true);
  // A parked opening can't be under a page that is the opening; there is none here, but none is ever kept by a new move.
  setViews({ slots: [{ ...shown, location: router.location, leaving: true }, arriving], moving: true });
  note("go", { id, kind, scrolled });
  router.navigate(to, { state: { flight: "in" } });
  return true;
}

/** Whether the product page's vial is in view enough to fly from (the study's 3/4 of the screen). */
function seen(product: ProductScene) {
  const r = product.glass.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight * 0.75;
}

/**
 * The history moved (Back, Forward, Escape's back). Decides, before the router draws the new address, whether
 * a move owns it: then the departing page stays drawn and the scroll is the move's. Returns true if it does.
 */
function onPop(update: PopUpdate): boolean {
  const to = update.location;
  if (update.uaTransition) {
    // Safari animated its own swipe back: the page simply changes.
    if (move || pending) snap(to);
    return false;
  }
  const want = pageOf(to.pathname);
  if (move) {
    if (want === "home" && move.dir === "in") {
      repin(move.home, to);
      retarget("out");
      return true;
    }
    if (want === "product" && move.dir === "out" && productOf(to.pathname) === move.id) {
      repin(move.product, to);
      retarget("in");
      return true;
    }
    snap(to);
    return false;
  }
  if (pending) {
    snap(to);
    return false;
  }
  landing?.();
  const from = router?.location;
  if (!from || live().length !== 1 || want !== "home" || pageOf(from.pathname) !== "product" || !arrivedByFlight(from)) return false;
  const shown = live()[0];
  const product = products.get(shown.id);
  const id = productOf(from.pathname);
  if (!product || !id || product.id !== id) return false;
  const kind: Kind = !reduced() && openingShows(id) && seen(product) ? "camera" : "fade";
  const scrolled = Math.round(window.scrollY);
  if (scrolled) {
    hold(shown.id, scrolled);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  // The opening comes back where its reader left it when they tapped the vial: held there while the camera pulls
  // back, and landed there as it settles. The place stays kept meanwhile, so no scroll of the move's is recorded.
  const place = scrollFor(to.key) ?? 0;
  keepScroll(to.key, place);
  // The opening the camera left, parked under this page, comes back as it is: already mounted, laid out and drawn
  // once, so its pictures are decoded and the camera can start at once. Without one, a new opening is mounted.
  const parked = views.slots.find((slot) => slot.parked);
  const arriving: Slot = parked ? { ...parked, location: to, pending: true, leaving: false, parked: false } : { id: nextSlot++, location: to, pending: true, leaving: false };
  pending = { kind, dir: "out", id, home: arriving.id, product: shown.id, places: new Map([[shown.id, scrolled], [arriving.id, place]]), waiting: false, hurry: false, decoded: Boolean(parked) };
  listen(true);
  setViews({ slots: [arriving, { ...shown, location: from, leaving: true }], moving: true });
  note("back", { id, kind, scrolled, parked: Boolean(parked) });
  // A parked opening registered its scene long ago: nothing will announce it, so the move is tried as soon as the
  // views have been drawn with it.
  if (parked) schedule();
  return true;
}

function repin(slot: number, location: Location) {
  setViews({ ...views, slots: views.slots.map((s) => (s.id === slot ? { ...s, location } : s)) });
}

/** "The collection" on a page the move brought you to: the camera pulls back out to the opening. */
export function flyBack(): boolean {
  if (!router || !arrivedByFlight(router.location)) return false;
  router.navigate(-1);
  return true;
}

/** Whether the reader's last input was the keyboard (as the browser decides where a focus ring shows). */
let keyboard = false;

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (event) => { if (!event.metaKey && !event.ctrlKey) keyboard = true; }, true);
  window.addEventListener("pointerdown", () => { keyboard = false; }, true);
  setPopHook((update) => {
    const owned = onPop(update);
    if (owned) holdPopScroll(update.location.key);
    return owned;
  });
  if (import.meta.env?.DEV) {
    (window as unknown as { __tmFlight: unknown }).__tmFlight = {
      log,
      get state() {
        return { views, moving: move ? { dir: move.dir, kind: move.kind, id: move.id } : null, pending: pending ? { dir: pending.dir, kind: pending.kind, id: pending.id } : null };
      },
      T,
    };
  }
}
