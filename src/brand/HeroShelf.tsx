import { useRef } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { productById, productCutout, sampleRecord } from "../shop/catalog";
import type { Product } from "../data";
import { tone } from "../shop/ui";
import { sheenMask, useLight } from "./light";
import { Trace } from "./Trace";
import "./hero.css";

/** The shelf, arranged by category colour as the brand guide asks for group shots. */
const shelf = [
  "ghk-cu-100-mg",
  "melanotan-ii-10-mg",
  "nad-500-mg",
  "bpc-157-10-mg",
  "semax-10-mg",
  "tesamorelin-10-mg",
  "retatrutide-10-mg",
]
  .map(productById)
  .filter((p): p is Product => Boolean(p));

const trust = [
  ["Research use only", "Supplied for laboratory research applications."],
  ["Not for human use", "Not for human or veterinary administration."],
  ["Independently tested", "Every lot tested on receipt at a contracted laboratory."],
  ["Cold chain", "Temperature-controlled storage and transit."],
];

/** The logo's dot, used as a full stop: the one place the gradient touches type. */
export function BrandDot() {
  return (
    <>
      <span className="tm-brand-dot" aria-hidden="true" />
      <span className="sr-only">.</span>
    </>
  );
}

/**
 * The client's own hero carried a lot card (BP10-2611A, HPLC 99.31%, MS confirmed).
 * Here it appears above the vial it belongs to, as the first pass of light crosses it.
 */
function LotChip() {
  const purity = sampleRecord.results.find((r) => r.method === "HPLC");
  const identity = sampleRecord.results.find((r) => r.method === "Mass spectrometry");
  return (
    <span className="tm-lotchip" aria-hidden="true">
      <span className="tm-lotchip-top">
        <span className="tm-lotchip-lot">Sample lot {sampleRecord.lot}</span>
        <span className="tm-lotchip-status">
          <i />
          Verified
        </span>
      </span>
      <span className="tm-lotchip-results">
        HPLC {purity?.value}% · MS {identity?.value.toLowerCase()}
      </span>
    </span>
  );
}

export function HeroShelf() {
  const middle = (shelf.length - 1) / 2;
  const scene = useRef<HTMLElement>(null);
  useLight(scene);
  return (
    <>
      <section className="tm tm-bhero" aria-labelledby="tm-bhero-title" ref={scene}>
        <div className="tm-bhero-head">
          <p className="tm-pill-eyebrow">
            <span className="tm-brand-dot" aria-hidden="true" />
            Lot-level traceability
          </p>
          <h1 id="tm-bhero-title" className="tm-bhero-title">
            <span className="tm-bhero-line" style={{ "--tm-i": 0 } as CSSProperties}>
              <span>True research.</span>
            </span>
            <span className="tm-bhero-line" style={{ "--tm-i": 1 } as CSSProperties}>
              <span>True precision.</span>
            </span>
            <span className="tm-bhero-line" style={{ "--tm-i": 2 } as CSSProperties}>
              <span>
                Verified
                <BrandDot />
              </span>
            </span>
          </h1>
        </div>
        <div className="tm-bhero-aside">
          <p className="tm-bhero-lead">
            Research compounds supplied as lyophilized powder, independently
            tested on receipt, quarantined until release, and traceable from the
            vial in your hand back to the source batch.
          </p>
          <div className="tm-actions">
            <Link className="tm-button tm-button-primary" to="/products">
              View catalog
            </Link>
            <Link className="tm-button tm-button-outline" to="/verify">
              Verify a lot
            </Link>
          </div>
        </div>

        <div className="tm-shelf" role="list" aria-label="The collection, arranged by colour" data-review="label-files">
          {shelf.map((product, i) => (
            <Link
              key={product.id}
              role="listitem"
              className="tm-shelf-vial"
              to={`/product/${product.id}`}
              style={{ ...tone(product), "--tm-i": Math.abs(i - middle) } as CSSProperties}
            >
              <span className="tm-shelf-stage" data-sheen>
                {product.id === sampleRecord.productId && <LotChip />}
                <span className="tm-shelf-shadow" aria-hidden="true" />
                <img
                  src={productCutout(product, "lg")}
                  srcSet={`${productCutout(product, "sm")} 289w, ${productCutout(product, "lg")} 578w`}
                  sizes="(max-width: 960px) 34vw, 12vw"
                  alt={`${product.name}, ${product.size}`}
                  loading={Math.abs(i - middle) <= 1 ? "eager" : "lazy"}
                  draggable={false}
                />
                <span
                  className="tm-sheen"
                  aria-hidden="true"
                  style={sheenMask(productCutout(product, "sm"))}
                />
              </span>
              <span className="tm-shelf-name">
                {product.name}
                <span>{product.size}</span>
              </span>
            </Link>
          ))}
        </div>
        <Trace className="tm-bhero-trace" peakAt={0.5} caption="≥99% purity specification · HPLC" />
      </section>

      <section className="tm tm-trust" aria-label="Our standard">
        {trust.map(([title, text]) => (
          <div key={title} className="tm-trust-item">
            <p className="tm-trust-title">{title}</p>
            <p className="tm-trust-text">{text}</p>
          </div>
        ))}
      </section>
    </>
  );
}
