import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { assetUrl } from "./assetUrl";

export default function Review() {
  useEffect(() => {
    document.title = "TrueMark — Design presentation";
  }, []);

  return (
    <main className="review-page">
      <header className="review-intro">
        <div>
          <p className="review-eyebrow">TRUEMARK BIOLABS / DESIGN PRESENTATION</p>
          <h1>The TrueMark<br />experience.</h1>
        </div>
        <div className="review-intro-copy">
          <p>A complete website concept.<br />A few considered possibilities.</p>
          <p>Explore the site, then take a closer look at the imagery and typography that give it its character.</p>
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
          <img src={assetUrl("images/hero-still-life.png")} alt="TrueMark packaging and clear-liquid research vials in natural light" fetchPriority="high" />
          <span>THE COMPLETE PROTOTYPE</span>
        </div>
      </Link>

      <section className="review-explorations" aria-labelledby="review-explorations-title">
        <div className="review-section-intro">
          <h2 id="review-explorations-title">Consider the possibilities.</h2>
          <p>Compare the directions. See each one in context.</p>
        </div>
        <div className="review-exploration-grid">
          <Link className="review-exploration" to="/visual-study?view=compare">
            <div className="review-visual-cover">
              <img src={assetUrl("images/studies/water.png")} alt="Sunlight creates an abstract pattern in clear water" loading="lazy" />
              <span>Four ways<br />to begin.</span>
            </div>
            <div className="review-exploration-caption">
              <div><p className="review-eyebrow">02 / LANDING VISUALS</p><h3>A different first feeling.</h3><p>Open landscapes, living patterns, light through glass, and the research object. Four approaches to the opening moment.</p></div>
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
              <div><p className="review-eyebrow">03 / TYPOGRAPHY</p><h3>Quietly distinctive.</h3><p>Three typographic directions, shown across the collection, product, and documentation pages. Quiet modern is used in the current website.</p></div>
              <ArrowUpRight size={23} />
            </div>
            <span className="review-text-action">Compare the typography <ArrowRight size={16} /></span>
          </Link>
        </div>
      </section>

      <section className="review-note" aria-label="About this presentation">
        <p className="review-eyebrow">A WORKING DESIGN PREVIEW</p>
        <p>Navigation, filtering, and sample interactions are available to explore. Images and records are illustrative; forms and the bag demonstrate the experience without sending inquiries or placing orders.</p>
      </section>
      <footer className="review-footer"><span>TrueMark Biolabs</span><span>Considered at every step.</span></footer>
    </main>
  );
}
