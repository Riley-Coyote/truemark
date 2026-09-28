/**
 * Where the review stands, for the review bar: "live" only once the shared notes have loaded
 * and the live channel has joined; "connecting" until then; "local" when notes stay on this
 * device. The layer sets it; the bar (loaded with the page) only reads it.
 */
import { useSyncExternalStore } from "react";
import { keyInAddress, storedKey } from "./key";
import { SUPABASE_CONFIGURED } from "./mode";

export type ReviewStatus = "local" | "connecting" | "live";

let status: ReviewStatus = SUPABASE_CONFIGURED && (storedKey() || keyInAddress()) ? "connecting" : "local";
const listeners = new Set<() => void>();

export function setReviewStatus(next: ReviewStatus) {
  if (next === status) return;
  status = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useReviewStatus(): ReviewStatus {
  return useSyncExternalStore(subscribe, () => status, () => status);
}
