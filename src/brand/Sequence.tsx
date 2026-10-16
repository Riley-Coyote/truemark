import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, FileText, Pause, Play, QrCode, X } from "lucide-react";
import { assetUrl } from "../assetUrl";
import type { Product } from "../data";
import { LAB, certificates, claimText, contentValue, labLink, resultGroups, resultsFor } from "../platform/certificate-records";
import { productById, productCutout } from "../shop/catalog";
import { usePrefersReducedMotion } from "../shop/motion";
import { focusMask } from "./fog";
import { fogSceneOf, glassMask } from "./Rooms";
import type { Box, Room, Seat } from "./Rooms";
import {
  CHAPTERS,
  CUTOUT,
  DETAILS,
  FINALE,
  FINDINGS,
  LOT_PRINT,
  MARKS,
  QR_FRAME,
  RESTS,
  cameraPath,
  cameraTransform,
  detailAt,
  findingAt,
  layers,
  mix,
  pedestalShadow,
  posePoint,
  posesOf,
  restAt,
  vialHeight,
  vialPath,
} from "./sequence-film";
import type { Pose, Pt, Rect, Scene } from "./sequence-film";
import "./sequence.css";

/*
 * The opening's closer look, after Motion 04 (design-lab/motion, the version the client chose), in the opening's own
 * room: the collection at rest; the featured vial lifting off its pedestal toward the reader; its label decoded in three
 * details; its code opening Verify; the record its printed lot finds; the certificate behind the record, read finding
 * by finding; then the vial home on its pedestal and the room whole again. The reader starts it (the featured vial, or
 * the opening's "Look closer") and it plays itself, as a phone's stories do: each move between chapters at its own
 * pace, each chapter held while it is read, then on to the next. A tap goes on (or, on the left, back), a hold pauses,
 * a swipe down or the close button leaves through the room's mist. Scrolling stays the page's own and never moves the
 * story. Every picture is a pure function of how far through the story it is (sequence-film.ts); this file lays the
 * parts out and writes them each frame. With motion off (the reader's setting, or the switch) the same story is told
 * as still frames, in the same words.
 */

/** The featured lot: Semax's first batch, on the collection's centre pedestal (carousel.ts), told from its label as
 *  photographed and its certificate as KMD Analytical issued it. Any lot with a certificate could tell the story; of the
 *  five on the pedestals, this one's label photographs cleanly and its content reads closest to its label's claim. */
const FEATURED_LOT = "TM-SMX10-2609-01";
const certificate = certificates.find((entry) => entry.lot === FEATURED_LOT)!;
export const FEATURED = certificate.productId;
const LOT = certificate.lot;
/** The event the sequence sends as its camera leaves the room's rest and comes back to it (fog/FloorMist.tsx). */
export const SEQUENCE_EVENT = "tm-sequence";
/** Further than this from the top, the camera has left the room's rest. */
const AWAY = 0.0015;
/** The event that starts the story (openStory). */
const STORY_EVENT = "tm-story-open";
/** Start the story from the room: the featured vial and the opening's "Look closer" call this. */
export function openStory() {
  window.dispatchEvent(new Event(STORY_EVENT));
}
/** How long each rest is held while its caption is read (ms; the room's, the first, is passed straight through): the
 *  approach; the label's three details; the connection; the record; the certificate's three findings; the finale. A
 *  caption is a line or two, so a rest is a glance, as a phone's stories are; a tap goes on sooner, a hold stays.
 *  The whole story plays in about 27 s (it was about 39 s, which Riley found too slow, Oct 13). */
const DWELL = [0, 1700, 1500, 1350, 1500, 1800, 2200, 1650, 1500, 1500, 3000] as const;
/** The story's bars, one to a chapter, and the finale's last. */
const STORY_BARS = [1, 2, 3, 4, 5, FINALE] as const;
/** How much faster a move runs once a tap has asked to go on, how long (ms) a reading the taps go on past takes to
 *  cross, and how fast the story runs back to an earlier rest. */
const RUSH = 3, PASS = 260, REWIND = 2.4;
/** Run on (or back) by a tap, the certificate's dissolve into the room's light would pass in a blink, a white flash on
 *  a phone: so as a run begins the page's light is let go over this long (ms), and the page simply fades into the room.
 *  At the story's own pace it comes back. */
const LIGHT_EASE = 160;
/** How long the room's mist takes to come in over the story as it closes (sequence.css .tm-story-veil). */
const VEIL_IN = 340;
/** Finished, the story's own words leave the room this fast, and the opening's take this long to come back (stories.css
 *  --tm-story-end, --tm-story-back). */
const END_OUT = 420, BACK_IN = 760;

const image = (name: string) => assetUrl(`images/sequence/${name}`);
/** The sequence's own pictures (public/images/sequence; how each was made: tools/landing/r12-sequence, and for the
 *  featured lot's, tools/landing/r13-motion4/assets). */
const PICTURES = {
  /** KMD Analytical's certificate for the lot, its one page as printed. */
  certificate: image("coa-semax.webp"),
  /** The same page's findings, three times as fine, for the reading glass (FINE_PRINT). */
  findings: image("coa-semax-findings.webp"),
  /** The room, softened and deeper still, for each of its two cuts. */
  room: {
    wide: { soft: image("room-soft.webp"), deep: image("room-deep.webp") },
    tall: { soft: image("room-phone-soft.webp"), deep: image("room-phone-deep.webp") },
  },
  /** A vial's two shadows as one picture, drawn at the vial's size in each cut of the room. */
  shadow: { wide: image("shadow/wide.webp"), tall: image("shadow/tall.webp") },
  /** The floating vial's light, drawn ahead of time (tools/landing/r14-cinematic/assets): the room's light gathered
   *  behind it, its soft shadow on the pedestal below, and the low haze the room recedes into behind it. */
  light: { glow: image("light/glow.webp"), pedestal: image("light/pedestal-shadow.webp"), haze: image("light/haze.webp") },
} as const;
/** The lot's certificate, as KMD Analytical issued it, and its own PDF on the site. */
const CERTIFICATE_PDF = assetUrl(`certificates/${LOT}.pdf`);
const CERTIFICATE_PAGE = { w: 1700, h: 2200 } as const;
/** Where each finding is printed on the page (its pixels): the identity statement, the purity and the content. */
const ON_THE_PAGE = [
  { x: 600, y: 758, w: 404, h: 44 },
  { x: 208, y: 532, w: 264, h: 142 },
  { x: 650, y: 532, w: 356, h: 176 },
] as const;

/** Where the reading glass rests on each finding (the page's pixels), and how much of the page shows across it there:
 *  the words "Identity Conforms", and each number with its name above it and its unit below, each filling about two
 *  thirds of the glass. The identity statement is printed at a third of the numbers' size, so it is read closer. */
const READ = [
  { x: 697, y: 779, across: 262 },
  { x: 338, y: 606, across: 300 },
  { x: 753, y: 606, across: 300 },
] as const;
/** The part of the page the glass shows, rendered from the lab's PDF at 600 dpi (three times the page's own pixels):
 *  the findings, with room around them for the glass at its widest as it moves between them. */
const FINE_PRINT = { x: 100, y: 360, w: 900, h: 660, scale: 3 } as const;
/** How much more of the page the glass shows halfway between two findings, as if lifted on its way. */
const LOUPE_LIFT = 0.16;

/** A collection vial out of focus (public/images/sequence/soft): its small cutout, blurred, with a margin all round. */
export function softCutout(product: Product): string | undefined {
  const file = productCutout(product, "sm").split("/").pop() ?? "";
  return file.endsWith("-sm.webp") ? image(`soft/${file.replace(/-sm\.webp$/, ".webp")}`) : undefined;
}

/** A vial's glass catching the room's light at its edges (public/images/sequence/light/rim): a rim of light just
 *  inside its outline, on the cap, the crimp, the neck, the shoulders and the foot, never on its label. */
export function rimLight(product: Product | undefined): string | undefined {
  const file = productCutout(product, "lg").split("/").pop() ?? "";
  return file.endsWith(".webp") ? image(`light/rim/${file}`) : undefined;
}

/** A collection vial's shadows, the seat under its foot and the long cast, drawn ahead of time as one picture
 *  (public/images/sequence/shadow): the sequence shows it in their place, as an image layer the camera scales without
 *  drawing it again, where Safari draws a blurred shadow anew at every step of a camera move. */
export function vialShadow(tall: boolean): string {
  return tall ? PICTURES.shadow.tall : PICTURES.shadow.wide;
}

/* ---------- Motion: the reader's setting, or the switch ---------- */

const MOTION_KEY = "tm-motion";
type Choice = "on" | "off" | null;
let choice: Choice = null;
try {
  const kept = typeof window !== "undefined" ? window.localStorage.getItem(MOTION_KEY) : null;
  choice = kept === "on" || kept === "off" ? kept : null;
} catch {
  choice = null;
}
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
function choose(next: "on" | "off") {
  choice = next;
  try {
    window.localStorage.setItem(MOTION_KEY, next);
  } catch {
    // Kept for this visit only.
  }
  listeners.forEach((listener) => listener());
}
/** Whether the opening moves: the switch on its stage, once used; until then the reader's own setting. */
export function useMotion(): boolean {
  const reduced = usePrefersReducedMotion();
  const chosen = useSyncExternalStore(subscribe, () => choice, () => null);
  return chosen ? chosen === "on" : !reduced;
}

/** Turned off partway through the story: the still form takes the reader to its own beginning (SequenceStills). */
let landOnStills = false;

/** The switch: on the stage at rest, and beside the journey while the story runs, so the room's mist and the story can
 *  be stopped whenever they move (WCAG 2.2.2). At rest it holds the screen's bottom corner, and the chat's mark gives way
 *  to it there (assistant/Assistant.tsx KEEP_CLEAR); the header keeps the chat in reach. */
export function MotionSwitch({ className = "", keepClear = false }: { className?: string; keepClear?: boolean }) {
  const on = useMotion();
  const toggle = () => {
    if (on) landOnStills = Boolean(document.querySelector(".tm-mist[data-seq-playing]"));
    choose(on ? "off" : "on");
  };
  return (
    <button type="button" className={`tm-seq-switch ${className}`} aria-pressed={on} onClick={toggle} data-keep-clear={keepClear ? "" : undefined}>
      <span className="tm-seq-switch-track" aria-hidden="true">
        <span className="tm-seq-switch-thumb" />
      </span>
      Motion
    </button>
  );
}

/* ---------- The record, read once for every part that tells it ---------- */

const record = (() => {
  const group = resultGroups(resultsFor(certificate))[0];
  return {
    compound: certificate.compound,
    reference: certificate.certificate,
    strength: group?.claim ? `${group.claim.value} ${group.claim.unit}` : "",
    purity: group?.purity ? { value: group.purity.value, unit: group.purity.unit } : null,
    identity: group?.identity?.value ?? null,
    content: group?.content ? contentValue(group.content) : null,
    contentFigure: group?.content ? { value: group.content.value, unit: group.content.unit.replace(/ per vial$/, "") } : null,
    claim: group ? claimText(group) : undefined,
    claimFigures: group?.claim && group.ofClaim ? { claim: `${group.claim.value} ${group.claim.unit}`, of: group.ofClaim.value } : null,
  };
})();

/** The client's four principles, as the live page's trust row sets them. */
const PRINCIPLES = [
  ["Research use only", "Supplied for laboratory research applications."],
  ["Not for human use", "Not for human or veterinary administration."],
  ["Independently tested", "Every lot tested on receipt at a contracted laboratory."],
  ["Cold chain", "Temperature-controlled storage, and transit when applicable."],
] as const;

/** Each chapter's words (Motion 04's, the client's choice). The collection's are the opening's own. */
const WORDS = [
  null,
  { eyebrow: "The approach", title: ["One vial,", "up close."], text: "Take one from the collection and read what its label tells you." },
  { eyebrow: "The label", title: ["Three marks.", "One record."], text: "The name, the lot number and the code each lead to the same record. Follow each marker." },
  { eyebrow: "The connection", title: ["Scan the code.", "Match the lot."], text: "The QR code opens Verify. Enter the printed lot number to find its record." },
  { eyebrow: "The record", title: ["The number.", "Its results."], text: "The lot printed on the vial, matched to what the laboratory reported for it." },
  { eyebrow: "The certificate", title: ["Their words,", "not ours."], text: "Read the reported findings, then open the laboratory’s own certificate in full." },
] as const;

/** The label's three details, decoded. */
const LABEL_DETAILS = [
  { category: DETAILS[0], title: "Compound + strength", description: "The compound name and labeled amount identify this vial. The certificate reports the measured results." },
  { category: DETAILS[1], title: "Printed lot number", description: "Match this identifier to the lot record. It keeps the vial, reported results, and source certificate connected." },
  { category: DETAILS[2], title: "QR code", description: "Scan to open Verify, then enter the printed lot number. The matching record leads to its original certificate." },
] as const;

/** The certificate's three findings, read against the page. */
const MEASURES = [
  { name: FINDINGS[0], value: record.identity ?? "", unit: "", source: "Identity statement", method: "HPLC · retention time + UV", explanation: "The laboratory reports a match to its reference standard by retention time and UV spectrum." },
  { name: FINDINGS[1], value: record.purity?.value ?? "", unit: record.purity?.unit ?? "", source: "Purity result", method: "HPLC · total peak area", explanation: "The reported share of integrated peak area. Purity and the amount in the vial are different measurements." },
  {
    name: FINDINGS[2],
    value: record.contentFigure?.value ?? "",
    unit: record.contentFigure?.unit ?? "",
    source: "Content result",
    method: "HPLC · content per vial",
    explanation: record.claimFigures
      ? `Measured net peptide per vial. The label claim is ${record.claimFigures.claim}; the laboratory reports ${record.claimFigures.of}% of that claim.`
      : "Measured net peptide per vial.",
  },
] as const;
const SCOPE = "Results describe the laboratory’s submitted sample. Read the full certificate for its scope.";
const VERIFY_LOT = `/verify?lot=${encodeURIComponent(LOT)}`;
const two = (n: number) => String(n).padStart(2, "0");

/* ---------- The parts, shared by the moving and the still forms ---------- */

/** A chapter's words: its number and name, its two lines, and what it says. In the story the chapters count from the
 *  approach, as its bars do; the still form counts the room as the first. */
function ChapterWords({ chapter, count = chapter + 1 }: { chapter: number; count?: number }) {
  const words = WORDS[chapter];
  if (!words) return null;
  return (
    <div className="tm-seq-words">
      <p className="tm-seq-eyebrow">
        <span>{two(count)}</span> {words.eyebrow}
      </p>
      <h2 className="tm-seq-title">
        <span>{words.title[0]}</span> <span>{words.title[1]}</span>
      </h2>
      <p className="tm-seq-text">{words.text}</p>
    </div>
  );
}

/** The label, decoded: its three details, the one in view open. In the still form every one is open. */
function Decoder({ go, still = false }: { go?: (rest: number) => void; still?: boolean }) {
  const values = [
    <>
      {record.compound}
      <span className="tm-seq-chip">{record.strength}</span>
    </>,
    <span className="tm-seq-print">{LOT}</span>,
    <Link className="tm-seq-value-link" to="/verify">
      Open Verify <ArrowRight size={18} strokeWidth={1.6} aria-hidden="true" />
    </Link>,
  ];
  return (
    <section className="tm-seq-card tm-seq-decoder" aria-label="The label, decoded" data-still={still ? "" : undefined}>
      <p className="tm-seq-card-caption" aria-hidden="true">
        <span>The label, decoded</span>
        {still ? (
          <span>01 — 03</span>
        ) : (
          <span className="tm-seq-count">
            <span className="tm-seq-count-now" />
            <i> / 03</i>
          </span>
        )}
      </p>
      <ol className="tm-seq-details">
        {LABEL_DETAILS.map((detail, i) => (
          <li key={detail.category} className="tm-seq-detail" data-i={i}>
            {still ? (
              <p className="tm-seq-detail-head">
                <span className="tm-seq-index">{two(i + 1)}</span>
                <span className="tm-seq-detail-name">
                  <small>{detail.category}</small>
                  <strong>{detail.title}</strong>
                </span>
              </p>
            ) : (
              <button type="button" className="tm-seq-detail-head" data-rest={2 + i} onClick={() => go?.(2 + i)}>
                <span className="tm-seq-index">{two(i + 1)}</span>
                <span className="tm-seq-detail-name">
                  <small>{detail.category}</small>
                  <strong>{detail.title}</strong>
                </span>
                <ChevronDown size={16} strokeWidth={1.6} aria-hidden="true" />
              </button>
            )}
            <div className="tm-seq-detail-body">
              <div className="tm-seq-detail-clip">
                <p className="tm-seq-value">{values[i]}</p>
                <p className="tm-seq-description">{detail.description}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {!still && (
        <p className="tm-seq-card-foot">
          <span>Hold to pause · tap to go on</span>
          <button type="button" className="tm-seq-next-detail" onClick={() => go?.(Math.min(5, restAtNow() + 1))}>
            <span className="tm-seq-next-label">Next detail</span>
            <span className="tm-seq-next-verify">Try Verify</span>
            <ArrowRight size={14} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </p>
      )}
    </section>
  );
}

/** Verify, as the site's own lookup asks for the lot: the printed number typed in, and the lookup itself, a link. */
function VerifyCard({ still = false }: { still?: boolean }) {
  return (
    <section className="tm-seq-card tm-seq-verify" aria-label="TrueMark Verify">
      <p className="tm-seq-verify-head">
        <QrCode size={18} strokeWidth={1.5} aria-hidden="true" />
        TrueMark Verify
      </p>
      <p className="tm-seq-verify-ask" id="tm-seq-verify-ask">Enter the printed lot number</p>
      <Link className="tm-seq-field" to={VERIFY_LOT} aria-describedby="tm-seq-verify-ask" data-typed={still ? "" : undefined}>
        <span className="tm-seq-field-text">
          <span className="tm-seq-typed" aria-hidden={still ? undefined : "true"}>{still ? LOT : ""}</span>
          <span className="tm-seq-caret" aria-hidden="true" />
          {!still && <span className="tm-seq-placeholder" aria-hidden="true">Lot number</span>}
          {!still && <span className="sr-only">{LOT}</span>}
        </span>
        <span className="tm-seq-field-go" aria-hidden="true">
          <ArrowRight size={18} strokeWidth={1.6} />
        </span>
        <span className="sr-only">, look up this lot in Verify</span>
      </Link>
    </section>
  );
}

/** The lot's record, as Verify finds it. */
function RecordCard({ go, still = false }: { go?: (rest: number) => void; still?: boolean }) {
  return (
    <section className="tm-seq-card tm-seq-record" aria-label="The lot record">
      <p className="tm-seq-card-caption">
        <span>The lot record</span>
        <span>{LAB.name}</span>
      </p>
      <p className="tm-seq-record-over">Printed on the vial. Found in the record.</p>
      <p className="tm-seq-record-lot">
        <Link className="tm-seq-print" to={VERIFY_LOT}>{LOT}</Link>
      </p>
      <p className="tm-seq-record-match">
        <Check size={13} strokeWidth={2} aria-hidden="true" /> The identifier on this vial
      </p>
      <p className="tm-seq-record-product">
        <strong>{record.compound}</strong> <span className="tm-seq-chip">{record.strength}</span>
        <small>Reported by {LAB.name}</small>
      </p>
      <dl className="tm-seq-record-results">
        {record.purity && (
          <div>
            <dt>Purity · HPLC</dt>
            <dd>
              {record.purity.value}
              <small>{record.purity.unit}</small>
            </dd>
          </div>
        )}
        {record.contentFigure && (
          <div>
            <dt>Content per vial</dt>
            <dd>
              {record.contentFigure.value}
              <small> {record.contentFigure.unit}</small>
            </dd>
          </div>
        )}
      </dl>
      <a className="tm-seq-record-ref" href={CERTIFICATE_PDF} target="_blank" rel="noopener noreferrer">
        <FileText size={17} strokeWidth={1.5} aria-hidden="true" />
        <span>
          <span>Certificate of Analysis</span>
          <span className="tm-seq-mono">{record.reference}</span>
        </span>
        <ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" />
        <span className="sr-only">, the certificate as a PDF, opens in a new tab</span>
      </a>
      {!still && (
        <button type="button" className="tm-seq-record-go" onClick={() => go?.(7)}>
          Follow the record to its source <ArrowRight size={17} strokeWidth={1.6} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

/** The certificate's findings: one read at a time against the page, as the reader scrolls (every one, still). */
function Findings({ go, still = false }: { go?: (rest: number) => void; still?: boolean }) {
  return (
    <section className="tm-seq-findings" aria-label="The reported findings" data-still={still ? "" : undefined}>
      <p className="tm-seq-card-caption" aria-hidden="true">
        <span>The reported findings</span>
        <span>01 — 03</span>
      </p>
      <div className="tm-seq-findings-card">
        <div className="tm-seq-measures">
          {MEASURES.map((measure, i) => {
            const inner = (
              <>
                <span className="tm-seq-measure-index">{two(i + 1)}</span>
                <span className="tm-seq-measure-name">{measure.name}</span>
                <strong>
                  {measure.value}
                  {measure.unit && <small>{measure.unit === "%" ? "%" : ` ${measure.unit}`}</small>}
                </strong>
              </>
            );
            return still ? (
              <div key={measure.name} className="tm-seq-measure" data-i={i}>{inner}</div>
            ) : (
              <button key={measure.name} type="button" className="tm-seq-measure" data-i={i} data-rest={7 + i} onClick={() => go?.(7 + i)}>
                {inner}
              </button>
            );
          })}
        </div>
        <div className="tm-seq-readings">
          {MEASURES.map((measure, i) => (
            <div key={measure.name} className="tm-seq-reading" data-i={i}>
              <span className="tm-seq-reading-source">On the source / {measure.source}</span>
              <strong>{measure.method}</strong>
              <p>{measure.explanation}</p>
            </div>
          ))}
        </div>
        <p className="tm-seq-scope">{SCOPE}</p>
      </div>
    </section>
  );
}

/** The certificate's one page, whole: a link to its PDF, with the finding being read marked where it is printed. */
function Paper({ still = false }: { still?: boolean }) {
  const lab = labLink(record.reference);
  return (
    <figure className="tm-seq-paper" data-still={still ? "" : undefined}>
      <a className="tm-seq-page" href={CERTIFICATE_PDF} target="_blank" rel="noopener noreferrer">
        <img
          src={PICTURES.certificate}
          width={CERTIFICATE_PAGE.w}
          height={CERTIFICATE_PAGE.h}
          alt={`Certificate of Analysis ${record.reference}, issued by ${LAB.name} for lot ${LOT}`}
          draggable={false}
          decoding="async"
          loading={still ? "lazy" : undefined}
        />
        {!still && ON_THE_PAGE.map((box, i) => (
          <span
            key={i}
            className="tm-seq-focus"
            data-i={i}
            aria-hidden="true"
            style={{
              left: `${((box.x / CERTIFICATE_PAGE.w) * 100).toFixed(3)}%`,
              top: `${((box.y / CERTIFICATE_PAGE.h) * 100).toFixed(3)}%`,
              width: `${((box.w / CERTIFICATE_PAGE.w) * 100).toFixed(3)}%`,
              height: `${((box.h / CERTIFICATE_PAGE.h) * 100).toFixed(3)}%`,
            }}
          >
            <i />
            <i />
            <i />
            <i />
          </span>
        ))}
        {/* The window's light sweeping across the page as it turns toward the reader; once it has come forward, a
            reading glass on the finding being read, the page's own print under it (the film moves both); and the light
            the page dissolves into as the story ends. */}
        {!still && (
          <span className="tm-seq-glint" aria-hidden="true">
            <i />
          </span>
        )}
        {!still && (
          <span className="tm-seq-loupe" aria-hidden="true">
            <img src={PICTURES.findings} width={FINE_PRINT.w * FINE_PRINT.scale} height={FINE_PRINT.h * FINE_PRINT.scale} alt="" draggable={false} decoding="async" />
          </span>
        )}
        {!still && <span className="tm-seq-bloom" aria-hidden="true" />}
        <span className="sr-only">, the certificate as a PDF, opens in a new tab</span>
      </a>
      <figcaption>
        <span>
          <b>Original source</b> {LAB.name} · 1 page
        </span>
        <span className="tm-seq-paper-links">
          <a href={CERTIFICATE_PDF} target="_blank" rel="noopener noreferrer">
            Read full COA <ArrowUpRight size={13} strokeWidth={1.6} aria-hidden="true" />
            <span className="sr-only">, opens in a new tab</span>
          </a>
          {lab && (
            <a href={lab.href} target="_blank" rel="noopener noreferrer">
              Verify with {LAB.name} <ArrowUpRight size={13} strokeWidth={1.6} aria-hidden="true" />
              <span className="sr-only">, opens in a new tab</span>
            </a>
          )}
        </span>
      </figcaption>
    </figure>
  );
}

function Principles({ className = "" }: { className?: string }) {
  return (
    <ul className={`tm-seq-principles ${className}`}>
      {PRINCIPLES.map(([title, line]) => (
        <li key={title} className="tm-seq-principle">
          <b>{title}</b>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

/** The finale's words: the story's last lines, where the headline stood. */
function FinaleWords({ onExplore }: { onExplore?: () => void }) {
  return (
    <div className="tm-seq-finale-words">
      <h2 className="tm-seq-finale-title">
        <span>Start with the material.</span> <span>Keep the record close.</span>
      </h2>
      <div className="tm-seq-finale-aside">
        <p>The compound, the lot number on its label, and the laboratory’s certificate behind it, kept together.</p>
        {onExplore ? (
          <button type="button" className="tm-seq-explore" onClick={onExplore}>
            Explore the collection <ArrowDown size={16} strokeWidth={1.6} aria-hidden="true" />
          </button>
        ) : (
          <Link className="tm-seq-explore" to="/products">
            Explore the collection <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}

/* ---------- On the plate, and in the air ---------- */

const pct = (value: number, of: number) => `${((value / of) * 100).toFixed(4)}%`;
/** How far a decoder dot on a word stands past it, in the page's pixels: the dot's radius with its ring (sequence.css)
 *  and a hair. */
const DOT_CLEAR = 7.5;
/** A decoder line's own laid-out length (sequence.css .tm-seq-lead-line), which the film stretches to each line's. */
const LEAD_LINE = 100;
/** The floating vial's light at its strongest: the room's light gathered behind it, the edge light on its glass, and its
 *  shadow on the pedestal; and the highlight's band, as a share of the vial's width (sequence.css .tm-seq-hero-sheen). */
const GLOW = 0.7, RIM = 0.8, SHADOW = 0.38, SHEEN = 0.6;
/** The haze near the camera at its densest, and how far it drifts over the whole story (a share of its own width); and,
 *  settled to the floor for the finale, how dense it is and how low it lies (a share of its own height). */
const HAZE = 0.78, HAZE_DRIFT = 7;
const HAZE_FLOOR = 0.9, HAZE_FLAT = 0.55;
/** The window's light sweeping across the certificate as it turns, at its brightest. */
const GLINT = 0.85;
/** The window's shade passing over the page while its findings are read, at its deepest. */
const PAGE_SHADE = 0.3;
/** How far past its cutout's own pixels the floating vial is drawn at most: a little, where the eye can't tell. */
const SHARP_PAST = 1.12;
/** The reading glass's width as a share of the page's: a little more of it on a phone, where the whole screen is small. */
const loupeShare = (tall: boolean) => (tall ? 0.44 : 0.38);

/**
 * The featured vial in the air: its large cutout, its label as photographed, and the room's light on its glass as on
 * the plate; behind it, the room's light gathered as the lens racks focus to it; on its glass, that light caught at the
 * edges, and a highlight drifting across its crimp and shoulders (the film moves it). Laid out at the largest it floats
 * and only ever drawn smaller, so it is always sharp. On its pedestal the plate's own vial shows in its place.
 */
function HeroVial({ ready }: { ready: boolean }) {
  const product = productById(FEATURED);
  const src = productCutout(product, "lg");
  const rim = rimLight(product);
  const [mask, setMask] = useState<string | null>(null);
  useLayoutEffect(() => setMask(glassMask(src)), [src]);
  return (
    <div className="tm-seq-hero" aria-hidden="true" style={mask ? ({ "--tm-glass-mask": mask } as CSSProperties) : undefined}>
      {ready && (
        <>
          <img className="tm-seq-hero-glow" src={PICTURES.light.glow} alt="" draggable={false} decoding="async" />
          <img className="tm-seq-hero-glass" src={src} alt="" draggable={false} decoding="async" />
          <span className="tm-room-vial-air" />
          {rim && <img className="tm-seq-hero-rim" src={rim} alt="" draggable={false} decoding="async" />}
          <span className="tm-seq-hero-sheen">
            <i />
          </span>
        </>
      )}
    </div>
  );
}

/** The room, softened and deeper still, over the room and under the vials: everywhere but the featured vial's
 *  pedestal, which the lens keeps sharp (fog/scenes.ts focusMask), as the camera racks focus to it. */
export function SequenceRoom({ room, tall, pedestal, ready }: { room: Room; tall: boolean; pedestal: number; ready: boolean }) {
  const scene = fogSceneOf(room);
  const mask = scene && ready ? focusMask(scene, pedestal) : null;
  const style = mask ? ({ "--tm-seq-focus": mask } as CSSProperties) : undefined;
  const set = tall ? PICTURES.room.tall : PICTURES.room.wide;
  if (!ready) return null;
  return (
    <>
      <span className="tm-seq-room tm-seq-room-soft" aria-hidden="true">
        <img src={set.soft} style={style} alt="" draggable={false} decoding="async" />
      </span>
      <span className="tm-seq-room tm-seq-room-deep" aria-hidden="true">
        <img src={set.deep} style={style} alt="" draggable={false} decoding="async" />
      </span>
    </>
  );
}

/** The camera: the plate it films and the floor below it, scaled and moved as one (the transform is the film's to
 *  write). Always there, so the plate is never mounted anew as motion goes on or off; still, it is only a frame. */
export function SequenceCamera({ children }: { children: ReactNode }) {
  return <div className="tm-seq-camera">{children}</div>;
}

/* ---------- Loading: after the opening, never before ---------- */

/** The sequence's pictures, fetched and decoded once the opening has loaded and the browser is idle (or at once, when
 *  the reader starts down the page sooner), so no picture is decoded the moment it is first needed. */
export function useSequenceReady(on: boolean, extra: readonly string[] = []): boolean {
  const [ready, setReady] = useState(false);
  const more = extra.join("\n");
  useEffect(() => {
    if (!on || ready) return;
    let live = true;
    let idle = 0;
    const later = typeof window.requestIdleCallback === "function";
    const go = () => {
      window.removeEventListener("scroll", go);
      const all = [
        productCutout(productById(FEATURED), "lg"),
        PICTURES.certificate,
        PICTURES.findings,
        ...Object.values(PICTURES.room.wide),
        ...Object.values(PICTURES.room.tall),
        ...Object.values(PICTURES.shadow),
        ...Object.values(PICTURES.light),
        rimLight(productById(FEATURED)) ?? "",
        ...more.split("\n"),
      ].filter(Boolean);
      void Promise.all(all.map((src) => {
        const img = new Image();
        img.decoding = "async";
        img.src = src;
        return img.decode().catch(() => undefined);
      })).then(() => { if (live) setReady(true); });
    };
    const start = () => {
      idle = later ? window.requestIdleCallback(go, { timeout: 2500 }) : window.setTimeout(go, 900);
    };
    window.addEventListener("scroll", go, { passive: true, once: true });
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      live = false;
      window.removeEventListener("scroll", go);
      window.removeEventListener("load", start);
      if (later) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [on, ready, more]);
  return ready;
}

/* ---------- The film ---------- */

/** Writes a style (or an attribute, or a text) only when its value changes: most frames change a few layers' opacity
 *  and the camera, nothing else. */
function writer() {
  const was = new Map<Element, Map<string, string>>();
  const changed = (node: Element, name: string, value: string) => {
    let mine = was.get(node);
    if (!mine) was.set(node, (mine = new Map()));
    if (mine.get(name) === value) return false;
    mine.set(name, value);
    return true;
  };
  const write = (node: HTMLElement | null | undefined, name: string, value: string) => {
    if (node && changed(node, name, value)) node.style.setProperty(name, value);
  };
  const attr = (node: Element | null | undefined, name: string, value: string | null) => {
    if (!node || !changed(node, `@${name}`, value ?? "\u0000")) return;
    if (value === null) node.removeAttribute(name);
    else node.setAttribute(name, value);
  };
  const text = (node: Element | null | undefined, value: string) => {
    if (node && changed(node, "#text", value)) node.textContent = value;
  };
  /** Everything written, taken off again: the stage outlives the film (motion off), and keeps none of its frames. */
  const clear = () => {
    for (const [node, mine] of was) {
      for (const name of mine.keys()) {
        if (name.startsWith("@")) node.removeAttribute(name.slice(1));
        else if (name !== "#text") (node as HTMLElement | SVGElement).style?.removeProperty(name);
      }
    }
    was.clear();
  };
  return Object.assign(write, { attr, text, clear });
}
const fixed = (value: number, places = 3) => value.toFixed(places);

/** Where an element is laid out in another (its transform aside: the film moves many of them). */
function laidOut(el: HTMLElement, within: HTMLElement): Rect {
  let left = 0, top = 0;
  for (let at: HTMLElement | null = el; at && at !== within; at = at.offsetParent as HTMLElement | null) {
    left += at.offsetLeft;
    top += at.offsetTop;
  }
  return { left, top, right: left + el.offsetWidth, bottom: top + el.offsetHeight };
}
const middleOf = (rect: Rect): Pt => ({ x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 });

/** A page held by a camera move (flight.ts), or parked under a product page: the film holds its frame meanwhile. */
const held = (node: Element) => Boolean(node.closest(".tm-views[data-moving], .tm-view[data-pending], .tm-view[data-parked]"));

/** The rest the film shows now, for the decoder's own Next (set by the film as it draws). */
let restNow = 0;
const restAtNow = () => restNow;

type SceneBase = { box: Box; plateScale: number; seat: Seat | undefined; tall: boolean };

/**
 * The sequence: a track as long as the story, its view held on screen below the header while the reader scrolls
 * through it, the opening's stage at its top. The view shows the camera's picture, the vial in the air, and over them
 * each chapter's words and cards; the journey at its foot.
 */
export function SequenceTrack({ on, scene, lead, ready, children }: {
  /** Off, the track is only the stage's frame: the same elements around it, so the stage is never mounted anew. */
  on: boolean;
  scene: SceneBase;
  /** On a phone, the opening's lead and its caption: the approach's card, where the first screen had no room. */
  lead: ReactNode;
  ready: boolean;
  children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const go = useRef<(rest: number) => void>(() => undefined);
  const skip = useRef<() => void>(() => undefined);
  useFilm(track, on, scene, ready, go, skip);
  const travel = (rest: number) => go.current(rest);
  if (!on) {
    return (
      <div className="tm-seq-track" ref={track} data-off="">
        <div className="tm-seq-view">{children}</div>
      </div>
    );
  }
  return (
    <div className="tm-seq-track" ref={track} data-shape={scene.tall ? "tall" : "wide"} data-mode="story">
      <div className="tm-seq-view">
        {children}
        {/* The story's own controls, over it while it plays: a bar to each chapter, filling as it plays, and the way to
            pause it and to leave it. A key reaches the way back and on too; a pointer taps or swipes the picture. */}
        <div className="tm-story-chrome">
          <ol className="tm-story-bars" aria-hidden="true">
            {STORY_BARS.map((chapter) => (
              <li key={chapter} className="tm-story-bar">
                <span className="tm-story-bar-fill" />
              </li>
            ))}
          </ol>
          <button type="button" className="tm-story-button tm-story-step" data-step="-1" aria-label="Previous chapter">
            <ArrowLeft size={16} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <button type="button" className="tm-story-button tm-story-step" data-step="1" aria-label="Next chapter">
            <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <button type="button" className="tm-story-button tm-story-pause" aria-pressed="false" aria-label="Pause the story">
            <Pause className="tm-story-pause-icon" size={15} strokeWidth={1.8} aria-hidden="true" />
            <Play className="tm-story-play-icon" size={15} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button type="button" className="tm-story-button tm-story-close" aria-label="Close the story">
            <X size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>
        {/* The room's mist, which comes in over the story as it closes and clears again on the room. */}
        <span className="tm-story-veil" aria-hidden="true" />
        {/* The floating vial's shadow on its own pedestal, under it wherever the camera carries the pedestal; and the
            haze near the camera that the floor and the far vials recede into, in front of the room, behind the vial. */}
        {ready && <img className="tm-seq-pedestal-shadow" src={PICTURES.light.pedestal} alt="" aria-hidden="true" draggable={false} decoding="async" />}
        {ready && <img className="tm-seq-haze" src={PICTURES.light.haze} alt="" aria-hidden="true" draggable={false} decoding="async" />}
        {/* On a phone, the room's floor rising under the captions (stories.css). */}
        <span className="tm-story-floor" aria-hidden="true" />
        <HeroVial ready={ready} />
        {/* The decoder's markers: a line from each detail on the label to its number, and a dot on the detail. Each is
            moved whole, never redrawn, so following the vial costs the browser no painting. */}
        <div className="tm-seq-leads" aria-hidden="true">
          {MARKS.map((_, i) => (
            <span key={i} className="tm-seq-lead" data-i={i}>
              <span className="tm-seq-lead-line" />
              <span className="tm-seq-lead-dot" />
            </span>
          ))}
        </div>
        {/* The scan closing in on the label's code as it opens Verify: four corners and a line of light, moved whole
            with the vial. */}
        <span className="tm-seq-scan" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <b className="tm-seq-scan-line" />
        </span>
        {/* The thread the lot draws as it travels to its record: drawn only while it shows. */}
        <svg className="tm-seq-threads" aria-hidden="true">
          <path className="tm-seq-thread" />
        </svg>
        {/* The way out and the journey, before the story in the page's order: a key reaches them first, and they show
            when it does (sequence.css), wherever the story is. */}
        <div className="tm-seq-controls">
          <button type="button" className="tm-seq-skip" onClick={() => skip.current()}>
            Skip to catalog <ArrowDown size={14} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <nav className="tm-seq-journey" aria-label="The story’s chapters">
            <button type="button" className="tm-seq-step" data-step="-1" aria-label="Previous chapter" onClick={() => travel(Math.max(0, restAtNow() - 1))}>
              <ArrowLeft size={16} strokeWidth={1.6} aria-hidden="true" />
            </button>
            <div className="tm-seq-journey-middle">
              <p className="tm-seq-journey-caption" aria-hidden="true">
                <span className="tm-seq-journey-name">{CHAPTERS[0]}</span>
                <span className="tm-seq-journey-count">
                  <span className="tm-seq-journey-now">01</span>
                  <i>/</i>
                  {two(CHAPTERS.length)}
                </span>
              </p>
              <ol className="tm-seq-segments">
                {CHAPTERS.map((name, i) => (
                  <li key={name}>
                    <button type="button" className="tm-seq-segment" data-i={i} aria-label={`${two(i + 1)} ${name}`} onClick={() => travel(RESTS.findIndex((rest) => rest.chapter === i))}>
                      <span className="tm-seq-segment-fill" />
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <button type="button" className="tm-seq-step" data-step="1" aria-label="Next chapter" onClick={() => travel(restAtNow() + 1)}>
              <ArrowRight size={17} strokeWidth={1.6} aria-hidden="true" />
            </button>
          </nav>
          <MotionSwitch className="tm-seq-switch-film" />
        </div>
        <div className="tm-seq-beats">
          <h2 className="sr-only">
            One vial, the whole story: {record.compound}, lot {LOT}
          </h2>
          <div className="tm-seq-chapter" data-chapter="1" data-rest="1">
            <ChapterWords chapter={1} count={1} />
            {lead && <div className="tm-seq-card tm-seq-lead-copy">{lead}</div>}
          </div>
          <div className="tm-seq-chapter" data-chapter="2" data-rest="2">
            <ChapterWords chapter={2} count={2} />
            <Decoder go={travel} />
          </div>
          {/* The decoder's markers, beside the vial wherever it floats: each brings its detail into view. A pointer's
              shortcut to the decoder's own rows, which a key reaches already, so a key passes them by (it would
              otherwise go through the three details twice, the story travelling back between). */}
          <div className="tm-seq-marks">
            {LABEL_DETAILS.map((detail, i) => (
              <button key={detail.category} type="button" className="tm-seq-mark" tabIndex={-1} data-i={i} data-rest={2 + i} onClick={() => travel(2 + i)}>
                <span aria-hidden="true">{two(i + 1)}</span>
                <span className="sr-only">On the label: {detail.title.toLowerCase()}</span>
              </button>
            ))}
          </div>
          <div className="tm-seq-chapter" data-chapter="3" data-rest="5">
            <ChapterWords chapter={3} count={3} />
            <VerifyCard />
          </div>
          <div className="tm-seq-chapter" data-chapter="4" data-rest="6">
            <ChapterWords chapter={4} count={4} />
            <RecordCard go={travel} />
          </div>
          <div className="tm-seq-traveler" aria-hidden="true">
            <span className="tm-seq-print">{LOT}</span>
          </div>
          <div className="tm-seq-chapter" data-chapter="5" data-rest="7">
            <ChapterWords chapter={5} count={5} />
            <Findings go={travel} />
            <Paper />
          </div>
          <div className="tm-seq-chapter tm-seq-finale" data-chapter={FINALE} data-rest="10">
            <FinaleWords onExplore={() => skip.current()} />
            <span className="tm-seq-finale-floor" aria-hidden="true" />
            <Principles />
          </div>
        </div>
      </div>
    </div>
  );
}

/** How long a move between two rests takes: about three quarters of a second between two details, up to a second
 *  for a long way (a new chapter's picture). */
const travelTime = (from: number, to: number) => 640 + Math.min(1, Math.abs(to - from) / 0.1) * 420;
const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
type FilmResume = {
  requested: boolean;
  clock: number;
  paused: boolean;
  light: number;
  rushTo: number;
  back: number;
  backEdge: number;
  phase: string | null;
  afterClose: (() => void) | null;
};

/**
 * The film's player: plays the story on its own clock once the reader starts it, and writes every part for each moment,
 * once a frame while it plays. The clock runs through a timetable (a move to each rest, then a dwell on it); the
 * picture, the bars and the chapter are all read from the clock. While the story plays the page holds still at its top;
 * closed, the film rests on the room.
 */
function useFilm(track: RefObject<HTMLDivElement | null>, on: boolean, base: SceneBase, ready: boolean, go: RefObject<(rest: number) => void>, skip: RefObject<() => void>) {
  const { box, plateScale, seat, tall } = base;
  const resume = useRef<FilmResume | null>(null);
  useLayoutEffect(() => {
    if (!on) resume.current = null;
    const root = on ? track.current : null;
    const section = root?.closest<HTMLElement>(".tm-mist");
    const view = root?.querySelector<HTMLElement>(".tm-seq-view");
    const camera = root?.querySelector<HTMLElement>(".tm-seq-camera");
    if (!root || !section || !view || !camera || !seat || !box.width) return;
    const q = (selector: string, within: ParentNode = root) => within.querySelector<HTMLElement>(selector);
    const all = (selector: string, within: ParentNode = root) => [...within.querySelectorAll<HTMLElement>(selector)];
    const featured = q(`.tm-room-vial[data-product-id="${CSS.escape(FEATURED)}"]`);
    const vials = all(".tm-room-plate .tm-room-vial");
    const neighbours = vials.filter((el) => el !== featured);
    const chapter = (i: number) => q(`.tm-seq-chapter[data-chapter="${i}"]`);
    const el = {
      words: q(".tm-mist-copy"),
      mist: all(".tm-floor-mist, .tm-front-mist"),
      roomSoft: q(".tm-seq-room-soft"),
      roomDeep: q(".tm-seq-room-deep"),
      neighbourGlass: neighbours.map((n) => q(".tm-room-vial-glass", n)),
      neighbourSoft: neighbours.map((n) => q(".tm-room-vial-soft", n)),
      neighbourAir: neighbours.map((n) => q(".tm-room-vial-air", n)),
      featuredGlass: featured ? q(".tm-room-vial-glass", featured) : null,
      featuredSoft: featured ? q(".tm-room-vial-soft", featured) : null,
      featuredAir: featured ? q(".tm-room-vial-air", featured) : null,
      featuredShade: featured ? q(".tm-room-vial-shade", featured) : null,
      hero: q(".tm-seq-hero"),
      heroGlow: q(".tm-seq-hero-glow"),
      heroRim: q(".tm-seq-hero-rim"),
      heroSheen: q(".tm-seq-hero-sheen > i"),
      pedestalShadow: q(".tm-seq-pedestal-shadow"),
      haze: q(".tm-seq-haze"),
      leads: all(".tm-seq-lead"),
      leadLines: all(".tm-seq-lead-line"),
      leadDots: all(".tm-seq-lead-dot"),
      threads: q(".tm-seq-threads") as unknown as HTMLElement | null,
      thread: q(".tm-seq-thread") as unknown as SVGPathElement | null,
      marks: all(".tm-seq-mark"),
      scan: q(".tm-seq-scan"),
      scanLine: q(".tm-seq-scan-line"),
      chapterWords: [1, 2, 3, 4, 5].map((i) => q(".tm-seq-words", chapter(i) ?? root)),
      leadCopy: q(".tm-seq-lead-copy"),
      decoder: q(".tm-seq-decoder"),
      decoderNow: q(".tm-seq-count-now"),
      verify: q(".tm-seq-verify"),
      typed: q(".tm-seq-typed"),
      field: q(".tm-seq-field"),
      record: q(".tm-seq-record"),
      recordLot: q(".tm-seq-record-lot"),
      recordRef: q(".tm-seq-record-ref"),
      traveler: q(".tm-seq-traveler"),
      findings: q(".tm-seq-findings"),
      paper: q(".tm-seq-paper"),
      page: q(".tm-seq-paper .tm-seq-page"),
      glint: q(".tm-seq-glint"),
      glintBand: q(".tm-seq-glint > i"),
      loupe: q(".tm-seq-loupe"),
      loupeImage: q(".tm-seq-loupe > img"),
      bloom: q(".tm-seq-bloom"),
      finaleWords: q(".tm-seq-finale-words"),
      finaleFloor: q(".tm-seq-finale-floor"),
      principles: all(".tm-seq-principle"),
      controls: q(".tm-seq-controls"),
      journeyName: q(".tm-seq-journey-name"),
      journeyNow: q(".tm-seq-journey-now"),
      segments: all(".tm-seq-segment"),
      segmentFills: all(".tm-seq-segment-fill"),
      steps: all(".tm-seq-step"),
      journey: q(".tm-seq-journey"),
      restSwitch: section.querySelector<HTMLElement>(".tm-seq-switch-rest"),
      filmSwitch: q(".tm-seq-switch-film"),
    };
    const write = writer();
    const header = document.querySelector<HTMLElement>(".tm-header");

    // The view's geometry: where it holds (under the header), how far the film runs, the scene the camera films, where
    // the vial may float in each chapter, and where the parts it hands over to are laid out.
    let top = 0, start = 0;
    let scene: Scene | null = null;
    let path: ReturnType<typeof cameraPath> = () => ({ s: 1, at: { x: 0, y: 0 }, on: { x: 0, y: 0 } });
    let vial: ReturnType<typeof vialPath> = () => ({ pose: { x: 0, y: 0, h: 1 }, air: 0 });
    let heroHeight = 1;
    let to = { recordLot: { x: 0, y: 0 }, recordRef: { x: 0, y: 0 }, paper: { x: 0, y: 0 } };
    // Where the reading glass rests on each finding, on the page as it is laid out (in its own pixels), and the glass's
    // size there.
    let printed: Pt[] = READ.map(() => ({ x: 0, y: 0 }));
    let glass = 1, pageScale = 1, deepest = 1;
    const rectOf = (node: HTMLElement | null): Rect | null => (node ? laidOut(node, view) : null);
    const measure = () => {
      const stuck = header ? (Number.parseFloat(getComputedStyle(header).top) || 0) + header.offsetHeight : 0;
      if (Math.abs(stuck - top) > 0.5) {
        top = stuck;
        section.style.setProperty("--tm-seq-top", `${top.toFixed(1)}px`);
      }
      // The story plays at the page's top, where the view starts below all that stands above it there (the
      // research-use strip, which scrolls away, as well as the header): it runs from there to the window's foot.
      const from = view.getBoundingClientRect().top + window.scrollY;
      if (Math.abs(from - start) > 0.5) {
        start = from;
        section.style.setProperty("--tm-story-from", `${start.toFixed(1)}px`);
      }
      const W = view.clientWidth, H = view.clientHeight;
      // Where the vial may float: on a wide screen, the room left of the chapter's column, above the journey; on a
      // phone, the picture's room below the story's controls and above the captions.
      const journey = rectOf(el.controls);
      const foot = journey ? journey.top : H;
      // The page's margin, as the journey's row stands in it.
      const margin = journey ? journey.left : 24;
      const freeBeside = (column: Rect | null): Rect => ({
        left: margin + 56,
        right: column ? column.left - 104 : W * 0.5,
        top: H * 0.07,
        bottom: foot - H * 0.035,
      });
      const approachWords = rectOf(el.chapterWords[0]);
      // On a phone the picture's room is one for the approach, the label and the connection (the tallest of their
      // captions sets its foot), so the vial holds one size through them; for the record, its part left of the
      // record's figures.
      const ceiling = (rectOf(q(".tm-story-chrome"))?.bottom ?? H * 0.08) + 10;
      const captionTop = (i: number) => rectOf(el.chapterWords[i])?.top ?? H * 0.75;
      const stage = { left: margin, right: W - margin, top: ceiling, bottom: Math.min(captionTop(0), captionTop(1), captionTop(2)) - 18 };
      const free = tall
        ? {
            approach: stage,
            label: stage,
            connection: stage,
            record: { left: margin * 0.5, right: (rectOf(el.record)?.left ?? W * 0.54) - 8, top: ceiling, bottom: captionTop(3) - 18 },
          }
        : {
            approach: { left: 0, right: W, top: (approachWords?.bottom ?? H * 0.3) + 20, bottom: H },
            label: freeBeside(rectOf(chapter(2))),
            connection: freeBeside(rectOf(chapter(3))),
            record: freeBeside(rectOf(chapter(4))),
          };
      scene = { view: { w: W, h: H }, box, plateScale, seat, tall, sharp: (CUTOUT.h / Math.max(1, window.devicePixelRatio || 1)) * SHARP_PAST, free };
      path = cameraPath(scene);
      vial = vialPath(scene, path);
      const poses = posesOf(scene);
      heroHeight = Math.max(poses.hover.h, poses.label.h, poses.connection.h, poses.record.h);
      root.style.setProperty("--tm-seq-hero-h", `${heroHeight.toFixed(1)}px`);
      // The scan's frame is laid out at the code's size on the vial at its largest, and only ever drawn smaller.
      root.style.setProperty("--tm-seq-scan-w", `${((heroHeight * QR_FRAME.w) / CUTOUT.h).toFixed(1)}px`);
      root.style.setProperty("--tm-seq-scan-h", `${((heroHeight * QR_FRAME.h) / CUTOUT.h).toFixed(1)}px`);
      // The pedestal's shadow is laid out at the vial's width at rest, and drawn larger as the vial rises.
      root.style.setProperty("--tm-seq-seat-w", `${((vialHeight(scene) * CUTOUT.w) / CUTOUT.h).toFixed(1)}px`);
      const lotRect = rectOf(el.recordLot?.firstElementChild as HTMLElement | null);
      const refRect = rectOf(el.recordRef);
      const paperRect = rectOf(q(".tm-seq-page", el.paper ?? root));
      to = {
        recordLot: lotRect ? middleOf(lotRect) : { x: W * 0.7, y: H * 0.4 },
        recordRef: refRect ? middleOf(refRect) : { x: W * 0.7, y: H * 0.6 },
        paper: paperRect ? middleOf(paperRect) : { x: W * 0.7, y: H * 0.5 },
      };
      const pageW = el.page?.offsetWidth ?? 0, pageH = el.page?.offsetHeight ?? 0;
      printed = READ.map((at) => ({ x: (at.x / CERTIFICATE_PAGE.w) * pageW, y: (at.y / CERTIFICATE_PAGE.h) * pageH }));
      glass = loupeShare(tall) * pageW;
      pageScale = pageW / CERTIFICATE_PAGE.w;
      // The print under the glass is laid out at its closest reading and only ever drawn smaller, so it stays sharp.
      deepest = (loupeShare(tall) * CERTIFICATE_PAGE.w) / Math.min(...READ.map((at) => at.across));
      root.style.setProperty("--tm-seq-loupe-share", String(loupeShare(tall)));
      root.style.setProperty("--tm-seq-loupe-w", `${(FINE_PRINT.w * pageScale * deepest).toFixed(1)}px`);
    };

    // ---------- The story's clock ----------

    // The timetable: from the room to each rest in turn, a move, then a dwell while its words are read, the picture all
    // but still (the clock crosses the rest's hold slowly, so its light still drifts).
    type Seg = { rest: number; move: boolean; t0: number; t1: number; p0: number; p1: number };
    const segs: Seg[] = [];
    let end = 0;
    for (let i = 1, at = 0; i < RESTS.length; i++) {
      const [h0, h1] = RESTS[i].hold;
      const move = travelTime(at, h0);
      segs.push({ rest: i, move: true, t0: end, t1: end + move, p0: at, p1: h0 });
      end += move;
      segs.push({ rest: i, move: false, t0: end, t1: end + DWELL[i], p0: h0, p1: h1 });
      end += DWELL[i];
      at = h1;
    }
    const segAt = (c: number) => segs.find((s) => c < s.t1) ?? segs[segs.length - 1];
    const dwellOf = (rest: number) => segs.find((s) => s.rest === rest && !s.move) ?? segs[segs.length - 1];
    const pAt = (c: number) => {
      if (c <= 0) return 0;
      const s = segAt(c);
      const t = Math.min(1, Math.max(0, (c - s.t0) / (s.t1 - s.t0)));
      return mix(s.p0, s.p1, s.move ? smootherstep(t) : t);
    };
    // Each bar's share of the clock: from its chapter's first move to its last dwell.
    const spans = STORY_BARS.map((chapter) => {
      const mine = segs.filter((s) => RESTS[s.rest].chapter === chapter);
      return { t0: mine[0]?.t0 ?? 0, t1: mine[mine.length - 1]?.t1 ?? end };
    });

    const beats = q(".tm-seq-beats");
    const chrome = {
      root: q(".tm-story-chrome"),
      fills: all(".tm-story-bar-fill"),
      pause: q(".tm-story-pause"),
      close: q(".tm-story-close"),
    };
    let open = false, clock = 0, frame = 0, last = 0, closing = 0;
    let requested = false, openingFrame = 0, disposed = false;
    // Where the taps have asked the story to go on to (the start of a rest's reading: the clock runs on fast until it
    // gets there); the clock running back to an earlier rest (and the edge past which it lands there); paused by the
    // button, or held by a finger on the picture.
    let rushTo = 0, back = -1, backEdge = 0, paused = false, holding = false;
    // How much of the page's light its dissolve may show: all of it at the story's own pace, none on a run (LIGHT_EASE).
    let light = 1;
    let afterClose: (() => void) | null = null;
    // The opening's words coming back over the room, once the story has finished.
    let backTimer = 0;
    const backDone = () => {
      window.clearTimeout(backTimer);
      backTimer = 0;
      section.removeAttribute("data-story-back");
    };

    let receivingStory = resume.current !== null;
    const publishStory = () => {
      if (receivingStory) return;
      window.dispatchEvent(new CustomEvent("tm-story-state", { detail: {
        open, clock, paused, holding, light, rushTo, back, backEdge,
        phase: section.getAttribute("data-story"),
      } }));
    };
    const drawBars = () => {
      publishStory();
      chrome.fills.forEach((fill, i) => {
        const span = spans[i];
        const share = Math.min(1, Math.max(0, (clock - span.t0) / Math.max(1, span.t1 - span.t0)));
        write(fill, "transform", `scaleX(${fixed(share, 4)})`);
      });
    };
    const still = () => paused || holding;
    const showPaused = () => {
      write.attr(chrome.pause, "aria-pressed", String(paused));
      write.attr(chrome.pause, "aria-label", paused ? "Play the story" : "Pause the story");
      section.toggleAttribute("data-story-paused", paused);
      section.toggleAttribute("data-story-held", holding);
      publishStory();
    };
    // While the story plays, the page holds still at its top: no scroll, and no touch anywhere on it moves it (Safari
    // scrolls a page under overflow: hidden from a touch outside the story, on the header).
    const lock = (on: boolean) => {
      for (const node of [document.documentElement, document.body]) node.style.overflow = on ? "hidden" : "";
      if (on) document.addEventListener("touchmove", onTouchMove, { passive: false });
      else document.removeEventListener("touchmove", onTouchMove);
    };

    const tick = (now: number) => {
      frame = 0;
      if (disposed || !open) return;
      if (held(root)) {
        last = 0;
        return;
      }
      const dt = last ? Math.min(50, now - last) : 16;
      last = now;
      const run = back >= 0 || clock < rushTo;
      light = Math.min(1, Math.max(0, light + (run ? -dt : dt) / LIGHT_EASE));
      if (back >= 0) {
        // Running back: past the move into the earlier rest, it lands at the start of that rest's reading (a still
        // picture); back past the first, it is the room again, and the story closes there.
        const c = clock - dt * REWIND;
        if (c <= backEdge) {
          clock = back;
          back = -1;
        } else clock = c;
        if (clock <= 0) {
          settle();
          return;
        }
      } else if (!still() || clock < rushTo) {
        // Going on: a move at speed, a reading passed over in a moment (crossed, not cut, so the picture never jumps).
        const s = segAt(clock);
        if (clock < rushTo) clock = Math.min(rushTo, clock + dt * (s.move ? RUSH : (s.t1 - s.t0) / PASS));
        else clock += dt;
      }
      draw(pAt(clock));
      drawBars();
      if (clock >= end) {
        close();
        return;
      }
      if (back >= 0 || clock < rushTo || !still()) frame = requestAnimationFrame(tick);
      else last = 0;
    };
    const wake = () => {
      if (!disposed && open && !frame) frame = requestAnimationFrame(tick);
    };

    // On: a move runs on fast to its rest; from a reading, on to the next rest's. Each tap counts: tapped again while
    // the story is going on, it goes one rest further.
    const next = () => {
      if (!open || closing) return;
      back = -1;
      if (rushTo > clock) {
        const aim = segAt(rushTo).rest;
        if (aim + 1 < RESTS.length) rushTo = dwellOf(aim + 1).t0;
      } else {
        const s = segAt(clock);
        if (s.move) rushTo = dwellOf(s.rest).t0;
        else if (s.t1 >= end) {
          close();
          return;
        } else rushTo = dwellOf(s.rest + 1).t0;
      }
      wake();
    };
    // Back: to the start of this rest's reading, once it has been read a while; otherwise to the rest before, and from
    // the first, the room.
    const prev = () => {
      if (!open || closing) return;
      rushTo = 0;
      const s = segAt(clock);
      if (!s.move && clock - s.t0 > 1500) {
        clock = s.t0;
        last = 0;
        draw(pAt(clock));
        drawBars();
        wake();
        return;
      }
      if (!s.move) clock = s.t0;
      const to = s.rest - 1;
      const reading = to >= 1 ? dwellOf(to) : null;
      back = reading ? reading.t0 : 0;
      backEdge = reading ? reading.t1 : 0;
      wake();
    };
    const togglePause = () => {
      paused = !paused;
      showPaused();
      wake();
    };

    // Opening: from the room at the page's top (scrolled there first, if the reader had started down the page).
    const cancelOpening = () => {
      requested = false;
      cancelAnimationFrame(openingFrame);
      openingFrame = 0;
    };
    const begin = () => {
      if (disposed || open) return;
      cancelOpening();
      open = true;
      clock = 0;
      last = 0;
      rushTo = 0;
      back = -1;
      paused = false;
      holding = false;
      backDone();
      lock(true);
      section.setAttribute("data-story", "open");
      write.attr(beats, "inert", null);
      showPaused();
      measure();
      wake();
    };
    const onOpen = () => {
      if (disposed || open || closing || requested) return;
      if (window.scrollY <= 1) {
        begin();
        return;
      }
      requested = true;
      window.scrollTo({ top: 0, behavior: "smooth" });
      const since = performance.now();
      const wait = () => {
        openingFrame = 0;
        if (disposed || !requested) return;
        if (window.scrollY <= 1 || performance.now() - since > 1400) begin();
        else openingFrame = requestAnimationFrame(wait);
      };
      openingFrame = requestAnimationFrame(wait);
    };
    // Settled on the room: the story is closed, and the page is the reader's again.
    const settle = () => {
      const focused = view.contains(document.activeElement);
      open = false;
      clock = 0;
      last = 0;
      rushTo = 0;
      back = -1;
      paused = false;
      holding = false;
      cancelAnimationFrame(frame);
      frame = 0;
      draw(0);
      drawBars();
      section.removeAttribute("data-story");
      showPaused();
      write.attr(beats, "inert", "");
      lock(false);
      if (focused) section.querySelector<HTMLElement>(".tm-story-cue")?.focus({ preventScroll: true });
      const then = afterClose;
      afterClose = null;
      then?.();
    };
    // Finished: the finale's picture is the room whole again, so the room is simply handed back, with no mist to hide a
    // move. The story's words, principles and controls fade from it, then the opening's own words come back over the
    // same room, and the page scrolls on from there.
    const finish = () => {
      section.setAttribute("data-story", "ending");
      publishStory();
      closing = window.setTimeout(() => {
        closing = 0;
        settle();
        section.setAttribute("data-story-back", "");
        backTimer = window.setTimeout(backDone, BACK_IN);
      }, END_OUT);
    };
    // Closing: the room's mist comes in over the story, the camera is back in the room behind it, and the mist clears.
    // From the finale, whose picture is the room already, the story finishes instead.
    const close = () => {
      cancelOpening();
      if (!open || closing) return;
      if (clock >= dwellOf(RESTS.length - 1).t0) {
        finish();
        return;
      }
      section.setAttribute("data-story", "closing");
      publishStory();
      closing = window.setTimeout(() => {
        closing = 0;
        settle();
      }, VEIL_IN);
    };

    // The cards' own buttons go to a rest: the next by the usual way on, an earlier one by running back.
    go.current = (rest: number) => {
      if (!open || closing || !RESTS[rest]) return;
      const s = segAt(clock);
      if (rest === s.rest + 1 || (rest === s.rest && s.move)) next();
      else if (rest < s.rest || (rest === s.rest && clock > s.t0)) {
        rushTo = 0;
        if (!s.move) clock = s.t0;
        const reading = dwellOf(rest);
        back = reading.t0;
        backEdge = rest < s.rest ? reading.t1 : reading.t0;
        wake();
      } else if (rest > s.rest) {
        rushTo = 0;
        back = -1;
        clock = dwellOf(rest).t0;
        wake();
      }
    };
    // The finale's way on: the story closes, and the page goes on to the collection's classes.
    skip.current = () => {
      const toIndex = () => {
        const target = document.getElementById("tm-index-title");
        const host = target?.closest<HTMLElement>("section") ?? target;
        if (!host) return;
        window.scrollTo({ top: host.getBoundingClientRect().top + window.scrollY - top, behavior: "smooth" });
        if (target) {
          target.setAttribute("tabindex", "-1");
          target.focus({ preventScroll: true });
        }
      };
      if (open) {
        afterClose = toIndex;
        close();
      } else toIndex();
    };

    // A finger on the picture: held, the story pauses, and plays on when it lets go. A tap goes on (on the left side,
    // back), a swipe across goes on or back, and a swipe down closes the story. Its links, buttons and controls are
    // their own.
    let down: { x: number; y: number; at: number; id: number } | null = null;
    const own = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest("a, button, input, label, .tm-story-chrome"));
    const onDown = (event: PointerEvent) => {
      if (!open || closing || !event.isPrimary || event.button !== 0 || own(event.target)) return;
      down = { x: event.clientX, y: event.clientY, at: event.timeStamp, id: event.pointerId };
      holding = true;
      showPaused();
    };
    const onUp = (event: PointerEvent) => {
      if (!down || event.pointerId !== down.id) return;
      const dx = event.clientX - down.x, dy = event.clientY - down.y;
      const long = event.timeStamp - down.at > 320;
      down = null;
      holding = false;
      showPaused();
      if (dy > 64 && dy > Math.abs(dx) * 1.2) close();
      else if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) next();
        else prev();
      } else if (!long && Math.hypot(dx, dy) < 14) {
        const box = view.getBoundingClientRect();
        if (event.clientX - box.left < box.width * 0.3) prev();
        else next();
      } else wake();
    };
    const onCancel = (event: PointerEvent) => {
      if (!down || event.pointerId !== down.id) return;
      down = null;
      holding = false;
      showPaused();
      wake();
    };
    // The page under the story never scrolls while it plays, nor bounces.
    const onTouchMove = (event: TouchEvent) => {
      if (open) event.preventDefault();
    };
    const onKey = (event: KeyboardEvent) => {
      if ((!open && !requested) || event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
      if (!open && event.key !== "Escape") return;
      const onControl = event.target instanceof Element && Boolean(event.target.closest("a, button, input"));
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") prev();
      else if (event.key === " " && !onControl) togglePause();
      else return;
      event.preventDefault();
    };
    const onChrome = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLElement>(".tm-story-button") : null;
      if (!button) return;
      if (button === chrome.pause) togglePause();
      else if (button === chrome.close) close();
      else if (button.dataset.step === "1") next();
      else if (button.dataset.step === "-1") prev();
    };
    // A key that reaches another chapter's words or cards while the story plays brings the story to that chapter.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const home = target?.closest<HTMLElement>("[data-rest]");
      if (!open || !home || !beats?.contains(home)) return;
      const rest = Number(home.dataset.rest);
      if (RESTS[rest] && RESTS[restAt(pAt(clock))]?.chapter !== RESTS[rest].chapter) go.current(rest);
    };
    let away = false, playing = false;
    const draw = (p: number) => {
      if (!scene) return;
      const L = layers(p);
      const cam = path(p);
      const { pose, air } = vial(p);
      // Procession owns the resting camera. Toolbar/element resize callbacks
      // must not reset that scroll-driven transform between its animation frames.
      if (open || !section.closest("[data-procession]:not([data-procession-native])")) {
        write(camera, "transform", p <= 0 ? "none" : cameraTransform(cam));
      }
      // The camera has left the room's rest: the room holds still (its mist pauses), and nothing on it takes the pointer.
      const nowAway = p > AWAY;
      if (nowAway !== away) {
        away = nowAway;
        section.toggleAttribute("data-seq-away", away);
        if (away) section.setAttribute("data-seq-begun", "");
        window.dispatchEvent(new Event(SEQUENCE_EVENT));
      }
      // Partway through the story: nothing else asks for the reader's attention meanwhile (the first-order offer waits).
      const nowPlaying = p > AWAY && p < 1 - AWAY;
      if (nowPlaying !== playing) {
        playing = nowPlaying;
        section.toggleAttribute("data-seq-playing", playing);
      }
      // Which chapter, detail and finding the picture is at: the parts that change with them are styled from these.
      const rest = restAt(p);
      restNow = rest;
      const at = RESTS[rest];
      const detail = p < RESTS[5].hold[0] - 0.04 ? detailAt(p) : p < 0.52 ? 2 : 1;
      write.attr(root, "data-chapter", String(at.chapter));
      write.attr(root, "data-detail", String(detail));
      write.attr(root, "data-finding", String(findingAt(p)));

      // The opening's words leave on the first scroll, drifting up a little as they go; the stage's switch goes with
      // them, and the journey's controls take its place.
      write(el.words, "opacity", fixed(L.words));
      write(el.words, "translate", `0 ${fixed((1 - L.words) * -14, 2)}px`);
      write(el.words, "--tm-seq-words-events", L.words > 0.002 ? "auto" : "none");
      write(el.restSwitch, "opacity", fixed(L.words));
      write(el.restSwitch, "visibility", L.words > 0.002 ? "visible" : "hidden");
      for (const node of el.mist) write(node, "opacity", fixed(L.mist));
      write(el.roomSoft, "opacity", fixed(L.roomSoft));
      write(el.roomDeep, "opacity", fixed(L.roomDeep));
      // A vial racked out of focus: its softened copy fades in over the sharp one, which goes as it arrives, and the
      // window's thin edge of light on the glass goes with the sharp one.
      const rack = (sharp: HTMLElement | null | undefined, soft: HTMLElement | null | undefined, light: HTMLElement | null | undefined, t: number, shown = 1) => {
        write(soft, "opacity", fixed(t * shown));
        write(sharp, "opacity", fixed((1 - t * t) * shown));
        write(light, "opacity", fixed((1 - t) * shown));
      };
      el.neighbourGlass.forEach((glass, i) => rack(glass, el.neighbourSoft[i], el.neighbourAir[i], L.neighboursSoft));
      // The featured vial: in the air, the vial drawn from its large cutout; on its pedestal, the plate's own, the two
      // crossing over as it lifts and lands, where they are one picture. Its seat on the pedestal goes as it lifts.
      const inAir = Math.min(1, air / 0.05);
      rack(el.featuredGlass, el.featuredSoft, el.featuredAir, L.vialSoft, 1 - inAir);
      write(el.featuredShade, "opacity", fixed(L.shade));
      write(el.hero, "opacity", fixed(inAir));
      write(el.hero, "visibility", inAir > 0.001 ? "visible" : "hidden");
      const heroScale = pose.h / heroHeight;
      const heroLeft = pose.x - (pose.h * CUTOUT.w) / CUTOUT.h / 2, heroTop = pose.y - pose.h / 2;
      write(el.hero, "transform", `translate3d(${fixed(heroLeft, 2)}px, ${fixed(heroTop, 2)}px, 0) scale(${fixed(heroScale, 5)})`);
      // Its light: the room's light gathers behind it and catches its glass at the edges as the lens racks focus to it,
      // and the highlight drifts across its crimp and shoulders (the band is SHEEN of the vial's width; L.sheen is where
      // its middle crosses).
      const lit = 0.35 + 0.65 * L.roomSoft;
      write(el.heroGlow, "opacity", fixed(lit * GLOW));
      write(el.heroRim, "opacity", fixed(lit * RIM));
      write(el.heroSheen, "transform", `translate3d(${fixed(((L.sheen - SHEEN / 2) / SHEEN) * 100, 2)}%, 0, 0)`);
      // Its shadow on the pedestal below, as the seat it leaves fades; gone again as it lands, where the seat returns.
      const fall = pedestalShadow(scene, cam, pose);
      const shadowed = inAir * (1 - L.shade) * fall.density;
      write(el.pedestalShadow, "opacity", fixed(shadowed * SHADOW));
      write(el.pedestalShadow, "visibility", shadowed > 0.002 ? "visible" : "hidden");
      write(el.pedestalShadow, "transform", `translate3d(${fixed(fall.x, 2)}px, ${fixed(fall.y, 2)}px, 0) translate(-50%, -50%) scale(${fixed(fall.scale, 4)})`);
      // The haze the room recedes into while the lens is close, drifting slowly the whole way through; as the room comes
      // back into focus it settles to the floor, and stays there for the finale.
      const haze = L.haze * mix(HAZE, HAZE_FLOOR, L.hazeSettle);
      write(el.haze, "opacity", fixed(haze));
      write(el.haze, "visibility", haze > 0.002 ? "visible" : "hidden");
      write(el.haze, "transform", `translate3d(${fixed(-p * HAZE_DRIFT, 3)}%, 0, 0) scaleY(${fixed(mix(1, HAZE_FLAT, L.hazeSettle), 4)})`);

      // The decoder: a line from each detail on the label to its marker, the marker beside the vial. A dot on a word
      // stands just past it, by its own radius and a hair, so the word stays whole however small the vial is drawn.
      const compact = tall;
      const points = MARKS.map((mark) => {
        const at = posePoint(pose, mark.x, mark.y);
        return { x: at.x + mark.out * DOT_CLEAR, y: at.y };
      });
      const reach = compact ? 46 : Math.min(96, Math.max(60, Math.abs(points[0].x - points[1].x) * 0.42));
      const badges: Pt[] = [
        { x: points[0].x + reach, y: points[0].y - (compact ? 34 : 44) },
        { x: points[1].x - reach, y: points[1].y + (compact ? -10 : 14) },
        { x: points[0].x + reach * (compact ? 0.6 : 0.9), y: points[2].y + (compact ? 44 : 86) },
      ];
      // Keep each 44 px label target, plus an 8 px gutter, inside a phone's
      // picture even when a tall viewport brings the vial closer to its edges.
      if (compact) for (const badge of badges) badge.x = Math.max(30, Math.min(scene.view.w - 30, badge.x));
      points.forEach((point, i) => {
        const o = L.marks[i] ?? 0;
        write(el.leads[i], "opacity", fixed(o));
        // The line laid along from the dot to its marker: its own length (LEAD_LINE) turned and stretched to fit.
        const dx = badges[i].x - point.x, dy = badges[i].y - point.y;
        const at = `translate3d(${fixed(point.x, 2)}px, ${fixed(point.y, 2)}px, 0)`;
        write(el.leadLines[i], "transform", `${at} rotate(${fixed(Math.atan2(dy, dx), 5)}rad) scaleX(${fixed(Math.hypot(dx, dy) / LEAD_LINE, 4)})`);
        write(el.leadDots[i], "transform", at);
        const mark = el.marks[i];
        write(mark, "opacity", fixed(o));
        write(mark, "transform", `translate3d(${fixed(badges[i].x, 1)}px, ${fixed(badges[i].y, 1)}px, 0) scale(${fixed(0.86 + 0.14 * o, 3)})`);
        write(mark, "visibility", o > 0.002 ? "visible" : "hidden");
        write.attr(mark, "aria-pressed", String(detail === i));
      });

      // The scan: the code's printed frame on the label, its corners closing in on it as the code opens Verify, and a
      // line of light passing down it once.
      write(el.scan, "opacity", fixed(L.scan));
      write(el.scan, "visibility", L.scan > 0.002 ? "visible" : "hidden");
      if (L.scan > 0.002) {
        const code = posePoint(pose, QR_FRAME.x + QR_FRAME.w / 2, QR_FRAME.y + QR_FRAME.h / 2);
        write(el.scan, "transform", `translate3d(${fixed(code.x, 2)}px, ${fixed(code.y, 2)}px, 0) translate(-50%, -50%) scale(${fixed((pose.h / heroHeight) * (1 + 0.16 * (1 - L.scan)), 4)})`);
        write(el.scanLine, "opacity", fixed(Math.sin(Math.PI * L.scanSweep)));
        write(el.scanLine, "transform", `translate3d(0, ${fixed(L.scanSweep * 100, 2)}%, 0)`);
      }

      // Each chapter's words: in as its picture arrives, out as the next begins, rising a little as they come.
      el.chapterWords.forEach((node, i) => {
        const o = L.chapters[i + 1] ?? 0;
        write(node, "opacity", fixed(o));
        write(node, "translate", `0 ${fixed((1 - o) * 12, 2)}px`);
      });
      // The cards take taps only while they show; out of their chapter they are only unseen (read in the page's order,
      // and a key that reaches them brings the story to them: onFocusIn).
      const card = (node: HTMLElement | null, o: number, transform?: string) => {
        write(node, "opacity", fixed(o));
        write(node, "transform", transform ?? `translate3d(0, ${fixed((1 - o) * 16, 2)}px, 0)`);
        write(node, "--tm-seq-taps", o > 0.5 ? "auto" : "none");
      };
      card(el.leadCopy, L.chapters[1] ?? 0);
      card(el.decoder, L.decoder);
      write.text(el.decoderNow, two(detail + 1));
      card(el.verify, L.verify);
      const typed = Math.round(L.typing * LOT.length);
      write.text(el.typed, LOT.slice(0, typed));
      write.attr(el.field, "data-typed", typed >= LOT.length ? "" : null);
      write.attr(el.field, "data-typing", L.typing > 0 && L.typing < 1 ? "" : null);
      // The record comes in from the vial's side as the lot travels to it, turning to face the reader, and lifts away
      // as the certificate comes forward from its reference.
      const entry = L.recordIn, depart = L.recordOut;
      card(
        el.record,
        L.record,
        `translate3d(${fixed(-48 * (1 - entry), 2)}px, ${fixed(18 * (1 - entry) - 14 * depart, 2)}px, 0) perspective(1300px) rotateY(${fixed(-12 * (1 - entry), 3)}deg) scale(${fixed(0.95 + 0.05 * entry - 0.03 * depart, 4)})`,
      );
      write(el.recordLot, "opacity", fixed(L.recordLot));
      // The lot travels from the number printed on the label to its place in the record, along a low arc, a thread
      // trailing it from the label.
      const from = posePoint(pose, LOT_PRINT.x, LOT_PRINT.y);
      const t = L.travel;
      const arc = Math.sin(t * Math.PI) * (compact ? 24 : 64);
      const flying = { x: mix(from.x, to.recordLot.x, t), y: mix(from.y, to.recordLot.y, t) - arc };
      write(el.traveler, "opacity", fixed(L.traveler));
      write(el.traveler, "visibility", L.traveler > 0.002 ? "visible" : "hidden");
      write(el.traveler, "transform", `translate3d(${fixed(flying.x, 1)}px, ${fixed(flying.y, 1)}px, 0) translate(-50%, -50%) scale(${fixed(0.62 + 0.38 * t, 4)})`);
      // The thread is a drawing, so it is drawn only while it shows, and is no layer at all when it doesn't.
      write(el.threads, "visibility", L.traveler > 0.002 ? "visible" : "hidden");
      if (L.traveler > 0.002) write.attr(el.thread, "d", `M ${fixed(from.x, 1)} ${fixed(from.y, 1)} C ${fixed(from.x + 60, 1)} ${fixed(from.y, 1)} ${fixed(flying.x - 40, 1)} ${fixed(flying.y + 12, 1)} ${fixed(flying.x, 1)} ${fixed(flying.y, 1)}`);
      write(el.thread as unknown as HTMLElement, "opacity", fixed(L.traveler * 0.55));
      // The certificate: the page comes forward from the record's reference, turning to face the reader, and settles
      // beside its findings; at the end it sinks back into the room's light.
      const e = L.paper, gone = L.paperOut;
      const dx = (to.recordRef.x - to.paper.x) * (1 - e), dy = (to.recordRef.y - to.paper.y) * (1 - e) + 26 * gone;
      write(el.paper, "opacity", fixed(L.paperShown));
      write(el.paper, "transform", `translate3d(${fixed(dx, 2)}px, ${fixed(dy, 2)}px, 0) perspective(1400px) rotateY(${fixed(-15 * (1 - e), 3)}deg) rotateX(${fixed(5 * (1 - e), 3)}deg) rotateZ(${fixed(-2 * (1 - e), 3)}deg) scale(${fixed(0.5 + 0.5 * e - 0.04 * gone, 4)})`);
      write(el.paper, "--tm-seq-taps", L.paperShown > 0.5 ? "auto" : "none");
      // The window's light sweeps across the page once as it turns toward the reader, gone by the time it faces them;
      // and while its findings are read, the same band passes over it once more as a soft shade (sequence.css), so the
      // held page is never quite still.
      const turning = e < 1;
      const across = turning ? Math.min(1, Math.max(0, (e - 0.1) / 0.8)) : L.pageShade;
      write(el.glint, "opacity", fixed(Math.sin(Math.PI * across) * (turning ? GLINT : PAGE_SHADE)));
      write(el.glintBand, "transform", `translate3d(${fixed(mix(-140, 260, across), 2)}%, 0, 0) skewX(-16deg)`);
      // The finding's marks stand on the page once it has come forward (sequence.css .tm-seq-focus), and so does the
      // reading glass: centred on the finding being read and as close as it is read there (READ), gliding to the next
      // between their rests, lifted a little on its way (LOUPE_LIFT); under it, the page's findings as the lab's PDF
      // prints them (FINE_PRINT), laid out at the closest reading and drawn smaller for the others.
      write.attr(root, "data-paper", L.paper >= 0.999 ? "set" : null);
      const along = Math.min(1, Math.floor(L.reading)), glide = L.reading - along;
      const onPage = READ[along], toPage = READ[Math.min(READ.length - 1, along + 1)];
      const reading = printed[along], toRead = printed[Math.min(printed.length - 1, along + 1)];
      const read = { x: mix(reading.x, toRead.x, glide), y: mix(reading.y, toRead.y, glide) };
      const lift = Math.sin(Math.PI * glide);
      const shown = mix(onPage.across, toPage.across, glide) * (1 + LOUPE_LIFT * lift);
      const power = (loupeShare(tall) * CERTIFICATE_PAGE.w) / shown;
      const under = pageScale * power;
      const inPrint = { x: mix(onPage.x, toPage.x, glide) - FINE_PRINT.x, y: mix(onPage.y, toPage.y, glide) - FINE_PRINT.y };
      write(el.loupe, "transform", `translate3d(${fixed(read.x - glass / 2, 2)}px, ${fixed(read.y - glass / 2, 2)}px, 0) scale(${fixed(1 + 0.02 * lift, 4)})`);
      write(el.loupe, "--tm-seq-loupe-lift", fixed(lift, 3));
      write(el.loupeImage, "transform", `translate3d(${fixed(glass / 2 - under * inPrint.x, 2)}px, ${fixed(glass / 2 - under * inPrint.y, 2)}px, 0) scale(${fixed(power / deepest, 4)})`);
      // As the page goes, it brightens into a soft bloom of the room's light, which goes with it; tapped through, it
      // simply fades (LIGHT_EASE).
      const bloom = L.paperLight * light;
      write(el.bloom, "opacity", fixed(bloom));
      write(el.bloom, "visibility", bloom > 0.002 ? "visible" : "hidden");
      card(el.findings, L.findings);
      // The finale: its words where the headline stood, and the four principles one after another.
      write(el.finaleWords, "opacity", fixed(L.finale));
      write(el.finaleWords, "translate", `0 ${fixed((1 - L.finale) * 14, 2)}px`);
      write(el.finaleWords, "--tm-seq-taps", L.finale > 0.5 ? "auto" : "none");
      write(el.finaleFloor, "opacity", fixed(L.principles[0] ?? 0));
      el.principles.forEach((node, i) => {
        const o = L.principles[i] ?? 0;
        write(node, "opacity", fixed(o));
        write(node, "translate", `0 ${fixed((1 - o) * 12, 2)}px`);
      });

      // The journey: which chapter, how far through each, and the way on or back.
      write(el.controls, "opacity", fixed(L.journey));
      write(el.controls, "--tm-seq-taps", L.journey > 0.5 ? "auto" : "none");
      // One Motion switch at a time: the stage's while the opening's words are up, the journey's after.
      write(el.filmSwitch, "visibility", L.words > 0.002 ? "hidden" : "visible");
      const shownChapter = Math.min(at.chapter, CHAPTERS.length - 1);
      write.text(el.journeyName, shownChapter === 2 ? `Label · ${DETAILS[detail]}` : shownChapter === 5 ? `Certificate · ${FINDINGS[findingAt(p)]}` : CHAPTERS[shownChapter]);
      write.text(el.journeyNow, two(shownChapter + 1));
      el.segmentFills.forEach((fill, i) => {
        const start = RESTS.find((r) => r.chapter === i)?.hold[0] ?? 0;
        const next = RESTS.find((r) => r.chapter === i + 1)?.hold[0] ?? 1;
        const share = i === 0 ? Math.min(1, p / Math.max(0.0001, next)) : Math.min(1, Math.max(0, (p - start) / (next - start)));
        write(fill, "transform", `scaleX(${fixed(share, 4)})`);
        write.attr(el.segments[i], "aria-current", i === shownChapter ? "step" : null);
      });
      write.attr(el.steps[0], "aria-disabled", rest === 0 ? "true" : null);
    };

    // The presentation follows one clock, but computes the camera independently
    // for each viewport. No stretched desktop coordinates or second autoplay timer.
    const followStory = (event: Event) => {
      const state = (event as CustomEvent).detail;
      if (!state || typeof state.open !== "boolean" || !Number.isFinite(state.clock)) return;
      receivingStory = true;
      try {
        if (!state.open) {
          if (open) { window.clearTimeout(closing); closing = 0; settle(); }
          return;
        }
        if (!open) { window.scrollTo({ top: 0, behavior: "instant" }); begin(); }
        cancelAnimationFrame(frame);
        frame = 0;
        last = 0;
        clock = Math.max(0, Math.min(end, state.clock));
        paused = !!state.paused;
        holding = !!state.holding;
        light = state.light;
        rushTo = state.rushTo;
        back = state.back;
        backEdge = state.backEdge;
        showPaused();
        draw(pAt(clock));
        drawBars();
        if (state.phase === "closing" || state.phase === "ending") close();
      } finally { receivingStory = false; }
    };
    const remeasure = () => {
      if (disposed) return;
      measure();
      draw(pAt(clock));
    };
    measure();
    draw(0);
    drawBars();
    write.attr(beats, "inert", "");
    const observer = new ResizeObserver(remeasure);
    observer.observe(root);
    observer.observe(view);
    for (const node of [el.leadCopy, el.decoder, el.verify, el.record, el.paper, el.controls, ...el.chapterWords]) if (node) observer.observe(node);
    void document.fonts?.ready.then(remeasure);
    window.addEventListener("resize", remeasure);
    window.addEventListener("tm-flight", remeasure);
    window.addEventListener(STORY_EVENT, onOpen);
    window.addEventListener("tm-story-follow", followStory);
    window.addEventListener("tm-story-release", wake);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    view.addEventListener("pointerdown", onDown);
    chrome.root?.addEventListener("click", onChrome);
    section.addEventListener("focusin", onFocusIn);
    // Viewport, font and decoded-image layout changes can rebuild the geometry
    // while a story is running. Keep its clock and intent through that rebuild.
    const saved = resume.current;
    resume.current = null;
    receivingStory = false;
    if (saved?.requested) onOpen();
    else if (saved) {
      receivingStory = true;
      begin();
      clock = Math.min(end, saved.clock);
      paused = saved.paused;
      light = saved.light;
      rushTo = saved.rushTo;
      back = saved.back;
      backEdge = saved.backEdge;
      afterClose = saved.afterClose;
      receivingStory = false;
      showPaused();
      draw(pAt(clock));
      drawBars();
      if (saved.phase === "closing" || saved.phase === "ending") close();
    }
    return () => {
      resume.current = open || requested ? { requested, clock, paused, light, rushTo, back, backEdge, phase: section.getAttribute("data-story"), afterClose } : null;
      disposed = true;
      cancelOpening();
      cancelAnimationFrame(frame);
      window.clearTimeout(closing);
      backDone();
      if (open) lock(false);
      observer.disconnect();
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("tm-flight", remeasure);
      window.removeEventListener(STORY_EVENT, onOpen);
      window.removeEventListener("tm-story-follow", followStory);
      window.removeEventListener("tm-story-release", wake);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      view.removeEventListener("pointerdown", onDown);
      chrome.root?.removeEventListener("click", onChrome);
      section.removeEventListener("focusin", onFocusIn);
      write.clear();
      root.style.removeProperty("--tm-seq-hero-h");
      root.style.removeProperty("--tm-seq-scan-w");
      root.style.removeProperty("--tm-seq-scan-h");
      root.style.removeProperty("--tm-seq-seat-w");
      root.style.removeProperty("--tm-seq-loupe-share");
      root.style.removeProperty("--tm-seq-loupe-w");
      for (const name of ["data-seq-away", "data-seq-playing", "data-story", "data-story-paused", "data-story-held"]) section.removeAttribute(name);
      section.style.removeProperty("--tm-seq-top");
      section.style.removeProperty("--tm-story-from");
      window.dispatchEvent(new Event(SEQUENCE_EVENT));
    };
  }, [track, on, box.left, box.top, box.width, box.height, plateScale, seat, tall, ready, go, skip]);
}

/* ---------- The still form ---------- */

/** The label's markers in the still form, where the film sets them on a wide screen (the cutout's pixels): each
 *  detail's number beside the vial, a line from it to the detail, whose dot stands past a word as in the film (its
 *  radius, 11, and a hair). */
const STILL_DOTS = MARKS.map((mark) => ({ x: mark.x + mark.out * 16, y: mark.y }));
const STILL_BADGES = [
  { x: MARKS[0].x + 200, y: MARKS[0].y - 92 },
  { x: MARKS[1].x - 200, y: MARKS[1].y + 30 },
  { x: MARKS[0].x + 180, y: MARKS[2].y + 180 },
] as const;

/**
 * The same story as still frames, in the same words, for a reader who has turned motion off: the label and its three
 * details; Verify; the record; the certificate and its findings; the finale and the four principles.
 */
export function SequenceStills() {
  const section = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const node = section.current;
    if (!landOnStills || !node) return;
    landOnStills = false;
    const header = document.querySelector<HTMLElement>(".tm-header");
    const top = header ? (Number.parseFloat(getComputedStyle(header).top) || 0) + header.offsetHeight : 0;
    window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - top, behavior: "instant" as ScrollBehavior });
    node.focus({ preventScroll: true });
  }, []);
  return (
    <section className="tm tm-seq-stills" ref={section} tabIndex={-1} aria-label={`One vial, the whole story: ${record.compound}, lot ${LOT}`}>
      <div className="tm-seq-still tm-seq-still-label">
        <ChapterWords chapter={2} />
        <figure className="tm-seq-still-frame" aria-hidden="true">
          <span className="tm-seq-still-vial">
            <img className="tm-seq-still-glass" src={productCutout(productById(FEATURED), "lg")} alt="" draggable={false} loading="lazy" decoding="async" />
            <svg className="tm-seq-still-leads" viewBox={`0 0 ${CUTOUT.w} ${CUTOUT.h}`} preserveAspectRatio="none">
              {STILL_DOTS.map((dot, i) => (
                <g key={i}>
                  <line x1={dot.x} y1={dot.y} x2={STILL_BADGES[i].x} y2={STILL_BADGES[i].y} />
                  <circle cx={dot.x} cy={dot.y} r="11" />
                </g>
              ))}
            </svg>
            {STILL_BADGES.map((badge, i) => (
              <span key={i} className="tm-seq-still-mark" style={{ left: pct(badge.x, CUTOUT.w), top: pct(badge.y, CUTOUT.h) }}>
                {two(i + 1)}
              </span>
            ))}
          </span>
        </figure>
        <Decoder still />
      </div>
      <div className="tm-seq-still tm-seq-still-pair">
        <ChapterWords chapter={3} />
        <VerifyCard still />
      </div>
      <div className="tm-seq-still tm-seq-still-pair">
        <ChapterWords chapter={4} />
        <RecordCard still />
      </div>
      <div className="tm-seq-still tm-seq-still-certificate">
        <div className="tm-seq-still-read">
          <ChapterWords chapter={5} />
          <Findings still />
        </div>
        <Paper still />
      </div>
      <div className="tm-seq-still tm-seq-still-finale">
        <FinaleWords />
        <Principles className="tm-seq-still-principles" />
      </div>
    </section>
  );
}

export type { Pose, Pt };
