import { useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { compoundClasses, faqs } from "../data";
import { assetUrl } from "../assetUrl";
import { HomeAssistantEntry } from "../assistant/Assistant";
import { productById, productCutout, sampleRecord, specFor } from "../shop/catalog";
import { store, useResource } from "../platform/store";
import type { Lot } from "../platform/types";
import { SequenceChain } from "./SequenceChain";
import "./home.css";
import "./paper-trail.css";

/* The client's home page, below the hero, in the client's order and words. */

const lot = sampleRecord.lot;

/** The lot line of the featured lot's label, as the client prints it: their brand kit's own label build (brand-kit/
 *  10_Source_Files/build.py, label 08, set in the kit's fonts), cut about "LOT:" and its number. The reading glass shows
 *  it only while the featured lot is the one this label prints. */
const PRINTED_LOT = { lot: "TM-BPC10-2609-01", print: assetUrl("images/labels/bpc-157-10-mg-lot.webp") } as const;

/**
 * Where a lot number is on a vial: the featured lot's vial on the collection's pedestal, a reading glass beside it on
 * its label's lot line, and a hairline from the glass along the line's foot to the number as printed on the vial.
 */
function LotOnTheVial() {
  const product = productById(sampleRecord.productId);
  if (!product || lot !== PRINTED_LOT.lot) return null;
  return (
    <div className="tm-lookup-still" role="img" aria-label={`A ${product.name} vial. Its lot number, ${lot}, is printed on its label under “Lot”.`}>
      <span className="tm-lookup-seat">
        <img
          className="tm-lookup-pedestal"
          src={assetUrl("images/scenes/pedestal-sm.webp")}
          srcSet={`${assetUrl("images/scenes/pedestal-sm.webp")} 351w, ${assetUrl("images/scenes/pedestal.webp")} 703w`}
          sizes="15rem"
          width={351}
          height={192}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
        />
        <span className="tm-lookup-vial">
          <img
            src={productCutout(product, "sm")}
            srcSet={`${productCutout(product, "sm")} 289w, ${productCutout(product, "lg")} 578w`}
            sizes="7.5rem"
            width={289}
            height={556}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </span>
      </span>
      <span className="tm-lookup-lead" />
      <span className="tm-lookup-glass">
        <img src={PRINTED_LOT.print} width={580} height={580} alt="" loading="lazy" decoding="async" draggable={false} />
      </span>
    </div>
  );
}

type Station = {
  step: string;
  iso?: string;
  date: string;
  detail: string;
  /** What the client promises of this station for every lot, in the client's words. */
  note?: ReactNode;
  state: "done" | "current" | "next";
  release?: boolean;
};

const stationDate = (iso?: string | null) =>
  iso ? { iso, date: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(iso)) } : { date: "—" };

/**
 * The lot walks the client's six stations, in preview as in live. The record keeps three dates
 * (received, tested, released) and a status; a station passed without a recorded date says "Done",
 * the one the lot is at says "Now", and the rest wait. Testing and shipping carry the client's own
 * promises for every lot: independent testing on receipt, and the cold chain.
 */
function liveStations(record: Lot): Station[] {
  const { status } = record;
  const at = { quarantine: 1, testing: 3, released: 5, archived: 6, rejected: 4 }[status];
  const state = (index: number): Station["state"] => (index < at ? "done" : index === at ? "current" : "next");
  const when = (index: number, iso?: string | null) => {
    const kind = state(index);
    if (kind === "done") return iso ? stationDate(iso) : { date: "Done" };
    return { date: kind === "current" ? "Now" : "Next" };
  };
  const rejected = status === "rejected";
  const tested = <><b>Independently tested</b> Every lot tested on receipt at a contracted laboratory.</>;
  const coldChain = "Temperature-controlled storage, and transit when applicable.";
  return [
    { step: "Received", ...when(0, record.receivedAt), detail: "Batch logged", state: state(0) },
    { step: "Quarantined", ...when(1, record.receivedAt), detail: "Held at −20 °C", state: state(1) },
    { step: "Sampled", ...when(2), detail: "Sent to laboratory", state: state(2) },
    { step: status === "testing" ? "Testing" : "Tested", ...when(3, record.testedAt), detail: "HPLC · MS", note: tested, state: state(3) },
    rejected
      ? { step: "Not released", date: "—", detail: "Did not pass release", state: "next" }
      : { step: "Released", ...(state(4) === "next" ? { date: "Pending" } : when(4, record.releasedAt)), detail: "Certificate published", state: state(4), release: true },
    rejected
      ? { step: "Shipped", date: "—", detail: "Not shipped", note: coldChain, state: "next" }
      : { step: status === "released" ? "Shipping" : "Shipped", ...when(5), detail: "Cold chain", note: coldChain, state: state(5) },
  ];
}

/** The featured lot's record as a strip of six stations, the lot travelling it to where it is now. */
function LotRecord({ record, loading }: { record?: Lot | null; loading: boolean }) {
  const product = productById(sampleRecord.productId);
  const sequence = product ? specFor(product).sequence : undefined;
  const trail: Station[] = record ? liveStations(record) : [];
  const done = trail.filter((stop) => stop.state === "done").length;
  // The lot travels to the station it is at: the one in progress, or else the last one passed.
  const at = trail.findIndex((stop) => stop.state === "current");
  const reached = at >= 0 ? at + 1 : done;
  // The track lays out one column per station; while the record loads, six placeholders hold them.
  const stops = trail.length || (loading ? 6 : 0);
  return (
    <div
      className="tm-trail-record"
      data-reveal
      data-stops={stops}
      style={{ "--tm-trail-stops": stops, "--tm-trail-done": reached } as CSSProperties}
    >
      <div className="tm-trail-head">
        <h2 id="tm-trail-title" className="tm-trail-title">
          Every vial has a paper trail. <span>Here&rsquo;s one.</span>
        </h2>
        <p className="tm-trail-note">
          Each lot moves through the same path before it is released, and the
          record stays open for anyone to read.
        </p>
      </div>
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
          {/* While the lot's record is on the way, its six stations hold their places. */}
          {trail.length === 0 && loading && Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="is-next is-skeleton" aria-hidden="true">
              <span className="tm-trail-node" />
              <span className="tm-trail-date"><span className="tm-skel" style={{ width: "2.5em" }} /></span>
              <span className="tm-trail-step"><span className="tm-skel" style={{ width: "5.5em" }} /></span>
              <span className="tm-trail-detail"><span className="tm-skel" style={{ width: "6.5em" }} /></span>
            </li>
          ))}
          {/* The station the lot has reached carries it: on a phone the lot's dot rests there (home.css). */}
          {trail.map((stop, i) => (
            <li
              key={stop.step}
              className={`is-${stop.state}${stop.release && stop.state === "done" ? " is-release" : ""}`}
              style={{ "--tm-i": i } as CSSProperties}
              data-here={i === reached - 1 ? "" : undefined}
            >
              <span className="tm-trail-node" aria-hidden="true" />
              {stop.iso ? (
                <time className="tm-trail-date" dateTime={stop.iso}>
                  {stop.date}
                </time>
              ) : (
                <span className="tm-trail-date">{stop.date}</span>
              )}
              <span className="tm-trail-step">{stop.step}</span>
              <span className="tm-trail-detail">{stop.detail}</span>
              {stop.note && <span className="tm-trail-promise">{stop.note}</span>}
            </li>
          ))}
        </ol>
        {reached > 0 && <span className="tm-trail-progress" aria-hidden="true" />}
        {trail.length === 0 && (loading
          ? <span className="sr-only" role="status">Loading the lot record</span>
          : <p className="tm-section-note" role="status">Lot record unavailable.</p>)}
      </div>
    </div>
  );
}

/** A class's compounds, as the client lists them, set so a line breaks only between compounds or after a blend's
 *  slash, never inside a name ("CJC (No DAC)", "TB-500"), and each separator stays with the name before it. The words
 *  read exactly as written. */
function memberLine(members: string): ReactNode[] {
  const names = members.split(" · ").flatMap((name, k, all) => {
    const parts = name.split(" / ").map((part) => part.replaceAll(" ", "\u00a0"));
    return parts.map((part, j) => (j < parts.length - 1 ? `${part}\u00a0/` : k < all.length - 1 ? `${part}\u00a0·` : part));
  });
  return names.flatMap((name, k) => [k ? " " : "", name.includes("-") ? <span key={k} className="tm-class-word">{name}</span> : name]);
}

/**
 * The catalog by compound class, as the client's site sets it: the heading and the way into the catalog, then the
 * eight classes as cards, each with its number, name and compounds. Each card is a corner of the opening's room: its
 * lilac wall, the window's light falling across it, and one of the class's vials standing whole on the room's pedestal,
 * the light behind it taking the colour of its label. Each card opens the catalog at its class.
 */
export function ClassIndex() {
  return (
    <>
      <section className="tm tm-index" aria-labelledby="tm-index-title">
        <header className="tm-index-head" data-reveal>
          <p className="tm-eyebrow">Catalog</p>
          <h2 id="tm-index-title" className="tm-heading">
            Organized by
            <br />
            compound class
          </h2>
          <p className="tm-section-note">
            Eight classes, each with full specification data — CAS number,
            molecular formula and weight, sequence, purity and identity method,
            solubility and storage.
          </p>
        </header>
        <Link className="tm-textlink tm-index-all" to="/products" data-reveal>
          View catalog <ArrowRight size={16} strokeWidth={1.6} />
        </Link>
        <ul className="tm-class-grid">
          {compoundClasses.map((c, i) => {
            const product = productById(c.vial ?? "");
            return (
              <li key={c.id} data-reveal style={{ "--tm-i": i % 4 } as CSSProperties}>
                <Link className="tm-class" to={`/products?class=${c.id}`} style={{ "--tm-class-hue": c.labelColor } as CSSProperties}>
                  <span className="tm-class-light" aria-hidden="true" />
                  <span className="tm-class-number">Class {String(c.position).padStart(2, "0")}</span>
                  <span className="tm-class-name">{c.name}</span>
                  <span className="tm-class-members">{memberLine(c.members)}</span>
                  <span className="tm-class-stage" aria-hidden="true">
                    <span className="tm-class-glow" />
                    <span className="tm-class-seat">
                      <img
                        className="tm-class-pedestal"
                        src={assetUrl("images/scenes/pedestal-sm.webp")}
                        srcSet={`${assetUrl("images/scenes/pedestal-sm.webp")} 351w, ${assetUrl("images/scenes/pedestal.webp")} 703w`}
                        sizes="(max-width: 640px) 38vw, (max-width: 1099px) 34vw, 17vw"
                        width={351}
                        height={192}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                      {product && (
                        <span className="tm-class-vial">
                          {/* Drawn no larger than its cutout: the small one, or the full one for denser screens. */}
                          <img
                            src={productCutout(product, "sm")}
                            srcSet={`${productCutout(product, "sm")} 289w, ${productCutout(product, "lg")} 578w`}
                            sizes="(max-width: 640px) 19vw, (max-width: 1099px) 17vw, 9vw"
                            width={289}
                            height={556}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                          />
                        </span>
                      )}
                    </span>
                    <span className="tm-class-mist" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

/**
 * The lot's paper trail, in daylight, after the closer look has shown its certificate: the featured lot's six stations,
 * then the lookup, in the client's words, for the reader's own lot. The featured lot's certificate is the closer look's
 * (Sequence.tsx); its number here opens it.
 */
export function PaperTrail() {
  const current = useResource(() => store.lots.get(lot));
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  function lookUp(event: FormEvent) {
    event.preventDefault();
    navigate(`/verify?lot=${encodeURIComponent(value.trim() || lot)}`);
  }

  return (
    <>
      <section className="tm tm-papertrail" aria-labelledby="tm-trail-title">
        <LotRecord record={current.data} loading={current.loading} />
      </section>
      <section className="tm tm-papertrail tm-lookup-section" aria-labelledby="tm-proof-title">
        <div className="tm-lookup-copy" data-reveal>
          <p className="tm-eyebrow">One lot, end to end</p>
          <h2 id="tm-proof-title" className="tm-heading">
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
        </div>
        <div className="tm-lookup-use" data-reveal style={{ "--tm-i": 1 } as CSSProperties}>
          <LotOnTheVial />
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
          <p className="tm-proof-featured">
            <span className="tm-proof-featured-label">Featured lot</span>
            <Link className="tm-mono tm-lookup-featured" to={`/verify?lot=${encodeURIComponent(lot)}`}>
              {lot} <ArrowRight size={15} strokeWidth={1.6} aria-hidden="true" />
            </Link>
          </p>
        </div>
      </section>
    </>
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

/** The client's research-use terms, as its trust row set them: a title and its line. */
const researchUse = [
  ["Research use only", "Supplied for laboratory research applications."],
  ["Not for human use", "Not for human or veterinary administration."],
];

/**
 * Buying with us: one closing spread on paper. Who can buy, and the way to apply, beside the questions
 * that remain, the resources and the assistant.
 */
export function BuyingWithUs() {
  return (
    <section className="tm tm-closing" aria-label="Buying with us">
      <div className="tm-closing-buyers" data-reveal>
        <p className="tm-eyebrow">Who we supply</p>
        <h2 id="tm-supply-title" className="tm-heading">
          Laboratory and institutional buyers
        </h2>
        <p className="tm-section-note">
          Accounts are opened to verified research organizations.
        </p>
        {/* Each column's ruled list starts on one line across the spread (home.css). */}
        <div className="tm-closing-body">
          <ul className="tm-closing-list" aria-labelledby="tm-supply-title">
            {buyers.map((buyer) => (
              <li key={buyer}>{buyer}</li>
            ))}
          </ul>
          <Link className="tm-button tm-button-primary tm-closing-apply" to="/access/apply">
            Apply for a research account
          </Link>
          <dl className="tm-closing-terms">
            {researchUse.map(([title, text]) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="tm-closing-questions" data-reveal style={{ "--tm-i": 1 } as CSSProperties}>
        <h2 id="tm-questions-title" className="tm-heading">
          Common questions
        </h2>
        <div className="tm-closing-more">
          <p className="tm-section-note">
            Chemistry, storage, and documentation. Everything else is on the
            resources page.
          </p>
          <Link className="tm-textlink" to="/research-blog">
            Read the full resources hub <ArrowRight size={16} strokeWidth={1.6} />
          </Link>
        </div>
        <div className="tm-closing-body">
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
        </div>
      </div>
    </section>
  );
}
