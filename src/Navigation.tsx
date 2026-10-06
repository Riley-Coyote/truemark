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
import "./navigation.css";

type History = ReturnType<typeof createBrowserHistory>;
type Listener = Parameters<History["listen"]>[0];

/* ---------- Moving forward ---------- */

const VIAL = "tm-vial";
const matches = (query: string) => typeof window.matchMedia === "function" && window.matchMedia(query).matches;
const motionAllowed = () => !matches("(prefers-reduced-motion: reduce)");
/** Phones push every page in; wider screens change pages at once, as pages do, and only a tapped vial travels. */
const phoneWidth = () => matches("(max-width: 760px)");

/** The site's areas. The command center and the partner portal keep their own frame; the partner program loads on its own. */
function areaOf(path: string) {
  if (/^\/admin(\/|$)/.test(path)) return "admin";
  if (/^\/partners\/app(\/|$)/.test(path)) return "portal";
  if (/^\/partners(\/|$)/.test(path)) return "partners";
  return "shop";
}

/**
 * Going forward to another page glides. Filters, the account's own tabs, redirects and every
 * way back change in place: Safari animates its own swipe back, and its toolbar back is
 * instant on every site. (Wider screens glide only to carry a tapped vial; see push below.)
 */
function glides(from: string, to: string): boolean {
  if (typeof document.startViewTransition !== "function" || document.visibilityState === "hidden" || !motionAllowed()) return false;
  if (from === to) return false;
  const area = areaOf(from);
  if (area !== areaOf(to) || area === "admin" || area === "portal") return false;
  // The account's sections are siblings: they switch in place. Going deeper (an order) still glides.
  if (from.startsWith("/account") && to.startsWith("/account") && !to.startsWith(`${from}/`)) return false;
  return true;
}

let tapped: { id: string; element: HTMLElement; at: number } | null = null;
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

/** Before the change: the vial just tapped, if this is its product page and it is in view. */
function departVial(to: string): string | null {
  const card = tapped;
  tapped = null;
  if (!card || performance.now() - card.at > 1000 || productOf(to) !== card.id || !card.element.isConnected || !onScreen(card.element)) return null;
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
 * React Router's history, with forward navigation run inside a view transition.
 * The address changes inside the transition, after the old page is captured, and the new page
 * renders in that same step, so nothing on screen moves until the glide begins. Back and
 * forward render at once, so the right page is in place before the browser paints or lifts
 * Safari's swipe picture.
 */
function gliding(history: History, basename = "/"): History {
  const listen = history.listen.bind(history);
  const push = history.push.bind(history);
  const base = basename.replace(/\/$/, "");
  const bare = (pathname: string) => (base && pathname.startsWith(base) ? pathname.slice(base.length) || "/" : pathname);
  let inside = false;
  let pending: string | null = null;

  history.listen = (listener: Listener) =>
    listen((update) => {
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
    if (!glides(from, into)) {
      push(to, state);
      return;
    }
    // A second tap while the first is still on its way is the same tap.
    if (pending === target) return;
    pending = target;
    unname();
    const vial = departVial(into);
    if (!vial && !phoneWidth()) {
      pending = null;
      push(to, state);
      return;
    }
    try {
      const transition = document.startViewTransition(() => {
        pending = null;
        inside = true;
        try {
          push(to, state);
        } finally {
          inside = false;
        }
        arriveVial(vial);
      });
      transition.ready.catch(() => undefined);
      transition.updateCallbackDone.catch(() => undefined);
      transition.finished.catch(() => undefined).finally(unname);
    } catch {
      pending = null;
      inside = false;
      unname();
      push(to, state);
    }
  };
  return history;
}

function useGlidingHistory(kind: "browser" | "hash", basename?: string) {
  const [history] = useState(() =>
    gliding(kind === "hash" ? createHashHistory({ window, v5Compat: true }) : createBrowserHistory({ window, v5Compat: true }), kind === "browser" ? basename : undefined),
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
  // Already tall enough, as on a swipe back: the page is in place before it is painted.
  if (room() >= y - 1) jump(y);
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
      if (currentKey && !stopRestoring && !document.documentElement.hasAttribute("data-scroll-locked")) positions.set(currentKey, Math.round(window.scrollY));
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
