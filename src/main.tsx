import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/manrope";
import { LIVE, PATH_ROUTER, entryUrl, enterRoot } from "./platform/mode";
import { GlidingBrowserRouter, GlidingHashRouter, ScrollMemory } from "./Navigation";
import { SectionScroll } from "./SectionLink";
import "./styles.css";

const routerBase = import.meta.env?.BASE_URL ?? "./";
const hashRouter = !PATH_ROUTER && (LIVE || import.meta.env.PROD);
const Router = hashRouter ? GlidingHashRouter : GlidingBrowserRouter;
const restored = entryUrl(window.location.href, routerBase, PATH_ROUTER, hashRouter, LIVE);
if (restored) window.history.replaceState(window.history.state, "", restored);

const root = ReactDOM.createRoot(document.getElementById("root")!);

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
  const routes = await import("./AppRoutes");
  await routes.prepareAppRoutes?.();
  const AppRoutes = routes.default;
  root.render(
    <React.StrictMode>
      <Router basename={PATH_ROUTER ? routerBase : undefined}>
        <ScrollMemory />
        <SectionScroll />
        <AppRoutes />
      </Router>
    </React.StrictMode>,
  );
}

async function start(): Promise<void> {
  try { await renderApp(); }
  catch (error) {
    if (!LIVE) throw error;
    const { ShopLoadFailure } = await import("./platform/live/ShopLoadFailure");
    root.render(<ShopLoadFailure retry={start} />);
  }
}
void start();
