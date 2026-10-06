import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Download } from "lucide-react";
import type { LotRecord } from "../shop/records";
import { LAB, PURITY_MINIMUM, certificates, claimText, contentValue, labLink, resultGroups, splitLabel } from "../platform/certificate-records";
import type { ResultGroup } from "../platform/certificate-records";
import { certificateDate, statusLabel } from "./Certificate";
import { LotTrace } from "./LotTrace";
import "./certificate-view.css";

/*
 * A lot's Certificate of Analysis as a page of the site: the laboratory's reported results, set in
 * TrueMark's own design, with the lab's PDF to download whole and its own page to confirm it.
 * Nothing of the lab's document is reproduced (it "may not be reproduced except in full"): no
 * wordmark, signature, QR, seal or chart. Its numbers, our design, their whole PDF.
 */

/** The purity scale's range, in percent: the specification and every lot sit well inside it. */
const SCALE_FROM = 90;
const SCALE_TO = 100;

export function CertificateView({
  record,
  pageLink = false,
  onLeave,
  titleId,
}: {
  record: LotRecord;
  /** In the dialog: offer the lot's own page. */
  pageLink?: boolean;
  /** Called as a link inside leaves for another page. */
  onLeave?: () => void;
  titleId?: string;
}) {
  const published = record.status === "released" || record.status === "archived";
  const entry = record.reference ? certificates.find((item) => item.certificate === record.reference) : undefined;
  const groups = published ? resultGroups(record.results) : [];
  const peaks = published && entry ? entry.components.map(({ name, retentionTime }) => ({ name, retentionTime })) : [];
  const lab = published ? labLink(record.reference) : undefined;
  const analyzed = certificateDate(entry?.analyzed ?? record.testedAt);
  const received = certificateDate(entry?.sampleReceived);
  const issued = certificateDate(entry?.issued);
  const others = groups.flatMap((group) => group.other.map((result) => ({ group, result })));

  return (
    <article className={`tm-cert is-${record.status}`} aria-labelledby={titleId}>
      <header className="tm-cert-head">
        <p className="tm-cert-eyebrow">Certificate of Analysis</p>
        <h2 id={titleId} className="tm-cert-title">
          {record.product.name} <span>{record.product.size}</span>
        </h2>
        <div className="tm-cert-meta">
          <LotNumber lot={record.lot} />
          <span className="tm-cert-status">
            <i aria-hidden="true" />
            {statusLabel[record.status]}
          </span>
        </div>
      </header>

      {peaks.length > 0 && (
        <figure className="tm-cert-line">
          <LotTrace peaks={peaks} />
          <figcaption>
            Drawn from the reported retention time{peaks.length > 1 ? "s" : ""}. The laboratory's chromatogram is in the full certificate.
          </figcaption>
        </figure>
      )}

      {published && groups.length === 1 && <Figures group={groups[0]} />}
      {published && groups.length > 1 && <Components groups={groups} />}

      {others.map(({ group, result }) => (
        <p key={result.label} className="tm-cert-aside">
          {splitLabel(result.label).base}
          {group.component ? `, ${group.component}` : ""}: <strong>{result.value} {result.unit}</strong>. {result.method}.
        </p>
      ))}

      {!published && (
        <p className="tm-cert-note">
          {record.status === "withheld"
            ? "This lot did not meet its release specification and was never sold. If a vial carries this number, please contact the team."
            : "This lot is in the TrueMark catalog. Its results will appear here once the laboratory publishes them."}
        </p>
      )}

      {published && (
        <dl className="tm-cert-record">
          <Row label="Tested by">
            {LAB.name}
            <small>{LAB.description.replace(/^an? /, (article) => article.charAt(0).toUpperCase() + article.slice(1))}</small>
          </Row>
          <Row label="Method">{LAB.method}</Row>
          {received && <Row label="Sample received">{received}</Row>}
          {analyzed && <Row label="Test date">{analyzed}</Row>}
          {issued && <Row label="Issued">{issued}</Row>}
          {record.reference && (
            <Row label="Certificate">
              <span className="tm-mono">{record.reference}</span>
            </Row>
          )}
        </dl>
      )}

      {published && (
        <div className="tm-cert-read">
          <p className="tm-cert-read-title">How to read this</p>
          <p>
            Purity is the share of the material the instrument detected that is the compound itself. Content is how much of
            it the vial holds, measured separately. Both describe the sample the laboratory tested.
          </p>
        </div>
      )}

      {record.status === "archived" && <p className="tm-cert-note">This lot has been fully distributed. Its record stays open.</p>}

      {published && (record.coaUrl || lab || pageLink) && (
        <div className="tm-cert-actions">
          {record.coaUrl && <DownloadLink href={record.coaUrl} lot={record.lot} />}
          {lab && (
            <a className="tm-textlink" href={lab.href} target="_blank" rel="noopener noreferrer">
              Verify with {LAB.name} <ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" />
              <span className="sr-only">, opens in a new tab</span>
            </a>
          )}
          {pageLink && (
            <Link className="tm-textlink" to={`/verify?lot=${encodeURIComponent(record.lot)}`} onClick={onLeave}>
              Open the lot's page <ArrowRight size={15} strokeWidth={1.6} aria-hidden="true" />
            </Link>
          )}
          {lab?.enter && (
            <p className="tm-cert-enter">
              Enter certificate <span className="tm-mono">{lab.enter}</span> there.
            </p>
          )}
        </div>
      )}

      {published && (
        <p className="tm-cert-foot">
          Lot traceable to source batch. Reported by {LAB.name} for the sample tested; the full certificate is the record.
        </p>
      )}
    </article>
  );
}

/** A single compound's results, as figures: what was measured, then the standard it's held to. */
function Figures({ group }: { group: ResultGroup }) {
  const purity = group.purity;
  const content = group.content;
  const perVial = content?.unit === "mg per vial";
  return (
    <div className="tm-cert-figures">
      {purity && (
        <Figure label="Purity" value={purity.value} unit="%">
          <span>of total peak area · specification ≥&nbsp;{PURITY_MINIMUM}%</span>
          <PurityScale value={Number(purity.value)} />
        </Figure>
      )}
      {group.identity && (
        <Figure label="Identity" value={group.identity.value}>
          <span>Retention time and UV spectrum match the reference standard.</span>
        </Figure>
      )}
      {content && (
        <Figure
          label={perVial ? "Content per vial" : splitLabel(content.label).base}
          value={content.value}
          unit={content.unit.replace(/ per vial$/, "")}
        >
          {claimText(group) && <span>{claimText(group)}</span>}
        </Figure>
      )}
    </div>
  );
}

function Figure({ label, value, unit, children }: { label: string; value: string; unit?: string; children?: ReactNode }) {
  return (
    <div className="tm-cert-figure">
      <p className="tm-cert-figure-label">{label}</p>
      <p className="tm-cert-figure-value">
        {value}
        {unit && <span className={unit === "%" ? "is-percent" : undefined}>{unit === "%" ? unit : ` ${unit}`}</span>}
      </p>
      <div className="tm-cert-figure-note">{children}</div>
    </div>
  );
}

/** Where this lot's purity sits against the specification, on a 90–100% scale. */
function PurityScale({ value }: { value: number }) {
  const at = (percent: number) => `${((Math.min(SCALE_TO, Math.max(SCALE_FROM, percent)) - SCALE_FROM) / (SCALE_TO - SCALE_FROM)) * 100}%`;
  return (
    <span className="tm-cert-scale" aria-hidden="true">
      <span className="tm-cert-scale-track">
        <span className="tm-cert-scale-fill" style={{ width: at(value) }} />
        <span className="tm-cert-scale-spec" style={{ left: at(Number(PURITY_MINIMUM)) }} />
        <span className="tm-cert-scale-mark" style={{ left: at(value) }} />
      </span>
      <span className="tm-cert-scale-ends">
        <span>{SCALE_FROM}%</span>
        <span style={{ left: at(Number(PURITY_MINIMUM)) }}>Spec</span>
        <span>{SCALE_TO}%</span>
      </span>
    </span>
  );
}

/** A blend's results: one row per component, in the certificate's order. */
function Components({ groups }: { groups: ResultGroup[] }) {
  const perVial = groups.every((group) => group.content?.unit === "mg per vial");
  return (
    <div className="tm-cert-components">
      <table>
        <caption className="sr-only">Results for each component</caption>
        <thead>
          <tr>
            <th scope="col">Component</th>
            <th scope="col">Purity</th>
            <th scope="col">Identity</th>
            <th scope="col">{perVial ? "Content per vial" : "Content"}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.component ?? ""}>
              <th scope="row">{group.component}</th>
              <td data-label="Purity">{group.purity ? `${group.purity.value}%` : "—"}</td>
              <td data-label="Identity">{group.identity?.value ?? "—"}</td>
              <td data-label={perVial ? "Content per vial" : "Content"}>
                {group.content ? contentValue(group.content) : "—"}
                {claimText(group) && <small>{claimText(group)}</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tm-cert-components-spec">
        Specification: HPLC purity ≥&nbsp;{PURITY_MINIMUM}% for every component. Identity by retention time and UV spectrum
        against a reference standard.
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The lot number, with a way to copy it. */
function LotNumber({ lot }: { lot: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <span className="tm-cert-lot">
      <span className="tm-cert-lot-label">Lot</span>
      <span className="tm-mono">{lot}</span>
      <button
        type="button"
        className="tm-cert-copy"
        aria-live="polite"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(lot);
            setCopied(true);
          } catch {
            /* The number is on screen to copy by hand. */
          }
        }}
      >
        <span hidden={copied}>Copy</span>
        <span hidden={!copied}>Copied</span>
      </button>
    </span>
  );
}

/** The laboratory's PDF, whole and unmodified, saved under the lot's name. */
function DownloadLink({ href, lot }: { href: string; lot: string }) {
  // A browser saves only same-site files under a chosen name; a file from elsewhere opens instead.
  const sameSite = (() => {
    try {
      return new URL(href, window.location.href).origin === window.location.origin;
    } catch {
      return false;
    }
  })();
  return (
    <a
      className="tm-button tm-button-primary tm-cert-download"
      href={href}
      download={sameSite ? `TrueMark-${lot}-certificate.pdf` : undefined}
      target={sameSite ? undefined : "_blank"}
      rel={sameSite ? undefined : "noopener noreferrer"}
    >
      <Download size={16} strokeWidth={1.7} aria-hidden="true" />
      Download the certificate
      <span className="tm-cert-download-kind">PDF</span>
    </a>
  );
}
