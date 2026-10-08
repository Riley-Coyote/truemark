import { Fragment } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import type { LotRecord } from "../shop/records";
import { LAB, claimText, contentValue, labLink, resultGroups, splitLabel } from "../platform/certificate-records";
import "./certificate.css";

/** Certificates print dates the client's way: 11 Aug 2026, 24 Sep 2026 (three letters, as the lab prints them). */
export function certificateDate(iso?: string) {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(date);
  return `${part({ day: "2-digit" })} ${part({ month: "short" })} ${part({ year: "numeric" })}`;
}

/** An instrument method reads in the label; anything else (how a figure was derived) reads under the value. */
const instrument = (method: string) => ["HPLC", "Mass spectrometry", "LAL"].includes(method) || /^HPLC \(.+\)$/.test(method);

function resultLabel(label: string, method: string) {
  if (method === "HPLC") return `${label} (HPLC)`;
  if (method === "Mass spectrometry") return `${label} (MS)`;
  if (method === "LAL") return `${label} (LAL)`;
  // The certificates' identity method: "HPLC (RT + UV vs. reference)".
  const hplc = method.match(/^HPLC \((.+)\)$/);
  return hplc ? `${label} (HPLC: ${hplc[1]})` : label;
}

export function resultValue(value: string, unit: string) {
  if (unit === "%") return `${value}%`;
  return unit ? `${value} ${unit}` : value;
}

export const statusLabel: Record<LotRecord["status"], string> = {
  released: "Approved",
  archived: "Archived",
  withheld: "Not released",
  pending: "Pending",
};

function Row({
  label,
  children,
  style,
  className,
}: {
  label: string;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div className={className} style={style}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The release specification covers purity and identity; those results carry the mark. */
function Passed() {
  return (
    <>
      <Check size={14} strokeWidth={2} aria-hidden="true" />
      <span className="sr-only">, meets specification</span>
    </>
  );
}

/**
 * A lot's Certificate of Analysis, laid out as a certificate: identity first, then each result
 * with its method (a blend's under each component's name), the test date, the laboratory's PDF
 * and its own verification, and the reference that ties it to the source batch. Results appear
 * only once a lot is released.
 */
/** The certificate's form while its record is on the way: the document's own labels, each value's
 *  place held by light passing over it, so nothing moves when the record arrives. */
export function CertificateSkeleton({ className = "" }: { className?: string }) {
  const rows: [string, string, string?][] = [
    ["Lot", "8.5em"],
    ["Compound", "7em"],
    ["Testing laboratory", "7.5em"],
    ["Purity (HPLC)", "4em"],
    ["Identity", "5.5em"],
    ["Content per vial", "4em", "11em"],
    ["Test date", "5.5em"],
  ];
  return (
    <div className={className} role="status" aria-label="Loading the certificate">
      <article className="tm-coa is-loading" aria-hidden="true">
        <header className="tm-coa-head">
          <span className="tm-coa-title">Certificate of Analysis</span>
          <span className="tm-skel tm-coa-skel-status" />
        </header>
        <dl className="tm-coa-rows">
          {rows.map(([label, width, note]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={note ? "tm-coa-skel-stack" : undefined}>
                <span className="tm-skel" style={{ width }} />
                {note && <span className="tm-skel tm-coa-skel-note" style={{ width: note }} />}
              </dd>
            </div>
          ))}
        </dl>
        {/* The links and the batch line, so the card is as tall as the one that replaces it. */}
        <p className="tm-coa-links is-skel">
          <span className="tm-skel" style={{ width: "10em" }} />
          <span className="tm-skel" style={{ width: "11em" }} />
        </p>
        <footer className="tm-coa-foot is-skel">
          <span className="tm-skel" style={{ width: "14em" }} />
          <span className="tm-skel" style={{ width: "9em" }} />
        </footer>
      </article>
    </div>
  );
}

export function Certificate({ record, reveal = false, className = "" }: { record: LotRecord; reveal?: boolean; className?: string }) {
  const published = record.status === "released" || record.status === "archived";
  const tested = certificateDate(record.testedAt);
  const released = certificateDate(record.releasedAt);
  const lab = published ? labLink(record.reference) : undefined;
  let order = 0;
  const next = () => ({ "--tm-i": order++ }) as CSSProperties;
  return (
    <div className={className}>
      <article
        className={`tm-coa is-${record.status}`}
        data-reveal={reveal ? "" : undefined}
        aria-label={`Certificate of analysis, lot ${record.lot}`}
      >
        <header className="tm-coa-head">
          <span className="tm-coa-title">Certificate of Analysis</span>
          <span className="tm-coa-status">
            <i aria-hidden="true" />
            {statusLabel[record.status]}
          </span>
        </header>
        <dl className="tm-coa-rows">
          <Row label="Lot">
            <span className="tm-mono">{record.lot}</span>
          </Row>
          <Row label="Compound">
            {record.product.name} · {record.product.size}
          </Row>
          <Row label="Testing laboratory">{published ? LAB.name : "Contracted laboratory"}</Row>
        </dl>
        {published &&
          resultGroups(record.results).map((group) => (
            <Fragment key={group.component ?? ""}>
              {group.component && <p className="tm-coa-component">{group.component}</p>}
              <dl className="tm-coa-rows">
                {group.purity && (
                  <Row label={resultLabel("Purity", group.purity.method)} className="is-result" style={next()}>
                    {resultValue(group.purity.value, group.purity.unit)}
                    <Passed />
                  </Row>
                )}
                {group.identity && (
                  <Row label={resultLabel("Identity", group.identity.method)} className="is-result" style={next()}>
                    {group.identity.value}
                    <Passed />
                  </Row>
                )}
                {group.content && (
                  <Row
                    label={resultLabel(group.content.unit === "mg per vial" ? "Content per vial" : splitLabel(group.content.label).base, group.content.method)}
                    className="is-result is-detailed"
                    style={next()}
                  >
                    <span>{contentValue(group.content)}</span>
                    {claimText(group) && <small>{claimText(group)}</small>}
                  </Row>
                )}
                {group.other.map((result) => (
                  <Row key={result.label} label={resultLabel(splitLabel(result.label).base, result.method)} className="is-result is-detailed" style={next()}>
                    <span>{resultValue(result.value, result.unit)}</span>
                    {result.method && !instrument(result.method) && <small>{result.method}</small>}
                  </Row>
                ))}
              </dl>
            </Fragment>
          ))}
        {published && (tested || released) && (
          <dl className="tm-coa-rows">
            {tested ? <Row label="Test date">{tested}</Row> : <Row label="Release date">{released}</Row>}
          </dl>
        )}
        {!published && (
          <p className="tm-coa-note">
            {record.status === "withheld"
              ? "This lot did not meet its release specification and was never sold. If a vial carries this number, please contact the team."
              : "This lot is in the TrueMark catalog. Its results will appear here once the laboratory publishes them."}
          </p>
        )}
        {record.status === "archived" && (
          <p className="tm-coa-note">This lot has been fully distributed. Its record stays open.</p>
        )}
        {published && (
          <p className="tm-coa-links">
            <Link className="tm-textlink" to={`/verify?lot=${encodeURIComponent(record.lot)}`}>
              Read the full certificate <ArrowRight size={15} strokeWidth={1.6} aria-hidden="true" />
            </Link>
            {lab && (
              <a className="tm-textlink" href={lab.href} target="_blank" rel="noopener noreferrer">
                Verify with {LAB.name} <ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" />
                <span className="sr-only">, opens in a new tab</span>
              </a>
            )}
            {lab?.enter && (
              <span className="tm-coa-enter">
                Enter certificate <span className="tm-mono">{lab.enter}</span> there.
              </span>
            )}
          </p>
        )}
        <footer className="tm-coa-foot">
          <span>Lot traceable to source batch</span>
          <span className="tm-mono">{record.reference ?? "Reference pending"}</span>
        </footer>
      </article>
    </div>
  );
}
