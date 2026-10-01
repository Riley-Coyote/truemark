import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import "@fontsource-variable/manrope";
import { LIVE } from "./platform/mode";
import { SectionScroll } from "./SectionLink";
import "./styles.css";

const Router = (LIVE || import.meta.env.PROD) ? HashRouter : BrowserRouter;

if ((LIVE || import.meta.env.PROD) && !window.location.hash) {
  const { pathname, search } = window.location;
  window.history.replaceState(
    window.history.state,
    "",
    `${pathname}${search}#${LIVE ? "/access" : "/review"}`,
  );
}

const root = ReactDOM.createRoot(document.getElementById("root")!);

async function renderApp() {
  if (LIVE) {
    const { bootstrap } = await import("./platform/live/bootstrap");
    await bootstrap();
  }
  // Catalog groupings in screen modules are calculated when imported. In live,
  // import them only after the database catalog has replaced the source array.
  const { default: AppRoutes } = await import("./AppRoutes");
  root.render(
    <React.StrictMode>
      <Router>
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
