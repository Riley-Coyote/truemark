import { useSyncExternalStore } from "react";

/**
 * A step forward waiting to be drawn (Navigation.tsx): from the tap that asks for it until the page being left has been
 * taken for its glide or dissolve. What was open over that page (the menu, search, the bag, the offer) holds still
 * meanwhile, as the tap left it, and leaves with the page (shop/motion.ts usePresence). Begun on its way out instead, it
 * was taken halfway gone: on an iPhone the panel vanished at the tap, then came back whole on the page sliding away.
 */
let waiting = false;
const listeners = new Set<() => void>();

export function setStepWaiting(now: boolean) {
  if (now === waiting) return;
  waiting = now;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether a step forward is waiting to be drawn. */
export function useStepWaiting(): boolean {
  return useSyncExternalStore(subscribe, () => waiting, () => false);
}

/**
 * Page changes being drawn (Navigation.tsx): from a step's start until its glide or dissolve is done. What shows up
 * meanwhile shows up whole (shop/motion.ts useReveal). On an iPhone a fade begun inside the change showed whole while
 * the change ran, then started again from nothing once it was done: the lot's certificate blinked as it arrived.
 */
let drawing = 0;

export function drawingStep(finished: Promise<unknown>) {
  drawing += 1;
  void finished.catch(() => undefined).finally(() => {
    drawing -= 1;
  });
}

/** Whether a page change is being drawn now. */
export function stepDrawing(): boolean {
  return drawing > 0;
}
