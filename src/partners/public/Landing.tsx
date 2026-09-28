import { useRef } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Images, Link2, Receipt, Wallet } from "lucide-react";
import { SectionLink } from "../../SectionLink";
import { BrandDot } from "../../brand/HeroShelf";
import { useReveal } from "../../shop/motion";
import { SAMPLE_TERMS, disclosure, disclosurePlacement, doRules, dontRules, ordinal, percent, scene } from "../program";
import { VialTrio } from "../VialTrio";
import { useTitle } from "./title";

const steps = [
  {
    title: "Apply",
    detail: "Tell us where you publish and how you would feature TrueMark. Every application is reviewed before a code is issued.",
  },
  {
    title: "Share your link or code",
    detail: `Your code takes ${percent(SAMPLE_TERMS.discount)} off for your audience, and your link carries it to checkout.`,
  },
  {
    title: "Earn on every referred order",
    detail: `${percent(SAMPLE_TERMS.rate)} of the order subtotal after the discount, paid monthly.`,
  },
];

const features = [
  { icon: Link2, title: "Links and codes", text: "Build a link to any page, copy your code, and copy the disclosure that goes with it." },
  { icon: Receipt, title: "Referrals", text: "Every referred order and its commission, from pending to paid." },
  { icon: Wallet, title: "Payouts", text: `Monthly, on the ${ordinal(SAMPLE_TERMS.payoutDay)}, with a statement for each one.` },
  { icon: Images, title: "Guidelines and assets", text: "The full guidelines, with the product renders, cut-outs and logo for your own layouts." },
];

const index = (i: number) => String(i + 1).padStart(2, "0");

/** The partner program's front page, in the shop's voice: the vials, the terms, the rules. */
export default function Landing() {
  useTitle("Partner program");
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  const photo = scene("trio");

  return (
    <div className="tm-page" ref={root}>
      <section className="tm pp-hero" aria-labelledby="pp-hero-title">
        <div className="pp-hero-head">
          <p className="tm-pill-eyebrow">
            <span className="tm-brand-dot" aria-hidden="true" />
            By application
          </p>
          <h1 id="pp-hero-title" className="tm-display pp-hero-title">
            The TrueMark
            <br />
            partner program
            <BrandDot />
          </h1>
        </div>
        <div className="pp-hero-aside">
          <p className="pp-hero-lead">For educators and reviewers who talk about research the right way.</p>
          <div className="tm-actions">
            <Link className="tm-button tm-button-primary" to="/partners/apply">
              Apply to partner
            </Link>
            <SectionLink className="tm-button tm-button-outline" section="guidelines">
              Read the guidelines
            </SectionLink>
          </div>
        </div>
        <div className="pp-hero-photo">
          <img
            src={photo.src}
            srcSet={photo.srcSet}
            sizes="100vw"
            width={2400}
            height={1357}
            alt="Three TrueMark vials on lilac pedestals: BPC-157, Retatrutide and GHK-Cu."
            fetchPriority="high"
          />
        </div>
      </section>

      <section className="tm pp-terms" aria-labelledby="pp-terms-title">
        <h2 id="pp-terms-title" className="tm-eyebrow pp-terms-title">
          Sample terms
        </h2>
        <dl className="pp-terms-list" data-review="partner-terms">
          <div data-reveal style={{ "--tm-i": 0 } as CSSProperties}>
            <dt>Commission</dt>
            <dd className="tm-figure">
              {Math.round(SAMPLE_TERMS.rate * 100)}
              <small>%</small>
            </dd>
            <dd className="pp-terms-text">On every referred order, of the subtotal after your audience’s discount.</dd>
          </div>
          <div data-reveal style={{ "--tm-i": 1 } as CSSProperties}>
            <dt>For your audience</dt>
            <dd className="tm-figure">
              {Math.round(SAMPLE_TERMS.discount * 100)}
              <small>% off</small>
            </dd>
            <dd className="pp-terms-text">With your code, or automatically through your link.</dd>
          </div>
          <div data-reveal style={{ "--tm-i": 2 } as CSSProperties}>
            <dt>Payouts</dt>
            <dd className="tm-figure">Monthly</dd>
            <dd className="pp-terms-text">
              On the {ordinal(SAMPLE_TERMS.payoutDay)}, for the previous month’s approved commissions.
            </dd>
          </div>
        </dl>
      </section>

      <section className="tm pp-how" aria-labelledby="pp-how-title">
        <header className="pp-how-head" data-reveal>
          <p className="tm-eyebrow">How it works</p>
          <h2 id="pp-how-title" className="tm-heading">
            Apply, share, earn.
            <br />
            <span>Every order on the record.</span>
          </h2>
        </header>
        <p className="tm-section-note pp-how-note" data-reveal style={{ "--tm-i": 1 } as CSSProperties}>
          Each referred order is recorded against your code, the way every vial is recorded against its lot.
        </p>
        <div className="pp-track" data-reveal>
          <ol className="pp-track-list">
            {steps.map((step, i) => (
              <li key={step.title} style={{ "--tm-i": i } as CSSProperties}>
                <span className="pp-track-node" aria-hidden="true" />
                <span className="pp-track-index">{index(i)}</span>
                <h3 className="pp-track-step">{step.title}</h3>
                <p className="pp-track-detail">{step.detail}</p>
              </li>
            ))}
          </ol>
          <span className="pp-track-progress" aria-hidden="true" />
        </div>
      </section>

      <section className="tm tm-night pp-guides" id="guidelines" aria-labelledby="pp-guides-title">
        <header className="pp-guides-head" data-reveal>
          <p className="tm-eyebrow">Compliance</p>
          <h2 id="pp-guides-title" className="tm-heading">
            Guidelines come first.
            <br />
            <span>Talk about the material, never the body.</span>
          </h2>
        </header>
        <p className="tm-section-note pp-guides-note" data-reveal style={{ "--tm-i": 1 } as CSSProperties}>
          TrueMark supplies compounds for laboratory research. Every partner agrees to these guidelines before a code
          is issued, and every post is held to them.
        </p>

        <div className="pp-rules" data-reveal>
          <h3 className="pp-rules-title">Do</h3>
          <ol className="pp-rules-list">
            {doRules.map((rule, i) => (
              <li key={rule.title}>
                <span className="pp-rules-index">{index(i)}</span>
                <p className="pp-rule-title">{rule.title}</p>
                <p className="pp-rule-detail">{rule.detail}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="pp-rules is-dont" data-reveal style={{ "--tm-i": 1 } as CSSProperties}>
          <h3 className="pp-rules-title">Don’t</h3>
          <ol className="pp-rules-list">
            {dontRules.map((rule, i) => (
              <li key={rule.title}>
                <span className="pp-rules-index">{index(i)}</span>
                <p className="pp-rule-title">{rule.title}</p>
                <p className="pp-rule-detail">{rule.detail}</p>
              </li>
            ))}
          </ol>
        </div>

        <figure className="pp-specimen" data-reveal>
          <figcaption className="pp-specimen-label">The disclosure, in every post</figcaption>
          <blockquote className="pp-specimen-line">
            <p>{disclosure()}</p>
          </blockquote>
        </figure>
        <div className="pp-placement" data-reveal style={{ "--tm-i": 1 } as CSSProperties}>
          <h3 className="pp-rules-title">Where it goes</h3>
          <ul className="pp-placement-list">
            {disclosurePlacement.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="tm pp-portal" aria-labelledby="pp-portal-title">
        <header className="pp-portal-head" data-reveal>
          <p className="tm-eyebrow">The partner portal</p>
          <h2 id="pp-portal-title" className="tm-heading">
            From your link
            <br />
            <span>to your payout.</span>
          </h2>
        </header>
        <p className="tm-section-note pp-portal-note" data-reveal style={{ "--tm-i": 1 } as CSSProperties}>
          Your own dashboard for the program. It shows each referred order’s number, date and amounts; the buyer’s
          identity always stays with TrueMark.
        </p>
        <p className="pp-link-specimen" data-reveal>
          <span className="pp-link-host">truemarkbiolabs.com</span>
          <wbr />
          <span className="pp-link-path">/verify</span>
          <wbr />
          <span className="pp-link-ref">?ref=YOURCODE</span>
        </p>
        <ul className="pp-features">
          {features.map((feature, i) => (
            <li key={feature.title} data-reveal style={{ "--tm-i": i } as CSSProperties}>
              <feature.icon aria-hidden="true" strokeWidth={1.5} />
              <p className="pp-feature-title">{feature.title}</p>
              <p className="pp-feature-text">{feature.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="tm pp-cta" aria-labelledby="pp-cta-title">
        <VialTrio className="pp-cta-trio" />
        <div className="pp-cta-copy" data-reveal>
          <h2 id="pp-cta-title" className="tm-display">
            Talk about research
            <br />
            the right way
            <BrandDot />
          </h2>
          <p className="tm-section-note pp-cta-note">
            The application is one short form. Each one is reviewed before a code is issued.
          </p>
          <div className="tm-actions">
            <Link className="tm-button tm-button-primary" to="/partners/apply">
              Apply to partner
            </Link>
            <Link className="tm-textlink" to="/partners/sign-in">
              Already a partner? Sign in <ArrowRight size={16} strokeWidth={1.6} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
