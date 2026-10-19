import { startTransition, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  UNSAFE_createBrowserHistory as createBrowserHistory,
  UNSAFE_createHashHistory as createHashHistory,
  parsePath,
  unstable_HistoryRouter as HistoryRouter,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import type { Location } from "react-router-dom";
import "./navigation.css";
import { drawingStep, setStepWaiting } from "./stepping";

type History = ReturnType<typeof createBrowserHistory>;
type Listener = Parameters<History["listen"]>[0];

/* ---------- A camera move that owns a step back (src/brand/flight.ts) ---------- */

export type PopUpdate = { location: Location; uaTransition: boolean };
let popHook: ((update: PopUpdate) => boolean) | null = null;
/** Called before the router draws a Back or Forward; returning true keeps the step for a move. */
export function setPopHook(hook: (update: PopUpdate) => boolean) {
  popHook = hook;
}
// Safari's swipe back animates the page itself; this listener runs before the router's, so the step knows.
let uaTransition = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", (event) => {
    uaTransition = Boolean((event as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition);
  });
}
let heldPop: string | null = null;
/** The page this step back lands on is placed by the move, not by the remembered scroll. */
export function holdPopScroll(key: string) {
  heldPop = key;
}

/* ---------- Moving forward ---------- */

const VIAL = "tm-vial";
const matches = (query: string) => typeof window.matchMedia === "function" && window.matchMedia(query).matches;
const motionAllowed = () => !matches("(prefers-reduced-motion: reduce)");
/** Phones push every page in; wider screens dissolve to it. Either way a tapped vial travels over both pages. */
const phoneWidth = () => matches("(max-width: 760px)");
/** Whether pages can glide here and now. */
const canGlide = () => typeof document.startViewTransition === "function" && document.visibilityState !== "hidden" && motionAllowed();

/** Readies a page's code, by its address within the site: src/pages.tsx's preloadPath, handed over by main.tsx (so this
 *  module, and the pieces that use it, never reach every page's code themselves). */
let readyCode: (path: string) => Promise<unknown> = () => Promise.resolve();
export function readyPagesWith(preload: (path: string) => Promise<unknown>) {
  readyCode = preload;
}
/** Ready a page's code ahead of a step to it. */
export function readyPage(path: string): Promise<unknown> {
  return readyCode(path).catch(() => undefined);
}

/** How long a step forward waits for its page's code, in ms. Within it the page glides in whole, never as an empty page
 *  that fills in once it has arrived; past it (a dropped connection) the step goes anyway, and the page draws when its
 *  code comes or says it didn't load. */
const CODE_WAIT = 3000;
/** How long a glide waits, once the next page is drawn, for the pictures on its first screen, in ms. The page being left
 *  holds still meanwhile, as it was the moment it was tapped (see firstScreen for when it can't). */
const PICTURE_WAIT = 300;
/** How soon the browser's step back must come for a page's own way back to glide it, in ms (stepBack). */
const BACK_WAIT = 1000;

/** The site's areas. The command center and the partner portal keep their own frame; the partner program loads on its own. */
function areaOf(path: string) {
  if (/^\/admin(\/|$)/.test(path)) return "admin";
  if (/^\/partners\/app(\/|$)/.test(path)) return "portal";
  if (/^\/partners(\/|$)/.test(path)) return "partners";
  return "shop";
}

/**
 * Going forward to another page glides: a phone pushes it in, a wider screen dissolves to it. Filters, the
 * account's own tabs and redirects change in place. A step back glides where nothing else animates it: on a wider
 * screen every step back or forward dissolves, as a step forward does; on a phone only a page's own way back does (see
 * stepBack), since Safari animates its own swipe back and its toolbar back is instant on every site.
 */
function glides(from: string, to: string): boolean {
  if (!canGlide() || from === to) return false;
  const area = areaOf(from);
  if (area !== areaOf(to) || area === "admin" || area === "portal") return false;
  // The account's sections are siblings: they switch in place. Going deeper (an order) still glides.
  if (from.startsWith("/account") && to.startsWith("/account") && !to.startsWith(`${from}/`)) return false;
  return true;
}

type Tapped = { id: string; element: HTMLElement; at: number };
let tapped: Tapped | null = null;
let named: HTMLElement[] = [];

/** A vial about to open its product page (a card's, or the home shelf's): it flies there. */
export function rememberVial(id: string, element: HTMLElement | null | undefined) {
  tapped = element ? { id, element, at: performance.now() } : null;
}

const productOf = (pathname: string) => /^\/product\/([^/?#]+)/.exec(pathname)?.[1] ?? null;

function inView(element: HTMLElement) {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.bottom > 0 && box.top < window.innerHeight;
}
const onScreen = (element: HTMLElement) => inView(element) && getComputedStyle(element).opacity !== "0";

function name(element: HTMLElement) {
  element.style.viewTransitionName = VIAL;
  named.push(element);
}

function unname() {
  for (const element of named) element.style.viewTransitionName = "";
  named = [];
}

/** The vial just tapped, if this step opens its product page. */
function tappedFor(to: string): Tapped | null {
  const card = tapped;
  tapped = null;
  return card && performance.now() - card.at <= 1000 && productOf(to) === card.id ? card : null;
}

/** Before the change: that vial takes off, if it is still in view. */
function departVial(card: Tapped | null): string | null {
  if (!card || !card.element.isConnected || !onScreen(card.element)) return null;
  name(card.element);
  return card.id;
}

/**
 * After the change: where that vial lands, if that place is in view. The flight is its entrance,
 * so the picture it lands as skips its own (`data-landed`, see stage.css). With nowhere to land,
 * the vial simply leaves with the page it was on.
 */
function arriveVial(id: string | null) {
  if (!id) return;
  const target = [...document.querySelectorAll<HTMLElement>(`[data-vial="${CSS.escape(id)}"]`)].find(
    (element) => !named.includes(element) && inView(element),
  );
  if (!target) {
    unname();
    return;
  }
  for (const element of named) element.style.viewTransitionName = "";
  named = [];
  target.dataset.landed = "";
  name(target);
}

/**
 * The pictures on the first screen of the page just drawn, decoded, so the page glides in whole rather than filling in
 * as it moves; never longer than PICTURE_WAIT. One that would wait to be scrolled to is asked for now, as it would be
 * the moment the page showed. (A picture held hidden, as a product's other sizes are, keeps waiting.)
 *
 * Only when the next page stands where the last one was scrolled to (`scrolledFrom`). While a step is drawn, iPhone
 * Safari keeps showing the page being left, held still, but scrolls it at once to wherever the next page stands, where
 * it was never drawn: a wait then showed the last page jumped and half blank for as long as it lasted.
 */
function firstScreen(scrolledFrom: number): Promise<void> | undefined {
  if (Math.abs(window.scrollY - scrolledFrom) >= 1) return undefined;
  const pictures = [...document.images].filter((image) => {
    const box = image.getBoundingClientRect();
    if (box.width === 0 || box.bottom <= 0 || box.top >= window.innerHeight || box.right <= 0 || box.left >= window.innerWidth) return false;
    const style = getComputedStyle(image);
    return style.opacity !== "0" && style.visibility !== "hidden";
  });
  if (!pictures.length) return Promise.resolve();
  for (const image of pictures) if (image.loading === "lazy") image.loading = "eager";
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, PICTURE_WAIT);
    void Promise.all(pictures.map((image) => image.decode().catch(() => undefined))).then(() => {
      window.clearTimeout(timer);
      resolve();
    });
  });
}

/** The pages' openings, which rise into place as a page first loads (shop.css). */
const OPENINGS = new Set(["tm-rise", "tm-appear"]);

/**
 * A page arriving by a glide or a dissolve is drawn whole: the step is its entrance, so its opening's own rise is
 * finished at once instead of playing again under the moving page, where it showed as a pale page sliding in. A page
 * loaded afresh still rises.
 */
function settleOpenings() {
  if (typeof CSSAnimation === "undefined") return;
  for (const animation of document.getAnimations()) {
    if (!(animation instanceof CSSAnimation) || !OPENINGS.has(animation.animationName)) continue;
    try {
      animation.finish();
    } catch {
      // One that can't be finished (none of the openings repeat) plays as it would.
    }
  }
}

/** A page's code, or CODE_WAIT, whichever comes first. */
function codeFor(path: string): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, CODE_WAIT);
    void readyPage(path).then(() => {
      window.clearTimeout(timer);
      resolve();
    });
  });
}

/** The site's history, once its router has made it: a page's own way back steps back through it. */
let site: History | null = null;
/** Each entry pushed this visit, by its key, and the page it was pushed from (its path within the site, and search). */
const pushedFrom = new Map<string, { pathname: string; search: string }>();
/** A page's own way back has asked for the next step back to glide (see stepBack), until this time (performance.now()). */
let glideBackUntil = 0;

/**
 * React Router's history, with forward navigation run inside a view transition.
 * The address changes inside the transition, after the old page is captured, and the new page
 * renders in that same step, so nothing on screen moves until the glide begins. Back and
 * forward render at once, so the right page is in place before the browser paints or lifts
 * Safari's swipe picture.
 *
 * A glide waits for its page's code first (the page being left stays as it is, and can still be scrolled), and once the
 * page is drawn, briefly, for the pictures on its first screen: the page arrives whole, never empty or filling in.
 *
 * A page's own way back (stepBack) glides too, the push reversed: the step back is drawn inside a view transition the
 * moment it arrives, as a step forward is, so the page it returns to is drawn and placed where it was left in one go.
 */
function gliding(history: History, kind: "browser" | "hash", basename = "/"): History {
  const listen = history.listen.bind(history);
  const push = history.push.bind(history);
  const base = basename.replace(/\/$/, "");
  const bare = (pathname: string) => (base && pathname.startsWith(base) ? pathname.slice(base.length) || "/" : pathname);
  let inside = false;
  let pending: string | null = null;
  let shown = { key: history.location.key, pathname: bare(history.location.pathname), search: history.location.search };

  history.listen = (listener: Listener) =>
    listen((update) => {
      // An entry replaced in place (a redirect) was still opened from where it was.
      const opener = update.action === "PUSH" ? { pathname: shown.pathname, search: shown.search } : update.action === "REPLACE" ? pushedFrom.get(shown.key) : undefined;
      if (opener) pushedFrom.set(update.location.key, opener);
      const left = shown;
      shown = { key: update.location.key, pathname: bare(update.location.pathname), search: update.location.search };
      if (update.action === "POP") {
        // A step back or forward replaces a step forward still waiting for its page.
        pending = null;
        setStepWaiting(false);
        const owned = popHook?.({ location: update.location, uaTransition }) ?? false;
        const asked = performance.now() < glideBackUntil || (!phoneWidth() && glides(left.pathname, shown.pathname));
        const glide = asked && !uaTransition && !owned;
        glideBackUntil = 0;
        uaTransition = false;
        if (glide && glideBack(() => flushSync(() => listener(update)))) return;
      }
      if (inside || update.action === "POP") {
        flushSync(() => listener(update));
        return;
      }
      // As the router does by default: the page shown stays until the next one is ready.
      startTransition(() => listener(update));
    });

  history.push = (to, state) => {
    const next = typeof to === "string" ? parsePath(to) : to;
    const target = `${next.pathname ?? history.location.pathname}${next.search ?? ""}`;
    const from = bare(history.location.pathname);
    const into = bare(next.pathname ?? history.location.pathname);
    // The opening's camera move draws its own way in (src/brand/flight.ts).
    if ((state as { flight?: unknown } | null | undefined)?.flight || !glides(from, into)) {
      pending = null;
      setStepWaiting(false);
      push(to, state);
      return;
    }
    // A second tap while the first is still on its way is the same tap.
    if (pending === target) return;
    const card = tappedFor(into);
    pending = target;
    // What is open over the page holds still until the page is taken for the step, and goes with it (stepping.ts).
    setStepWaiting(true);
    void codeFor(into).then(() => {
      // Another step has been taken meanwhile: it replaces this one.
      if (pending !== target) return;
      unname();
      const vial = departVial(card);
      try {
        const transition = document.startViewTransition(() => {
          const scrolledFrom = window.scrollY;
          pending = null;
          setStepWaiting(false);
          inside = true;
          try {
            push(to, state);
          } finally {
            inside = false;
          }
          arriveVial(vial);
          settleOpenings();
          return firstScreen(scrolledFrom);
        });
        transition.ready.catch(() => undefined);
        transition.updateCallbackDone.catch(() => undefined);
        transition.finished.catch(() => undefined).finally(unname);
        drawingStep(transition.finished);
      } catch {
        pending = null;
        setStepWaiting(false);
        inside = false;
        unname();
        push(to, state);
      }
    });
  };

  readyOnIntent((url) => {
    if (url.origin !== window.location.origin) return null;
    if (kind === "hash") return url.pathname === window.location.pathname && url.hash.startsWith("#/") ? url.hash.slice(1) : null;
    return bare(url.pathname);
  });
  site = history;
  return history;
}

let intentWatched = false;
/**
 * A page is readied the moment a link to it is pointed at, pressed or reached by keyboard: its click comes a moment
 * later, and by then its code has usually arrived.
 */
function readyOnIntent(pathOf: (url: URL) => string | null) {
  if (intentWatched) return;
  intentWatched = true;
  const readied = new WeakSet<Element>();
  const ready = (event: Event) => {
    if (event.type === "pointerover" && (event as PointerEvent).pointerType !== "mouse") return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!link || readied.has(link) || (link.target && link.target !== "_self")) return;
    readied.add(link);
    let url: URL;
    try {
      url = new URL(link.href);
    } catch {
      return;
    }
    const path = pathOf(url);
    if (path) void readyCode(path).catch(() => readied.delete(link));
  };
  for (const type of ["pointerdown", "pointerover", "focusin"]) document.addEventListener(type, ready, { capture: true, passive: true });
}

/** Whether the entry before this one is `pathname` (with any search): the page this one was opened from. */
export function openedFrom(key: string, pathname: string): boolean {
  return pushedFrom.get(key)?.pathname === pathname;
}

/**
 * One step back, as a page's own way back takes it (Product's "The collection", when the collection is where the
 * product was opened from), to the page as it was left. On a phone the page slides away to the right and uncovers the
 * one before it: the push, reversed, as an iPhone's back button does it. Wider screens dissolve back, as every step does
 * there; with Reduce Motion the page changes at once.
 */
export function stepBack() {
  if (!site) {
    window.history.back();
    return;
  }
  if (phoneWidth() && canGlide()) glideBackUntil = performance.now() + BACK_WAIT;
  site.go(-1);
}

/**
 * The step back drawn inside a view transition, as the router draws it (`draw`); false if it can't glide. It is drawn
 * as the step arrives, not from a transition begun before it: iPhone Safari, while a transition waits, shows the page
 * being left scrolled at once to wherever the next one stands, and a page returned to where it was left showed a blank
 * frame as it uncovered. For the same reason the browser's own return to the place, which follows the step, is held off
 * for this one step (the setting belongs to the entry stepped back to, current by now): iPhone Safari made it on the page
 * being left, before the slide. ScrollMemory puts the page in its place inside the transition instead, and the browser
 * keeps its own memory for every other step, as Safari's swipe back needs it to.
 */
function glideBack(draw: () => void): boolean {
  const root = document.documentElement;
  const browserPlaces = () => {
    window.history.scrollRestoration = "auto";
  };
  root.dataset.glide = "back";
  window.history.scrollRestoration = "manual";
  try {
    const transition = document.startViewTransition(() => {
      browserPlaces();
      const scrolledFrom = window.scrollY;
      draw();
      settleOpenings();
      return firstScreen(scrolledFrom);
    });
    transition.ready.catch(() => undefined);
    transition.updateCallbackDone.catch(() => undefined);
    transition.finished
      .catch(() => undefined)
      .finally(() => {
        browserPlaces();
        delete root.dataset.glide;
      });
    drawingStep(transition.finished);
    return true;
  } catch {
    browserPlaces();
    delete root.dataset.glide;
    return false;
  }
}

function useGlidingHistory(kind: "browser" | "hash", basename?: string) {
  const [history] = useState(() =>
    gliding(kind === "hash" ? createHashHistory({ window, v5Compat: true }) : createBrowserHistory({ window, v5Compat: true }), kind, kind === "browser" ? basename : undefined),
  );
  return history;
}

/** React Router's BrowserRouter, with pages that glide forward. */
export function GlidingBrowserRouter({ basename, children }: { basename?: string; children: ReactNode }) {
  const history = useGlidingHistory("browser", basename);
  return (
    <HistoryRouter history={history} basename={basename} useTransitions={false}>
      {children}
    </HistoryRouter>
  );
}

/** React Router's HashRouter, with pages that glide forward. */
export function GlidingHashRouter({ basename, children }: { basename?: string; children: ReactNode }) {
  const history = useGlidingHistory("hash");
  return (
    <HistoryRouter history={history} basename={basename} useTransitions={false}>
      {children}
    </HistoryRouter>
  );
}

/* ---------- Where each page was left ---------- */

const SAVED = "tm-scroll-positions";
const INPUT = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
const positions = new Map<string, number>();
let currentKey: string | null = null;
let stopRestoring: (() => void) | null = null;

// Pull to refresh keeps the place too. The browser keeps its own scroll memory as well: Safari
// shows its picture of the previous page during a swipe back only while it does.
if (typeof window !== "undefined") {
  try {
    for (const [key, y] of JSON.parse(sessionStorage.getItem(SAVED) ?? "[]") as [string, number][]) positions.set(key, y);
  } catch {
    /* A fresh start. */
  }
}

const jump = (y: number) => window.scrollTo({ top: y, behavior: "instant" });

/** An entry whose place a camera move keeps (src/brand/flight.ts): the move scrolls the window to the top while it
 *  holds the page where it was, so that scroll isn't the reader's and isn't recorded for it. */
let pinned: string | null = null;
/** Keep the place a page was left at for its history entry, as a camera move takes the window to the top. */
export function keepScroll(key: string, y: number) {
  positions.set(key, y);
  pinned = key;
}
/** The move has landed its page where it was kept: the reader's scroll is theirs again. */
export function releaseScroll() {
  pinned = null;
}
/** The place a history entry's page was left at, if it is known. */
export const scrollFor = (key: string) => positions.get(key);
/** Where a page drawing for the first time now will stand once ScrollMemory has put it back (read before it has): the
 *  place a reload, a return from another site or a step back keeps for its entry, or its top. vite.config.ts startHead
 *  reads the same place for the page's first paint. */
export function placeOnOpening(key: string): number {
  if (currentKey === null && !returning()) return 0;
  return positions.get(key) ?? 0;
}
/** The input that ends a wait for a place: whatever the reader does first wins. */
export const READER_INPUT = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

/** A reload, or a return from another site, comes back to a page's place; a fresh visit starts at the top. */
function returning() {
  const entry = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  return entry?.type === "reload" || entry?.type === "back_forward";
}

const room = () => document.documentElement.scrollHeight - window.innerHeight;

/**
 * Return to a remembered place. A page whose content is still arriving (the shop checks the
 * session first) is too short to stand there yet: iPhone Safari would report the jump as made
 * and then quietly settle at the top. So the jump waits until the page is tall enough, and the
 * place counts as reached only once it has held for a few frames.
 */
function restore(y: number) {
  const started = performance.now();
  let frame = 0;
  let held = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    for (const type of INPUT) window.removeEventListener(type, stop);
    stopRestoring = null;
    if (currentKey) positions.set(currentKey, Math.round(window.scrollY));
  };
  const step = () => {
    if (room() >= y - 1) {
      if (Math.abs(window.scrollY - y) > 1) {
        jump(y);
        held = 0;
      } else held += 1;
    }
    if (held >= 3) return stop();
    if (performance.now() - started > 2500) {
      // The page never grew that tall: stand as near as it allows.
      jump(Math.min(y, Math.max(0, room())));
      return stop();
    }
    frame = requestAnimationFrame(step);
  };
  // Already tall enough, as on a swipe back: the page is in place before it is painted. Placed once the page has laid
  // itself out (its own layout effects measure it and draw it again, as the opening does its room), still before it is
  // painted: placed before that, the browser kept what was on screen as the page above it grew, so the page first
  // showed a little off, then jumped into place.
  queueMicrotask(() => {
    if (stopRestoring === stop && room() >= y - 1) jump(y);
  });
  // Whatever the reader does first wins.
  for (const type of INPUT) window.addEventListener(type, stop, { passive: true });
  stopRestoring = stop;
  frame = requestAnimationFrame(step);
}

/**
 * Back and forward return to exactly where each page was left, even when its content arrives
 * after the browser's own attempt; a new page opens at its top (or at its section, or where it
 * asked to stay with `keepScroll`). Search and filter changes keep the place.
 */
export function ScrollMemory() {
  const location = useLocation();
  const action = useNavigationType();
  const shownPath = useRef<string | null>(null);

  useEffect(() => {
    // While a place is being restored the page may pass through others; only where it settles counts.
    // A page held still under a sheet keeps the place it had (the keyboard may move it meanwhile).
    const record = () => {
      if (currentKey && currentKey !== pinned && !stopRestoring && !document.documentElement.hasAttribute("data-scroll-locked")) positions.set(currentKey, Math.round(window.scrollY));
    };
    const save = () => {
      try {
        sessionStorage.setItem(SAVED, JSON.stringify([...positions].slice(-50)));
      } catch {
        /* Places are kept for this visit only. */
      }
    };
    window.addEventListener("scroll", record, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("scroll", record);
      window.removeEventListener("pagehide", save);
    };
  }, []);

  // A layout effect, so the page is in place before it is painted or captured for a glide.
  useLayoutEffect(() => {
    // Any restore still running belongs to the page being left: it settles under that page's key.
    stopRestoring?.();
    const before = shownPath.current;
    shownPath.current = location.pathname;
    currentKey = location.key;
    if (pinned !== location.key) pinned = null;
    if (action === "POP" && heldPop === location.key) {
      // A camera move took this step back: it lands the page at its top itself.
      heldPop = null;
      return;
    }
    if (action === "POP") {
      const y = before === null && !returning() ? undefined : positions.get(location.key);
      if (y !== undefined) restore(y);
      else if (before !== null && before !== location.pathname) jump(0);
      return;
    }
    if (before === location.pathname || location.hash) return;
    if ((location.state as { keepScroll?: boolean } | null)?.keepScroll) return;
    jump(0);
    // Only a change of entry moves the page; the rest is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  return null;
}
