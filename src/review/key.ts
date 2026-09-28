/**
 * The review key: Riley sends a link ending `#/review?key=<key>`. The key sits in the part of
 * the address that is never sent to a server; the layer keeps it on this device and removes
 * it from the address bar. Holding the key is what lets notes be shared.
 */

const STORAGE = "tm-review-key";
const MAX_LENGTH = 512;

/** The key this browser holds, if any. */
export function storedKey(): string | null {
  try {
    const key = localStorage.getItem(STORAGE)?.trim();
    return key ? key : null;
  } catch {
    return null;
  }
}

export function storeKey(key: string) {
  try {
    localStorage.setItem(STORAGE, key);
  } catch {
    /* Without storage the key still works for this visit. */
  }
}

/** A key carried by the route's own query (`?key=…`), cleaned; null when there is none. */
export function keyFromSearch(search: string): string | null {
  const key = new URLSearchParams(search).get("key")?.trim();
  return key && key.length <= MAX_LENGTH ? key : null;
}

/** True when the address holds a key (read before the layer has loaded and removed it). */
export function keyInAddress(): boolean {
  if (typeof window === "undefined") return false;
  const hashQuery = window.location.hash.includes("?") ? window.location.hash.slice(window.location.hash.indexOf("?")) : "";
  return Boolean(keyFromSearch(window.location.search) || keyFromSearch(hashQuery));
}

/**
 * The review's live channel: "review:" and the first 20 hex characters of the key's SHA-256,
 * so only people holding the key can find it (and names never sit on a guessable channel).
 */
export async function channelFor(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `review:${hex.slice(0, 20)}`;
}
