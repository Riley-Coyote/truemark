import { useEffect } from "react";

/**
 * Presses and hovers, as a finger means them.
 *
 * Under a finger, iOS Safari holds :active on whatever the finger lands on for as long as it stays down, through a
 * scroll that starts there: a class card shrank under the thumb for the whole of a scroll, and a button a scroll began
 * on darkened. So under a finger the site's presses come from here (vite.config.ts turns every :active in its styles
 * into the browser's own for a mouse and [data-pressed] for a finger): a press shows once the finger has rested a moment
 * without moving, as a native list's rows do, and a quick tap shows one as it lifts. A scroll, a drag, a pinch or the
 * long press that opens a link's preview never does.
 *
 * The press is set on the element the finger landed on and every element around it, as the browser's own :active is,
 * so a rule on a card answers to a press on the words inside it.
 *
 * A phone also hovers whatever a finger tapped last, and keeps it hovered until a tap lands somewhere else: a story's
 * pause button kept a lit disc once tapped. Under a finger the site's hovers hold off (vite.config.ts again), and a mouse
 * that moves (a laptop's, after its screen was touched) has them back.
 */

/** How long a finger rests before its press shows, in ms. A scroll gives itself away sooner: the finger moves first,
 *  and iOS takes it over some 60 ms in. */
const PRESS_AFTER = 100;
/** How far a finger may drift, in CSS pixels, and still be pressing rather than starting a scroll. */
const DRIFT = 6;
/** How long a quick tap's press holds once the finger has lifted, in ms, so it is seen. */
const TAP_HOLD = 90;

/** Watches the page's presses, and whether a finger or a mouse is on it, for as long as the site is up (main.tsx). */
export function Presses(): null {
  useEffect(watchPresses, []);
  return null;
}

function watchPresses(): () => void {
  const root = document.documentElement;
  let pressed: Element[] = [];
  let finger: { id: number; x: number; y: number; target: Element } | null = null;
  let waiting = 0;
  let holding = 0;

  /** Whether the hand on the page is a finger (or a pen): then :active gives way to [data-pressed], and :hover holds
   *  off. */
  const touching = (on: boolean) => {
    if (root.hasAttribute("data-touch") !== on) root.toggleAttribute("data-touch", on);
  };
  const press = (target: Element) => {
    for (let el: Element | null = target; el && el !== root; el = el.parentElement) {
      el.setAttribute("data-pressed", "");
      pressed.push(el);
    }
  };
  const lift = () => {
    for (const el of pressed) el.removeAttribute("data-pressed");
    pressed = [];
  };
  const letGo = () => {
    window.clearTimeout(waiting);
    window.clearTimeout(holding);
    waiting = 0;
    finger = null;
    lift();
  };

  touching(matchMedia("(hover: none) and (pointer: coarse)").matches);
  const stop = new AbortController();
  const listen = { capture: true, passive: true, signal: stop.signal };
  document.addEventListener("pointerdown", (event) => {
    touching(event.pointerType !== "mouse");
    if (event.pointerType === "mouse" || !event.isPrimary || !(event.target instanceof Element)) return;
    letGo();
    const target = event.target;
    finger = { id: event.pointerId, x: event.clientX, y: event.clientY, target };
    waiting = window.setTimeout(() => {
      waiting = 0;
      press(target);
    }, PRESS_AFTER);
  }, listen);
  document.addEventListener("pointermove", (event) => {
    // A mouse moving: hovers answer it again. (A phone's tap moves no mouse pointer: the mouse events iOS sends after
    // one are not pointer events.)
    if (event.pointerType === "mouse") touching(false);
    else if (finger?.id === event.pointerId && Math.hypot(event.clientX - finger.x, event.clientY - finger.y) > DRIFT) letGo();
  }, listen);
  document.addEventListener("pointerup", (event) => {
    if (finger?.id !== event.pointerId) return;
    const { target } = finger;
    finger = null;
    if (!waiting) {
      lift();
      return;
    }
    window.clearTimeout(waiting);
    waiting = 0;
    press(target);
    holding = window.setTimeout(lift, TAP_HOLD);
  }, listen);
  // The browser has taken the finger for a scroll or a zoom, or something under it is scrolling (a tap that stops a
  // fling): no press.
  document.addEventListener("pointercancel", letGo, listen);
  window.addEventListener("scroll", () => {
    if (finger) letGo();
  }, listen);

  return () => {
    stop.abort();
    letGo();
    root.removeAttribute("data-touch");
  };
}
