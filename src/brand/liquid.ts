/*
 * The liquid under the opening's glass (OpeningGlass.ts): pieces whose middle and size each ride a spring, all on one
 * clock. It is the motion of Riley and Claude's liquid glass, cut down to what the opening needs; glass.css draws the
 * glass itself. The springs are SwiftUI's (a response in seconds and a damping fraction), stepped 240 times a second
 * and never once a frame: one step a frame goes unstable at background frame rates. A piece at rest stands exactly on
 * whole device pixels, so the words over it never smear. The clock sleeps while nothing moves, and rests while the page
 * is hidden or the glass is off screen. Reduced motion lands every spring at once.
 */

/** The springs the glass moves on: [response in seconds, damping fraction]. */
const MOTION = {
  well: [0.42, 0.58], // welling up out of nothing: surface tension, one clear wobble
  drain: [0.32, 0.94], // draining away to nothing
  swell: [0.3, 0.86], // pointed at
  pull: [0.24, 0.95], // pressed
  press: [0.5, 0.6], // let go, wobbling back once
  carry: [0.16, 0.8], // following the hand
  settle: [0.38, 0.78], // left, or let go after a carry
} as const;
export type Motion = keyof typeof MOTION;

export type Box = { x: number; y: number; w: number; h: number };

const STEPS_PER_SECOND = 240;

/** A spring toward `to`, stepped velocity first (semi-implicit Euler). */
class Spring {
  x: number;
  to: number;
  private v = 0;
  private k = 0;
  private c = 0;
  constructor(value: number) {
    this.x = this.to = value;
    this.use(MOTION.settle);
  }
  use([response, damping]: readonly [number, number]) {
    const w = (2 * Math.PI) / Math.max(response, 1e-3);
    this.k = w * w;
    this.c = 2 * damping * w;
  }
  step(h: number) {
    this.v += (-this.k * (this.x - this.to) - this.c * this.v) * h;
    this.x += this.v * h;
  }
  /** Within a fiftieth of a pixel and all but still; it's then put exactly on its target. */
  get resting() {
    return Math.abs(this.x - this.to) < 0.02 && Math.abs(this.v) < 0.3;
  }
  settle() {
    this.x = this.to;
    this.v = 0;
  }
  snap(value: number) {
    this.x = this.to = value;
    this.v = 0;
  }
}

/** One piece of glass: its middle and its size, each on a spring of its own. It starts hidden, a speck at the corner. */
export class Piece {
  private target: Box;
  private readonly springs: [x: Spring, y: Spring, w: Spring, h: Spring];
  private isHidden = true;

  constructor(private readonly liquid: Liquid) {
    this.target = liquid.snap({ x: 0, y: 0, w: 2, h: 2 });
    const { x, y, w, h } = this.target;
    this.springs = [new Spring(x), new Spring(y), new Spring(w), new Spring(h)];
  }

  get x() { return this.springs[0].x; }
  get y() { return this.springs[1].x; }
  get w() { return Math.max(0, this.springs[2].x); }
  get h() { return Math.max(0, this.springs[3].x); }
  get resting() { return this.springs.every((s) => s.resting); }
  get visible() { return !this.isHidden && this.w >= 0.5 && this.h >= 0.5; }
  get hidden() { return this.isHidden; }
  set hidden(hidden: boolean) {
    this.isHidden = hidden;
    this.liquid.wake();
  }

  /** Spring toward a box on a named motion. What the box leaves out keeps the course it was on. */
  to(box: Partial<Box>, motion: Motion) {
    const target = this.aimAt(box), [x, y, w, h] = this.springs;
    if (box.x != null) x.use(MOTION[motion]);
    if (box.y != null) y.use(MOTION[motion]);
    if (box.w != null) w.use(MOTION[motion]);
    if (box.h != null) h.use(MOTION[motion]);
    x.to = target.x;
    y.to = target.y;
    w.to = target.w;
    h.to = target.h;
    this.liquid.wake();
  }

  /** Jump there, at rest. What the box leaves out keeps the course it was on. */
  set(box: Partial<Box>) {
    const target = this.aimAt(box), [x, y, w, h] = this.springs;
    if (box.x != null) x.snap(target.x);
    if (box.y != null) y.snap(target.y);
    if (box.w != null) w.snap(target.w);
    if (box.h != null) h.snap(target.h);
    this.liquid.wake();
  }

  /** One small step of the clock, for Liquid. */
  step(h: number) {
    for (const s of this.springs) s.step(h);
  }

  /** After the steps: what has come to rest is put exactly on its target (everything, under reduced motion). */
  settle(reduced: boolean) {
    for (const s of this.springs) if (reduced || s.resting) s.settle();
  }

  private aimAt(box: Partial<Box>) {
    const was = this.target;
    this.target = this.liquid.snap({ x: box.x ?? was.x, y: box.y ?? was.y, w: box.w ?? was.w, h: box.h ?? was.h });
    return this.target;
  }
}

/** Pieces on springs on one clock. A subclass draws them in render(), every frame they move. */
export class Liquid {
  private readonly pieces: Piece[] = [];
  private watches: { test: () => boolean; done: () => void; by: number }[] = [];
  private time = 0;
  private frame = 0;
  private last = 0;
  private onscreen = true;
  private readonly reducedMotion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  private readonly seen: IntersectionObserver | null;
  private readonly again = () => {
    this.last = 0;
    this.wake();
  };

  /** `watched` is what the glass is drawn in: while it's off screen, or the page is hidden, the clock rests. */
  constructor(watched: Element) {
    document.addEventListener("visibilitychange", this.again);
    this.reducedMotion?.addEventListener("change", this.again);
    this.seen = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
      for (const entry of entries) this.onscreen = entry.isIntersecting;
      if (this.onscreen) this.again();
    }) : null;
    this.seen?.observe(watched);
  }

  get reduced() {
    return Boolean(this.reducedMotion?.matches);
  }

  /** A box with its edges on whole device pixels. */
  snap(box: Box): Box {
    const d = window.devicePixelRatio || 1, whole = (v: number) => Math.round(v * d) / d;
    const x0 = whole(box.x - box.w / 2), x1 = whole(box.x + box.w / 2);
    const y0 = whole(box.y - box.h / 2), y1 = whole(box.y + box.h / 2);
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  }

  add() {
    const piece = new Piece(this);
    this.pieces.push(piece);
    return piece;
  }

  /** Settles once `test` passes after a step of the clock, or after `most` seconds of the liquid's own time. */
  until(test: () => boolean, most = 4) {
    return new Promise<void>((done) => {
      this.watches.push({ test, done, by: this.time + most });
      this.wake();
    });
  }

  wake() {
    if (this.frame || !this.live()) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  /** Draws the pieces where their springs have them. */
  render() {}

  destroy() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.seen?.disconnect();
    document.removeEventListener("visibilitychange", this.again);
    this.reducedMotion?.removeEventListener("change", this.again);
    this.pieces.length = 0;
    this.watches = [];
  }

  private live() {
    return document.visibilityState !== "hidden" && this.onscreen;
  }

  private readonly tick = (now: number) => {
    this.frame = 0;
    if (!this.live()) {
      this.last = 0;
      return;
    }
    const dt = this.last ? Math.min((now - this.last) / 1000, 1 / 30) : 1 / 60;
    this.last = now;
    this.step(dt);
    this.render();
    if (this.watches.length || this.pieces.some((p) => !p.resting)) this.frame = requestAnimationFrame(this.tick);
    else this.last = 0;
  };

  private step(dt: number) {
    const reduced = this.reduced, n = Math.max(1, Math.ceil(dt * STEPS_PER_SECOND - 1e-6)), h = dt / n;
    this.time += dt;
    for (let i = 0; i < n; i++) for (const p of this.pieces) p.step(h);
    for (const p of this.pieces) p.settle(reduced);
    const done = this.watches.filter((w) => this.time >= w.by || w.test());
    if (!done.length) return;
    this.watches = this.watches.filter((w) => !done.includes(w));
    for (const w of done) w.done();
  }
}
