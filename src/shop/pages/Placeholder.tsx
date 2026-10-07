import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/** Stands in for a page that is being built on the platform system. */
export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="tm-page">
      <section className="tm" aria-labelledby="tm-placeholder-title">
        <div className="tm-empty-page">
          <p className="tm-eyebrow">In progress</p>
          <h1 id="tm-placeholder-title" className="tm-display">
            {title}
            <br />
            <span>is being built.</span>
          </h1>
          <Link className="tm-textlink" to="/">
            Back to the home page <ArrowRight size={16} strokeWidth={1.6} />
          </Link>
        </div>
      </section>
    </div>
  );
}
