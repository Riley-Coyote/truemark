import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { assetUrl } from "./assetUrl";

export default function Review() {
  useEffect(() => {
    document.title = "TrueMark — Design presentation";
  }, []);

  return (
    <main className="review-page brand-refinement">
      <header className="review-intro">
        <div>
          <p className="review-eyebrow">TRUEMARK BIOLABS / DESIGN PRESENTATION</p>
          <h1>The TrueMark<br />experience.</h1>
        </div>
        <div className="review-intro-copy">
          <p>Your identity.<br />A more considered experience.</p>
          <p>Quiet typography, natural light, and your original identity. Explore the revised website and compare the new environmental imagery alongside the original studies.</p>
        </div>
      </header>

      <Link className="review-site-feature" to="/" aria-label="Explore the complete TrueMark website">
        <div className="review-site-copy">
          <p className="review-eyebrow">01 / THE WEBSITE</p>
          <h2>Research,<br />with a record.</h2>
          <p>From the first impression to the details of a compound. Explore the collection, documentation, journal, and complete browsing experience.</p>
          <span className="review-enter">Explore the website <ArrowUpRight size={19} /></span>
        </div>
        <div className="review-site-image">
          <img src={assetUrl("images/studies/morning.png")} alt="Morning light over a clear coastal cove" fetchPriority="high" />
          <span>THE COMPLETE PROTOTYPE</span>
        </div>
      </Link>

      <section className="review-explorations" aria-labelledby="review-explorations-title">
        <div className="review-section-intro">
          <h2 id="review-explorations-title">Consider the possibilities.</h2>
          <p>Two fresh studies join the original four directions. See each one in context.</p>
        </div>
        <div className="review-exploration-grid">
          <Link className="review-exploration" to="/visual-study?view=compare">
            <div className="review-visual-cover">
              <img src={assetUrl("images/studies/tidal.png")} alt="Sunlight creates an abstract pattern in clear water" loading="lazy" />
              <span>Six ways<br />to begin.</span>
            </div>
            <div className="review-exploration-caption">
              <div><p className="review-eyebrow">02 / LANDING VISUALS</p><h3>A different first feeling.</h3><p>Open landscapes, living patterns, light through glass, and the research object. Plus two new studies in morning light and quiet renewal.</p></div>
              <ArrowUpRight size={23} />
            </div>
            <span className="review-text-action">Explore six directions <ArrowRight size={16} /></span>
          </Link>

          <Link className="review-exploration" to="/type-study?direction=quiet&view=compare">
            <div className="review-type-cover" aria-hidden="true">
              <span className="review-type-label">THE CHARACTER OF TRUEMARK</span>
              <span className="review-type-specimen">Aa.</span>
              <span className="review-type-baseline">Sculptural <span>Precise</span> Quiet modern</span>
            </div>
            <div className="review-exploration-caption">
              <div><p className="review-eyebrow">03 / EARLIER TYPOGRAPHY</p><h3>Quietly distinctive.</h3><p>Three earlier typographic directions, shown across the collection, product, and documentation pages. The revised website returns to Quiet modern, paired with the client’s original logo and product labels.</p></div>
              <ArrowUpRight size={23} />
            </div>
            <span className="review-text-action">Compare the typography <ArrowRight size={16} /></span>
          </Link>
        </div>
      </section>

      <section className="review-note" aria-label="About this presentation">
        <p className="review-eyebrow">A WORKING DESIGN PREVIEW</p>
        <p>Navigation, filtering, and sample interactions are available to explore. The original landing concepts use earlier packaging; the current site uses supplied label artwork. Images and records are illustrative, and forms and the bag demonstrate the experience without sending inquiries or placing orders.</p>
      </section>
      <footer className="review-footer"><span>TrueMark BioLabs</span><span>Considered at every step.</span></footer>
    </main>
  );
}
