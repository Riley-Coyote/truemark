import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import App from "./App";

const TypeStudy = lazy(() => import("./TypeStudy"));

export default function AppRoutes() {
  return (
    <Routes>
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
