export const SHELF_INTERVAL = 3600;
export const SHELF_TOUCH_PAUSE = 8000;
export const wrapShelf = (index: number, length: number) => (index + length) % length;
export function shelfOffset(index: number, front: number, length: number) {
  return ((index - front + length + Math.floor(length / 2)) % length) - Math.floor(length / 2);
}
export function canTurnShelf(state: { mobile: boolean; reduced: boolean; visible: boolean; hidden: boolean; focused: boolean; touchedUntil: number }, now: number) {
  return state.mobile && !state.reduced && state.visible && !state.hidden && !state.focused && now >= state.touchedUntil;
}
