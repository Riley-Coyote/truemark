import { lazy, Suspense } from "react";
import { LIVE, LAUNCH } from "./platform/mode";
import { Route, Routes } from "react-router-dom";
import App from "./App";
import ReviewShell, { prepareReview } from "./ReviewShell";
import Gate from "./brand/Gate";
import { ResearcherCheck } from "./shop/ResearcherCheck";
import { ReviewOverview } from "./pages";
// Launch removes these imports and their routes from the customer bundle. The overview arrives with its route
// (pages.tsx; main.tsx readies it when a visit starts there).
export async function prepareAppRoutes() { await prepareReview(); }

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
        {ReviewOverview && <Route path="/review" element={<Suspense fallback={null}><ReviewOverview /></Suspense>} />}
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
      {/* A first visit confirms it is a researcher's, on the shop, its sign-in and the partner pages alike. */}
      <ResearcherCheck />
    </ReviewShell>
  );
}
