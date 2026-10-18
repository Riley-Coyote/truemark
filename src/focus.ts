/** Keep dialog keyboard navigation consistent, including Safari's button-skipping default. */
export function cycleDialogFocus(root: HTMLElement, event: KeyboardEvent) {
  if (event.key !== "Tab" || event.defaultPrevented) return;
  const items = Array.from(root.querySelectorAll<HTMLElement>(
    'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]',
  )).filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") &&
    !element.closest("[inert]") && element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility === "visible");
  // Positive tab indices precede the document-order controls, as in native traversal.
  items.sort((a, b) => (a.tabIndex || Infinity) - (b.tabIndex || Infinity));
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next = at < 0 ? (event.shiftKey ? items.length - 1 : 0)
    : (at + (event.shiftKey ? -1 : 1) + items.length) % items.length;
  event.preventDefault();
  (items[next] ?? root).focus();
}
