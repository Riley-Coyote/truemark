/**
 * The review layer, as the rest of the site sees it. The layer itself (and its fonts and
 * Supabase client) loads on its own, after the page.
 */
import { lazy } from "react";

export const ReviewLayer = lazy(() => import("./ReviewLayer"));
export { startReviewing } from "./commands";
export { useReviewStatus } from "./status";
export type { ReviewStatus } from "./status";

/** Inside a frame (the live demo shows the app in frames) there is no review bar or layer. */
export const IN_FRAME: boolean = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
