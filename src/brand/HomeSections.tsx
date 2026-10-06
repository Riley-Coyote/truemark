import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { assetUrl } from "../assetUrl";
import { compoundClasses, faqs } from "../data";
import { HomeAssistantEntry } from "../assistant/Assistant";
import { productById, productCutout, sampleRecord, specFor } from "../shop/catalog";
import { pictureLoading } from "../shop/ui";
import { recordFromLot } from "../shop/records";
import { store, useResource } from "../platform/store";
import type { Lot } from "../platform/types";
import { Certificate, CertificateSkeleton } from "./Certificate";
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

type Station = { step: string; iso?: string; date: string; detail: string; state: "done" | "current" | "next"; release?: boolean };

const stationDate = (iso?: string | null) =>
  iso ? { iso, date: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(iso)) } : { date: "—" };

/**
 * The lot walks the client's six stations, in preview as in live. The record keeps three dates
 * (received, tested, released) and a status; a station passed without a recorded date says "Done",
 * the one the lot is at says "Now", and the rest wait.
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
  return [
    { step: "Received", ...when(0, record.receivedAt), detail: "Batch logged", state: state(0) },
    { step: "Quarantined", ...when(1, record.receivedAt), detail: "Held at −20 °C", state: state(1) },
    { step: "Sampled", ...when(2), detail: "Sent to laboratory", state: state(2) },
    { step: status === "testing" ? "Testing" : "Tested", ...when(3, record.testedAt), detail: "HPLC · MS", state: state(3) },
    rejected
      ? { step: "Not released", date: "—", detail: "Did not pass release", state: "next" }
      : { step: "Released", ...(state(4) === "next" ? { date: "Pending" } : when(4, record.releasedAt)), detail: "Certificate published", state: state(4), release: true },
    rejected
      ? { step: "Shipped", date: "—", detail: "Not shipped", state: "next" }
      : { step: status === "released" ? "Shipping" : "Shipped", ...when(5), detail: "Cold chain", state: state(5) },
  ];
}

export function PaperTrail() {
  const current = useResource(() => store.lots.get(lot));
  const product = productById(sampleRecord.productId);
  const sequence = product ? specFor(product).sequence : undefined;
  const trail: Station[] = current.data ? liveStations(current.data) : [];
  const done = trail.filter((stop) => stop.state === "done").length;
  // The lot travels to the station it is at: the one in progress, or else the last one passed.
  const at = trail.findIndex((stop) => stop.state === "current");
  const reached = at >= 0 ? at + 1 : done;
  // The track lays out one column per station; while the record loads, six placeholders hold them.
  const stops = trail.length || (current.loading ? 6 : 0);
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

      <div
        className="tm-trail-record"
        data-reveal
        data-stops={stops}
        style={{ "--tm-trail-stops": stops, "--tm-trail-done": reached } as CSSProperties}
      >
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
            {trail.length === 0 && current.loading && Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="is-next is-skeleton" aria-hidden="true">
                <span className="tm-trail-node" />
                <span className="tm-trail-date"><span className="tm-skel" style={{ width: "2.5em" }} /></span>
                <span className="tm-trail-step"><span className="tm-skel" style={{ width: "5.5em" }} /></span>
                <span className="tm-trail-detail"><span className="tm-skel" style={{ width: "6.5em" }} /></span>
              </li>
            ))}
            {trail.map((stop, i) => (
              <li
                key={stop.step}
                className={`is-${stop.state}${stop.release && stop.state === "done" ? " is-release" : ""}`}
                style={{ "--tm-i": i } as CSSProperties}
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
              </li>
            ))}
          </ol>
          {reached > 0 && <span className="tm-trail-progress" aria-hidden="true" />}
          {trail.length === 0 && (current.loading
            ? <span className="sr-only" role="status">Loading the lot record</span>
            : <p className="tm-section-note" role="status">Lot record unavailable.</p>)}
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
      <div className="tm-classes-photo tm-settle" data-reveal>
        <img
          src={photo.src}
          srcSet={photo.srcSet}
          sizes="100vw"
          width={2400}
          height={1357}
          alt="Five TrueMark vials on lilac pedestals: NAD+, GHK-Cu, Retatrutide, Tesamorelin and BPC-157."
          {...pictureLoading(photo.src)}
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
                    <img src={productCutout(product, "sm")} alt="" {...pictureLoading(productCutout(product, "sm"))} draggable={false} />
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
  const current = useResource(() => store.lots.get(lot));
  const record = current.data ? recordFromLot(current.data) : null;
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  function lookUp(event: FormEvent) {
    event.preventDefault();
    navigate(`/verify?lot=${encodeURIComponent(value.trim() || lot)}`);
  }

  return (
    <section className="tm tm-night tm-night-studio tm-vband" aria-labelledby="tm-vband-title">
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

      {record ? <Certificate record={record} reveal className="tm-vband-cert" />
        : current.loading ? <CertificateSkeleton className="tm-vband-cert" />
        : <div className="tm-vband-cert" role="status">
            Lot record unavailable.
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
