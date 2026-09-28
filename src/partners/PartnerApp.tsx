import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Apply from "./public/Apply";
import Landing from "./public/Landing";
import NotFound from "./public/NotFound";
import PublicFrame from "./public/PublicFrame";
import SignIn, { SignOut } from "./public/SignIn";

const Portal = lazy(() => import("./portal/Portal"));

/**
 * The partner program. Public pages (/partners, /partners/apply, /partners/sign-in)
 * speak in the shop's voice; the portal (/partners/app/*) is the app kit in its
 * light studio theme.
 */
export default function PartnerApp() {
  return (
    <Routes>
      <Route
        path="app/*"
        element={
          <Suspense fallback={null}>
            <Portal />
          </Suspense>
        }
      />
      <Route path="sign-out" element={<SignOut />} />
      <Route element={<PublicFrame />}>
        <Route index element={<Landing />} />
        <Route path="apply" element={<Apply />} />
        <Route path="sign-in" element={<SignIn />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
