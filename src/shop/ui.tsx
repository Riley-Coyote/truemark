import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus } from "lucide-react";
import { money } from "../data";
import type { Product } from "../data";
import { productImage, productSrcSet, sampleRecord } from "./catalog";
import type { Compound } from "./catalog";
import type { LotRecord } from "./records";

/** Hand a product's label colours to CSS as --tm-tone / --tm-tone-ink. */
export function tone(product: Product): CSSProperties {
  return { "--tm-tone": product.color, "--tm-tone-ink": product.colorInk } as CSSProperties;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="tm-eyebrow">{children}</p>;
}

/**
 * Stacked renders that crossfade in place. The supplied renders share one
 * camera, so changing the index reads as the label itself changing.
 */
export function VialImages({
  items,
  index,
  prev = -1,
  sizes,
  priority = false,
}: {
  items: Product[];
  index: number;
  prev?: number;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <>
      {items.map((product, i) => (
        <img
          key={product.id}
          className={i === index ? "is-active" : i === prev ? "is-prev" : undefined}
          src={productImage(product, "lg")}
          srcSet={productSrcSet(product)}
          sizes={sizes}
          alt={i === index ? `${product.name}, ${product.size} research vial` : ""}
          aria-hidden={i === index ? undefined : true}
          loading={priority && i === index ? "eager" : "lazy"}
          fetchPriority={priority && i === index ? "high" : "auto"}
          draggable={false}
        />
      ))}
    </>
  );
}

export function CompoundTile({ compound, listItem = false }: { compound: Compound; listItem?: boolean }) {
  const { lead, variants, fromPrice, name } = compound;
  return (
    <Link
      role={listItem ? "listitem" : undefined}
      className="tm-tile"
      to={`/product/${lead.id}`}
      style={tone(lead)}
    >
      <span className="tm-tile-image">
        <img src={productImage(lead, "sm")} alt="" loading="lazy" draggable={false} />
      </span>
      <span className="tm-tile-body">
        <span className="tm-tile-name">
          <i aria-hidden="true" />
          {name}
        </span>
        <span className="tm-tile-meta">
          {variants.length > 1
            ? `${variants.map((v) => v.size.replace(/ mg$/, "")).join(" · ")} mg`
            : lead.size}
          <span>
            {fromPrice !== undefined
              ? `${variants.length > 1 ? "From " : ""}${money(fromPrice)}`
              : ""}
          </span>
        </span>
      </span>
    </Link>
  );
}

export const proofFigures = [
  { label: "Purity specification", figure: "≥99", unit: "%", text: "Measured by HPLC on every lot before it is released." },
  { label: "Identity", figure: "MS", unit: "", text: "Confirmed by mass spectrometry, lot by lot." },
  { label: "Storage", figure: "−20", unit: "°C", text: "Held cold, then shipped with temperature control." },
  { label: "Release", figure: "0", unit: "", text: "Lots released without an approved certificate." },
];

export function ProofFigures() {
  return (
    <dl className="tm-specs">
      {proofFigures.map((proof, i) => (
        <div key={proof.label} data-reveal style={{ "--tm-i": i } as CSSProperties}>
          <dt>{proof.label}</dt>
          <dd>
            <span className="tm-figure">
              {proof.figure}
              {proof.unit && <small>{proof.unit}</small>}
            </span>
            <span className="tm-figure-text">{proof.text}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Quantity({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div className="tm-quantity">
      <button
        type="button"
        aria-label={`Decrease ${label.toLowerCase()}`}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={14} strokeWidth={1.8} />
      </button>
      <input
        type="number"
        min={1}
        max={99}
        inputMode="numeric"
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
      />
      <button
        type="button"
        aria-label={`Increase ${label.toLowerCase()}`}
        disabled={value >= 99}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}

export function RecordCard({
  record,
  reveal = false,
  className = "",
}: {
  record: LotRecord;
  reveal?: boolean;
  className?: string;
}) {
  const published = record.status === "released" || record.status === "archived";
  const statusLabel = {
    released: "Released",
    archived: "Archived",
    withheld: "Not released",
    pending: "Certificate pending",
  }[record.status];
  return (
    <article
      className={`tm-record-card ${className}`}
      data-reveal={reveal ? "" : undefined}
      aria-label={`Lot record ${record.lot}`}
    >
      <header>
        <span className="tm-record-kicker">{record.sample ? "Lot record · sample" : "Lot record"}</span>
        <span className={`tm-status is-${record.status}`}>
          <i aria-hidden="true" />
          {statusLabel}
        </span>
      </header>
      <p className="tm-record-lot tm-mono">{record.lot}</p>
      <p className="tm-record-compound">
        {record.product.name} <span>{record.product.size} · {record.product.form}</span>
      </p>
      {published ? (
        <dl>
          {record.results.map((result, i) => (
            <div key={result.label} style={{ "--tm-i": i } as CSSProperties}>
              <dt>
                {result.label}
                <span>{result.method}</span>
              </dt>
              <dd>
                {result.value}
                {result.unit && <small>{result.unit}</small>}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="tm-record-pending">
          {record.status === "withheld"
            ? "This lot did not meet its release specification and was never sold. If a vial carries this number, please contact the team."
            : "This lot is in the TrueMark catalog. Its certificate will appear here once the laboratory results are published."}
        </p>
      )}
      {record.status === "archived" && (
        <p className="tm-record-note">This lot has been fully distributed. Its record stays open.</p>
      )}
      <footer>
        <span className="tm-mono">{record.reference ?? "Awaiting reference"}</span>
        <span>
          {record.lot === sampleRecord.lot
            ? "Illustrative values from the client mockup"
            : record.sample
              ? "Sample lot for the design preview"
              : "Design preview"}
        </span>
      </footer>
    </article>
  );
}
