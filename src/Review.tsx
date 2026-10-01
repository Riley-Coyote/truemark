import { useEffect } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { assetUrl } from "./assetUrl";
import { BrandLogo } from "./BrandLogo";
import { BrandDot } from "./brand/HeroShelf";
import { Trace } from "./brand/Trace";
import { ReviewLive } from "./brand/ReviewLive";
import { startReviewing } from "./review/index";
import "./shop/tokens.css";
import "./brand/review-page.css";

function scene(name: string) {
  return {
    src: assetUrl(`images/scenes/${name}.webp`),
    srcSet: `${assetUrl(`images/scenes/${name}-sm.webp`)} 1200w, ${assetUrl(`images/scenes/${name}.webp`)} 2400w`,
  };
}

/** The first design as sent on 22 September, published beside this one. */
const FIRST_DESIGN = `${import.meta.env.BASE_URL}first-design/`;

const carried = [
  ["Your identity, untouched", "The lockup and the label artwork as supplied; a one-colour black logo, which the guide approves, for everyday use."],
  ["Your type, set with care", "Poppins speaks for the brand, light and large; Helvetica-class Heros carries every name, lot and number."],
  ["Your gradient, as light", "It glows under a button, lights the peak of the purity trace and sits in the logo's dot. It never fills a surface."],
  ["Colour in the vials", "A lilac studio drawn from your brand purple, so the label colours are the only strong colour on the page."],
];

/** The presentation's front door: what the platform is, where to look, and what is sample. */
export default function Review() {
  useEffect(() => {
    document.title = "TrueMark — Design presentation";
  }, []);
  const website = scene("collection");
  const partners = scene("trio");

  return (
    <main className="rv brand-refinement">
      <header className="rv-intro">
        <div className="rv-intro-head">
          <BrandLogo />
          <p className="rv-eyebrow">Design presentation</p>
          <h1 className="rv-title">
            <span className="tm-bhero-line" style={{ "--tm-i": 0 } as CSSProperties}>
              <span>The TrueMark</span>
            </span>
            <span className="tm-bhero-line" style={{ "--tm-i": 1 } as CSSProperties}>
              <span>
                platform
                <BrandDot />
              </span>
            </span>
          </h1>
        </div>
        <div className="rv-intro-side">
          <p className="rv-lead">
            Your site, your brand kit and your own words, rebuilt as one platform: the
            shop, lot verification, research accounts, a partner program, and the
            command center you run it all from.
          </p>
          <a className="rv-earlier" href={FIRST_DESIGN}>
            See the first design, from 22 September
            <ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" />
          </a>
        </div>
      </header>

      <Link className="rv-feature" to="/" aria-label="Explore the website">
        <img
          className="rv-feature-photo"
          src={website.src}
          srcSet={website.srcSet}
          sizes="(max-width: 960px) 100vw, 88vw"
          alt="Five TrueMark vials on lilac pedestals"
          fetchPriority="high"
        />
        <div className="rv-feature-copy">
          <p className="rv-eyebrow">01 · The website</p>
          <h2 className="rv-feature-title">
            True research.
            <br />
            True precision.
            <br />
            Verified
            <BrandDot />
          </h2>
          <p className="rv-text">
            Your pages in your order: the catalog, every compound on its plinth, lot
            verification with its certificate, quality and handling, the research blog,
            checkout and research accounts.
          </p>
          <span className="rv-action">
            Explore the website <ArrowUpRight size={17} strokeWidth={1.6} aria-hidden="true" />
          </span>
        </div>
      </Link>

      <div className="rv-pair">
        <Link className="rv-card" to="/partners" aria-label="Open the partner program">
          <div className="rv-card-visual rv-card-photo">
            <img src={partners.src} srcSet={partners.srcSet} sizes="(max-width: 960px) 100vw, 44vw" alt="" loading="lazy" />
          </div>
          <div className="rv-card-copy">
            <p className="rv-eyebrow">02 · The partner program</p>
            <h2 className="rv-card-title">Partners who talk about research the right way.</h2>
            <p className="rv-text">
              A public program page, an application with the guidelines built in, and a
              portal for links, codes, referrals and payouts.
            </p>
            <span className="rv-textlink">
              Open the partner program <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link className="rv-card" to="/admin" aria-label="Open the command center">
          <div className="rv-card-visual rv-card-night" aria-hidden="true">
            <BrandLogo variant="white" />
            <Trace theme="night" peakAt={0.68} height={96} className="rv-card-trace" />
          </div>
          <div className="rv-card-copy">
            <p className="rv-eyebrow">03 · The command center</p>
            <h2 className="rv-card-title">The business, run from one place.</h2>
            <p className="rv-text">
              Orders, lots and certificates, products and inventory, applications,
              customers, partners and payouts, discount codes and settings.
            </p>
            <span className="rv-textlink">
              Open the command center <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
            </span>
          </div>
        </Link>
      </div>

      <ReviewLive />

      <section className="rv-review" aria-labelledby="rv-review-title">
        <div className="rv-review-intro">
          <h2 id="rv-review-title" className="rv-review-title">
            Leave notes anywhere
          </h2>
          <p className="rv-text">
            Riley’s questions are waiting in{" "}
            <span className="rv-review-keep">
              <span className="rv-review-key">Questions</span>,
            </span>{" "}
            each on the page it’s about.
          </p>
          <button type="button" className="rv-start" onClick={startReviewing}>
            Start reviewing <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>
        <ol className="rv-review-steps">
          <li>
            <span className="rv-review-index" aria-hidden="true">
              01
            </span>
            <p className="rv-review-step">
              Click <span className="rv-review-key">Comment</span>
            </p>
            <p className="rv-review-hint">
              At the foot of every page<span className="rv-review-keyhint">, or press C</span>.
            </p>
          </li>
          <li>
            <span className="rv-review-index" aria-hidden="true">
              02
            </span>
            <p className="rv-review-step">Click anything</p>
            <p className="rv-review-hint">A headline, a photo, a price, a button.</p>
          </li>
          <li>
            <span className="rv-review-index" aria-hidden="true">
              03
            </span>
            <p className="rv-review-step">Write your note</p>
            <p className="rv-review-hint">It stays pinned to the spot you chose.</p>
          </li>
        </ol>
      </section>

      <section className="rv-carried" aria-labelledby="rv-carried-title">
        <h2 id="rv-carried-title" className="rv-section-title">
          Your brand, carried through
        </h2>
        <dl className="rv-carried-list">
          {carried.map(([title, text]) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rv-note" aria-labelledby="rv-note-title">
        <h2 id="rv-note-title" className="rv-eyebrow">
          A working design preview
        </h2>
        <p className="rv-text">
          Everything you can click works, with sample data. No order is placed, no
          payment is taken and no message is sent. Sample people, figures and the sample
          record on lot TM-BPC10-2609-01 are illustrative; the rest of your first batch
          shows its real lot numbers, and no results until the laboratory publishes them.
        </p>
      </section>

      <footer className="rv-foot">
        <span>Earlier explorations</span>
        <a href={FIRST_DESIGN}>The first design</a>
        <Link to="/visual-study?view=compare">Landing visuals</Link>
        <Link to="/type-study?direction=quiet&view=compare">Typography</Link>
      </footer>
    </main>
  );
}
