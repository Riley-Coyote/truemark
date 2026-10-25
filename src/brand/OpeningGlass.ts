import { useEffect } from "react";
import type { RefObject } from "react";
import { Liquid } from "./liquid";
import type { Box, Motion, Piece } from "./liquid";
import "./glass.css";

/*
 * The opening's floating controls in clear glass, standing in the room: the second way in ("Verify a lot"), the Motion
 * switch and the featured pedestal's "Look closer". It is Riley and Claude's liquid glass in its web form: its springs
 * (liquid.ts) and its clear glass's numbers (glass.css). A browser can't draw Apple's own glass, so this is ours,
 * matched to Apple's by measurement: the room behind it blurred 2 px and lifted 8% toward white, a hairline rim lit
 * from above, a soft shade beneath it in the room's own ink, and every change a spring.
 *
 * The spec, state by state:
 * - At rest each piece of glass lies exactly under its control, on whole device pixels. The control keeps its words and
 *   marks; the glass takes over its fill, its edge and its shade (glass.css).
 * - Pointed at, the glass swells (4 px wider, 2 px taller) on the swell spring, and leans after the pointer as water
 *   follows a finger (a fifteenth of the way from its middle to the pointer, at most 5 px across and 2 down, on the
 *   carry spring); pressed, it squeezes (6 by 3) on the pull spring; let go, it comes back with one wobble on the press
 *   spring, and left, it settles home.
 * - When the opening's words go (the story opens, the page scrolls on past the room, the camera flies to a product), the
 *   glass drains to nothing toward its middle on the drain spring: glass changes shape, it never fades. When the words
 *   come back, it wells up again from its middle with one wobble of surface tension. Until it drains it goes wherever
 *   its control goes: the first stretch of a scroll carries some of them a little way.
 * - It first wells up as the opening's words begin to arrive, so each control's words and glass come in together.
 * - Reduced motion lands every spring at once (liquid.ts).
 *
 * The glass is drawn in layers of its own under the controls' words (MistOpening.tsx): the buttons themselves sit in a
 * layer the browser seals off for its fades (will-change: opacity), where glass would see nothing of the room behind.
 * Each piece is its own capsule (glass.css), not a traced outline: Safari doesn't clip a backdrop-filter to a clip-path,
 * and showed the glass's whole box; it does clip to a radius. These pieces never join, so nothing is lost.
 */

const SWELL = { w: 4, h: 2 };
const SQUEEZE = { w: -6, h: -3 };
/** How far the glass leans after the pointer: a share of the way from its middle, and the most it goes each way. */
const LEAN = { share: 1 / 15, x: 5, y: 2 };
const clamp = (v: number, most: number) => Math.max(-most, Math.min(most, v));
/** Scrolled this far down (a share of the screen's height), the words have begun to go; back above the second, they
 *  return. The gap between the two keeps a hand resting near the top from draining and welling the glass in turn. */
const SCROLL_AWAY = 0.03;
const SCROLL_BACK = 0.01;

/** Measures an element as it will stand once the animations bringing it in have run: the words rise a little as they
 *  arrive (mist.css) and as they come back after a story (stories.css), and the glass goes where they'll land, not where
 *  they are on the way. Each such animation is held at its end for the moment of measuring and put back at once, before
 *  anything is drawn. Those tied to the scroll stay as they are: the glass follows the scroll itself (Held.follow). */
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

/** Where an element stands in a layer's own coordinates, at whatever scale the layer is drawn (the room's plate is). */
function boxIn(layer: HTMLElement, el: HTMLElement): Box | null {
  return landed(el, layer.parentElement, () => {
    const L = layer.getBoundingClientRect(), E = el.getBoundingClientRect();
    if (!E.width || !E.height || !layer.offsetWidth) return null;
    const s = L.width / layer.offsetWidth;
    return { x: (E.left + E.width / 2 - L.left) / s, y: (E.top + E.height / 2 - L.top) / s, w: E.width / s, h: E.height / s };
  });
}

/** The liquid drawn as capsules of clear glass, one element each, placed every frame its springs move. */
class CapsuleGlass extends Liquid {
  private readonly drawn = new Map<Piece, HTMLDivElement>();
  constructor(private readonly layer: HTMLElement) {
    super(layer);
  }
  hold(): Piece {
    const piece = this.add();
    const el = document.createElement("div");
    el.className = "tm-glass";
    this.layer.appendChild(el);
    this.drawn.set(piece, el);
    return piece;
  }
  render() {
    for (const [piece, el] of this.drawn) {
      if (!piece.visible) { el.style.visibility = "hidden"; continue; }
      el.style.visibility = "";
      el.style.width = `${piece.w}px`;
      el.style.height = `${piece.h}px`;
      el.style.transform = `translate3d(${piece.x - piece.w / 2}px, ${piece.y - piece.h / 2}px, 0)`;
    }
  }
  destroy() {
    super.destroy();
    for (const el of this.drawn.values()) el.remove();
    this.drawn.clear();
  }
}

/** One control's glass: it lies under the control, answers the pointer, and drains or wells as the words go and come. */
class Held {
  readonly piece: Piece;
  private box: Box | null = null;
  private over = false;
  private down = false;
  private lean = { x: 0, y: 0 };
  private shown = false;
  private readonly listeners = new AbortController();

  constructor(private readonly glass: CapsuleGlass, private readonly layer: HTMLElement, readonly el: HTMLElement) {
    this.piece = glass.hold();
    const on = { signal: this.listeners.signal };
    el.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") { this.over = true; this.rest("swell"); } }, on);
    el.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse" || !this.over) return;
      const r = el.getBoundingClientRect();
      this.lean = {
        x: clamp((event.clientX - (r.left + r.width / 2)) * LEAN.share, LEAN.x),
        y: clamp((event.clientY - (r.top + r.height / 2)) * LEAN.share, LEAN.y),
      };
      this.rest("carry");
    }, on);
    el.addEventListener("pointerleave", () => { this.over = false; this.down = false; this.lean = { x: 0, y: 0 }; this.rest("settle"); }, on);
    el.addEventListener("pointerdown", () => { this.down = true; this.rest("pull"); }, on);
    window.addEventListener("pointerup", () => { if (this.down) { this.down = false; this.rest("press"); } }, on);
    window.addEventListener("pointercancel", () => { if (this.down) { this.down = false; this.rest("settle"); } }, on);
  }

  private aim(): Box | null {
    if (!this.box) return null;
    const d = this.down ? SQUEEZE : this.over ? SWELL : { w: 0, h: 0 };
    return { x: this.box.x + this.lean.x, y: this.box.y + this.lean.y, w: this.box.w + d.w, h: this.box.h + d.h };
  }

  /** Measured again (a resize, a font arriving): at rest it simply stands there. */
  place() {
    this.box = boxIn(this.layer, this.el);
    const aim = this.aim();
    if (aim && this.shown) this.piece.set(aim);
  }

  /** The page moved and carried its control a little way: it goes along at once, still swelling or welling as it was. */
  follow() {
    if (!this.shown) return;
    this.box = boxIn(this.layer, this.el);
    const aim = this.aim();
    if (aim) this.piece.set({ x: aim.x, y: aim.y });
  }

  private rest(motion: Motion) {
    const aim = this.aim();
    if (aim && this.shown) this.piece.to(aim, motion);
  }

  /** Up out of nothing at its middle, to its control's size, with one wobble. */
  well() {
    if (this.shown) return;
    this.box = boxIn(this.layer, this.el);
    const aim = this.aim();
    if (!aim) return;
    this.shown = true;
    this.piece.hidden = false;
    this.piece.set({ x: aim.x, y: aim.y, w: 2, h: 2 });
    this.piece.to(aim, "well");
  }

  /** Down to nothing toward its middle; hidden once it's there, unless it was asked back on the way. */
  drain() {
    if (!this.shown) return;
    this.shown = false;
    this.piece.to({ w: 2, h: 2 }, "drain");
    void this.glass.until(() => this.piece.resting, 2).then(() => { if (!this.shown) this.piece.hidden = true; });
  }

  destroy() {
    this.listeners.abort();
  }
}

/** Whether this browser can draw glass over the page at all (backdrop-filter); without it the controls keep their own
 *  frosted fill. */
const canDrawGlass = () =>
  typeof CSS !== "undefined" && (CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)"));

/**
 * The opening's glass. `stage` is a layer over the room, under the copy and the Motion switch; `plate` a layer in the
 * room's plate, under "Look closer". Rebuilt when the opening lays its words out anew (a phone turned, the story's
 * pictures ready).
 */
export function useOpeningGlass(
  section: RefObject<HTMLElement | null>,
  stage: RefObject<HTMLDivElement | null>,
  plate: RefObject<HTMLDivElement | null>,
  layout: unknown[],
) {
  useEffect(() => {
    const root = section.current, stageLayer = stage.current;
    if (!root || !stageLayer || !canDrawGlass()) return;
    root.setAttribute("data-glass", "");
    const glasses = new Map<HTMLElement, CapsuleGlass>();
    const held: Held[] = [];
    const hold = (layer: HTMLElement | null, selector: string) => {
      const el = root.querySelector<HTMLElement>(selector);
      if (!layer || !el) return null;
      let glass = glasses.get(layer);
      if (!glass) { glass = new CapsuleGlass(layer); glasses.set(layer, glass); }
      const h = new Held(glass, layer, el);
      held.push(h);
      return h;
    };
    const ways = [hold(stageLayer, ".tm-mist-actions .tm-button-outline"), hold(stageLayer, ".tm-seq-switch-rest")].filter((h): h is Held => Boolean(h));
    const cue = hold(plate.current, ".tm-story-cue");

    const views = document.querySelector(".tm-views");
    let scrolled = window.scrollY > window.innerHeight * SCROLL_AWAY;
    let entered = false;
    const away = () => root.hasAttribute("data-story") || scrolled || Boolean(views?.hasAttribute("data-moving"));
    const sync = () => {
      if (!entered) return;
      const gone = away();
      for (const h of ways) { if (gone) h.drain(); else h.well(); }
      if (cue) {
        const cueGone = gone || root.hasAttribute("data-seq-away") || (cue.el as HTMLButtonElement).disabled;
        if (cueGone) cue.drain(); else cue.well();
      }
    };
    const enter = () => {
      if (entered) return;
      entered = true;
      sync();
    };

    // The glass comes as the opening's words begin to arrive (their entrance waits a beat, mist.css), or at once if
    // they're already there.
    const way = root.querySelector<HTMLElement>(".tm-mist-way");
    const entrance = way?.getAnimations?.().find((a) => a.playState === "running" || a.pending);
    const waiting = entrance && Number(entrance.currentTime ?? 0) < Number(entrance.effect?.getTiming().delay ?? 0);
    const listeners = new AbortController();
    const on = { signal: listeners.signal };
    if (way && waiting) way.addEventListener("animationstart", enter, { once: true, signal: listeners.signal });
    else enter();
    const fallback = window.setTimeout(enter, 2400);

    window.addEventListener("scroll", () => {
      const y = window.scrollY, vh = window.innerHeight;
      const next = scrolled ? y > vh * SCROLL_BACK : y > vh * SCROLL_AWAY;
      if (next !== scrolled) { scrolled = next; sync(); }
      for (const h of held) h.follow();
    }, { ...on, passive: true });

    const watched = new MutationObserver(sync);
    watched.observe(root, { attributes: true, attributeFilter: ["data-story", "data-seq-away"] });
    if (views) watched.observe(views, { attributes: true, attributeFilter: ["data-moving"] });
    if (cue) watched.observe(cue.el, { attributes: true, attributeFilter: ["disabled"] });

    const resized = new ResizeObserver(() => { for (const h of held) h.place(); });
    resized.observe(stageLayer);
    if (plate.current) resized.observe(plate.current);
    for (const h of held) resized.observe(h.el);
    void document.fonts?.ready.then(() => { for (const h of held) h.place(); });

    return () => {
      window.clearTimeout(fallback);
      listeners.abort();
      watched.disconnect();
      resized.disconnect();
      for (const h of held) h.destroy();
      for (const g of glasses.values()) g.destroy();
      root.removeAttribute("data-glass");
    };
    // The layout list names what lays the words out anew; the refs themselves never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, layout);
}
