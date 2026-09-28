import { useRef } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "../../../assetUrl";
import { BrandDot } from "../../../brand/HeroShelf";
import { Trace } from "../../../brand/Trace";
import { useReveal } from "../../motion";
import "../../../brand/about.css";

/*
 * The client's About page, in their order and in their words
 * (reference-study/wordpress-2026-09-24/about.txt): the opening, what we do,
 * principles, who we supply, and the promise they close on.
 */

function scene(name: string) {
  return {
    src: assetUrl(`images/scenes/${name}.webp`),
    srcSet: `${assetUrl(`images/scenes/${name}-sm.webp`)} 1200w, ${assetUrl(`images/scenes/${name}.webp`)} 2400w`,
  };
}

const verbs = [
  {
    number: "01",
    verb: "Supply",
    text: "Research compounds as lyophilized powder, in Type I glass vials, organized into eight compound classes with full specification data.",
  },
  {
    number: "02",
    verb: "Test",
    text: "Every lot is independently tested on receipt — HPLC purity, MS identity, endotoxin, sterility — and quarantined until it passes.",
  },
  {
    number: "03",
    verb: "Document",
    text: "Every vial carries a lot number and a QR code that lead to its Certificate of Analysis. Records run from source batch to shipped box.",
  },
];

const principles = [
  {
    title: "Quality is documented, not claimed",
    text: "We publish the test results for every lot instead of asking for trust. If it isn’t on a certificate, we don’t say it.",
  },
  {
    title: "Traceability is non-negotiable",
    text: "Every vial traces back to a source batch and forward to a shipment. A lot we cannot trace is a lot we do not sell.",
  },
  {
    title: "Research use only, without exception",
    text: "Our compounds are supplied to verified research organizations for laboratory work — and we label, package, and sell them accordingly.",
  },
];

export default function About() {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  const lab = scene("lab");
  const light = scene("caustics");

  return (
    <div className="tm-page tm-about" ref={root}>
      <section className="tm tm-about-open" aria-labelledby="tm-about-title">
        <div className="tm-about-open-head">
          <p className="tm-eyebrow">About</p>
          <h1 id="tm-about-title" className="tm-about-title">
            True research.
            <br />
            True precision.
            <br />
            TrueMark
            <BrandDot />
          </h1>
        </div>
        <p className="tm-about-lead">
          TrueMark BioLabs is committed to delivering the highest quality research
          compounds with precision, transparency, and absolute integrity.
        </p>
        <div className="tm-about-open-photo">
          <img src={lab.src} srcSet={lab.srcSet} sizes="100vw" width={2400} height={1357} alt="" fetchPriority="high" />
        </div>
      </section>

      <section className="tm tm-about-verbs" aria-labelledby="tm-about-verbs-title">
        <header className="tm-about-verbs-head" data-reveal>
          <p className="tm-eyebrow">What we do</p>
          <h2 id="tm-about-verbs-title" className="tm-heading">
            A supplier built
            <br />
            <span>around three verbs</span>
          </h2>
        </header>
        {/* One line runs under all three verbs; where it passes Test, it becomes the trace. */}
        <ol className="tm-about-verb-list">
          {verbs.map((item, i) => (
            <li
              key={item.verb}
              className={item.verb === "Test" ? "is-test" : undefined}
              data-reveal
              style={{ "--tm-i": i } as CSSProperties}
            >
              {item.verb === "Test" && <Trace className="tm-about-verb-trace" peakAt={0.36} height={96} />}
              <span className="tm-about-verb-number" aria-hidden="true">
                {item.number}
              </span>
              <h3 className="tm-about-verb">{item.verb}</h3>
              <p className="tm-about-verb-text">{item.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="tm tm-night tm-about-principles" aria-labelledby="tm-about-principles-title">
        <header className="tm-about-principles-head" data-reveal>
          <p className="tm-eyebrow">Principles</p>
          <h2 id="tm-about-principles-title" className="tm-heading">
            How we operate
          </h2>
        </header>
        <ul className="tm-about-principle-list">
          {principles.map((item, i) => (
            <li key={item.title} data-reveal style={{ "--tm-i": i } as CSSProperties}>
              <h3 className="tm-about-principle">{item.title}</h3>
              <p className="tm-about-principle-text">{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="tm-about-light" aria-hidden="true">
        <img src={light.src} srcSet={light.srcSet} sizes="100vw" width={2400} height={1357} alt="" loading="lazy" />
      </div>

      <section className="tm tm-about-close" aria-labelledby="tm-about-supply-title">
        <div className="tm-about-supply" data-reveal>
          <p className="tm-eyebrow">Who we supply</p>
          <h2 id="tm-about-supply-title" className="tm-heading">
            Verified research
            <br />
            <span>organizations</span>
          </h2>
          <p className="tm-section-note">
            Accounts are opened to educational institutions, hospitals,
            pharmaceutical and biotech companies, government laboratories, and
            private and contract research organizations. Orders ship to
            institutional addresses.
          </p>
          <div className="tm-actions">
            <Link className="tm-button tm-button-primary" to="/products">
              View catalog
            </Link>
            <Link className="tm-button tm-button-outline" to="/contact">
              Contact us
            </Link>
          </div>
        </div>

        <figure className="tm-about-promise" data-reveal style={{ "--tm-i": 1 } as CSSProperties}>
          <img className="tm-about-promise-mark" src={assetUrl("images/brand/kit/monogram-black.svg")} alt="" width={506} height={407} />
          <blockquote className="tm-about-promise-quote">
            <p>
              <span className="tm-about-promise-open" aria-hidden="true">
                “
              </span>
              Delivering the highest quality research compounds with precision,
              transparency, and absolute integrity.
              <span aria-hidden="true">”</span>
            </p>
          </blockquote>
          <figcaption className="tm-about-promise-by">
            <span>Our promise</span>
            <span>TrueMark BioLabs</span>
          </figcaption>
        </figure>
      </section>
    </div>
  );
}
