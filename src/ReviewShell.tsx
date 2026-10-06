import { Suspense } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LAUNCH } from "./platform/mode";
import type * as ReviewModule from "./review/index";

let loadedReview: typeof ReviewModule | undefined;
const reviewReady = LAUNCH ? null : Promise.all([
  import("./review/index"), import("./review/review.css"), import("./review.css"),
]).then(([review]) => { loadedReview = review; });
export async function prepareReview() { await reviewReady; }

const links = [
  { id: "overview", label: "Overview", to: "/review" },
  { id: "website", label: "Website", to: "/" },
  { id: "partners", label: "Partners", to: "/partners" },
  { id: "admin", label: "Command center", to: "/admin" },
];

export default function ReviewShell({ children }: { children: ReactNode }) {
  if (LAUNCH) return children;
  // main awaits this module before the first render, preserving the review bar.
  if (!loadedReview) throw reviewReady;
  return <Frame reviewModule={loadedReview}>{children}</Frame>;
}

function Frame({ children, reviewModule }: { children: ReactNode; reviewModule: typeof ReviewModule }) {
  const { IN_FRAME, ReviewLayer, useReviewStatus } = reviewModule;
  const { pathname } = useLocation();
  // "Live" only once shared notes have loaded and the live channel has joined.
  const review = useReviewStatus();
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
          {/* data-mode="supabase" is the bar's live look (src/review.css); data-status says which state. */}
          <span className="review-live" data-mode={review === "live" ? "supabase" : "local"} data-status={review}>
            <span className="review-live-dot" aria-hidden="true" />
            <span className="review-live-text">
              {review === "live" ? "Live" : review === "connecting" ? "Connecting…" : "On this device"}
            </span>
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
