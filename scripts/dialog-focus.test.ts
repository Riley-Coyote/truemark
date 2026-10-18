import assert from "node:assert/strict";
import { test } from "node:test";
import { cycleDialogFocus } from "../src/focus";

function fixture() {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const doc = { activeElement: null as unknown };
  for (const [key, value] of Object.entries({ document: doc, getComputedStyle: (el: { visibility: string }) => ({ visibility: el.visibility }) })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const node = (name: string, options = {}) => ({ name, tabIndex: 0, disabled: false, inert: false, shown: true, visibility: "visible",
    matches() { return this.disabled; }, closest() { return this.inert ? {} : null; },
    getClientRects() { return this.shown ? [{}] : []; }, focus() { doc.activeElement = this; }, ...options });
  const items = [node("close"), node("input"), node("submit"), node("result")];
  const root = { querySelectorAll: () => items, focus() { doc.activeElement = root; } };
  const press = (shiftKey = false, defaultPrevented = false) => {
    const event = { key: "Tab", shiftKey, defaultPrevented, preventDefault() { this.defaultPrevented = true; } };
    cycleDialogFocus(root as unknown as HTMLElement, event as KeyboardEvent);
    return event.defaultPrevented;
  };
  return { doc, node, items, root, press, close() { for (const [key, descriptor] of originals) descriptor ? Object.defineProperty(globalThis, key, descriptor) : Reflect.deleteProperty(globalThis, key); } };
}

test("Shift+Tab from a field reaches Close even when native navigation skips buttons", () => {
  const f = fixture(); try { f.doc.activeElement = f.items[1]; assert.equal(f.press(true), true); assert.equal(f.doc.activeElement, f.items[0]); } finally { f.close(); }
});
test("every Tab step is handled and both ends wrap within the dialog", () => {
  const f = fixture(); try {
    f.doc.activeElement = f.items[0];
    for (const expected of [...f.items.slice(1), f.items[0]]) { assert.equal(f.press(), true); assert.equal(f.doc.activeElement, expected); }
    f.press(true); assert.equal(f.doc.activeElement, f.items.at(-1));
  } finally { f.close(); }
});
test("disabled, inert, hidden and explicitly untabbable controls are skipped", () => {
  const f = fixture(); try {
    f.items.splice(1, 0, f.node("disabled", { disabled: true }), f.node("inert", { inert: true }), f.node("hidden", { visibility: "hidden" }), f.node("none", { shown: false }), f.node("negative", { tabIndex: -1 }));
    f.doc.activeElement = f.items[0]; f.press(); assert.equal((f.doc.activeElement as { name: string }).name, "input");
  } finally { f.close(); }
});
test("focus outside enters at the right end and an empty dialog keeps focus", () => {
  const f = fixture(); try {
    f.press(true); assert.equal(f.doc.activeElement, f.items.at(-1));
    f.items.length = 0; f.press(); assert.equal(f.doc.activeElement, f.root);
  } finally { f.close(); }
});
test("an already-handled key is left to the focused component", () => {
  const f = fixture(); try { f.doc.activeElement = f.items[1]; f.press(false, true); assert.equal(f.doc.activeElement, f.items[1]); } finally { f.close(); }
});
