import { storageKey } from "../mode";
import { products, setCategories } from "../../data";
import { live, initialize } from "./runtime";

let loadedAccess: "showcase" | "full" = "showcase";
export const catalogAccess = () => loadedAccess;
export function catalogReloadNeeded(access: "showcase" | "full", signedIn: boolean, gated: boolean,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">): boolean {
  if (access === "full") { storage.removeItem("tm-catalog-reload"); return false; }
  if (!signedIn || !gated || storage.getItem("tm-catalog-reload") === "1") return false;
  storage.setItem("tm-catalog-reload", "1");
  return true;
}

const visited = new Set<string>();
const pending = new Map<string, Promise<void>>();
/** Once per browser session/code, with an in-memory fallback when storage is blocked. */
export function rememberLink(raw: string): Promise<void> {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,64}$/.test(code)) return Promise.resolve();
  try { localStorage.setItem(storageKey("tm-preview-ref"), code); } catch { /* Checkout also accepts typed codes. */ }
  const key = storageKey(`tm-live-visit-${code}`);
  let recorded = visited.has(code);
  try { recorded ||= sessionStorage.getItem(key) === "1"; } catch { /* Session memory below. */ }
  if (recorded) return Promise.resolve();
  const running = pending.get(code);
  if (running) return running;
  const work = live().recordVisit(code).then(() => {
    visited.add(code);
    try { sessionStorage.setItem(key, "1"); } catch { /* Session memory still deduplicates. */ }
  }).finally(() => pending.delete(code));
  pending.set(code, work);
  return work;
}

/** Run before importing screen modules, whose catalog groupings are synchronous. */
export async function bootstrap() {
  await initialize();
  loadedAccess = await live().auth.hasSession() ? "full" : "showcase";
  const [catalog, classes] = await Promise.all([loadedAccess === "full" ? live().products() : live().showcase(), live().store.catalog.categories()]);
  if (loadedAccess === "full") { try { sessionStorage.removeItem("tm-catalog-reload"); } catch { /* Storage may be blocked. */ } }
  products.splice(0, products.length, ...catalog);
  setCategories(classes.map((category) => ({ ...category, vial: catalog.find((product) => product.category === category.id)?.id })));
  const query = new URLSearchParams(location.hash.split("?")[1] ?? location.search);
  const referral = query.get("ref");
  if (referral) void rememberLink(referral).catch(() => { /* A visit must not prevent browsing. */ });
}
