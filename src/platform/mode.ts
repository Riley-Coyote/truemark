/** Vite folds this at build time; preview is the default. */
export const LIVE = import.meta.env.VITE_PLATFORM === "live";

/** UI preferences may keep their old names in preview, never in live. */
export function storageKey(previewKey: string): string {
  return LIVE && !previewKey.startsWith("tm-live-") ? `tm-live-${previewKey.replace(/^(tm-preview-|truemark-preview-|tm-)/, "")}` : previewKey;
}
