import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import App from "./App";
import ReviewShell from "./ReviewShell";

const TypeStudy = lazy(() => import("./TypeStudy"));
const VisualStudy = lazy(() => import("./VisualStudy"));
const Review = lazy(() => import("./Review"));

export default function AppRoutes() {
  return (
    <ReviewShell>
      <Routes>
        <Route
          path="/review"
          element={
            <Suspense fallback={<p style={{ padding: 32 }}>Loading presentation…</p>}>
              <Review />
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
        <Route path="*" element={<App />} />
      </Routes>
    </ReviewShell>
  );
}
