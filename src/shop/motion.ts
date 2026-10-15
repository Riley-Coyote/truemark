import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { stepDrawing, useStepWaiting } from "../stepping";

/** Whether a media query matches now, kept current as it changes. */
export function useMediaQuery(query: string): boolean {
  // Server rendering and lean test windows have no matchMedia; the query then reads as false.
  const supported = () => typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [matches, setMatches] = useState(() => supported() && window.matchMedia(query).matches);
  useEffect(() => {
    if (!supported()) return;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/**
 * Whether the page is changing inside a glide, as Navigation.tsx draws a step forward on a phone and a page's own way
 * back: the page being left is drawn whole, with whatever was over it, and slides away as one. A browser that can't say
 * is taken to glide wherever it could (a phone, motion allowed).
 */
export function pageGliding(): boolean {
  if (typeof document === "undefined") return false;
  try {
    return document.documentElement.matches(":active-view-transition");
  } catch {
    return typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 760px)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      typeof document.startViewTransition === "function";
  }
}

/** How long past an exit's own time its end is waited for, in ms: its last frame, on a busy phone. */
const EXIT_GRACE = 60;

/** The longest an element's transitions or animations run, delays included, in ms. */
function exitTime(element: Element): number {
  const style = getComputedStyle(element);
  const times = (list: string) => list.split(",").map((time) => (parseFloat(time) || 0) * (time.trim().endsWith("ms") ? 1 : 1000));
  const longest = (durations: string, delays: string) => {
    const wait = times(delays);
    return Math.max(0, ...times(durations).map((duration, i) => duration + (wait[i % wait.length] ?? 0)));
  };
  return Math.max(longest(style.transitionDuration, style.transitionDelay), longest(style.animationDuration, style.animationDelay));
}

/**
 * Calls `done` once the element has faded out: when its opacity transition or its animation ends, or once the longest
 * of them has had its time, so nothing is left behind if the end never comes. Returns a way to call it off.
 */
export function afterExit(element: HTMLElement, done: () => void): () => void {
  let called = false;
  const finish = () => {
    if (called) return;
    called = true;
    stop();
    done();
  };
  const end = (event: Event) => {
    if (event.target !== element) return;
    if (event.type === "animationend" || (event as TransitionEvent).propertyName === "opacity") finish();
  };
  element.addEventListener("transitionend", end);
  element.addEventListener("animationend", end);
  const timer = window.setTimeout(finish, exitTime(element) + EXIT_GRACE);
  function stop() {
    called = true;
    window.clearTimeout(timer);
    element.removeEventListener("transitionend", end);
    element.removeEventListener("animationend", end);
  }
  return stop;
}

/**
 * Something shown over the page that leaves the way it came: the menu, the sizes, the added-to-cart bar, a sheet.
 * While `open` it is drawn; once closed it stays a moment, `closing`, while its way out plays, then it is gone. The
 * element given `exit` ends it as it fades (afterExit); a sheet that times its own way out says when instead (`gone`).
 * Opened again before it has gone, it simply stays. Reduce Motion takes it away at once, and so does a change of
 * `page` that glides: what was over the page being left goes with that page, and is not drawn on the one arriving.
 * Any other change of page lets it finish leaving over the new one. Closed by a step forward (a link in it followed),
 * it holds still as the tap left it until the page is taken for the step (stepping.ts), so it leaves with the page
 * whole; a step that doesn't come lets it leave as usual.
 */
export function usePresence<T extends HTMLElement = HTMLElement>(open: boolean, page?: string) {
  const reduced = usePrefersReducedMotion();
  const waiting = useStepWaiting();
  const [shown, setShown] = useState(open);
  const [drawnOn, setDrawnOn] = useState(page);
  if (open && !shown) setShown(true);
  if (page !== drawnOn) {
    setDrawnOn(page);
    if (!open && shown && pageGliding()) setShown(false);
  }
  if (!open && shown && reduced) setShown(false);
  const closing = shown && !open && !waiting;
  const exit = useRef<T | null>(null);
  const wanted = useRef(open);
  wanted.current = open;
  const gone = useCallback(() => {
    if (!wanted.current) setShown(false);
  }, []);
  useLayoutEffect(() => {
    const element = exit.current;
    if (!closing || !element) return;
    return afterExit(element, gone);
  }, [closing, gone]);
  return { shown, closing, exit, gone };
}

/**
 * Marks `[data-reveal]` descendants of `root` visible as they enter the
 * viewport, including ones that mount later (a live record, a lookup result).
 * CSS owns the motion; reduced-motion users get the end state.
 */
export function useReveal(root: RefObject<HTMLElement | null>, key: unknown = null) {
  useEffect(() => {
    const scope = root.current;
    if (!scope) return;
    const pending = () => scope.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-visible)");
    // Shown while a page change is drawn, it shows whole, as the arriving page does (Navigation.tsx settleOpenings).
    const show = (el: Element) => {
      el.classList.add("is-visible");
      if (!stepDrawing() || typeof CSSTransition === "undefined") return;
      for (const motion of el.getAnimations({ subtree: true })) {
        if (!(motion instanceof CSSTransition)) continue;
        try {
          motion.finish();
        } catch {
          // A transition that cannot finish is left to run.
        }
      }
    };
    const io = "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries, observer) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                show(entry.target);
                observer.unobserve(entry.target);
              }
            }
          },
          { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
        )
      : null;
    // Something already on screen when it arrives shows at once: the margin above is for what
    // scrolls into view, and would otherwise leave the foot of a first screen blank.
    const onScreen = (el: HTMLElement) => {
      const box = el.getBoundingClientRect();
      return box.height > 0 && box.top < window.innerHeight && box.bottom > 0;
    };
    // Observing an element twice is a no-op, so every arrival can simply re-scan.
    const watch = () => pending().forEach((el) => (io && !onScreen(el) ? io.observe(el) : show(el)));
    watch();
    const arrivals = new MutationObserver(watch);
    arrivals.observe(scope, { childList: true, subtree: true });
    return () => {
      arrivals.disconnect();
      io?.disconnect();
    };
  }, [root, key]);
}
