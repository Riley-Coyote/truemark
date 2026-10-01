import { storageKey } from "../mode";
export const STORE_CHANGE = "tm-live-store-change";
export const worldNow = () => new Date().toISOString();
export const changed = () => window.dispatchEvent(new CustomEvent(STORE_CHANGE));
export function read<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(storageKey(key)); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
}
export function write(key: string, value: unknown) {
  try { localStorage.setItem(storageKey(key), JSON.stringify(value)); } catch { /* Optional UI preferences. */ }
  changed();
}
