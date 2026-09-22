import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import "./review.css";

export default function ReviewShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const section = pathname === "/review" ? "overview"
    : pathname === "/visual-study" ? "visuals"
    : pathname === "/type-study" ? "type" : "website";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  const links = [
    { id: "overview", label: "Overview", to: "/review" },
    { id: "website", label: "Website", to: "/" },
    { id: "visuals", label: "Landing visuals", to: "/visual-study?view=compare" },
    { id: "type", label: "Typography", to: "/type-study?direction=quiet&view=compare" },
  ];

  return (
    <div className="review-shell">
      <nav className="review-nav" aria-label="Client review navigation">
        <Link className="review-identity" to="/review">TrueMark <span>/ Design review</span></Link>
        <div className="review-nav-links">
          {links.map((link) => (
            <Link key={link.id} to={link.to} aria-current={section === link.id ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
        </div>
        <span className="review-preview-label">Interactive preview</span>
      </nav>
      {children}
    </div>
  );
}
