import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useResource } from "../store";
import { live } from "./runtime";

export function TeamGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const profile = useResource(() => live().auth.profile(), []);
  if (profile.loading) return <div className="tm-page"><section className="tm"><p className="tm-section-note" role="status">Checking team access…</p></section></div>;
  if (profile.data?.role === "owner" || profile.data?.role === "staff") return children;
  return <div className="tm-page"><section className="tm">
    <h1 className="tm-heading">This area is for the TrueMark team</h1>
    {profile.error && <p className="tm-field-error" role="alert">{profile.error.message}</p>}
    <Link className="tm-button tm-button-primary" to="/access" state={{ from: location.pathname + location.search }}>Sign in</Link>
  </section></div>;
}
