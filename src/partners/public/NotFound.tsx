import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useTitle } from "./title";

export default function NotFound() {
  useTitle("Not part of the partner program");
  return (
    <div className="tm-page">
      <section className="tm pp-missing" aria-labelledby="pp-missing-title">
        <div className="pp-missing-copy">
          <p className="tm-eyebrow">Partner program</p>
          <h1 id="pp-missing-title" className="tm-heading">
            That page isn’t part
            <br />
            <span>of the partner program.</span>
          </h1>
          <p className="tm-section-note pp-missing-note">The address may be mistyped, or the page may have moved.</p>
          <div className="tm-actions">
            <Link className="tm-button tm-button-primary" to="/partners">
              The partner program
            </Link>
            <Link className="tm-textlink" to="/partners/sign-in">
              Sign in to the portal <ArrowRight size={16} strokeWidth={1.6} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
