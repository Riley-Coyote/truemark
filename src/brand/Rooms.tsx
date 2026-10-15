import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode, RefObject } from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "../assetUrl";
import type { Product } from "../data";
import { productCutout } from "../shop/catalog";
import { useMediaQuery } from "../shop/motion";
import { FloorMist, FOG_SCENES, focusMask } from "./fog";
import type { FogParams, FogScene } from "./fog";
import { OPENING_MEDIA } from "./opening-media";
import { moveInto, registerClaimant } from "./share";
import "./rooms.css";

/*
 * The living rooms the vials stand in. Each is a generated loop of an empty set with its camera locked,
 * so the pedestals never move; the supplied vial cutouts, untouched, are laid over them where each
 * pedestal's top is. Every position is a fraction of the room's own frame, measured on that frame.
 */

/** A room: its frame, its loop (a still room has none) and the loop's first frame (or the still). `large`: a sharper
 *  cut of the same room, for screens at least `from` device pixels across, which see the room closer than its own frame
 *  can hold (a product page's close framing on a retina screen). Every page starts on the room's own cut; the sharper
 *  one is brought in later, once, invisibly (upgradeLoop, upgradeStill). */
export type Room = { w: number; h: number; video?: string; poster: string; large?: { video?: string; poster: string; from: number } };
/** Where a vial's foot meets its pedestal's top, and how tall the vial stands there. */
export type Seat = { x: number; y: number; h: number };

const media = (name: string) => assetUrl(`media/${name}`);

/** The collection's room, widened from the original set so the pedestals stand low under open wall: a crisp, graded
 *  still (tools/hf/grade, from the plate the misty loops were made from, so every seat and the mist's calibration hold),
 *  its life the floor mist's. Every product stands in it too, the camera close on one pedestal. Its 3866×2160 cut goes
 *  in `large`. */
export const COLLECTION: Room = {
  w: 2560,
  h: 1430,
  poster: assetUrl(OPENING_MEDIA.wide.poster),
  large: { poster: assetUrl(OPENING_MEDIA.wide.large.poster), from: 2400 },
};
/** The same room cut for a portrait screen: the middle three pedestals, wall above, floor below. */
export const COLLECTION_TALL: Room = {
  w: 1080,
  h: 1934,
  poster: assetUrl(OPENING_MEDIA.tall.poster),
  // 2160×3870: at a product page's close framing on a 3x phone the smaller cut's pedestal rims go soft.
  large: { poster: assetUrl(OPENING_MEDIA.tall.large.poster), from: 1100 },
};

/** The band of the wide room a landscape opening shows (MistOpening.tsx): its widened edges wait for very wide
 *  screens. A product page reads it to know how much closer than the opening it frames the room. */
export const OPENING_BAND = { x0: 0.08, x1: 0.92, focusY: 0.88 };

/** The room's scale (its pixels per pixel of its own frame) at the opening's framing of a window `sw` wide whose
 *  first screen is `screen` tall: cover-fitted, the wide room by its band. */
export function openingScale(room: Room, sw: number, screen: number) {
  const across = room === COLLECTION ? (OPENING_BAND.x1 - OPENING_BAND.x0) * room.w : room.w;
  return Math.max(sw / across, screen / room.h);
}

/**
 * The cut of a room's loop (and its first frame) every page starts on, on every device: the room's own, light one. The
 * opening and every product page show the same cut, so a camera move never changes it. Where the screen wants the
 * sharper cut, the room's one loop brings it in later, at rest, once (upgradeLoop); its first frame, which lies under
 * the loop, stays this one.
 */
export function roomMedia(room: Room): { video?: string; poster: string } {
  return { video: room.video, poster: room.poster };
}

/** The loops' frame rate: every room is cut at 24 frames a second. */
const LOOP_FPS = 24;
type Connection = { saveData?: boolean; effectiveType?: string };
/** When a room's sharper cut comes in (upgradeLoop): never, once the page has loaded, or once a product's room is open. */
export type LargeCut = "never" | "now" | "room";
/** A phone: a touch screen whose shorter side is a phone's. */
const isPhone = () => typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches && Math.min(window.screen.width, window.screen.height) < 700;
/**
 * When this device should have a room's sharper cut. Only on a screen at least its `from` device pixels across (it sees
 * the room closer than the room's own frame holds), and never when the reader has asked to save data or the browser
 * calls the connection slow. A desktop on a connection the browser calls fast has it once the page has loaded ("now").
 * A phone, and any device whose browser says nothing of its connection (Safari never does), has it only once a
 * product's room has been opened, where the camera stands close enough to see it ("room"): the opening alone never
 * fetches it there.
 */
export function largeCut(room: Room): LargeCut {
  if (!room.large || typeof window === "undefined" || typeof navigator === "undefined") return "never";
  if (window.innerWidth * (window.devicePixelRatio || 1) < room.large.from) return "never";
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  if (connection?.saveData) return "never";
  if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-data: reduce)").matches) return "never";
  if (connection?.effectiveType && connection.effectiveType !== "4g") return "never";
  return !connection?.effectiveType || isPhone() ? "room" : "now";
}
/** Night: one beam on a glossy black plinth, the light on its top slowly brightening. */
export const NIGHT: Room = { w: 1920, h: 1080, video: media("night.mp4"), poster: media("night.jpg") };

/** The five pedestals, left to right. */
export const COLLECTION_SEATS: Seat[] = [
  { x: 0.2424, y: 0.71, h: 0.1792 },
  { x: 0.3682, y: 0.6452, h: 0.1792 },
  { x: 0.4978, y: 0.5986, h: 0.1792 },
  { x: 0.6296, y: 0.6558, h: 0.1792 },
  { x: 0.7576, y: 0.7268, h: 0.1792 },
];
/** The tall cut shows the inner three of the five. */
export const COLLECTION_TALL_SEATS: Seat[] = [
  { x: 0.168, y: 0.6083, h: 0.1417 },
  { x: 0.4963, y: 0.5714, h: 0.1417 },
  { x: 0.8306, y: 0.6166, h: 0.1417 },
];
/** The middle of the plinth's top: the foot's front edge stands just in front of the disc's centre. The vial
 *  stands small in the beam, with the dark around it. */
export const NIGHT_SEAT: Seat = { x: 0.6795, y: 0.66, h: 0.3 };

/** Where the night plinth's left rim is, as a fraction of the night room's width. */
export const NIGHT_PLINTH_LEFT = 0.494;

/**
 * Slide a room right, within what it overflows, until a feature at `featureX` (a fraction of the room's
 * width) stands at least at `clearX` in the stage, but never so far that the vial on `seat` leaves the
 * stage: it keeps `margin` inside the right edge. Used to keep the night plinth clear of the certificate.
 */
export function clearRight(box: Box, featureX: number, clearX: number, seat: Seat, stageWidth: number, margin = 24): Box {
  const need = clearX - featureX * box.width;
  const vialRight = seat.x * box.width + (seat.h * box.height * VIAL_RATIO) / 2;
  const keepIn = stageWidth - margin - vialRight;
  return { ...box, left: Math.min(0, Math.max(box.left, Math.min(need, keepIn))) };
}

/** The light on a vial's glass before the glass has arrived: none. */
const NO_OUTLINE = "linear-gradient(transparent, transparent)";

/** A vial cutout's width over its height. */
export const VIAL_RATIO = 578 / 1112;

/** A vial's own cut-out as a mask, for the room's light lying on its glass. The address is made absolute: a
 *  relative url() in a custom property resolves against the stylesheet that uses it, not against the page. */
export const glassMask = (src: string) => `url("${new URL(src, document.baseURI).href}")`;

export type Box = { left: number; top: number; width: number; height: number };

/** Cover a stage with a room, keeping the focus point at the same place in both. */
export function coverBox(sw: number, sh: number, room: Room, focus: { x: number; y: number }): Box {
  const scale = Math.max(sw / room.w, sh / room.h);
  const width = room.w * scale, height = room.h * scale;
  return { left: (sw - width) * focus.x, top: (sh - height) * focus.y, width, height };
}

/** A cover-fitted room taken a little closer (`z`), about the seat's foot, never uncovering the stage: the
 *  product's room, so the vial stands large and the room reaches past the frame (it can then arrive while the
 *  camera is still settling). */
export function zoomAt(box: Box, seat: Seat, z: number, sw: number, sh: number): Box {
  const fx = box.left + seat.x * box.width, fy = box.top + seat.y * box.height;
  const width = box.width * z, height = box.height * z;
  const clamp = (v: number, low: number) => Math.min(0, Math.max(low, v));
  return { left: clamp(fx - seat.x * width, sw - width), top: clamp(fy - seat.y * height, sh - height), width, height };
}

/** Cover a stage with a vertical band of a room, centred, so the band's edges meet the stage's sides. */
export function bandBox(sw: number, sh: number, room: Room, band: { x0: number; x1: number; focusY: number }): Box {
  const scale = Math.max(sw / ((band.x1 - band.x0) * room.w), sh / room.h);
  const width = room.w * scale, height = room.h * scale;
  return { left: sw / 2 - ((band.x0 + band.x1) / 2) * width, top: (sh - height) * band.focusY, width, height };
}

/** Cover a stage with a room, the given seat at the stage's centre as nearly as the room allows. */
export function centredOn(sw: number, sh: number, room: Room, seat: Seat): Box {
  // Fitted to the stage, and if that leaves too little room either side of the seat to centre it, a little closer.
  const scale = Math.max(sw / room.w, sh / room.h, sw / (2 * (1 - seat.x) * room.w), sw / (2 * seat.x * room.w));
  const width = room.w * scale, height = room.h * scale;
  const clamp = (v: number, low: number) => Math.min(0, Math.max(low, v));
  return { left: clamp(sw / 2 - seat.x * width, sw - width), top: clamp(sh / 2 - (seat.y - seat.h / 2) * height, sh - height), width, height };
}

/** A block of words on a room's wall, in stage pixels: its sides, its top and its bottom. */
export type Words = { left: number; right: number; top: number; bottom: number };

/**
 * Seat a room between the words on its wall and the words on its floor.
 *
 * Every vial standing under a block of words on the wall keeps `clearance` below it: the plate moves down
 * within what it overflows, and if that isn't enough (a plate fitted to the stage's width can only come
 * further down by the stage growing until the plate is fitted to its height), the stage must grow.
 *
 * Every vial standing over a block of words on the floor (anchored to the stage's bottom) keeps its foot
 * clear above it; there the stage grows to make the room. The heights are solved from the measurements
 * alone, not from the stage's current height, so a stage that grows to them stays there.
 *
 * `widthFit` is the plate's height when fitted to the stage's width; `focusY` is where the plate rests
 * vertically when nothing moves it (as in coverBox and bandBox).
 */
export function seatBelow(box: Box, seats: Seat[], wall: Words[], floor: Words[], stage: { w: number; h: number }, clearance: number, widthFit: number, focusY: number) {
  if (!stage.w) return { box, minStage: 0 };
  const under = (seat: Seat, block: Words) => {
    const centre = box.left + seat.x * box.width, half = (seat.h * box.height * VIAL_RATIO) / 2;
    return centre + half >= block.left && centre - half <= block.right;
  };
  let need = -Infinity, wallTarget = 0;
  for (const seat of seats) for (const block of wall) {
    if (!block.bottom || !under(seat, block)) continue;
    const cap = seat.y - seat.h;
    need = Math.max(need, block.bottom + clearance - cap * box.height);
    wallTarget = Math.max(wallTarget, (block.bottom + clearance) / cap);
  }
  const top = Math.min(0, Math.max(stage.h - box.height, Math.max(box.top, need)));
  let minStage = need > -Infinity && wallTarget > widthFit + 0.5 ? Math.ceil(wallTarget) : 0;
  // The floor: the words there sit `room` above the stage's bottom; each vial over them stands clear above.
  const gap = clearance / 2;
  for (const seat of seats) for (const block of floor) {
    if (!block.top || !under(seat, block)) continue;
    const room = stage.h - block.top;
    const foot = seat.y * box.height;
    // Resting where the plate falls by itself, its top moves with the stage: (h - H)·f. Held down by the wall's
    // words, it stays at `need`. Whichever holds the plate, solve for the stage height that clears the foot.
    const resting = (box.height * (seat.y - focusY) + gap + room) / (1 - focusY);
    const held = need + foot + gap + room;
    const restingTop = (resting - box.height) * focusY;
    minStage = Math.max(minStage, Math.ceil(need > restingTop ? held : resting));
  }
  return { box: { ...box, top }, minStage: minStage > stage.h + 0.5 || minStage > widthFit + 0.5 ? minStage : minStage };
}

/** How the opening frames its room (frameOpening): the plate, the stage's height, and whether the room falls short of
 *  the stage anywhere (then the stage is filled softly around it, mist.css). */
export type OpeningFrame = { box: Box; stage: number; fill: boolean };

/**
 * The opening's framing: every vial on its pedestal, with the face under its foot and `margin` around both, fully inside
 * the first screen at every window size, and clear of the words on the wall. The room is cover-fitted as before wherever
 * that holds; where it doesn't, the room is taken further away (the vials smaller) until it does, and never cropped.
 *
 * A portrait screen (`tall`) sees the tall cut's three pedestals across its width: the room comes no closer than lets
 * the outer two stand `margin` inside the screen's sides, and if it then can't reach down the whole first screen the
 * stage ends where the room does (its floor fades into what follows). A landscape screen sees the wide room's band: the
 * plate sits so the vials stand just under the words, `clearance` below them, with `footRoom` under each foot above the
 * screen's foot; if that needs the room smaller than the stage, the room stands in the middle of a soft fill of itself.
 * The words on the floor (a portrait screen's way in) are seated as before (seatBelow). `screen` is the first screen's
 * height for the stage; `wall` blocks are in stage pixels, and `floor` blocks give their top and bottom as distances
 * above the stage's foot, to which they are anchored.
 */
export function frameOpening({ room, seats, tall, sw, screen, wall, floor, clearance, footRoom, margin, band, focusY, minVial, plateScale = 1, drift = { x: 0, y: 0 } }: {
  room: Room;
  seats: Seat[];
  tall: boolean;
  sw: number;
  screen: number;
  wall: Words[];
  floor: Words[];
  clearance: number;
  footRoom: number;
  margin: number;
  band: { x0: number; x1: number; focusY: number };
  focusY: number;
  /** The smallest a vial may stand (px) before the stage grows past the first screen instead. */
  minVial: number;
  /** The plate is drawn this much larger than its box, about its centre (rooms.css .tm-room-plate). */
  plateScale?: number;
  /** How far the plate may move with the pointer's depth either way (px), kept inside the margin too. */
  drift?: { x: number; y: number };
}): OpeningFrame & { minStage: number } {
  const none = { box: { left: 0, top: 0, width: 0, height: 0 }, stage: screen, fill: false, minStage: 0 };
  if (!sw || !screen) return none;
  /** A vial's half width at plate width 1, in the plate's widths. */
  const halfOf = (seat: Seat) => (seat.h * (room.h / room.w) * VIAL_RATIO) / 2;
  if (tall) {
    // The outer seats stand `margin` inside the sides: the room no wider than that allows, centred.
    let widest = Infinity;
    // (Drawn `plateScale` larger about its centre, so its seats stand that much further out.)
    for (const seat of seats) {
      const left = seat.x - halfOf(seat), right = seat.x + halfOf(seat);
      if (left < 0.5) widest = Math.min(widest, (sw / 2 - margin - drift.x) / ((0.5 - left) * plateScale));
      if (right > 0.5) widest = Math.min(widest, (sw / 2 - margin - drift.x) / ((right - 0.5) * plateScale));
    }
    const p = Math.min(Math.max(sw / room.w, screen / room.h), widest / room.w);
    const width = room.w * p, height = room.h * p;
    const stage = Math.min(screen, height);
    const box = { left: (sw - width) / 2, top: (stage - height) * focusY, width, height };
    // The words on the floor are anchored to the stage's foot (`floor` gives their distances above it): as tall as the
    // room lets the stage be, they move up with it.
    const seated = seatBelow(box, seats, wall, floor.map((block) => ({ ...block, top: stage - block.top, bottom: stage - block.bottom })), { w: sw, h: stage }, clearance, height, focusY);
    const grown = Math.max(stage, seated.minStage);
    return { box: seated.box, stage: grown, fill: grown > height + 0.5, minStage: grown > stage + 0.5 ? grown : 0 };
  }
  // A landscape screen: the band, cover-fitted, as large as the vials and the faces under them allow.
  const across = (band.x1 - band.x0) * room.w;
  const cover = Math.max(sw / across, screen / room.h);
  const placeAt = (p: number): number | null => {
    const width = room.w * p, height = room.h * p;
    const left = sw / 2 - ((band.x0 + band.x1) / 2) * width;
    let low = -Infinity, high = Infinity;
    // Where things stand once the plate is drawn `plateScale` larger about its centre (the top is solved for: the
    // plate's centre is top + height / 2).
    const s = plateScale;
    for (const seat of seats) {
      const vial = seat.h * height * s, foot = height / 2 + (seat.y - 0.5) * height * s;
      const centre = sw / 2 + (left + seat.x * width - sw / 2) * s, half = (vial * VIAL_RATIO) / 2;
      if (centre - half < margin + drift.x || centre + half > sw - margin - drift.x) return null;
      for (const block of wall) {
        if (!block.bottom || centre + half < block.left || centre - half > block.right) continue;
        low = Math.max(low, block.bottom + clearance + drift.y - (foot - vial));
      }
      // The face under the foot, as deep as the way in stands on it (stories.css .tm-story-cue), and the margin below
      // it, on the first screen.
      high = Math.min(high, screen - drift.y - Math.max(footRoom, margin + 0.11 * vial + 36) - foot);
    }
    if (low > high) return null;
    const natural = (screen - height) * focusY;
    let top = Math.min(high, Math.max(low, natural));
    // Covering the stage where the words allow it.
    if (height >= screen) {
      const a = Math.max(low, screen - height), b = Math.min(high, 0);
      if (a <= b) top = Math.min(b, Math.max(a, natural));
    }
    return top;
  };
  let p = cover;
  let top = placeAt(p);
  if (top === null) {
    // The largest room that seats every vial on the first screen, found by halving.
    const least = minVial / (Math.max(...seats.map((seat) => seat.h)) * room.h);
    if (placeAt(least) === null) {
      // Even the smallest vials don't fit beside these words (a phone on its side): as before, the stage grows past the
      // first screen until the room, fitted to it, seats them clear of the words.
      let stage = screen;
      for (let i = 0; i < 6; i++) {
        const seated = seatBelow(bandBox(sw, stage, room, band), seats, wall, [{ left: 0, right: sw, top: stage - footRoom, bottom: stage }], { w: sw, h: stage }, clearance, (sw / across) * room.h, focusY);
        if (seated.minStage <= stage + 0.5) return { box: seated.box, stage, fill: false, minStage: stage > screen ? stage : 0 };
        stage = seated.minStage;
      }
      const box = seatBelow(bandBox(sw, stage, room, band), seats, wall, [{ left: 0, right: sw, top: stage - footRoom, bottom: stage }], { w: sw, h: stage }, clearance, (sw / across) * room.h, focusY).box;
      return { box, stage, fill: false, minStage: stage };
    }
    let lo = least, hi = cover;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (placeAt(mid) === null) hi = mid;
      else lo = mid;
    }
    p = lo;
    top = placeAt(p) ?? 0;
  }
  const width = room.w * p, height = room.h * p;
  const left = sw / 2 - ((band.x0 + band.x1) / 2) * width;
  const fill = left > 0.5 || left + width < sw - 0.5 || top > 0.5 || top + height < screen - 0.5;
  return { box: { left, top, width, height }, stage: screen, fill, minStage: 0 };
}

/** A stage's size, kept current. */
export function useStageSize(stage: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    const fit = () => setSize({ w: node.clientWidth, h: node.clientHeight });
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [stage]);
  return size;
}

/** A camera move is running (flight.ts), the page is an opening parked under a product page, or the opening's camera
 *  has left the room's rest (Sequence.tsx): the rooms hold still, as the pointer's depth does, until it settles. */
const held = (node: Element) => Boolean(node.closest(".tm-views[data-moving], .tm-view[data-parked], .tm-mist[data-seq-away]"));
/** A camera move is running or about to (flight.ts): nothing new is brought into a room meanwhile. */
const moving = () => Boolean(document.querySelector(".tm-views[data-moving], .tm-view[data-pending]"));
/** The event a move sends as it starts and settles (flight.ts FLIGHT_EVENT), and the one the opening's camera sends as
 *  it leaves the room's rest and comes back to it (Sequence.tsx SEQUENCE_EVENT). */
const FLIGHT = "tm-flight";
const SEQUENCE = "tm-sequence";

/** Depth: the room answers the pointer a little, the mist in front of it more. Writes --mx and --my. */
export function useDepth(stage: RefObject<HTMLElement | null>, on: boolean) {
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const rest = () => {
      if (held(node)) return;
      node.style.setProperty("--mx", "0");
      node.style.setProperty("--my", "0");
    };
    if (!on) { rest(); return; }
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch" || frame || held(node)) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (held(node)) return;
        const box = node.getBoundingClientRect();
        node.style.setProperty("--mx", (((event.clientX - box.left) / box.width) * 2 - 1).toFixed(3));
        node.style.setProperty("--my", (((event.clientY - box.top) / box.height) * 2 - 1).toFixed(3));
      });
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", rest);
    return () => { node.removeEventListener("pointermove", move); node.removeEventListener("pointerleave", rest); cancelAnimationFrame(frame); };
  }, [stage, on]);
}

/** A loop below the first screen starts loading once it is within a screen of the window, and plays once it is
 *  all but on screen. */
const LOAD_NEAR = "100% 0px";
const PLAY_NEAR = "160px 0px";

/**
 * A room's loop, playing only while it is on screen and the page is seen; its first frame shows while
 * it loads. Unless it is the first screen's own (`eager`), it isn't fetched at all until it comes near:
 * until then it is its poster, which is that first frame (`preload` alone isn't enough: WebKit fetches
 * the whole file regardless). With reduced motion the room is that first frame, held still. While a
 * camera move runs, or the opening's closer look is away from the room, every loop holds its frame, and plays on as
 * the move settles or the closer look comes back.
 */
export function RoomVideo({ room, still, eager = false, className = "tm-room" }: { room: Room; still: boolean; eager?: boolean; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(eager);
  useEffect(() => {
    const node = video.current;
    if (!node || near) return;
    const watch = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setNear(true); }, { rootMargin: LOAD_NEAR });
    watch.observe(node);
    return () => watch.disconnect();
  }, [near, still]);
  // Let go of the footage as the page goes, so its decoder and buffer are freed now rather than whenever the element is
  // collected.
  useEffect(() => {
    const node = video.current;
    return () => {
      if (!node?.getAttribute("src")) return;
      node.pause();
      node.removeAttribute("src");
      node.load();
    };
    // Only as this element goes (its own src changes are React's, and never come through here).
  }, [still]);
  useEffect(() => {
    const node = video.current;
    if (!node || !near) return;
    let seen = false;
    const sync = () => {
      if (seen && !document.hidden && !held(node)) node.play().catch(() => undefined);
      else node.pause();
    };
    const watch = new IntersectionObserver(([entry]) => { seen = entry.isIntersecting; sync(); }, { rootMargin: PLAY_NEAR });
    watch.observe(node);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener(FLIGHT, sync);
    window.addEventListener(SEQUENCE, sync);
    return () => {
      watch.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener(FLIGHT, sync);
      window.removeEventListener(SEQUENCE, sync);
    };
  }, [room.video, still, near]);
  if (still) return <img className={className} src={room.poster} alt="" aria-hidden="true" draggable={false} loading={eager ? undefined : "lazy"} />;
  // Its first frame, too, waits until it comes near (a poster is fetched at once, wherever the video stands).
  return <video ref={video} className={className} src={near ? room.video : undefined} poster={near && room.poster ? room.poster : undefined} muted loop playsInline preload={near ? "auto" : "none"} aria-hidden="true" />;
}

/* ---------- The collection's loop, one for every page that shows the room ---------- */

type LoopHost = { node: HTMLElement; unwire: (() => void) | null };
/** `cut`: the sharper cut's progress (upgradeLoop): not wanted, wanted once a product's room opens, waiting for rest,
 *  being readied, or shown. */
type Loop = { room: Room; video: HTMLVideoElement; owner: LoopHost | null; hosts: LoopHost[]; cut: "light" | "in-room" | "waiting" | "readying" | "large" };
const loops = new Map<string, Loop>();

function loopOf(room: Room): Loop {
  let loop = loops.get(room.poster);
  if (!loop) {
    const video = document.createElement("video");
    video.className = "tm-room";
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("aria-hidden", "true");
    video.preload = "auto";
    const cut = roomMedia(room);
    video.poster = cut.poster;
    video.src = cut.video ?? "";
    loop = { room, video, owner: null, hosts: [], cut: "light" };
    loops.set(room.poster, loop);
    const when = largeCut(room);
    if (when === "now") {
      loop.cut = "waiting";
      upgradeLoop(loop);
    } else if (when === "room") loop.cut = "in-room";
  }
  return loop;
}

/** A product's room (ProductStage.tsx), not the opening's. */
const inProductRoom = (host: LoopHost) => !host.node.closest(".tm-mist");
/** A loop that waits for a product's room to bring its sharper cut in: from now, at rest there (upgradeLoop). */
function openedRoom(loop: Loop, host: LoopHost) {
  if (loop.cut !== "in-room" || !inProductRoom(host)) return;
  loop.cut = "waiting";
  upgradeLoop(loop);
}

/** Once the page has loaded and the browser is next idle (Safari has no idle callback: a moment later). */
function afterLoadIdle(run: () => void) {
  const idle = () => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(run, { timeout: 4000 });
    else window.setTimeout(run, 1500);
  };
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
}
/** When no camera move is running: now, or once the next one has settled. */
function atRest(run: () => void) {
  if (!moving()) return run();
  const settled = () => {
    if (moving()) return;
    window.removeEventListener(FLIGHT, settled);
    run();
  };
  window.addEventListener(FLIGHT, settled);
}

/**
 * The room's sharper cut, brought in once, invisibly: after the page has loaded, when the browser is idle and no camera
 * move runs, the sharper loop is readied in a second <video> laid exactly under the one showing, set to the same moment
 * and kept in step with it frame by frame; at a frame boundary where both show the same frame of the loop, the light
 * one is taken away and the sharper one, already drawn beneath it, is the room from then on. A move that starts before
 * the swap stops it (nothing new is ever brought into a room mid-move); it is tried again once the move has settled.
 * Where the two can't be brought into step, the light cut stays.
 */
function upgradeLoop(loop: Loop) {
  const large = loop.room.large;
  if (!large?.video) return;
  const largeVideo = large.video;
  let tries = 0;
  const later = () => atRest(() => afterLoadIdle(() => atRest(now)));
  const now = () => {
    if (loop.cut !== "waiting" || !loop.owner || tries >= 3) return;
    tries++;
    loop.cut = "readying";
    const host = loop.owner;
    const shown = loop.video;
    const next = document.createElement("video");
    next.className = "tm-room";
    next.muted = true;
    next.defaultMuted = true;
    next.loop = true;
    next.playsInline = true;
    next.setAttribute("muted", "");
    next.setAttribute("playsinline", "");
    next.setAttribute("aria-hidden", "true");
    next.preload = "auto";
    next.poster = shown.poster;
    next.src = largeVideo;
    // Beneath the one showing, exactly where it is: drawn, but covered until the swap.
    host.node.insertBefore(next, shown);
    let done = false;
    const finish = (swap: boolean) => {
      if (done) return;
      done = true;
      window.removeEventListener(FLIGHT, onFlight);
      window.clearTimeout(timeout);
      if (!swap || loop.owner !== host || loop.video !== shown || moving()) {
        next.pause();
        next.removeAttribute("src");
        next.load();
        next.remove();
        loop.cut = "waiting";
        later();
        return;
      }
      // The sharper cut stands beneath on this very frame of the loop: taking the light one away shows it, and it plays
      // on from there (or holds, as the light one did).
      const playing = !shown.paused;
      host.unwire?.();
      loop.video = next;
      shown.remove();
      if (playing) void next.play().catch(() => undefined);
      host.unwire = wire(host.node, next);
      shown.pause();
      shown.removeAttribute("src");
      shown.load();
      loop.cut = "large";
      window.dispatchEvent(new CustomEvent("tm-room-cut", { detail: { room: loop.room.video, cut: largeVideo, frame: target, playing } }));
    };
    // A camera move begins: no new cut mid-move. It is tried again once the move has settled and the browser is idle.
    const onFlight = () => { if (moving()) finish(false); };
    window.addEventListener(FLIGHT, onFlight);
    // Never ready, or never caught (a hidden tab): tried again later.
    const timeout = window.setTimeout(() => finish(false), 20000);
    const total = () => Math.max(1, Math.round((shown.duration || 1) * LOOP_FPS));
    const frameOf = (time: number) => Math.round(time * LOOP_FPS) % total();
    /** How far `frame` is past `target`, the short way round the loop. */
    const past = (frame: number, goal: number) => {
      const n = total();
      const d = (((frame - goal) % n) + n) % n;
      return d > n / 2 ? d - n : d;
    };
    type FrameVideo = HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number };
    const framed = typeof (shown as FrameVideo).requestVideoFrameCallback === "function";
    // The sharper loop waits, paused, on a frame a little ahead of the one showing (its seek takes a moment); when the
    // light loop reaches that frame, the two show the same frame of the room and the swap is made, in that frame.
    let lead = 12;
    let target = -1;
    let parked = false;
    const aim = () => {
      if (done) return;
      parked = false;
      target = (frameOf(shown.currentTime) + lead) % total();
      next.pause();
      // The middle of the frame, so the sharper loop shows exactly that frame.
      next.currentTime = (target + 0.5) / LOOP_FPS;
      next.addEventListener("seeked", () => {
        const at = target;
        const ready = () => { if (!done && at === target) parked = true; };
        if (framed) (next as FrameVideo).requestVideoFrameCallback?.(ready);
        else requestAnimationFrame(ready);
      }, { once: true });
    };
    const reach = (frame: number) => {
      if (done || target < 0) return;
      const d = past(frame, target);
      if (d === 0 && parked) requestAnimationFrame(() => { if (!done) finish(true); });
      else if (d >= 0) {
        // Reached before the sharper loop was ready: aim further ahead.
        lead = Math.min(48, lead * 2);
        aim();
      }
    };
    const align = () => {
      if (done) return;
      if (shown.paused && shown.played.length === 0 && shown.currentTime === 0) {
        // Never played (autoplay refused, as in Low Power Mode): it shows its first frame's picture, the poster, and so
        // does the sharper loop, which shares it and hasn't played either.
        target = 0;
        requestAnimationFrame(() => finish(true));
        return;
      }
      if (shown.paused) {
        // Held still (off screen, or a tab coming back): the same frame, set exactly.
        target = frameOf(shown.currentTime);
        next.currentTime = shown.currentTime;
        next.addEventListener("seeked", () => requestAnimationFrame(() => requestAnimationFrame(() => {
          if (done) return;
          if (shown.paused && Math.abs(next.currentTime - shown.currentTime) < 0.25 / LOOP_FPS) finish(true);
          else align();
        })), { once: true });
        return;
      }
      aim();
      if (framed) {
        const step = (_: number, meta: { mediaTime: number }) => {
          if (done) return;
          reach(frameOf(meta.mediaTime));
          (shown as FrameVideo).requestVideoFrameCallback?.(step);
        };
        (shown as FrameVideo).requestVideoFrameCallback?.(step);
      } else {
        // No frame callbacks: the light loop's frame, read each animation frame.
        let last = -1;
        const check = () => {
          if (done) return;
          const frame = Math.floor(shown.currentTime * LOOP_FPS) % total();
          if (frame !== last) { last = frame; reach(frame); }
          requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }
    };
    if (next.readyState >= 4) align();
    else next.addEventListener("canplaythrough", align, { once: true });
  };
  afterLoadIdle(() => atRest(now));
}

/** The loop plays while its host is on screen, the page is seen and no camera move runs; otherwise it holds its frame. */
function wire(node: HTMLElement, video: HTMLVideoElement) {
  let seen = false;
  const sync = () => {
    if (seen && !document.hidden && !held(node)) video.play().catch(() => undefined);
    else video.pause();
  };
  const watch = new IntersectionObserver(([entry]) => { seen = entry.isIntersecting; sync(); }, { rootMargin: PLAY_NEAR });
  watch.observe(node);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener(FLIGHT, sync);
  window.addEventListener(SEQUENCE, sync);
  // Brought in while a move runs: hold the frame it came with until the observer has spoken.
  if (held(node)) video.pause();
  return () => {
    watch.disconnect();
    document.removeEventListener("visibilitychange", sync);
    window.removeEventListener(FLIGHT, sync);
    window.removeEventListener(SEQUENCE, sync);
  };
}

/* ---------- A still room, one for every page that shows it ---------- */

/**
 * A still room's sharper cut, once it has been brought in, drawn over the room's own cut in every page that shows the
 * room (the opening, and a product page on one of its pedestals): each page its own <img> of the one decoded picture, so
 * a camera move never carries an element from page to page (a moved image is decoded again where it lands: WebKit's
 * first frame of Back waited on it). Until then each page shows the room's own cut, the same file on both.
 */
type StillHost = LoopHost & { img: HTMLImageElement | null };
type Still = { room: Room; hosts: StillHost[]; cut: "light" | "in-room" | "readying" | "large" };
const stills = new Map<string, Still>();

function stillOf(room: Room): Still {
  let still = stills.get(room.poster);
  if (!still) {
    still = { room, hosts: [], cut: "light" };
    stills.set(room.poster, still);
    const when = largeCut(room);
    const made = still;
    if (when === "now") afterLoadIdle(() => upgradeStill(made));
    else if (when === "room") still.cut = "in-room";
  }
  return still;
}

/** A page's own <img> of the sharper cut, over the room's own cut. */
function showLarge(still: Still, host: StillHost) {
  const large = still.room.large;
  if (!large || host.img) return;
  const img = document.createElement("img");
  img.className = "tm-room";
  img.alt = "";
  img.setAttribute("aria-hidden", "true");
  img.draggable = false;
  img.src = large.poster;
  host.img = img;
  host.node.append(img);
}

/**
 * The sharper cut, brought in once, invisibly: fetched and decoded off screen, then laid over the room's own cut (the
 * same picture, sharper) in every page that shows the room, when no camera move runs, in one frame. Where it can't be
 * fetched or decoded, the room's own cut stays.
 */
function upgradeStill(still: Still) {
  const large = still.room.large;
  if (!large || still.cut === "readying" || still.cut === "large") return;
  still.cut = "readying";
  const probe = new Image();
  probe.src = large.poster;
  probe.decode().then(() => atRest(() => requestAnimationFrame(() => {
    // Let go meanwhile (the reader went on to another kind of page): nothing to bring in.
    if (stills.get(still.room.poster) !== still) return;
    still.cut = "large";
    for (const host of still.hosts) showLarge(still, host);
    window.dispatchEvent(new CustomEvent("tm-room-cut", { detail: { room: still.room.poster, cut: large.poster } }));
  })), () => { still.cut = "light"; });
}

/** A page showing the room: the sharper cut if it is here; and a product's room opened brings a phone's in (largeCut). */
function hostStill(still: Still, host: StillHost) {
  if (still.cut === "large") showLarge(still, host);
  else if (still.cut === "in-room" && inProductRoom(host)) upgradeStill(still);
}

/** How long the room may go unshown before its loops are let go: long enough for a page that shows it to follow. */
const RELEASE_AFTER = 3000;
let releasing = 0;
/**
 * Once no page has shown the room for a moment (the reader has gone on to another kind of page), every loop is let go:
 * paused, emptied so the browser frees its decoder and buffered footage, and forgotten. A page that shows the room
 * again starts it afresh, on its own light cut, as a first visit does. A camera move never lets go: one page or the
 * other shows the room throughout, and an opening parked under a product page still holds its place.
 */
function releaseLater() {
  window.clearTimeout(releasing);
  releasing = window.setTimeout(() => {
    if ([...loops.values(), ...stills.values()].some((part) => part.hosts.length)) return;
    for (const loop of loops.values()) {
      loop.video.pause();
      loop.video.removeAttribute("src");
      loop.video.removeAttribute("poster");
      loop.video.load();
    }
    loops.clear();
    stills.clear();
  }, RELEASE_AFTER);
}

function lend(loop: Loop, host: LoopHost) {
  if (loop.owner === host) return;
  if (loop.owner) {
    loop.owner.unwire?.();
    loop.owner.unwire = null;
  }
  loop.owner = host;
  moveInto(host.node, loop.video);
  host.unwire = wire(host.node, loop.video);
  openedRoom(loop, host);
}

/**
 * The room's loop, the same <video> on every page that shows the room (share.ts): drawn in one host at a time, the
 * page that comes in with a camera move waits for it, and the move hands it over at the moment both pages frame the
 * room alike, so its frame never changes. With reduced motion the room is its first frame, held still.
 */
export function RoomLoop({ room, still }: { room: Room; still: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const moving = Boolean(room.video);
  useLayoutEffect(() => {
    const node = host.current;
    // A test render's document can't make a <video>: the room is its first frame there.
    if ((still && moving) || !node || typeof document.createElement !== "function") return;
    if (!moving) {
      // A still room: every page that shows it draws its sharper cut, once there is one.
      const part = stillOf(room);
      const me: StillHost = { node, unwire: null, img: null };
      part.hosts.push(me);
      hostStill(part, me);
      return () => {
        me.img?.remove();
        part.hosts = part.hosts.filter((h) => h !== me);
        if (!part.hosts.length) releaseLater();
      };
    }
    const loop = loopOf(room);
    const me: LoopHost = { node, unwire: null };
    loop.hosts.push(me);
    if (!loop.owner) lend(loop, me);
    const unclaim = registerClaimant(node, () => lend(loop, me));
    return () => {
      unclaim();
      loop.hosts = loop.hosts.filter((h) => h !== me);
      if (loop.owner !== me) return;
      me.unwire?.();
      loop.owner = null;
      const next = loop.hosts[loop.hosts.length - 1];
      if (next) lend(loop, next);
      else {
        loop.video.pause();
        loop.video.remove();
        releaseLater();
      }
    };
  }, [room, still, moving]);
  if (still && moving) return <img className="tm-room" src={roomMedia(room).poster} alt="" aria-hidden="true" draggable={false} />;
  return <div className="tm-room tm-room-loop" ref={host} aria-hidden="true" />;
}

/** The room's mist scene, where it has one. */
export const fogSceneOf = (room: Room): FogScene | undefined =>
  room === COLLECTION ? FOG_SCENES.collection : room === COLLECTION_TALL ? FOG_SCENES.collectionTall : undefined;

/**
 * The lens's focus: a blurred view of the room behind it (the loop and the mist), everywhere but on one pedestal,
 * which stays sharp, with the vial standing on it (the vials are drawn above this layer, so they are never blurred).
 * The sharp region is that pedestal's own silhouette as the room's camera sees it (fog/scenes.ts focusMask), feathered
 * out into the room, so the softening grows with distance from it and never shows an edge. `blur` is in the plate's
 * own pixels; the camera move ramps it as it arrives (flight.ts), and a product page holds it at full.
 */
export function RoomFocus({ room, pedestal, blur }: { room: Room; pedestal: number | null; blur: number }) {
  const scene = fogSceneOf(room);
  const mask = scene && pedestal !== null ? focusMask(scene, pedestal) : null;
  const style = mask && blur > 0 ? ({ "--tm-focus-mask": mask, "--tm-focus-blur": `${blur.toFixed(3)}px` } as CSSProperties) : undefined;
  return <div className="tm-room-focus" style={style} data-focus={style ? "" : undefined} aria-hidden="true" />;
}

/** The plate a room and its vials are laid on, cover-fitted into its stage: one layer, so the camera move
 *  (flight.ts) carries the room, its mist and its vials together. */
export function Plate({ box, children }: { box: Box; children: ReactNode }) {
  return <div className="tm-room-plate" style={box}>{children}</div>;
}

/**
 * A real vial standing on its pedestal: a contact shadow under the foot, a long soft cast away from
 * the window, and the room's air as a still edge of window light on the bare glass around the label.
 * At night it stands in one beam instead: the cap and shoulders catch it, the label keeps its own
 * colours a little dimmed, and the glossy top gives back a reflection. No light lies over the label,
 * and nothing travels across the glass: what moves is the room's own footage.
 */
export function RoomVial({ product, seat, night = false, lit = 1, to, delay = 0, soft, shade, onOpen, onNear }: {
  product: Product;
  seat: Seat;
  night?: boolean;
  /** How much of the room's light reaches the vial where it stands, as a brightness (1: the vial under the light). */
  lit?: number;
  to?: string;
  delay?: number;
  /** The same vial out of focus, blurred ahead of time (public/images/sequence/soft): the opening's scroll sequence
   *  racks focus away from it by fading it in over the glass (Sequence.tsx). */
  soft?: string;
  /** The vial's two shadows drawn ahead of time as one picture (Sequence.tsx vialShadow), shown in their place. */
  shade?: string;
  /** The vial's link was followed; preventing the event takes the navigation over (the camera move). */
  onOpen?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Pointing at the vial or reaching it by keyboard: its page may be wanted next. */
  onNear?: () => void;
}) {
  const name = `${product.name}, ${product.size}`;
  const src = productCutout(product, "lg");
  // The room's light on the glass is cut to the vial's outline: the very file the glass shows, once it has arrived, so
  // the outline is never fetched a second time beside it (and never the larger cut where the glass shows the smaller).
  // Until then the light waits with the glass.
  const glass = useRef<HTMLImageElement>(null);
  const [outline, setOutline] = useState<string | null>(null);
  useLayoutEffect(() => {
    const img = glass.current;
    if (!img) return;
    const take = () => { if (img.naturalWidth) setOutline(img.currentSrc || img.src); };
    if (img.complete) take();
    img.addEventListener("load", take);
    return () => img.removeEventListener("load", take);
  }, [src]);
  const style = {
    "--tm-glass-mask": outline ? glassMask(outline) : NO_OUTLINE,
    "--seat-x": seat.x,
    "--seat-y": seat.y,
    "--vial-h": seat.h,
    "--tm-i": delay,
    "--tm-lit": lit,
  } as CSSProperties;
  const inner = <>
    {night && <img className="tm-room-vial-reflect" src={src} alt="" aria-hidden="true" draggable={false} />}
    {shade
      ? <img className="tm-room-vial-shade" src={shade} alt="" aria-hidden="true" draggable={false} decoding="async" />
      : <>
          <span className="tm-room-vial-shadow" aria-hidden="true" />
          {!night && <span className="tm-room-vial-cast" aria-hidden="true" />}
        </>}
    <img
      ref={glass}
      className="tm-room-vial-glass"
      src={src}
      srcSet={`${productCutout(product, "sm")} 289w, ${src} 578w`}
      sizes="(max-width: 760px) 30vw, 18vw"
      alt={to ? "" : name}
      draggable={false}
      // The night's vial stands below the first screen.
      loading={night ? "lazy" : undefined}
    />
    {soft && <img className="tm-room-vial-soft" src={soft} alt="" aria-hidden="true" draggable={false} decoding="async" />}
    <span className={night ? "tm-room-vial-beam" : "tm-room-vial-air"} aria-hidden="true" />
  </>;
  return to
    ? <Link
        className="tm-room-vial"
        to={to}
        style={style}
        data-product-id={product.id}
        aria-label={name}
        onClick={onOpen}
        onPointerEnter={() => onNear?.()}
        onFocus={() => onNear?.()}
      >
        {inner}
      </Link>
    : <figure className="tm-room-vial" style={style} data-night={night ? "" : undefined}>{inner}</figure>;
}

/**
 * Mist on the room's floor. In the rooms it is measured for (the collection, wide and tall) it is simulated in the
 * room's own space (fog/FloorMist.tsx): it wraps the pedestals' bases and pools against them, and a deliberate sweep
 * of the pointer parts it. Elsewhere, and wherever that can't run, it is a fog loop on black, added as light and held
 * low. Phones and reduced motion go without the loop: their rooms carry their own mist, and a second loop costs them
 * frames and data.
 */
export function FrontMist({ still, room, zoom = 1, tune }: { still: boolean; room?: Room; zoom?: number; tune?: Partial<FogParams> }) {
  const phone = useMediaQuery("(max-width: 760px)");
  const touch = useMediaQuery("(pointer: coarse)");
  const loop = still || phone ? null : <RoomVideo room={{ w: 1920, h: 1080, video: media("fog.mp4"), poster: "" }} still={false} className="tm-front-mist" />;
  const scene = room ? fogSceneOf(room) : undefined;
  return scene ? <FloorMist scene={scene} still={still} ambient={phone || touch} zoom={zoom} tune={tune} fallback={loop} /> : loop;
}
