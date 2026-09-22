import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import "@fontsource-variable/manrope";
import AppRoutes from "./AppRoutes";
import { SectionScroll } from "./SectionLink";
import "./styles.css";

const Router = import.meta.env.PROD ? HashRouter : BrowserRouter;

if (import.meta.env.PROD && !window.location.hash) {
  const { pathname, search } = window.location;
  window.history.replaceState(
    window.history.state,
    "",
    `${pathname}${search}#/review`,
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Router>
      <SectionScroll />
      <AppRoutes />
    </Router>
  </React.StrictMode>,
);
