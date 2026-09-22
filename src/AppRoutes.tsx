import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import App from "./App";

const TypeStudy = lazy(() => import("./TypeStudy"));
const VisualStudy = lazy(() => import("./VisualStudy"));

export default function AppRoutes() {
  return (
    <Routes>
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
  );
}
