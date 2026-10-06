import { lazy, Suspense } from "react";
import type { ComponentType } from "react";
import { LIVE, LAUNCH } from "./platform/mode";
import { Route, Routes } from "react-router-dom";
import App from "./App";
import ReviewShell, { prepareReview } from "./ReviewShell";
import Gate from "./brand/Gate";
// Launch removes these imports and their routes from the customer bundle.
let Review: ComponentType | null = null;
const overviewReady = LAUNCH ? null : import("./Review").then((module) => { Review = module.default; });
export async function prepareAppRoutes() { await Promise.all([overviewReady, prepareReview()]); }

const TypeStudy = LAUNCH ? null : lazy(() => import("./TypeStudy"));
const VisualStudy = LAUNCH ? null : lazy(() => import("./VisualStudy"));
const LiveOrder = LAUNCH ? null : lazy(() => import("./demo/LiveOrder"));
const AdminApp = lazy(() => import("./admin/AdminApp"));
const PartnerApp = lazy(() => import("./partners/PartnerApp"));
const EmailLink = LIVE ? lazy(() => import("./platform/live/EmailLink")) : null;
const TeamInvite = LIVE ? lazy(() => import("./platform/live/TeamInvite")) : null;

export default function AppRoutes() {
  return (
    <ReviewShell>
      <Routes>
        {Review && <Route path="/review" element={<Review />} />}
        {LiveOrder && <Route
          path="/review/live"
          element={
            <Suspense fallback={<p style={{ padding: 32 }}>Loading the live demo…</p>}>
              <LiveOrder />
            </Suspense>
          }
        />}
        {VisualStudy && <Route
          path="/visual-study"
          element={
            <Suspense fallback={<p style={{ padding: 32 }}>Loading visual studies…</p>}>
              <VisualStudy />
            </Suspense>
          }
        />}
        {TypeStudy && <Route
          path="/type-study"
          element={
            <Suspense fallback={<p style={{ padding: 32 }}>Loading type studies…</p>}>
              <TypeStudy />
            </Suspense>
          }
        />}
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
        {EmailLink && <Route path="/access/confirm" element={<Suspense fallback={null}><EmailLink /></Suspense>} />}
        {EmailLink && <Route path="/access/reset" element={<Suspense fallback={null}><EmailLink /></Suspense>} />}
        {TeamInvite && <Route path="/access/team" element={<Suspense fallback={null}><TeamInvite /></Suspense>} />}
        <Route path="/access" element={<Gate />} />
        <Route path="*" element={<App />} />
      </Routes>
    </ReviewShell>
  );
}
