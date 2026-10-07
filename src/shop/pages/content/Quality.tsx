import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "../../../assetUrl";
import { BrandDot } from "../../../brand/HeroShelf";
import { Trace } from "../../../brand/Trace";
import { PURITY_SPEC } from "../../../platform/certificate-records";
import { Track } from "../../../brand/Track";
import type { TrackStop } from "../../../brand/Track";
import { useReveal } from "../../motion";
import "../../../brand/quality.css";

/*
 * The client's Quality page, in the client's order and words: the opening, the
 * process from source batch to released vial, the release specification, the
 * records kept for every lot, and the closing prompt to verify a lot.
 */

/** A scene photograph at both of its sizes. */
function scene(name: string, width: number) {
  return {
    src: assetUrl(`images/scenes/${name}.webp`),
    srcSet: `${assetUrl(`images/scenes/${name}-sm.webp`)} ${width / 2}w, ${assetUrl(`images/scenes/${name}.webp`)} ${width}w`,
  };
}

const process: TrackStop[] = [
  {
    kicker: "Step 01",
    title: "Sourcing",
    text: "Raw material is purchased against a written specification, with the supplier batch number recorded.",
  },
  {
    kicker: "Step 02",
    title: "Receipt & quarantine",
    text: "Incoming lots are logged, assigned a TrueMark lot number, and held in temperature-controlled quarantine.",
  },
  {
    kicker: "Step 03",
    title: "Independent testing",
    text: "Samples are sent to a contracted laboratory for HPLC purity, MS identity, endotoxin and sterility testing.",
  },
  {
    kicker: "Step 04",
    title: "CoA review & release",
    text: "Results are reviewed against specification. Only approved lots are released; the CoA is published to the lot record.",
    release: true,
  },
  {
    kicker: "Step 05",
    title: "Cold-chain storage",
    text: "Released vials are stored at −20 °C and shipped with temperature control when applicable.",
  },
];

const specification: [test: string, method: string, requirement: string][] = [
  ["Purity", "HPLC", `≥\u00a0${PURITY_SPEC}%`],
  ["Identity", "Mass spectrometry", "Mass confirmed"],
  ["Endotoxin", "LAL assay", "< 0.25 EU/mg"],
  ["Sterility", "Culture", "No growth"],
  ["Net content", "Gravimetric", "Label claim met"],
];

const records: [name: string, text: ReactNode][] = [
  ["Batch record", "Supplier batch number, receipt date, quarantine log, and assigned TrueMark lot number."],
  [
    "Certificate of Analysis",
    "Full laboratory result set for the lot, published to the lot record and retrievable by lot number.",
  ],
  [
    "Retained samples",
    <>
      Vials from each lot are retained at −20&nbsp;°C for <span className="tm-quality-keep">re-testing</span> if a
      question is ever raised.
    </>,
  ],
  ["Distribution log", "Which lots shipped where and when — so any lot can be traced forward as well as back."],
];

function Opening() {
  const photo = scene("trio", 2400);
  return (
    <section className="tm tm-quality-open" aria-labelledby="tm-quality-title">
      <header className="tm-quality-open-head">
        <p className="tm-eyebrow">Quality</p>
        <h1 id="tm-quality-title" className="tm-quality-open-title">
          Quality,
          <br />
          documented
          <BrandDot />
        </h1>
      </header>
      <div className="tm-quality-open-photo">
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
  );
}

function Process() {
  return (
    <section id="process" className="tm tm-quality-process" aria-labelledby="tm-quality-process-title">
      <header className="tm-quality-process-head" data-reveal>
        <p className="tm-eyebrow">Process</p>
        <h2 id="tm-quality-process-title" className="tm-heading">
          From source batch
          <br />
          <span>to released vial</span>
        </h2>
      </header>
      {/* The page's opening line, beside the path it introduces. */}
      <p className="tm-quality-process-note" data-reveal>
        Every lot moves through the same controlled path — from sourcing to release — and every step leaves a
        record you can read.
      </p>
      <Track stops={process} labelledBy="tm-quality-process-title" />
    </section>
  );
}

/**
 * The release specification on night. An HPLC trace runs under the heading, and
 * its one peak rises directly over the purity requirement in the table, measured
 * so it stays there at every width. The trace is a motif captioned as a
 * specification, never a result for any lot.
 */
function Specification() {
  const trace = useRef<HTMLDivElement>(null);
  const purity = useRef<HTMLSpanElement>(null);
  const [peakAt, setPeakAt] = useState(0.8);

  useLayoutEffect(() => {
    const field = trace.current;
    const value = purity.current;
    if (!field || !value) return;
    const measure = () => {
      const f = field.getBoundingClientRect();
      const v = value.getBoundingClientRect();
      if (!f.width) return;
      const at = (v.left + v.width / 2 - f.left) / f.width;
      setPeakAt(Math.round(Math.min(0.94, Math.max(0.06, at)) * 1000) / 1000);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(field);
    observer.observe(value);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="specification"
      className="tm tm-night tm-night-studio tm-quality-spec"
      aria-labelledby="tm-quality-spec-title"
    >
      <header className="tm-quality-spec-head" data-reveal>
        <p className="tm-eyebrow">Release specification</p>
        <h2 id="tm-quality-spec-title" className="tm-heading">
          Every lot is tested
          <br />
          <span>against the same&nbsp;bar</span>
        </h2>
      </header>
      <p className="tm-section-note tm-quality-spec-note" data-reveal>
        A lot that misses any specification is rejected and never enters released inventory. The full result set
        for each lot is published on its Certificate of Analysis and retrievable by lot number.
      </p>
      <div
        className="tm-quality-trace"
        ref={trace}
        data-reveal
        style={{ "--tm-peak-at": peakAt } as CSSProperties}
        aria-hidden="true"
      >
        <Trace theme="night" peakAt={peakAt} height={120} />
        <span className="tm-quality-trace-caption">≥&nbsp;{PURITY_SPEC}% purity specification · HPLC</span>
      </div>
      <div className="tm-quality-sheet" data-reveal>
        <table>
          <caption>Release specification</caption>
          <thead>
            <tr>
              <th scope="col">Test</th>
              <th scope="col">Method</th>
              <th scope="col">Specification</th>
            </tr>
          </thead>
          <tbody>
            {specification.map(([test, method, requirement], i) => (
              <tr key={test}>
                <th scope="row">{test}</th>
                <td>{method}</td>
                <td>{i === 0 ? <span ref={purity}>{requirement}</span> : requirement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Records() {
  const photo = scene("powder", 1600);
  return (
    <section id="records" className="tm tm-quality-records" aria-labelledby="tm-quality-records-title">
      <div className="tm-quality-records-photo tm-settle" data-reveal>
        <img
          src={photo.src}
          srcSet={photo.srcSet}
          sizes="(max-width: 960px) 100vw, 40vw"
          width={1600}
          height={1062}
          alt=""
          loading="lazy"
        />
      </div>
      <header className="tm-quality-records-head" data-reveal>
        <p className="tm-eyebrow">Records</p>
        <h2 id="tm-quality-records-title" className="tm-heading">
          What we keep on file
          <br />
          <span>for every lot</span>
        </h2>
      </header>
      <dl className="tm-quality-files">
        {records.map(([name, text], i) => (
          <div key={name} data-reveal style={{ "--tm-i": i } as CSSProperties}>
            <dt>{name}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      <div className="tm-quality-close" data-reveal>
        <p className="tm-quality-close-line">
          Have a vial in hand?
          <br />
          <span>Read its certificate now.</span>
        </p>
        <Link className="tm-button tm-button-primary" to="/verify">
          Verify a lot
        </Link>
      </div>
    </section>
  );
}

export default function Quality() {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  return (
    <div className="tm-page tm-quality" ref={root}>
      <Opening />
      <Process />
      <Specification />
      <Records />
    </div>
  );
}
