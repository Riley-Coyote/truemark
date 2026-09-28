import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { assetUrl } from "../assetUrl";
import { faqs } from "../data";
import { productById, productCutout, sampleRecord, specFor } from "../shop/catalog";
import { findRecord } from "../shop/records";
import { Certificate } from "./Certificate";
import { SequenceChain } from "./SequenceChain";
import { Trace } from "./Trace";
import "./home.css";

/* The client's home page, below the hero, in the client's order and words. */

const lot = sampleRecord.lot;

function scene(name: string) {
  return {
    src: assetUrl(`images/scenes/${name}.webp`),
    srcSet: `${assetUrl(`images/scenes/${name}-sm.webp`)} 1200w, ${assetUrl(`images/scenes/${name}.webp`)} 2400w`,
  };
}

export function PaperTrail() {
  const product = productById(sampleRecord.productId);
  const sequence = product ? specFor(product).sequence : undefined;
  return (
    <section className="tm tm-trail" aria-labelledby="tm-trail-title">
      <header className="tm-trail-head" data-reveal>
        <p className="tm-eyebrow">One lot, end to end</p>
        <h2 id="tm-trail-title" className="tm-heading">
          Every vial has a paper trail.
          <br />
          <span>Here&rsquo;s one.</span>
        </h2>
      </header>
      <div className="tm-trail-aside" data-reveal style={{ "--tm-i": 1 } as CSSProperties}>
        <p className="tm-section-note">
          Each lot moves through the same path before it is released, and the
          record stays open for anyone to read.
        </p>
        <Link className="tm-textlink" to={`/verify?lot=${lot}`}>
          Read this lot&rsquo;s certificate <ArrowRight size={16} strokeWidth={1.6} />
        </Link>
      </div>

      <div className="tm-trail-record" data-reveal>
        <div className="tm-trail-lot">
          <p className="tm-trail-id">
            <span className="tm-trail-label">Lot</span>
            <span className="tm-mono">{lot}</span>
          </p>
          <p className="tm-trail-compound">
            {sampleRecord.compound} · {product?.size}
          </p>
          {sequence && <SequenceChain sequence={sequence} name={sampleRecord.compound} />}
        </div>
        <div className="tm-trail-rail">
          <ol className="tm-trail-track">
            {sampleRecord.trail.map((stop, i) => (
              <li
                key={stop.step}
                className={stop.step === "Released" ? "is-release" : undefined}
                style={{ "--tm-i": i } as CSSProperties}
              >
                <span className="tm-trail-node" aria-hidden="true" />
                <time className="tm-trail-date" dateTime={stop.iso}>
                  {stop.date}
                </time>
                <span className="tm-trail-step">{stop.step}</span>
                <span className="tm-trail-detail">{stop.detail}</span>
              </li>
            ))}
          </ol>
          <span className="tm-trail-progress" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

/** The client's eight classes, each shown by one of its vials: the colour lives in the bottles. */
const classes = [
  { id: "peptide-fragments", number: "Class 01", name: "Peptide fragments", members: "BPC-157 · TB-500 · KPV", vial: "bpc-157-10-mg" },
  { id: "secretagogue-peptides", number: "Class 02", name: "Secretagogue peptides", members: "Tesamorelin · CJC/IPA", vial: "tesamorelin-10-mg" },
  { id: "neuropeptides", number: "Class 03", name: "Neuropeptides", members: "Semax · Selank · DSIP", vial: "semax-10-mg" },
  { id: "mitochondrial-peptides", number: "Class 04", name: "Mitochondrial peptides", members: "MOTS-C", vial: "mots-c-10-mg" },
  { id: "copper-complexes", number: "Class 05", name: "Copper complexes", members: "GHK-Cu", vial: "ghk-cu-100-mg" },
  { id: "amino-acids", number: "Class 06", name: "Amino acids & derivatives", members: "NAD+ · Glutathione", vial: "nad-500-mg" },
  { id: "melanocortin-analogs", number: "Class 07", name: "Melanocortin analogs", members: "PT-141 · Melanotan", vial: "melanotan-ii-10-mg" },
  { id: "lab-supplies", number: "Supplies", name: "Lab supplies", members: "Separate catalog", vial: "bacteriostatic-water-10-ml" },
];

export function Classes() {
  const photo = scene("collection");
  return (
    <section className="tm tm-classes" aria-labelledby="tm-classes-title">
      <div className="tm-classes-photo">
        <img
          src={photo.src}
          srcSet={photo.srcSet}
          sizes="100vw"
          width={2400}
          height={1357}
          alt="Five TrueMark vials on lilac pedestals: NAD+, GHK-Cu, Retatrutide, Tesamorelin and BPC-157."
          loading="lazy"
        />
      </div>
      <header className="tm-classes-head" data-reveal>
        <p className="tm-eyebrow">Catalog</p>
        <h2 id="tm-classes-title" className="tm-heading">
          Organized by
          <br />
          compound class
        </h2>
      </header>
      <div className="tm-classes-intro" data-reveal>
        <p className="tm-section-note">
          Eight classes, each with full specification data — CAS number,
          molecular formula and weight, sequence, purity and identity method,
          solubility and storage.
        </p>
        <Link className="tm-textlink" to="/products">
          View catalog <ArrowRight size={16} strokeWidth={1.6} />
        </Link>
      </div>
      <ul className="tm-class-grid">
        {classes.map((c, i) => {
          const product = productById(c.vial);
          return (
            <li key={c.id} data-reveal style={{ "--tm-i": i % 4 } as CSSProperties}>
              <Link className="tm-class" to={`/products?class=${c.id}`}>
                <span className="tm-class-number">{c.number}</span>
                <span className="tm-class-name">{c.name}</span>
                <span className="tm-class-members">{c.members}</span>
                {product && (
                  <span className="tm-class-vial" aria-hidden="true">
                    <img src={productCutout(product, "sm")} alt="" loading="lazy" draggable={false} />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Verification() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  function lookUp(event: FormEvent) {
    event.preventDefault();
    navigate(`/verify?lot=${encodeURIComponent(value.trim() || lot)}`);
  }

  return (
    <section className="tm tm-night tm-vband" aria-labelledby="tm-vband-title">
      <div className="tm-vband-copy" data-reveal>
        <p className="tm-eyebrow">Verification</p>
        <h2 id="tm-vband-title" className="tm-heading">
          Enter a lot number.
          <br />
          <span>Read the certificate.</span>
        </h2>
        <p className="tm-section-note">
          Every vial carries a QR code and a printed lot number. The code opens
          Verify; the number opens the Certificate of Analysis for that batch — purity, identity,
          endotoxin, sterility, testing laboratory, release date. No account
          required.
        </p>
        <form className="tm-lookup" onSubmit={lookUp} role="search">
          <label className="sr-only" htmlFor="tm-lookup-lot">
            Lot number
          </label>
          <input
            id="tm-lookup-lot"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={lot}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">Look up</button>
        </form>
      </div>

      <Certificate record={findRecord(lot)!} reveal className="tm-vband-cert" />

      <div className="tm-vband-trace" data-reveal>
        <Trace theme="night" peakAt={0.7} height={120} caption={`${lot} · HPLC`} />
      </div>
    </section>
  );
}

const buyers = [
  "Educational institutions",
  "Hospitals and medical institutions",
  "Pharmaceutical and biotech companies",
  "Government laboratories",
  "Private research organizations",
  "Contract research organizations",
];

export function WhoWeSupply() {
  const photo = scene("lab");
  return (
    <section className="tm tm-supply" aria-labelledby="tm-supply-title">
      <img className="tm-supply-photo" src={photo.src} srcSet={photo.srcSet} sizes="100vw" alt="" loading="lazy" />
      <div className="tm-supply-copy" data-reveal>
        <p className="tm-eyebrow">Who we supply</p>
        <h2 id="tm-supply-title" className="tm-heading">
          Laboratory and
          <br />
          institutional buyers
        </h2>
        <p className="tm-section-note">
          Accounts are opened to verified research organizations. Orders ship
          to institutional addresses.
        </p>
      </div>
      <ul className="tm-supply-list">
        {buyers.map((buyer, i) => (
          <li key={buyer} data-reveal style={{ "--tm-i": i } as CSSProperties}>
            {buyer}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Questions() {
  return (
    <section className="tm tm-questions tm-bquestions" aria-labelledby="tm-questions-title">
      <header className="tm-questions-head" data-reveal>
        <h2 id="tm-questions-title" className="tm-heading">
          Common questions
        </h2>
        <p className="tm-section-note">
          Chemistry, storage, and documentation. Everything else is on the
          resources page.
        </p>
        <Link className="tm-textlink" to="/research-blog">
          Read the full resources hub <ArrowRight size={16} strokeWidth={1.6} />
        </Link>
      </header>
      <div className="tm-faq">
        {faqs.map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}
              <Plus size={18} strokeWidth={1.5} aria-hidden="true" />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
