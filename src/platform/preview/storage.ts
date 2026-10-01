import { LIVE } from "../mode";
/**
 * The preview's persistence: localStorage, read and written as JSON. Every write
 * tells this tab's screens to refresh (`tm-store-change`); a write in another tab
 * or frame arrives here as a `storage` event and is passed on the same way, so
 * every open view of the preview stays current.
 */
import { TODAY } from "../seed";

export const STORE_CHANGE = "tm-store-change";

/**
 * "Now" inside the sample world. The sample data runs to TODAY (25 Sep 2026), so
 * anything done in the preview happens on that day, and every "this month" and
 * "last 30 days" figure includes it. The time runs within the afternoon (UTC), so
 * the day reads as 25 September in every US time zone, and keeps moving forward
 * as the real clock does (it wraps every seven hours).
 */
export function worldNow(): string {
  const [y, m, d] = TODAY.split("-").map(Number);
  const span = 7 * 3_600_000;
  return new Date(Date.UTC(y, m - 1, d, 15) + (Date.now() % span)).toISOString();
}

export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* The preview keeps working without storage; changes simply won't persist. */
  }
  window.dispatchEvent(new CustomEvent(STORE_CHANGE, { detail: key }));
}

if (!LIVE) window.addEventListener("storage", (event) => {
  if (event.key === null || event.key.startsWith("tm-preview")) {
    window.dispatchEvent(new CustomEvent(STORE_CHANGE, { detail: event.key }));
  }
});
