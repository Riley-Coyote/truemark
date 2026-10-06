/** Vite folds this at build time; preview is the default. */
export const LIVE = import.meta.env.VITE_PLATFORM === "live";

/** UI preferences may keep their old names in preview, never in live. */
export function storageKey(previewKey: string): string {
  return LIVE && !previewKey.startsWith("tm-live-") ? `tm-live-${previewKey.replace(/^(tm-preview-|truemark-preview-|tm-)/, "")}` : previewKey;
}

/** Launch strips every review route and module at build time. */
export const LAUNCH = LIVE && import.meta.env?.VITE_LAUNCH === "1";
export const PATH_ROUTER = import.meta.env?.VITE_ROUTER === "path";

/** Restore Pages paths before auth and route-dependent bootstrap work. */
export function entryUrl(href: string, base: string, pathRouter: boolean, hashRouter: boolean, live: boolean): string | null {
  const url = new URL(href);
  const basePath = new URL(base, url).pathname.replace(/\/?$/, "/");
  if (pathRouter) {
    if (url.pathname === basePath || url.pathname === basePath.slice(0, -1)) {
      const restored = url.searchParams.get("p");
      if (restored?.startsWith("/") && !restored.startsWith("//")) {
        return basePath + restored.slice(1);
      }
    }
    return null;
  }
  if (!hashRouter || url.hash) return null;
  const rest = url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length) : "";
  if (live && rest) return `${basePath}#/${rest}${url.search}`;
  return `${url.pathname}${url.search}#${live ? "/access" : "/review"}`;
}
export function enterRoot(path: string, signedIn: boolean, storage: Pick<Storage, "getItem" | "setItem">): boolean {
  const entered = storage.getItem("tm-entered") === "1";
  storage.setItem("tm-entered", "1");
  return path === "/" && !signedIn && !entered;
}
