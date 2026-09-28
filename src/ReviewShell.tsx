import { Suspense, useEffect } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { IN_FRAME, REVIEW_MODE, ReviewLayer } from "./review/index";
import "./review/review.css";
import "./review.css";

const links = [
  { id: "overview", label: "Overview", to: "/review" },
  { id: "website", label: "Website", to: "/" },
  { id: "partners", label: "Partners", to: "/partners" },
  { id: "admin", label: "Command center", to: "/admin" },
];

export default function ReviewShell({ children }: { children: ReactNode }) {
  const { pathname, state } = useLocation();
  const keepScroll = (state as { keepScroll?: boolean } | null)?.keepScroll;
  const section =
    pathname === "/review" || pathname.startsWith("/review/")
      ? "overview"
      : pathname.startsWith("/partners")
        ? "partners"
        : pathname.startsWith("/admin")
          ? "admin"
          : pathname === "/visual-study" || pathname === "/type-study"
            ? null
            : "website";

  useEffect(() => {
    if (!keepScroll) window.scrollTo({ top: 0, behavior: "instant" });
    // Only a change of page should reset scroll; keepScroll is read at that moment.
  }, [pathname]);

  return (
    <div className="review-shell" data-framed={IN_FRAME ? "" : undefined}>
      {!IN_FRAME && (
        <nav className="review-nav" aria-label="Client review navigation">
          <Link className="review-identity" to="/review">
            TrueMark <span>Design review</span>
          </Link>
          <div className="review-nav-links">
            {links.map((link) => (
              <Link key={link.id} to={link.to} aria-current={section === link.id ? "page" : undefined}>
                {link.label}
              </Link>
            ))}
          </div>
          <span className="review-live" data-mode={REVIEW_MODE}>
            <span className="review-live-dot" aria-hidden="true" />
            <span className="review-live-text">{REVIEW_MODE === "supabase" ? "Live" : "On this device"}</span>
          </span>
        </nav>
      )}
      {children}
      {!IN_FRAME && (
        <Suspense fallback={null}>
          <ReviewLayer />
        </Suspense>
      )}
    </div>
  );
}
