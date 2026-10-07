/**
 * The shelf, arranged by category colour as the brand guide asks for group shots, held
 * between two vials of the brand purple. Only lots that tested at 99% or better by HPLC
 * stand here: the trace beneath says so (scripts/hero-shelf.test.ts checks it).
 */
export const shelfIds = [
  "semaglutide-20-mg",
  "ghk-cu-100-mg",
  "nad-500-mg",
  "bpc-157-10-mg",
  "semax-10-mg",
  "tesamorelin-10-mg",
  "retatrutide-10-mg",
];

export const SHELF_INTERVAL = 3600;
export const SHELF_TOUCH_PAUSE = 8000;
export const wrapShelf = (index: number, length: number) => (index + length) % length;
export function shelfOffset(index: number, front: number, length: number) {
  return ((index - front + length + Math.floor(length / 2)) % length) - Math.floor(length / 2);
}
export function canTurnShelf(state: { mobile: boolean; reduced: boolean; visible: boolean; hidden: boolean; focused: boolean; touchedUntil: number }, now: number) {
  return state.mobile && !state.reduced && state.visible && !state.hidden && !state.focused && now >= state.touchedUntil;
}
