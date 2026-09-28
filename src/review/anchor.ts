/**
 * Finding a spot on the page, and finding it again. A note remembers a selector for the
 * element that was clicked, where inside it the click landed (as fractions of its box) and
 * the element's text, so it can be found again if the page changes around it.
 */
import type { Anchor } from "./types";

export const LAYER_ROOT = "rl-root";

export function inLayer(node: Node | null): boolean {
  const el = node instanceof Element ? node : node?.parentElement ?? null;
  return Boolean(el?.closest(`.${LAYER_ROOT}`));
}

const tag = (el: Element) => el.tagName.toLowerCase();

/** Visible text (or the image's description), collapsed and trimmed, as a fingerprint. */
export function textOf(el: Element): string {
  const own = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  const text = own || el.getAttribute("alt") || el.getAttribute("aria-label") || el.getAttribute("title") || "";
  return text.slice(0, 160);
}

/** Ids React generates (":r3:", "«r3»") change between renders; they never anchor a note. */
function stableId(id: string): boolean {
  return Boolean(id) && id.length <= 64 && !/[:«»\s]/.test(id) && !/^\d/.test(id);
}

/** Classes that describe a moment (is-visible, active, open…) rather than the element. */
const STATE =
  /(^|[-_])(is|has)[-_]|active|current|selected|open|closed|expanded|collapsed|visible|hidden|show|hover|focus|pressed|checked|disabled|loading|reveal|animat|enter|leave|in-view|dragging|playing/i;

function stableClass(el: Element): string | null {
  for (const name of Array.from(el.classList)) {
    if (!STATE.test(name) && /^[a-z_-][\w-]*$/i.test(name)) return name;
  }
  return null;
}

function step(el: Element): string {
  const cls = stableClass(el);
  let part = cls ? `${tag(el)}.${CSS.escape(cls)}` : tag(el);
  const parent = el.parentElement;
  if (parent) {
    const same = Array.from(parent.children).filter((child) => child.tagName === el.tagName);
    if (same.length > 1) part += `:nth-of-type(${same.indexOf(el) + 1})`;
  }
  return part;
}

/** The closest element carrying `data-review`, looking at most three levels up. */
function reviewAncestor(el: Element): Element | null {
  let node: Element | null = el;
  for (let level = 0; node && level <= 3; level += 1) {
    if (node.hasAttribute("data-review")) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * The selector for an element: its `data-review` spot (itself or within three levels up);
 * else its own id; else a tag + class + position path up to the nearest id or `main`, at
 * most eight steps. The element's tag always leads the last step, so a text search can
 * look among elements of the same kind if the selector stops matching.
 */
export function selectorFor(target: Element): { element: Element; selector: string } {
  const review = reviewAncestor(target);
  if (review) {
    return { element: review, selector: `${tag(review)}[data-review="${CSS.escape(review.getAttribute("data-review") ?? "")}"]` };
  }
  if (target.id && stableId(target.id)) return { element: target, selector: `${tag(target)}#${CSS.escape(target.id)}` };
  const steps: string[] = [];
  let node: Element | null = target;
  while (node && steps.length < 8) {
    if (node !== target && node.id && stableId(node.id)) {
      steps.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    if (node !== target && (tag(node) === "main" || node === document.body)) {
      steps.unshift(tag(node));
      break;
    }
    steps.unshift(step(node));
    node = node.parentElement;
  }
  return { element: target, selector: steps.join(" > ") };
}

/** SVG innards and icon-only children anchor to something a person would name. */
export function meaningfulTarget(el: Element): Element {
  let node: Element = el;
  if (node instanceof SVGElement) {
    const svg = node instanceof SVGSVGElement ? node : node.ownerSVGElement ?? node.closest("svg");
    if (svg) node = svg;
    const parent = node.parentElement;
    if (parent && (parent.matches("a, button, label, [role='button']") || !textOf(node))) node = parent;
  }
  return node;
}

/** The page element under a point, ignoring the review layer itself. */
export function elementAt(x: number, y: number): Element | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (inLayer(el)) continue;
    if (el === document.documentElement) return null;
    return meaningfulTarget(el);
  }
  return null;
}

export function anchorFor(target: Element, x: number, y: number): { element: Element; anchor: Anchor } {
  const { element, selector } = selectorFor(target);
  const rect = element.getBoundingClientRect();
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return {
    element,
    anchor: {
      selector,
      dx: rect.width ? clamp((x - rect.left) / rect.width) : 0.5,
      dy: rect.height ? clamp((y - rect.top) / rect.height) : 0.5,
      text: textOf(element),
      viewport: { w: window.innerWidth, h: window.innerHeight },
      breakpoint: window.innerWidth <= 640 ? "mobile" : "desktop",
    },
  };
}

function queryAll(selector: string): Element[] {
  try {
    return Array.from(document.querySelectorAll(selector)).filter((el) => !inLayer(el));
  } catch {
    return [];
  }
}

/** Pick among several matches by the remembered text. */
function choose(candidates: Element[], text: string): Element | null {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  return candidates.find((el) => textOf(el) === text) ?? candidates[0];
}

/**
 * Find a note's element again: by its selector; then by the same `data-review` spot or id
 * under any tag; then by its text among elements of the same kind. Null means the spot
 * has moved.
 */
export function resolveAnchor(anchor: Anchor): Element | null {
  const direct = choose(queryAll(anchor.selector), anchor.text);
  if (direct) return direct;
  const last = anchor.selector.split(">").pop()?.trim() ?? "";
  const loose = last.match(/^[a-z][a-z0-9-]*((\[data-review=.+\])|(#.+))$/i);
  if (loose) {
    const found = choose(queryAll(loose[1]), anchor.text);
    if (found) return found;
  }
  const kind = last.match(/^[a-z][a-z0-9-]*/i)?.[0];
  if (kind && anchor.text) {
    const match = Array.from(document.getElementsByTagName(kind)).find((el) => !inLayer(el) && textOf(el) === anchor.text);
    if (match) return match;
  }
  return null;
}

/** The first visible element carrying a question's `data-review` spot. */
export function questionSpot(id: string): Element | null {
  const all = queryAll(`[data-review="${CSS.escape(id)}"]`);
  return all.find((el) => el.getClientRects().length > 0) ?? null;
}

/** A plain word for what the pointer is over, shown beside the outline in comment mode. */
export function kindOf(el: Element): string {
  const t = tag(el);
  if (/^h[1-6]$/.test(t)) return "Heading";
  if (t === "img" || t === "picture" || t === "video") return "Image";
  if (t === "svg" || t === "canvas") return "Graphic";
  if (t === "a") return "Link";
  if (t === "button" || el.getAttribute("role") === "button") return "Button";
  if (t === "input" || t === "select" || t === "textarea") return "Field";
  if (t === "label") return "Label";
  if (t === "ul" || t === "ol" || t === "dl" || el.getAttribute("role") === "list") return "List";
  if (t === "li" || t === "dt" || t === "dd" || el.getAttribute("role") === "listitem") return "List item";
  if (t === "table") return "Table";
  if (t === "tr" || t === "td" || t === "th") return "Table cell";
  if (t === "p" || t === "span" || t === "strong" || t === "em" || t === "small" || t === "blockquote") return "Text";
  if (t === "nav") return "Navigation";
  if (t === "header") return "Header";
  if (t === "footer") return "Footer";
  if (t === "form" || t === "fieldset") return "Form";
  if (t === "figure") return "Figure";
  if (t === "section" || t === "article" || t === "aside" || t === "main") return "Section";
  return "Area";
}
