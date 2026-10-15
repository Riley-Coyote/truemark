import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/manrope";
import { LIVE, PATH_ROUTER, entryUrl, enterRoot } from "./platform/mode";
import { GlidingBrowserRouter, GlidingHashRouter, readyPagesWith, ScrollMemory } from "./Navigation";
import { SectionScroll } from "./SectionLink";
import { preloadPath, readyNeighbours } from "./pages";
import { RootBoundary, RootFailure } from "./RootBoundary";
import { Presses } from "./press";
import "./styles.css";

const routerBase = import.meta.env?.BASE_URL ?? "./";
const hashRouter = !PATH_ROUTER && (LIVE || import.meta.env.PROD);
const Router = hashRouter ? GlidingHashRouter : GlidingBrowserRouter;
const restored = entryUrl(window.location.href, routerBase, PATH_ROUTER, hashRouter, LIVE);
if (restored) window.history.replaceState(window.history.state, "", restored);

const root = ReactDOM.createRoot(document.getElementById("root")!);
// A step to another page waits for its code, and readies it ahead of time (Navigation.tsx).
readyPagesWith(preloadPath);
/** The site's front door, for the ways on when it fails. */
const home = hashRouter ? `${routerBase}#/` : PATH_ROUTER ? routerBase : "/";

/** The address the router will show, within the site. */
function appPath() {
  if (hashRouter) return window.location.hash.slice(1) || "/";
  if (!PATH_ROUTER) return window.location.pathname;
  const base = new URL(routerBase, window.location.href).pathname.replace(/\/?$/, "/");
  return window.location.pathname.slice(base.length - 1) || "/";
}

// A file a newer deploy has replaced: the page is loaded again, fresh, once a minute at most. Past that, the page that
// needed it says it didn't load (PageBoundary.tsx, RootBoundary.tsx).
window.addEventListener("vite:preloadError", (event) => {
  try {
    const last = Number(sessionStorage.getItem("tm-reloaded-at") ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem("tm-reloaded-at", String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

async function renderApp() {
  if (LIVE) {
    const { bootstrap } = await import("./platform/live/bootstrap");
    await bootstrap();
    if (PATH_ROUTER) {
      const { live } = await import("./platform/live/runtime");
      const base = new URL(routerBase, window.location.href).pathname.replace(/\/?$/, "/");
      const path = window.location.pathname.slice(base.length - 1) || "/";
      let redirect = false;
      try { redirect = enterRoot(path, await live().auth.hasSession(), sessionStorage); } catch { /* Continue without tab storage. */ }
      if (redirect) window.history.replaceState(window.history.state, "", `${base}access${window.location.search}`);
    }
  }
  // Catalog groupings in screen modules are calculated when imported. In live,
  // import them only after the database catalog has replaced the source array.
  // The first page's own code comes alongside the shop's, so it draws at once (pages.tsx). If it fails, the shop still
  // starts, and the page says it didn't load inside it (PageBoundary.tsx).
  const [routes] = await Promise.all([import("./AppRoutes"), preloadPath(appPath()).catch(() => undefined)]);
  await routes.prepareAppRoutes?.();
  const AppRoutes = routes.default;
  root.render(
    <React.StrictMode>
      <Router basename={PATH_ROUTER ? routerBase : undefined}>
        <RootBoundary home={home}>
          <ScrollMemory />
          <SectionScroll />
          <Presses />
          <AppRoutes />
        </RootBoundary>
      </Router>
    </React.StrictMode>,
  );
  readyNeighbours();
}

async function start(): Promise<void> {
  try { await renderApp(); }
  catch {
    if (!LIVE) {
      root.render(<RootFailure home={home} />);
      return;
    }
    try {
      const { ShopLoadFailure } = await import("./platform/live/ShopLoadFailure");
      root.render(<ShopLoadFailure retry={start} />);
    } catch {
      root.render(<RootFailure home={home} />);
    }
  }
}
void start();
