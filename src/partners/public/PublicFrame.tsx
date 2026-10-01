import type { ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { BrandLogo } from "../../BrandLogo";
import { SectionLink } from "../../SectionLink";
import { Footer } from "../../shop/Chrome";
import "../public.css";

/**
 * The public partner pages wear the shop's chrome: the research-use notice, a
 * light bar with the client's logo, and the shop's own footer.
 */
export default function PublicFrame({ children }: { children?: ReactNode }) {
  return (
    <div className="brand-refinement pp-public">
      <SectionLink className="pp-skip" section="pp-main">
        Skip to content
      </SectionLink>
      <div className="tm-notice">
        <div className="tm-notice-inner">
          <p>Research use only · Not for human consumption</p>
        </div>
      </div>
      <header className="tm-header">
        <div className="tm-header-inner">
          <div className="pp-bar-brand">
            <Link className="tm-logo" to="/" aria-label="TrueMark BioLabs home">
              <BrandLogo />
            </Link>
            <NavLink className="pp-bar-label" to="/partners" end>
              Partner program
            </NavLink>
          </div>
          <nav className="tm-tools pp-bar-tools" aria-label="Partner program">
            <NavLink className="tm-textool" to="/partners/sign-in">
              Sign in
            </NavLink>
          </nav>
        </div>
      </header>
      <main id="pp-main">
        {children ?? <Outlet />}
      </main>
      <Footer />
    </div>
  );
}
