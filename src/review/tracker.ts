/**
 * Keeps the layer attached to the page. Each tracked thing (a pin, the outline in comment
 * mode, an open thread) names a source that measures where it is now; one animation-frame
 * loop measures every source and tells its listeners only when something moved. The loop
 * runs while anything is tracked and the tab is visible, so pins follow scrolling (of the
 * page or any inner panel), resizing, reveals and re-renders without the page being touched.
 */
import { inLayer } from "./anchor";

export type Spot = { x: number; y: number; rect: DOMRect; visible: boolean };
type Source = () => Spot | null;
type Entry = { source: Source; listeners: Set<(spot: Spot | null) => void>; last: Spot | null };

const entries = new Map<string, Entry>();
let raf = 0;
let top = 0;

const none: Source = () => null;

function same(a: Spot | null, b: Spot | null): boolean {
  if (!a || !b) return a === b;
  const r = (n: number) => Math.round(n * 2);
  return (
    a.visible === b.visible &&
    r(a.x) === r(b.x) &&
    r(a.y) === r(b.y) &&
    r(a.rect.left) === r(b.rect.left) &&
    r(a.rect.top) === r(b.rect.top) &&
    r(a.rect.width) === r(b.rect.width) &&
    r(a.rect.height) === r(b.rect.height)
  );
}

function frame() {
  raf = 0;
  if (document.hidden) return;
  top = document.querySelector(".review-nav")?.getBoundingClientRect().bottom ?? 0;
  for (const entry of entries.values()) {
    const spot = entry.source();
    if (!same(spot, entry.last)) {
      entry.last = spot;
      entry.listeners.forEach((listener) => listener(spot));
    }
  }
  if (entries.size) raf = requestAnimationFrame(frame);
}

function wake() {
  if (!raf && entries.size && !document.hidden) raf = requestAnimationFrame(frame);
}

if (typeof document !== "undefined") document.addEventListener("visibilitychange", wake);

function entry(key: string): Entry {
  let found = entries.get(key);
  if (!found) {
    found = { source: none, listeners: new Set(), last: null };
    entries.set(key, found);
  }
  return found;
}

function prune(key: string) {
  const found = entries.get(key);
  if (found && found.source === none && !found.listeners.size) entries.delete(key);
}

/** Measure `source` every frame under `key`. Returns a function that stops it. */
export function track(key: string, source: Source): () => void {
  const found = entry(key);
  found.source = source;
  wake();
  return () => {
    const current = entries.get(key);
    if (current?.source !== source) return;
    current.source = none;
    current.last = null;
    current.listeners.forEach((listener) => listener(null));
    prune(key);
  };
}

/** Hear where `key` is whenever it moves (and once now). */
export function listen(key: string, listener: (spot: Spot | null) => void): () => void {
  const found = entry(key);
  found.listeners.add(listener);
  listener(found.last);
  wake();
  return () => {
    found.listeners.delete(listener);
    prune(key);
  };
}

export function spotOf(key: string): Spot | null {
  return entries.get(key)?.last ?? null;
}

/** Below the review bar and inside the window. */
function inView(x: number, y: number): boolean {
  return y >= top + 4 && y <= window.innerHeight - 4 && x >= 4 && x <= window.innerWidth - 4;
}

/**
 * Whether the page element itself is what shows at that point: a sticky header, a dialog
 * or a drawer drawn over it hides the pin. The layer's own pieces are looked through.
 */
function uncovered(el: Element, x: number, y: number): boolean {
  for (const hit of document.elementsFromPoint(x, y)) {
    if (inLayer(hit)) continue;
    return hit === el || el.contains(hit) || hit.contains(el);
  }
  return false;
}

/** A point inside an element, as fractions of its box. */
export function spotIn(el: Element | null | undefined, dx: number, dy: number): Spot | null {
  if (!el || !el.isConnected) return null;
  const rect = el.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;
  const x = rect.left + dx * rect.width;
  const y = rect.top + dy * rect.height;
  const px = Math.min(Math.max(x, rect.left + 1), rect.right - 1);
  const py = Math.min(Math.max(y, rect.top + 1), rect.bottom - 1);
  return { x, y, rect, visible: inView(x, y) && uncovered(el, px, py) };
}

/** The top-right corner of an element's content (where a question's "?" sits). */
export function spotAtCorner(el: Element | null | undefined): Spot | null {
  if (!el || !el.isConnected) return null;
  const rect = el.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;
  let right = rect.right;
  let topEdge = rect.top;
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    const content = range.getBoundingClientRect();
    if (content.width && content.height) {
      right = Math.min(content.right, rect.right);
      topEdge = Math.max(content.top, rect.top);
    }
  } catch {
    /* Fall back to the element's own box. */
  }
  const x = Math.min(right + 6, window.innerWidth - 18);
  const y = topEdge + 2;
  const px = Math.min(Math.max(right - 4, rect.left + 1), rect.right - 1);
  const py = Math.min(Math.max(topEdge + 4, rect.top + 1), rect.bottom - 1);
  return { x, y, rect, visible: inView(x, y) && uncovered(el, px, py) };
}

/** An element's box, for outlines; visible while any of it is on screen. */
export function spotBox(el: Element | null | undefined): Spot | null {
  if (!el || !el.isConnected) return null;
  const rect = el.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;
  const visible = rect.bottom > top && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
  return { x: rect.left, y: rect.top, rect, visible };
}
