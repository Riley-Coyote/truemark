import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import App from "./App";
import ReviewShell from "./ReviewShell";
import Gate from "./brand/Gate";
// The Overview is where the published review opens, so it loads with the app, never behind a placeholder.
import Review from "./Review";

const TypeStudy = lazy(() => import("./TypeStudy"));
const VisualStudy = lazy(() => import("./VisualStudy"));
const LiveOrder = lazy(() => import("./demo/LiveOrder"));
const AdminApp = lazy(() => import("./admin/AdminApp"));
const PartnerApp = lazy(() => import("./partners/PartnerApp"));

export default function AppRoutes() {
  return (
    <ReviewShell>
      <Routes>
        <Route path="/review" element={<Review />} />
        <Route
          path="/review/live"
          element={
            <Suspense fallback={<p style={{ padding: 32 }}>Loading the live demo…</p>}>
              <LiveOrder />
            </Suspense>
          }
        />
        <Route
          path="/visual-study"
          element={
            <Suspense fallback={<p style={{ padding: 32 }}>Loading visual studies…</p>}>
              <VisualStudy />
            </Suspense>
          }
        />
        <Route
          path="/type-study"
          element={
            <Suspense fallback={<p style={{ padding: 32 }}>Loading type studies…</p>}>
              <TypeStudy />
            </Suspense>
          }
        />
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={null}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route
          path="/partners/*"
          element={
            <Suspense fallback={null}>
              <PartnerApp />
            </Suspense>
          }
        />
        <Route path="/access" element={<Gate />} />
        <Route path="*" element={<App />} />
      </Routes>
    </ReviewShell>
  );
}
