import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { createPortal } from "react-dom";
import { usePrefersReducedMotion } from "./motion";
import "./sheet.css";

/*
 * What every sheet on the site shares: the support chat, the bag and search. On a phone each
 * rises from the bottom like an iPhone sheet, follows the keyboard, holds the page still behind
 * it and can be pulled down to put away; on a wider screen it is a panel or a dialog. Each rule
 * here was learned on the iPhone simulator (memory: ios-safari-navigation-lessons).
 */

/** How long a sheet takes to come and go: --tm-dur-slow, as in the stylesheets. */
export const SHEET_MS = 420;
export const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex="0"]';
const PHONE = "(max-width: 760px)";

export type SheetState = "entering" | "open" | "leaving";
export type Seen = { top: number; height: number; page: number };

/**
 * The part of the screen the reader can actually see. On a phone it shrinks above the keyboard
 * and may be panned, so a sheet follows it: a field always sits just above the keys and nothing
 * of the page shows around it.
 */
export function useVisibleViewport() {
  const read = (): Seen | null => {
    const viewport = window.visualViewport;
    return viewport ? { top: viewport.offsetTop, height: viewport.height, page: viewport.pageTop } : null;
  };
  const [seen, setSeen] = useState(read);
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const measure = () => setSeen(read());
    measure();
    viewport.addEventListener("resize", measure);
    viewport.addEventListener("scroll", measure);
    // Safari does not report its own view moving when the page is put back in place.
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
      window.removeEventListener("scroll", measure);
    };
  }, []);
  return seen;
}

/** The visible screen as the custom properties a sheet's frame is sized by. */
export const viewportBox = (seen: Seen | null, prefix: string): CSSProperties | undefined =>
  seen ? ({ [`--${prefix}-top`]: `${seen.top}px`, [`--${prefix}-height`]: `${seen.height}px` } as CSSProperties) : undefined;

/**
 * The page behind holds still while a sheet is open. Only the document is locked, so the header
 * stays in place. iPhone Safari moves the page to show a field above its keyboard and leaves it
 * there when the keyboard goes; once the screen is back to its full height the page is put back.
 * (Moving it back while the keyboard is up fights Safari, and the page's header lands mid-screen.)
 */
export function useScrollLock() {
  useLayoutEffect(() => {
    const root = document.documentElement, body = document.body;
    const place = window.scrollY, address = window.location.href;
    const gutter = window.innerWidth - root.clientWidth;
    const before = { overflow: root.style.overflow, padding: body.style.paddingRight };
    root.style.overflow = "hidden";
    root.dataset.scrollLocked = "";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;
    const putBack = () => {
      if (Math.abs(window.scrollY - place) > 1) window.scrollTo({ top: place, behavior: "instant" });
    };
    const viewport = window.visualViewport;
    const full = viewport?.height ?? 0;
    const resized = () => {
      if (viewport && viewport.height >= full - 1) putBack();
    };
    viewport?.addEventListener("resize", resized);
    return () => {
      viewport?.removeEventListener("resize", resized);
      root.style.overflow = before.overflow;
      delete root.dataset.scrollLocked;
      body.style.paddingRight = before.padding;
      // Unless the reader followed a link out of the sheet to another page.
      if (window.location.href === address) putBack();
    };
  }, []);
}

/**
 * Arriving and leaving. A sheet enters from off screen (one frame in its starting place, then the
 * move), and asking it to close lets it leave before the owner removes it. Reduce Motion skips both.
 */
export function useSheetPresence(onClose: () => void) {
  const reduced = usePrefersReducedMotion();
  const [state, setState] = useState<SheetState>(reduced ? "open" : "entering");
  const finish = useRef(onClose);
  finish.current = onClose;
  const leaving = useRef(false);

  useLayoutEffect(() => {
    if (state !== "entering") return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setState("open"));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
    // Only the first render enters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestClose = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    if (reduced) {
      finish.current();
      return;
    }
    setState("leaving");
    window.setTimeout(() => finish.current(), SHEET_MS);
  }, [reduced]);

  return { state, requestClose };
}

/**
 * Focus while open: where it lands, Escape to close, Tab kept inside, and back where it was after.
 * `field` says when to land in the first field: "always" (search, where typing is the point),
 * "fine" (with a mouse and keyboard only, so a phone's keyboard never rises unasked), or "never"
 * (the sheet itself takes focus).
 */
export function useSheetFocus(panel: RefObject<HTMLElement | null>, onEscape: () => void, field: "always" | "fine" | "never") {
  const escape = useRef(onEscape);
  escape.current = onEscape;
  // A layout effect, so a field can take focus inside the tap that opened the sheet.
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = panel.current;
    if (!root) return;
    const fine = window.matchMedia?.("(pointer: fine)").matches ?? true;
    const target = () => {
      const input = root.querySelector<HTMLElement>("input:not([type=hidden]), textarea");
      return input && (field === "always" || (field === "fine" && fine)) ? input : root;
    };
    // A field focused in the same moment as the tap that opened the sheet brings up an iPhone's
    // keyboard; one focused later does not, so search tries at once and again once it has settled.
    if (field === "always") target().focus({ preventScroll: true });
    const timer = window.setTimeout(() => target().focus({ preventScroll: true }), 60);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        escape.current();
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      previous?.focus?.({ preventScroll: true });
    };
    // Set up once, when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * On a phone a sheet's top can be pulled down to put it away, as on iPhone: it follows the finger,
 * and goes when pulled far enough or flicked; otherwise it settles back. `grabs` says which touches
 * start a pull (its handle and title); controls never do.
 */
export function useSheetDrag(panel: RefObject<HTMLElement | null>, requestClose: () => void, grabs: (target: HTMLElement) => boolean = () => true) {
  const drag = useRef<{ start: number; at: number; distance: number; id: number } | null>(null);
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (event.pointerType === "mouse" || target.closest("button, a, input, select, textarea") || !grabs(target)) return;
    if (!window.matchMedia?.(PHONE).matches || !panel.current) return;
    drag.current = { start: event.clientY, at: performance.now(), distance: 0, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    panel.current.style.transition = "none";
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const moving = drag.current;
    if (!moving || event.pointerId !== moving.id || !panel.current) return;
    moving.distance = Math.max(0, event.clientY - moving.start);
    panel.current.style.transform = `translateY(${moving.distance}px)`;
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const moving = drag.current;
    if (!moving || event.pointerId !== moving.id || !panel.current) return;
    drag.current = null;
    const speed = moving.distance / Math.max(1, performance.now() - moving.at);
    // Clearing the inline styles hands the sheet back to its states, from wherever it was let go.
    panel.current.style.transition = "";
    panel.current.style.transform = "";
    if (moving.distance > 120 || (moving.distance > 40 && speed > 0.5)) requestClose();
  };
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
}

/**
 * iPhone Safari floats its address pill and the keyboard's bar over the page below the part of the
 * screen the reader can see, and shows the page there: fixed layers like a sheet stop at that edge.
 * This strip of paper is part of the page itself and lies just under the sheet (sheet.css), one
 * layer beneath it, so only the sheet's paper continues there.
 */
export function SheetSkirt({ seen, state, layer }: { seen: Seen | null; state: SheetState; layer: number }) {
  if (!seen) return null;
  return createPortal(
    <div className="tm-sheet-skirt" data-state={state} aria-hidden="true" style={{ top: seen.page + seen.height, zIndex: layer - 1 }} />,
    document.body,
  );
}
