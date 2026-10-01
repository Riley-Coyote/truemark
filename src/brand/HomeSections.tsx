import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { assetUrl } from "../assetUrl";
import { compoundClasses, faqs } from "../data";
import { HomeAssistantEntry } from "../assistant/Assistant";
import { productById, productCutout, sampleRecord, specFor } from "../shop/catalog";
import { findRecord, recordFromLot } from "../shop/records";
import { LIVE } from "../platform/mode";
import { store, useResource } from "../platform/store";
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
  const current = useResource(() => LIVE ? store.lots.get(lot) : Promise.resolve(null));
  const product = productById(sampleRecord.productId);
  const sequence = product ? specFor(product).sequence : undefined;
  const trail = LIVE ? [
    { step: "Received", iso: current.data?.receivedAt, detail: "Batch logged" },
    { step: "Tested", iso: current.data?.testedAt, detail: "HPLC · MS" },
    { step: "Released", iso: current.data?.releasedAt, detail: "Certificate published" },
  ].flatMap((stop) => stop.iso ? [{ ...stop, iso: stop.iso, date: new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(stop.iso)) }] : []) : sampleRecord.trail;
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
            {trail.map((stop, i) => (
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
          {trail.length > 0 && <span className="tm-trail-progress" aria-hidden="true" />}
          {LIVE && trail.length === 0 && <p className="tm-section-note" role="status">{current.loading ? "Loading lot record…" : current.error ? "Lot record unavailable." : "Certificate on release"}</p>}
        </div>
      </div>
    </section>
  );
}

/** The client's eight classes, each shown by one of its vials: the colour lives in the bottles. */
export function Classes() {
  const classes = compoundClasses.map((c) => ({ ...c, number: `Class ${String(c.position).padStart(2, "0")}` }));
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
          const product = productById(c.vial ?? "");
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
  const current = useResource(() => LIVE ? store.lots.get(lot) : Promise.resolve(null));
  const record = LIVE ? current.data ? recordFromLot(current.data) : null : findRecord(lot);
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

      {record ? <Certificate record={record} reveal className="tm-vband-cert" /> : <div className="tm-vband-cert" role="status">
        {current.loading ? "Loading lot record…" : "Lot record unavailable."}
        {current.error && <button type="button" className="tm-textlink" onClick={current.reload}>Try again</button>}
      </div>}

      <div className="tm-vband-trace" data-reveal>
        <Trace theme="night" peakAt={0.7} height={120} caption={record?.status === "released" && record.results.length ? `${lot} · HPLC` : "HPLC · purity specification"} />
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
  return (
    <section className="tm tm-supply" aria-labelledby="tm-supply-title">
      <div className="tm-supply-copy" data-reveal>
        <p className="tm-eyebrow">Who we supply</p>
        <h2 id="tm-supply-title" className="tm-heading">
          Laboratory and
          <br />
          institutional buyers
        </h2>
        <p className="tm-section-note">
          Accounts are opened to verified research organizations.
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
      <HomeAssistantEntry />
    </section>
  );
}
