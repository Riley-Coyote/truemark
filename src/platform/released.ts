import { content } from "./content";
import { STORE_CHANGE } from "./storage";
import { useResource } from "./store";
import type { Lot } from "./types";

/**
 * Released lots, read once for every view that shows one (each product card, the product page):
 * a single public request however many cards are on screen, made again after the store changes.
 */
let request: Promise<Lot[]> | null = null;
window.addEventListener(STORE_CHANGE, () => {
  request = null;
});

export function releasedLots(): Promise<Lot[]> {
  request ??= content.library().catch((error: unknown) => {
    request = null;
    throw error;
  });
  return request;
}

export const useReleasedLots = () => useResource(releasedLots);
