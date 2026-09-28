import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { assetUrl } from "../../../assetUrl";
import { BrandDot } from "../../../brand/HeroShelf";
import "../../../brand/notfound.css";

/** An address with nothing at it: the empty plinth, and the way back. */
export default function NotFound() {
  const { pathname } = useLocation();
  const fromBlog = pathname.startsWith("/research-blog/");

  useEffect(() => {
    document.title = "Page not found — TrueMark BioLabs";
  }, [pathname]);

  return (
    <div className="tm-page">
      <section className="tm tm-lost" aria-labelledby="tm-lost-title">
        <div className="tm-lost-copy">
          <p className="tm-eyebrow">Error 404</p>
          <h1 id="tm-lost-title" className="tm-lost-title">
            Page not found
            <BrandDot />
          </h1>
          <p className="tm-lost-lead">
            The address may be mistyped, or the page may have moved.
          </p>
          <div className="tm-actions">
            <Link className="tm-button tm-button-primary" to="/products">
              View catalog
            </Link>
            <Link className="tm-button tm-button-outline" to="/verify">
              Verify a lot
            </Link>
          </div>
          {fromBlog && (
            <Link className="tm-textlink tm-lost-back" to="/research-blog">
              Back to the Research Blog <ArrowRight size={16} strokeWidth={1.6} />
            </Link>
          )}
        </div>
        <div className="tm-lost-photo">
          <img
            src={assetUrl("images/scenes/product-stage.webp")}
            srcSet={`${assetUrl("images/scenes/product-stage-sm.webp")} 600w, ${assetUrl("images/scenes/product-stage.webp")} 900w`}
            sizes="(max-width: 960px) 100vw, 36vw"
            width={900}
            height={1125}
            alt=""
            draggable={false}
          />
        </div>
      </section>
    </div>
  );
}
