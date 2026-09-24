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
          <p>Explore the brand-refined website, then revisit the earlier landing and typography studies that informed its spacing, hierarchy, and sense of clarity.</p>
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
          <img src={assetUrl("images/brand/hero-collection.png")} alt="TrueMark BioLabs powder vials with the client’s color-coded labels" fetchPriority="high" />
          <span>THE COMPLETE PROTOTYPE</span>
        </div>
      </Link>

      <section className="review-explorations" aria-labelledby="review-explorations-title">
        <div className="review-section-intro">
          <h2 id="review-explorations-title">Consider the possibilities.</h2>
          <p>Revisit the earlier directions and see each one in context.</p>
        </div>
        <div className="review-exploration-grid">
          <Link className="review-exploration" to="/visual-study?view=compare">
            <div className="review-visual-cover">
              <img src={assetUrl("images/studies/water.png")} alt="Sunlight creates an abstract pattern in clear water" loading="lazy" />
              <span>Four ways<br />to begin.</span>
            </div>
            <div className="review-exploration-caption">
              <div><p className="review-eyebrow">02 / EARLIER LANDING VISUALS</p><h3>A different first feeling.</h3><p>Open landscapes, living patterns, light through glass, and the research object. Four early approaches to the opening moment.</p></div>
              <ArrowUpRight size={23} />
            </div>
            <span className="review-text-action">Explore four directions <ArrowRight size={16} /></span>
          </Link>

          <Link className="review-exploration" to="/type-study?direction=quiet&view=compare">
            <div className="review-type-cover" aria-hidden="true">
              <span className="review-type-label">THE CHARACTER OF TRUEMARK</span>
              <span className="review-type-specimen">Aa.</span>
              <span className="review-type-baseline">Sculptural <span>Precise</span> Quiet modern</span>
            </div>
            <div className="review-exploration-caption">
              <div><p className="review-eyebrow">03 / EARLIER TYPOGRAPHY</p><h3>Quietly distinctive.</h3><p>Three earlier typographic directions, shown across the collection, product, and documentation pages. The revised website combines the client’s brand typography with our quiet approach to spacing and hierarchy.</p></div>
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
