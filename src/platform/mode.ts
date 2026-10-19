/** Vite folds this at build time; preview is the default. */
export const LOCAL = import.meta.env?.DEV === true && import.meta.env.VITE_LOCAL_PLATFORM === "1";
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
    // Existing Auth templates and transactional emails use hash routes. Translate
    // them before Auth/bootstrap so previously sent links keep working at launch.
    if (url.hash.startsWith("#/") && !url.hash.startsWith("#//")) {
      const route = new URL(basePath + url.hash.slice(2), url.origin);
      for (const [key, value] of url.searchParams) {
        if (!route.searchParams.has(key)) route.searchParams.append(key, value);
      }
      return route.pathname + route.search + route.hash;
    }
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
  // The live site opens on its landing, which anyone may see; the shop pages ask for an account (App.tsx).
  return `${url.pathname}${url.search}#${live ? "/" : "/review"}`;
}
