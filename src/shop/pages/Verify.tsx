import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Certificate } from "../../brand/Certificate";
import { CertificateLibrary } from "../../brand/CertificateLibrary";
import { ProductStage } from "../../brand/ProductStage";
import { productById, productCutout, sampleRecord } from "../catalog";
import { useReveal } from "../motion";
import { LIVE } from "../../platform/mode";
import { store, useResource } from "../../platform/store";
import { normaliseLot, recordFromLot } from "../records";
import "../../brand/verify.css";

const steps = [
  [
    "Find the lot number",
    // The client's line said "below the compound name"; on the printed label it sits on the left, under LOT.
    "Printed on every vial label, on the left under LOT. Format: letters, digits, and a dash.",
  ],
  ["Scan the vial, then enter it", "The QR code on the label opens this page on your phone. Type the lot number printed beside it."],
  ["Read and retain the CoA", "Review purity, identity, endotoxin and sterility results, and retain the certificate with your laboratory records."],
];

const meanings = [
  ["Purity · HPLC", "High-performance liquid chromatography measures the fraction of the sample that is the stated compound."],
  ["Identity · MS", "Mass spectrometry confirms the molecular mass matches the stated compound and sequence."],
  ["Endotoxin · LAL", "Limulus amebocyte lysate assay quantifies bacterial endotoxin, reported in EU per milligram."],
  ["Sterility", "Culture-based testing verifies the absence of viable microbial growth in the sampled vials."],
];

/** Where the lot is printed: the vial, with a loupe over the LOT line of its label. */
function LotHint() {
  const vial = productById(sampleRecord.productId)!;
  const src = productCutout(vial, "lg");
  return (
    <figure className="tm-lothint" aria-hidden="true">
      <div className="tm-lothint-vial">
        <span className="tm-lothint-glow" />
        <img src={src} alt="" draggable={false} />
        <span className="tm-lothint-loupe">
          <img src={src} alt="" draggable={false} />
        </span>
      </div>
      <figcaption>
        The lot number is printed on the left of the label, under <span className="tm-mono">LOT</span>.
      </figcaption>
    </figure>
  );
}

export default function Verify() {
  const root = useRef<HTMLDivElement>(null);
  const result = useRef<HTMLElement>(null);
  const [params, setParams] = useSearchParams();
  const submitted = params.get("lot") ?? "";
  const [value, setValue] = useState(submitted);
  useEffect(() => setValue(submitted), [submitted]);

  const lookup = useResource(
    () => (submitted ? store.lots.get(normaliseLot(submitted)) : Promise.resolve(null)),
    [submitted],
  );
  const record = lookup.data ? recordFromLot(lookup.data) : null;
  // Re-observe once the result mounts; it arrives after the async lookup.
  useReveal(root, `${submitted}:${lookup.loading}`);

  // Bring the certificate into view once it arrives, unless it already is.
  useEffect(() => {
    if (!submitted || lookup.loading) return;
    const el = result.current;
    if (el && el.getBoundingClientRect().top > window.innerHeight * 0.55) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [submitted, lookup.loading]);

  function lookUp(lot: string) {
    const clean = normaliseLot(lot);
    if (clean) setParams({ lot: clean }, { preventScrollReset: true });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    lookUp(value);
  }

  return (
    <div className="tm-page tm-verify-page" ref={root}>
      <section className="tm tm-night tm-vhero" aria-labelledby="tm-verify-title">
        <div className="tm-vhero-copy">
          <p className="tm-eyebrow">Verification</p>
          <h1 id="tm-verify-title" className="tm-display">
            Enter a lot number.
            <br />
            <span>Read the certificate.</span>
          </h1>
          <p className="tm-section-note">
            Every vial carries a QR code and a printed lot number. The code opens
            this page; the number opens the Certificate of Analysis for that batch.
            No account required.
          </p>
          <form className="tm-lookup tm-vhero-form" onSubmit={submit} role="search">
            <label className="sr-only" htmlFor="tm-verify-lot">
              Lot number
            </label>
            <input
              id="tm-verify-lot"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={LIVE ? "Enter your lot number" : `Enter lot number — e.g. ${sampleRecord.lot}`}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
            />
            <button type="submit">Look up</button>
          </form>
          {/* The sample lot exists only in the preview world; live has no released lot to offer yet. */}
          {!LIVE && (
            <p className="tm-vhero-try">
              Try a released lot:
              <button type="button" className="tm-vhero-chip tm-mono" onClick={() => lookUp(sampleRecord.lot)}>
                {sampleRecord.lot}
              </button>
            </p>
          )}
        </div>
        <LotHint />
      </section>

      <section
        ref={result}
        id="tm-certificate"
        className="tm tm-vresult"
        aria-live="polite"
        aria-label="Certificate of Analysis"
      >
        {!submitted ? (
          <div className="tm-vresult-empty">
            <p className="tm-vresult-kicker">Certificate of Analysis</p>
            <p className="tm-section-note">The certificate for your lot will appear here after lookup.</p>
          </div>
        ) : lookup.loading ? (
          <div className="tm-vresult-empty" aria-busy="true">
            <p className="tm-vresult-kicker">Certificate of Analysis</p>
            <p className="tm-section-note">
              Looking up <span className="tm-mono">{normaliseLot(submitted)}</span>
            </p>
          </div>
        ) : record ? (
          <div className="tm-vresult-found">
            <div className="tm-vresult-vial" data-reveal>
              <ProductStage items={[record.product]} index={0} prev={-1} zoomed={false} />
              <Link className="tm-textlink" to={`/product/${record.product.id}`}>
                {record.product.name} {record.product.size} <ArrowRight size={16} strokeWidth={1.6} />
              </Link>
            </div>
            <Certificate record={record} reveal className="tm-vresult-cert" />
          </div>
        ) : (
          <div className="tm-vresult-empty tm-vresult-missing" data-reveal>
            <p className="tm-vresult-kicker">No record found</p>
            <p className="tm-vresult-title">
              Nothing matches <span className="tm-mono">{normaliseLot(submitted)}</span>.
            </p>
            <p className="tm-section-note">
              Check each character against your label; the letter O and the number
              0 are easy to confuse. If it still doesn’t resolve, the team will check
              it for you.
            </p>
            <Link className="tm-textlink" to="/contact">
              Ask the team to check a lot <ArrowRight size={16} strokeWidth={1.6} />
            </Link>
          </div>
        )}
      </section>

      <CertificateLibrary />

      <section className="tm tm-vsteps" aria-labelledby="tm-vsteps-title">
        <header className="tm-vsteps-head" data-reveal>
          <p className="tm-eyebrow">How it works</p>
          <h2 id="tm-vsteps-title" className="tm-heading">
            Three steps to the certificate
          </h2>
        </header>
        <ol className="tm-vsteps-list" data-review="qr-or-nfc">
          {steps.map(([title, text], i) => (
            <li key={title} data-reveal style={{ "--tm-i": i } as CSSProperties}>
              <span className="tm-vsteps-index">0{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="tm tm-vmeans" aria-labelledby="tm-vmeans-title">
        <header className="tm-vsteps-head" data-reveal>
          <p className="tm-eyebrow">Reading a CoA</p>
          <h2 id="tm-vmeans-title" className="tm-heading">
            What each result means
          </h2>
          <Link className="tm-textlink" to="/research-blog/how-to-read-a-certificate-of-analysis">
            How to read a Certificate of Analysis <ArrowRight size={16} strokeWidth={1.6} />
          </Link>
        </header>
        <dl className="tm-vmeans-list">
          {meanings.map(([label, text], i) => (
            <div key={label} data-reveal style={{ "--tm-i": i } as CSSProperties}>
              <dt>{label}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
