import type { CSSProperties, ReactNode } from "react";
import { Check } from "lucide-react";
import type { LotRecord } from "../shop/records";
import "./certificate.css";

/** Certificates print dates the client's way: 11 Aug 2026. */
export function certificateDate(iso?: string) {
  if (!iso) return undefined;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

function resultLabel(label: string, method: string) {
  if (method === "HPLC") return `${label} (HPLC)`;
  if (method === "Mass spectrometry") return `${label} (MS)`;
  return label;
}

function resultValue(value: string, unit: string) {
  if (unit === "%") return `${value}%`;
  return unit ? `${value} ${unit}` : value;
}

const statusLabel: Record<LotRecord["status"], string> = {
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
  review,
}: {
  label: string;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  /** A spot the review layer can pin a question to. */
  review?: string;
}) {
  return (
    <div className={className} style={style} data-review={review}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * A lot's Certificate of Analysis, laid out as the client's own certificate:
 * identity first, then each result with its method, then the dates and the
 * reference that tie it to the source batch. Results appear only once a lot is
 * released; the sample lot says plainly that it is a sample.
 */
export function Certificate({ record, reveal = false, className = "" }: { record: LotRecord; reveal?: boolean; className?: string }) {
  const published = record.status === "released" || record.status === "archived";
  const tested = certificateDate(record.testedAt);
  const released = certificateDate(record.releasedAt);
  return (
    <div className={className}>
      <article
        className={`tm-coa is-${record.status}`}
        data-reveal={reveal ? "" : undefined}
        aria-label={`${record.sample ? "Sample certificate" : "Certificate"} of analysis, lot ${record.lot}`}
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
          <Row label="Testing laboratory" review="lab-name">
            Contracted laboratory
          </Row>
          {published &&
            record.results.map((result, i) => (
              <Row
                key={result.label}
                label={resultLabel(result.label, result.method)}
                className="is-result"
                style={{ "--tm-i": i } as CSSProperties}
              >
                {resultValue(result.value, result.unit)}
                <Check size={14} strokeWidth={2} aria-hidden="true" />
                <span className="sr-only">, meets specification</span>
              </Row>
            ))}
          {published && tested && <Row label="Test date">{tested}</Row>}
          {published && !tested && released && <Row label="Release date">{released}</Row>}
        </dl>
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
        <footer className="tm-coa-foot">
          <span>Lot traceable to source batch</span>
          <span className="tm-mono">{record.reference ?? "Reference pending"}</span>
        </footer>
      </article>
      {record.sample && <p className="tm-coa-caption">Sample record · illustrative values</p>}
    </div>
  );
}
