import { useEffect } from "react";
import type { RefObject } from "react";
import { LiquidGlass } from "./glass/liquid-glass.js";
import type { GlassMaterial, Piece } from "./glass/liquid-glass.js";
import "./liquid.css";

/*
 * The opening's two ways in as one liquid: "Shop peptides" in TrueMark's own ink and "Verify a lot" in clear water,
 * drawn under the buttons' words by Riley and Claude's liquid glass (glass/liquid-glass.js). A browser can't draw
 * Apple's own glass, so this is ours: the water is a lens that bends the room behind it, its rim pulling in the world
 * just beyond its edge; the ink is opaque, seen by the light from above along its top; both cast a soft shade.
 *
 * The sentence: one drop of the brand's ink falls into the room and divides, as a cell does, into the two ways in.
 *
 * The spec, moment by moment:
 * - Arrival (the first time the opening's words arrive, with motion allowed). The buttons' words wait. A drop of ink as
 *   tall as a button falls from above the room straight down onto the middle of the pair, under gravity, drawn out
 *   along its fall and catching the light as it goes. It lands: the blow squashes it and it spreads, with one splash
 *   of overshoot, into one pill spanning both buttons, and light rings out around each vial's foot on its pedestal,
 *   the nearest first (RoomRipples). Then it divides: a waist forms in the middle, deepens, and the two halves draw
 *   apart to their buttons; the right half clears from ink to water as it goes, and the short neck between them lets
 *   go once they're 5 px apart. The words come once both are within a pixel of their buttons.
 * - At rest each piece lies exactly under its button, on whole device pixels.
 * - Pointed at (a mouse), a piece swells (4 by 2) and leans after the pointer as water follows a finger (a fifteenth
 *   of the way, at most 5 across and 2 down). Between the two, both reach toward the pointer until they touch on a
 *   short, full neck; move on into either and the neck lets go. Pressed, a piece squeezes (6 by 3); let go, it comes
 *   back with one wobble.
 * - When the opening's words go (the page scrolls on, a story opens, the camera flies to a product), the water flows
 *   back into the ink and the ink drains down to nothing. When they come back, the ink wells up as a drop, spreads and
 *   divides as it did on arrival, without the fall or the ripples.
 * - Reduced motion: the two lie at rest from the start and every change lands at once; nothing falls or divides.
 * - No WebGL2: nothing is drawn, and the buttons keep their own look.
 *
 * Words sit above the liquid, never in it: the buttons keep their words, marks and focus ring and give their fill,
 * edge and shade to the liquid beneath (liquid.css). The water bends a picture of the room behind it (paintRoom),
 * painted again whenever the room moves. The engine itself stays out of this repository (.git/info/exclude).
 */

type Box = { x: number; y: number; w: number; h: number };
type Pair = { shop: Box; verify: Box; span: Box };
type Which = "shop" | "verify";
type Spring2 = [number, number];

const SWELL = { w: 4, h: 2 };
const SQUEEZE = { w: -6, h: -3 };
/** How far a piece leans after the pointer: a share of the way from its middle, and the most it goes each way. */
const LEAN = { share: 1 / 15, x: 5, y: 2 };
/** Reaching for each other, the two leave this gap, which the pulled reach (24) spans with a short, full neck. */
const TOUCH = 6;
/** Scrolled this far down (a share of the screen's height), the words have begun to go; back above the second, they
 *  return. The gap between the two keeps a hand resting near the top from draining and welling the liquid in turn. */
const SCROLL_AWAY = 0.03;
const SCROLL_BACK = 0.01;
/** The fall: as long as this in seconds for a short drop, up to the second for the whole of a phone's room, under
 *  the gravity that takes. */
const FALL = { short: 0.34, long: 0.48, over: 700 };
/** The blow of landing: how much of the fall's speed squashes the drop, and how much flings it wide. */
const BLOW = { squash: 0.1, spread: 0.5 };
/** The springs of the arrival: the splash as it lands and spreads, and the two halves drawing apart. */
const SPLASH: Spring2 = [0.34, 0.62];
const DIVIDE: Spring2 = [0.55, 0.8];
/** The neck between the halves lets go once they're this far apart, so it never draws out into a thread. */
const LET_GO = 5;
/** The engine's reach while a piece is pulled out of another. */
const PULLED = 24;
/** The ripple on the pedestals: the top's width (in vial widths) and depth (in its width), where a ring starts (in
 *  vial widths from the foot), rings each, seconds apart, px/s outward, how fast the blow crosses the room (px/s), and
 *  each crest: a line of light with its shade just outside it, in the room's ink (the tops are lit nearly white, so
 *  the shade is what shows there, and the light shows where the top turns lavender). */
const RIPPLE = { pedestal: 2.2, depth: 0.11, inner: 0.32, rings: 3, apart: 0.1, speed: 150, travel: 1100,
  light: 0.7, shade: 0.2, line: 1, offset: 1.2 };
const clamp = (v: number, most: number) => Math.max(-most, Math.min(most, v));

/** Measures an element as it will stand once the animations bringing it in have run: the words rise a little as they
 *  arrive (mist.css) and as they come back after a story (stories.css), and the liquid goes where they'll land, not
 *  where they are on the way. Each such animation is held at its end for the moment of measuring and put back at once,
 *  before anything is drawn. Those tied to the scroll stay as they are: the liquid follows the scroll itself. */
function landed<T>(el: HTMLElement, stop: Element | null, measure: () => T): T {
  const held: [Animation, number][] = [];
  for (let a: Element | null = el; a && a !== stop; a = a.parentElement) {
    for (const animation of a.getAnimations?.() ?? []) {
      const now = animation.currentTime, end = animation.effect?.getComputedTiming().endTime;
      if (animation.timeline !== document.timeline || typeof now !== "number" || typeof end !== "number" || !Number.isFinite(end)) continue;
      held.push([animation, now]);
      animation.currentTime = end;
    }
  }
  try {
    return measure();
  } finally {
    for (const [animation, now] of held) animation.currentTime = now;
  }
}

/** Where an element stands in a layer's own coordinates, at whatever scale the layer is drawn. */
function boxIn(layer: HTMLElement, el: HTMLElement): Box | null {
  return landed(el, layer.parentElement, () => {
    const L = layer.getBoundingClientRect(), E = el.getBoundingClientRect();
    if (!E.width || !E.height || !layer.offsetWidth) return null;
    const s = L.width / layer.offsetWidth;
    return { x: (E.left + E.width / 2 - L.left) / s, y: (E.top + E.height / 2 - L.top) / s, w: E.width / s, h: E.height / s };
  });
}

/** The two buttons, and the one pill that spans both. */
function pairIn(layer: HTMLElement, shopEl: HTMLElement, verifyEl: HTMLElement): Pair | null {
  const shop = boxIn(layer, shopEl), verify = boxIn(layer, verifyEl);
  if (!shop || !verify) return null;
  const left = Math.min(shop.x - shop.w / 2, verify.x - verify.w / 2), right = Math.max(shop.x + shop.w / 2, verify.x + verify.w / 2);
  const top = Math.min(shop.y - shop.h / 2, verify.y - verify.h / 2), bottom = Math.max(shop.y + shop.h / 2, verify.y + verify.h / 2);
  return { shop, verify, span: { x: (left + right) / 2, y: (top + bottom) / 2, w: right - left, h: bottom - top } };
}

/** The drop falls once a visit. The opening lays its words out anew as it readies (a phone's pictures arriving, a
 *  phone turned), and a liquid built again after the drop has begun to fall only settles into place. */
let arrival: "none" | "playing" | "done" = "none";

const near = (p: Piece, box: Box) => Math.abs(p.w - box.w) < 1 && Math.abs(p.h - box.h) < 1 && Math.abs(p.x - box.x) < 1 && Math.abs(p.y - box.y) < 1;

/** TrueMark's one ink as the page has it now, read off a probe: the button's own background may be mid-transition
 *  (it gives its fill to the liquid, liquid.css). */
function inkOf(el: HTMLElement) {
  const probe = document.createElement("span");
  probe.style.color = "var(--tm-ink)";
  el.appendChild(probe);
  const ink = getComputedStyle(probe).color;
  probe.remove();
  return ink;
}

/** A piece hidden away takes a material at once, ready to show (the engine's own change is a crossfade). */
function becomes(p: Piece, material: GlassMaterial) {
  p.material = material;
  for (const s of p.mats) { s.x = s.to; s.v = 0; }
}

/** Where the room's picture stands relative to the layer: when this changes, the water's picture is painted again. */
function roomKey(layer: HTMLElement, root: HTMLElement) {
  const L = layer.getBoundingClientRect();
  return [L.width, L.height, ...[...root.querySelectorAll<HTMLImageElement>("img.tm-room-still")].flatMap((img) => {
    const r = img.getBoundingClientRect();
    return [r.left - L.left, r.top - L.top, r.width, r.height, img.complete ? img.naturalWidth : 0];
  })].map((v) => v.toFixed(1)).join(" ");
}

/** The room's floor mist (fog/FloorMist.tsx) as it was last drawn. It's drawn by WebGL into a buffer the browser
 *  clears once it's shown, so it can only be copied in the same frame, after it's drawn; a copy that comes up empty
 *  keeps the last one. */
class MistCopy {
  readonly canvas = document.createElement("canvas");
  has = false;
  private readonly scratch = document.createElement("canvas");

  take(mist: HTMLCanvasElement) {
    const { width, height } = mist;
    if (!width || !height) return false;
    for (const c of [this.scratch, this.canvas]) if (c.width !== width || c.height !== height) { c.width = width; c.height = height; }
    const s = this.scratch.getContext("2d", { willReadFrequently: true }), k = this.canvas.getContext("2d");
    if (!s || !k) return false;
    s.clearRect(0, 0, width, height);
    s.drawImage(mist, 0, 0);
    const row = s.getImageData(0, Math.floor(height * 0.75), width, 1).data;
    let drawn = false;
    for (let i = 3; i < row.length; i += 16) if (row[i] > 0) { drawn = true; break; }
    if (!drawn) return false;
    k.clearRect(0, 0, width, height);
    k.drawImage(this.scratch, 0, 0);
    this.has = true;
    return true;
  }
}

/** Paints the room as it stands behind the layer, for the water to bend: the room's picture where the page shows it,
 *  fitted as the page fits it (object-fit: cover, at its object-position), and the floor mist over it. */
function paintRoom(into: HTMLCanvasElement, layer: HTMLElement, root: HTMLElement, mist: MistCopy, drawnLight = false) {
  const L = layer.getBoundingClientRect();
  const w = Math.max(1, Math.round(L.width)), h = Math.max(1, Math.round(L.height));
  if (into.width !== w || into.height !== h) { into.width = w; into.height = h; }
  const ctx = into.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  for (const img of root.querySelectorAll<HTMLImageElement>("img.tm-room-still")) {
    if (!img.complete || !img.naturalWidth) continue;
    const r = img.getBoundingClientRect();
    const s = Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    const [px = "50%", py = "50%"] = getComputedStyle(img).objectPosition.split(" ");
    const at = (v: string) => (v.endsWith("%") ? Number.parseFloat(v) / 100 : 0.5);
    ctx.drawImage(img, r.left - L.left + (r.width - dw) * at(px), r.top - L.top + (r.height - dh) * at(py), dw, dh);
  }
  const fog = root.querySelector<HTMLCanvasElement>(".tm-floor-mist-canvas");
  if (fog && mist.has) {
    const r = fog.getBoundingClientRect();
    ctx.drawImage(mist.canvas, r.left - L.left, r.top - L.top, r.width, r.height);
  }
  // The room's daylight through water, as it was just drawn (room-light.ts): read only in the frame it's drawn, and
  // empty at any other moment.
  const light = root.querySelector<HTMLCanvasElement>(".tm-room-light");
  if (light && drawnLight) {
    const r = light.getBoundingClientRect();
    ctx.drawImage(light, r.left - L.left, r.top - L.top, r.width, r.height);
  }
}

/** Light ringing out around each vial's foot on its pedestal as the drop lands: thin lines of light, nothing that
 *  glows, drawn in the room's plate over the room and its mist and under the vials, so a vial hides its ring's far
 *  side. The nearest pedestal rings first, as the blow crosses the room. */
class RoomRipples {
  private readonly canvas = document.createElement("canvas");
  private frame = 0;

  constructor(private readonly layer: HTMLElement, private readonly root: HTMLElement) {
    layer.appendChild(this.canvas);
  }

  ring(fromX: number) {
    cancelAnimationFrame(this.frame);
    const layer = this.layer, L = layer.getBoundingClientRect(), s = L.width / (layer.offsetWidth || 1) || 1;
    const feet = [...this.root.querySelectorAll<HTMLElement>(".tm-room-vial")].map((vial) => {
      const r = vial.getBoundingClientRect(), vw = r.width / s, rx = (vw * RIPPLE.pedestal) / 2;
      return { x: (r.left + r.width / 2 - L.left) / s, y: (r.bottom - L.top) / s, rx, ry: rx * RIPPLE.depth, inner: vw * RIPPLE.inner, at: Math.abs(r.left + r.width / 2 - fromX) / RIPPLE.travel };
    }).filter((f) => f.rx > 1);
    if (!feet.length) return;
    const top = Math.min(...feet.map((f) => f.y - f.ry)) - 2, height = Math.max(...feet.map((f) => f.y + f.ry)) + 2 - top;
    const width = layer.offsetWidth, d = Math.min(window.devicePixelRatio || 1, 2);
    Object.assign(this.canvas.style, { top: `${top}px`, width: `${width}px`, height: `${height}px` });
    this.canvas.width = Math.round(width * d);
    this.canvas.height = Math.round(height * d);
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.setTransform(d, 0, 0, d, 0, -top * d);
      ctx.clearRect(0, top, width, height);
      let alive = false;
      for (const f of feet) {
        for (let k = 0; k < RIPPLE.rings; k++) {
          const age = t - f.at - k * RIPPLE.apart;
          const r = f.inner + Math.max(age, 0) * RIPPLE.speed;
          if (r >= f.rx) continue;
          alive = true;
          if (age < 0) continue;
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, Math.PI * 2);
          ctx.clip();
          const fade = (1 - r / f.rx) * (1 - (0.35 * k) / RIPPLE.rings), squash = f.ry / f.rx;
          ctx.lineWidth = RIPPLE.line;
          ctx.beginPath();
          ctx.ellipse(f.x, f.y, r + RIPPLE.offset, (r + RIPPLE.offset) * squash, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(36, 26, 74, ${RIPPLE.shade * fade})`;
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(f.x, f.y, r, r * squash, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${RIPPLE.light * fade})`;
          ctx.stroke();
          ctx.restore();
        }
      }
      this.frame = alive ? requestAnimationFrame(draw) : 0;
    };
    this.frame = requestAnimationFrame(draw);
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.canvas.remove();
  }
}

/** The two ways in, as one liquid. */
class OpeningLiquid {
  private readonly canvas = document.createElement("canvas");
  private readonly room = document.createElement("canvas");
  private readonly mist = new MistCopy();
  private mistTimer = 0;
  private readonly glass: LiquidGlass;
  private readonly pieces: Record<Which, Piece>;
  private pair: Pair | null = null;
  private state: "hidden" | "arriving" | "shown" | "leaving" = "hidden";
  private fell = false;
  private run = 0;
  private over: Which | "between" | null = null;
  private down: Which | null = null;
  private lean: Record<Which, { x: number; y: number }> = { shop: { x: 0, y: 0 }, verify: { x: 0, y: 0 } };
  private roomAt = "";
  private lightAt = 0;
  private inkAt: string;

  constructor(
    private readonly root: HTMLElement,
    private readonly layer: HTMLElement,
    private readonly els: Record<Which, HTMLElement>,
    private readonly ripples: RoomRipples | null,
  ) {
    this.canvas.className = "tm-liquid";
    layer.appendChild(this.canvas);
    this.inkAt = inkOf(els.shop);
    try {
      this.glass = new LiquidGlass(this.canvas, {
        backdrop: this.room,
        fit: "fill",
        drawBackdrop: false,
        veil: false,
        material: "clear",
        ink: this.inkAt,
        shadow: { y: 8, blur: 22, key: 0.22, reach: 10, ambient: 0.12 },
      });
    } catch (error) {
      this.canvas.remove();
      throw error;
    }
    this.pieces = {
      shop: this.glass.add({ x: 0, y: 0, w: 2, h: 2, material: "black", lit: 1, hidden: true }),
      verify: this.glass.add({ x: 0, y: 0, w: 2, h: 2, material: "black", hidden: true }),
    };
    this.watchMist();
  }

  get shown() {
    return this.state === "shown" || this.state === "arriving";
  }

  /** The words come and go; the liquid follows. */
  show() {
    if (this.shown) return;
    if (!this.fell && arrival !== "none") {
      this.fell = true;
      this.paint();
      if (this.measure()) this.settle();
      arrival = "done";
      return;
    }
    void (this.fell ? this.reform() : this.arrive());
  }

  hide() {
    if (!this.shown) return;
    void this.leave();
  }

  /** Measured again (a resize, a font arriving, the page carrying the words a little way): at rest it simply stands
   *  there; and the room's picture is painted again if the room has moved. */
  place() {
    this.paint();
    const ink = inkOf(this.els.shop);
    if (ink !== this.inkAt) { this.inkAt = ink; this.glass.ink = ink; }
    const pair = this.measure();
    if (!pair || this.state !== "shown") return;
    for (const which of ["shop", "verify"] as const) {
      const aim = this.aim(which);
      if (aim) this.pieces[which].set(aim);
    }
  }

  paint(again = false, light = false) {
    const key = roomKey(this.layer, this.root);
    if (key === this.roomAt && !again) return;
    this.roomAt = key;
    paintRoom(this.room, this.layer, this.root, this.mist, light);
    this.glass.invalidateBackdrop();
  }

  /** The room's light has just drawn a frame: while the water is out and the light can reach what lies behind it, its
   *  picture of the room is painted again, at most twenty times a second. */
  lightDrawn() {
    if (this.state === "hidden" || !this.pieces.verify.visible) return;
    const now = performance.now();
    if (now - this.lightAt < 50) return;
    const light = this.root.querySelector<HTMLCanvasElement>(".tm-room-light")?.getBoundingClientRect();
    const V = this.els.verify.getBoundingClientRect();
    if (!light || V.top > light.top + light.height * 0.6) return;
    this.lightAt = now;
    this.paint(true, true);
  }

  /** Where the floor mist lies behind the two (a phone's way in stands on the room's floor), the water's picture of it
   *  is taken again eight times a second, in a frame just after the mist is drawn. */
  private watchMist = () => {
    this.mistTimer = window.setTimeout(this.watchMist, 125);
    if (this.state === "hidden") return;
    const fog = this.root.querySelector<HTMLCanvasElement>(".tm-floor-mist-canvas");
    if (!fog) return;
    const F = fog.getBoundingClientRect(), V = this.els.verify.getBoundingClientRect();
    if (F.bottom < V.top || F.top > V.bottom || F.right < V.left || F.left > V.right) return;
    requestAnimationFrame(() => { if (this.mist.take(fog)) this.paint(true); });
  };

  point(event: PointerEvent) {
    if (event.pointerType !== "mouse" || this.state !== "shown") return;
    const S = this.els.shop.getBoundingClientRect(), V = this.els.verify.getBoundingClientRect();
    const x = event.clientX, y = event.clientY;
    const inside = (r: DOMRect) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    const between = V.left > S.right && x > S.right && x < V.left
      && y >= Math.min(S.top, V.top) && y <= Math.max(S.bottom, V.bottom);
    const next: Which | "between" | null = inside(S) ? "shop" : inside(V) ? "verify" : between ? "between" : null;
    const toward = (r: DOMRect) => ({
      x: clamp((x - (r.left + r.width / 2)) * LEAN.share, LEAN.x),
      y: clamp((y - (r.top + r.height / 2)) * LEAN.share, LEAN.y),
    });
    if (next === "between") {
      const across = Math.max(0, (V.left - S.right - TOUCH - SWELL.w) / 2);
      this.lean = { shop: { x: across, y: toward(S).y }, verify: { x: -across, y: toward(V).y } };
    } else {
      this.lean = { shop: next === "shop" ? toward(S) : { x: 0, y: 0 }, verify: next === "verify" ? toward(V) : { x: 0, y: 0 } };
    }
    const was = this.over;
    this.over = next;
    this.pieces.verify.pulled = next === "between";
    const motion = next === was ? "carry" : next ? "swell" : "settle";
    this.rest("shop", motion);
    this.rest("verify", motion);
  }

  press(which: Which) {
    if (this.state !== "shown") return;
    this.down = which;
    this.rest(which, "pull");
  }

  release() {
    const which = this.down;
    if (!which) return;
    this.down = null;
    this.rest(which, "press");
  }

  destroy() {
    this.run++;
    window.clearTimeout(this.mistTimer);
    this.glass.destroy();
    this.canvas.remove();
  }

  private measure() {
    this.pair = pairIn(this.layer, this.els.shop, this.els.verify);
    return this.pair;
  }

  private aim(which: Which): Box | null {
    const box = this.pair?.[which];
    if (!box) return null;
    const d = this.down === which ? SQUEEZE : this.over === which || this.over === "between" ? SWELL : { w: 0, h: 0 };
    const lean = this.lean[which];
    return { x: box.x + lean.x, y: box.y + lean.y, w: box.w + d.w, h: box.h + d.h };
  }

  private rest(which: Which, motion: string) {
    if (this.state !== "shown") return;
    const aim = this.aim(which);
    if (aim) this.pieces[which].to(aim, motion);
  }

  private words(shown: boolean) {
    if (shown) this.root.removeAttribute("data-liquid-words");
    else this.root.setAttribute("data-liquid-words", "waiting");
  }

  /** Both at rest under their buttons, at once (reduced motion, or a choreography cut short). */
  private settle() {
    const pair = this.pair;
    if (!pair) return;
    const { shop, verify } = this.pieces;
    this.over = null;
    this.down = null;
    this.lean = { shop: { x: 0, y: 0 }, verify: { x: 0, y: 0 } };
    verify.pulled = false;
    becomes(shop, "black");
    becomes(verify, "clear");
    shop.set(pair.shop);
    verify.set(pair.verify);
    shop.hidden = false;
    verify.hidden = false;
    this.state = "shown";
    this.words(true);
  }

  /** The first time: the drop falls, lands, rings the room, and divides. */
  private async arrive() {
    const run = ++this.run;
    this.paint();
    const pair = this.measure();
    if (!pair) return;
    this.fell = true;
    arrival = "playing";
    this.state = "arriving";
    if (this.glass.reduced) { this.settle(); arrival = "done"; return; }
    this.words(false);
    const { shop, verify } = this.pieces, { span } = pair, D = span.h;
    verify.hidden = true;
    verify.pulled = true;
    becomes(verify, "black");
    becomes(shop, "black");
    shop.set({ x: span.x, y: -D, w: D, h: D });
    shop.hidden = false;
    shop.stretchy = true;
    const speed = await this.fall(shop, -D, span.y, run);
    if (run !== this.run) return;
    shop.stretchy = false;
    shop.sh.v -= speed * BLOW.squash;
    shop.sw.v += speed * BLOW.spread;
    shop.to(span, SPLASH);
    const L = this.layer.getBoundingClientRect();
    this.ripples?.ring(L.left + (span.x * L.width) / (this.layer.offsetWidth || 1));
    await this.glass.until(() => shop.w > span.w * 0.97 || (shop.w > span.w * 0.9 && shop.sw.v <= 0), 1.2);
    if (run !== this.run) return;
    await this.divide(run);
    if (run === this.run) arrival = "done";
  }

  /** The words back after they went: the ink wells up as a drop, spreads into one pill, and divides again. */
  private async reform() {
    const run = ++this.run;
    this.paint();
    const pair = this.measure();
    if (!pair) return;
    this.state = "arriving";
    if (this.glass.reduced) { this.settle(); return; }
    this.words(false);
    const { shop, verify } = this.pieces, { span } = pair;
    verify.hidden = true;
    verify.pulled = true;
    becomes(verify, "black");
    becomes(shop, "black");
    shop.set({ x: span.x, y: span.y, w: 2, h: 2 });
    shop.hidden = false;
    shop.to({ x: span.x, y: span.y, w: span.h, h: span.h }, "well");
    await this.glass.until(() => shop.w > span.h * 0.85, 1);
    if (run !== this.run) return;
    shop.to(span, SPLASH);
    await this.glass.until(() => shop.w > span.w * 0.97 || (shop.w > span.w * 0.9 && shop.sw.v <= 0), 1.2);
    if (run !== this.run) return;
    await this.divide(run);
  }

  /** Down out of the sky under gravity, writing its own springs so the engine draws it out along its speed. */
  private fall(p: Piece, from: number, to: number, run: number) {
    const T = FALL.short + (FALL.long - FALL.short) * Math.min(1, (to - from) / FALL.over), g = (2 * (to - from)) / (T * T);
    return new Promise<number>((done) => {
      let t = 0;
      const off = this.glass.on("frame", (dt) => {
        if (run !== this.run) { off(); done(0); return; }
        t += dt;
        const y = from + 0.5 * g * t * t, v = g * t;
        if (y >= to) {
          off();
          p.ay.x = p.ay.to = to;
          p.ay.v = 0;
          done(v);
          return;
        }
        p.ay.x = p.ay.to = y;
        p.ay.v = v;
      });
      this.glass.wake();
    });
  }

  /** One pill becomes two, from where it has spread to: a waist forms in the middle and deepens, the halves draw apart
   *  to their buttons, the right one clearing to water once the waist shows, and the neck lets go while it's short. */
  private async divide(run: number) {
    const pair = this.pair;
    if (!pair) return;
    const { shop, verify } = this.pieces, at = { x: shop.x, y: shop.y }, half = shop.w / 2, H = shop.h;
    /* The halves overlap by as much as keeps the pill's outline whole where they meet: joined at the pulled reach
       (24), two round ends whose centres are c apart meet at full height when c = 2√((H/2 + 6)² − (H/2)²). */
    const o = H - 2 * Math.sqrt((H / 2 + PULLED / 4) ** 2 - (H / 2) ** 2), w = half + o / 2;
    shop.set({ x: at.x - half + w / 2, y: at.y, w, h: H });
    verify.set({ x: at.x + half - w / 2, y: at.y, w, h: H });
    verify.pulled = true;
    verify.hidden = false;
    shop.to(pair.shop, DIVIDE);
    verify.to(pair.verify, DIVIDE);
    const apart = () => verify.x - verify.w / 2 - (shop.x + shop.w / 2);
    const home = pair.verify.x - pair.verify.w / 2 - (pair.shop.x + pair.shop.w / 2);
    await this.glass.until(() => apart() > -2, 1);
    if (run !== this.run) return;
    verify.material = "clear";
    await this.glass.until(() => apart() > Math.min(LET_GO, home * 0.7), 1.5);
    if (run !== this.run) return;
    verify.pulled = false;
    await this.glass.until(() => near(shop, pair.shop) && near(verify, pair.verify), 2);
    if (run !== this.run) return;
    this.state = "shown";
    this.words(true);
  }

  /** The words go: the water flows back into the ink, and the ink drains down to nothing. */
  private async leave() {
    const run = ++this.run;
    this.state = "leaving";
    this.words(false);
    const { shop, verify } = this.pieces;
    this.over = null;
    this.down = null;
    this.lean = { shop: { x: 0, y: 0 }, verify: { x: 0, y: 0 } };
    verify.pulled = false;
    if (this.glass.reduced) {
      shop.hidden = true;
      verify.hidden = true;
      this.state = "hidden";
      return;
    }
    if (verify.visible) {
      verify.material = "black";
      verify.joinAtLeast = 16;
      verify.to({ x: shop.x, y: shop.y, w: 10, h: 10 }, "drain");
      shop.to({ w: shop.target.w + 4, h: shop.target.h + 4 }, "swell");
      await this.glass.until(() => verify.w < 11 || verify.resting, 1);
      if (run !== this.run) return;
      verify.hidden = true;
      verify.joinAtLeast = 0;
    }
    shop.to({ y: shop.target.y + shop.target.h / 2, w: 2, h: 2 }, "drain");
    await this.glass.until(() => shop.resting, 1.5);
    if (run !== this.run) return;
    shop.hidden = true;
    this.state = "hidden";
  }
}

/**
 * The opening's two ways in as one liquid. `stage` is a layer over the room and under the words; `plate` a layer in
 * the room's plate, under the vials, for the ripples. Rebuilt only when the opening takes another shape (a phone
 * turned): everything else that moves the buttons, it follows by measuring them.
 */
export function useOpeningLiquid(
  section: RefObject<HTMLElement | null>,
  stage: RefObject<HTMLDivElement | null>,
  plate: RefObject<HTMLDivElement | null>,
  layout: unknown[],
) {
  useEffect(() => {
    const root = section.current, layer = stage.current;
    const shop = root?.querySelector<HTMLElement>(".tm-mist-actions .tm-button-primary");
    const verify = root?.querySelector<HTMLElement>(".tm-mist-actions .tm-button-outline");
    if (!root || !layer || !shop || !verify) return;
    const ripples = plate.current ? new RoomRipples(plate.current, root) : null;
    let liquid: OpeningLiquid;
    try {
      liquid = new OpeningLiquid(root, layer, { shop, verify }, ripples);
    } catch {
      ripples?.destroy();
      return;
    }
    root.setAttribute("data-liquid", "");

    const views = document.querySelector(".tm-views");
    let scrolled = window.scrollY > window.innerHeight * SCROLL_AWAY;
    let entered = false;
    const away = () => root.hasAttribute("data-story") || scrolled || Boolean(views?.hasAttribute("data-moving"));
    const sync = () => {
      if (!entered) return;
      if (away()) liquid.hide();
      else liquid.show();
    };
    const enter = () => {
      if (entered) return;
      entered = true;
      sync();
    };

    // The drop falls as the opening's words begin to arrive (their entrance waits a beat, mist.css), or at once if
    // they're already there.
    const way = root.querySelector<HTMLElement>(".tm-mist-way");
    const entrance = way?.getAnimations?.().find((a) => a.playState === "running" || a.pending);
    const waiting = entrance && Number(entrance.currentTime ?? 0) < Number(entrance.effect?.getTiming().delay ?? 0);
    const listeners = new AbortController();
    const on = { signal: listeners.signal };
    // A frame later, not at once: React builds the opening twice as it first mounts in development, and the first is
    // put away before that frame comes, so only the opening that stays lets the drop fall.
    let entering = 0;
    if (way && waiting) way.addEventListener("animationstart", enter, { once: true, signal: listeners.signal });
    else entering = requestAnimationFrame(enter);
    const fallback = window.setTimeout(enter, 2400);

    let frame = 0;
    const later = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; liquid.place(); });
    };
    window.addEventListener("scroll", () => {
      const y = window.scrollY, vh = window.innerHeight;
      const next = scrolled ? y > vh * SCROLL_BACK : y > vh * SCROLL_AWAY;
      if (next !== scrolled) { scrolled = next; sync(); }
      if (liquid.shown) later();
    }, { ...on, passive: true });
    window.addEventListener("pointermove", (event) => {
      liquid.point(event);
      if (event.pointerType === "mouse" && liquid.shown) later();
    }, { ...on, passive: true });
    shop.addEventListener("pointerdown", () => liquid.press("shop"), on);
    verify.addEventListener("pointerdown", () => liquid.press("verify"), on);
    window.addEventListener("pointerup", () => liquid.release(), on);
    window.addEventListener("pointercancel", () => liquid.release(), on);

    root.addEventListener("tm-room-light", () => liquid.lightDrawn(), on);

    const watched = new MutationObserver(sync);
    watched.observe(root, { attributes: true, attributeFilter: ["data-story"] });
    if (views) watched.observe(views, { attributes: true, attributeFilter: ["data-moving"] });

    const resized = new ResizeObserver(later);
    resized.observe(layer);
    resized.observe(shop);
    resized.observe(verify);
    void document.fonts?.ready.then(later);
    for (const img of root.querySelectorAll<HTMLImageElement>("img.tm-room-still")) {
      if (!img.complete) img.addEventListener("load", later, on);
    }

    return () => {
      window.clearTimeout(fallback);
      cancelAnimationFrame(entering);
      cancelAnimationFrame(frame);
      listeners.abort();
      watched.disconnect();
      resized.disconnect();
      liquid.destroy();
      ripples?.destroy();
      root.removeAttribute("data-liquid");
      root.removeAttribute("data-liquid-words");
    };
    // The layout list names what lays the words out anew; the refs themselves never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, layout);
}
