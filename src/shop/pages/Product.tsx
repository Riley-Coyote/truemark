import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { stockProblem } from "../../platform/commerce";
import { categoryName, money, products } from "../../data";
import { compoundsForBrowsing, describe, specFor } from "../catalog";
import { useShop } from "../context";
import { useReveal } from "../motion";
import { ProofFigures, Quantity, tone } from "../ui";
import { useLight } from "../../brand/light";
import { ContinueExploring } from "../../brand/ContinueExploring";
import { ProductStage } from "../../brand/ProductStage";
import { SequenceChain } from "../../brand/SequenceChain";

export default function ProductPage() {
  const { id } = useParams();
  const product = products.find((p) => p.id === id && p.active !== false);
  const navigate = useNavigate();
  const { add, cart } = useShop();
  const [quantity, setQuantity] = useState(1);
  const [zoomed, setZoomed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useReveal(root, product?.name);
  const top = useRef<HTMLElement>(null);
  const more = useRef<HTMLElement>(null);
  useLight(top, { firstPass: 900, pass: 2450, repeat: false });
  useLight(more, { ambient: false });

  const siblings = product ? products.filter((p) => p.name === product.name && p.active !== false) : [];
  const index = product ? siblings.indexOf(product) : 0;
  const [slide, setSlide] = useState({ index, prev: -1, name: product?.name });
  if (slide.index !== index || slide.name !== product?.name) {
    // Same compound: crossfade between sizes. New compound: cut cleanly.
    setSlide({ index, prev: slide.name === product?.name ? slide.index : -1, name: product?.name });
  }

  useEffect(() => {
    setQuantity(1);
  }, [id]);
  useEffect(() => {
    setZoomed(false);
  }, [product?.name]);

  if (!product) {
    return (
      <div className="tm-page">
        <section className="tm tm-empty-page">
          <p className="tm-eyebrow">Not found</p>
          <h1 className="tm-display">
            That compound
            <br />
            <span>isn’t in the collection.</span>
          </h1>
          <Link className="tm-textlink" to="/products">
            Browse the collection <ArrowRight size={16} strokeWidth={1.6} />
          </Link>
        </section>
      </div>
    );
  }

  const unavailable = stockProblem(product, quantity + (cart.find((item) => item.id === product.id)?.quantity ?? 0));
  const spec = specFor(product);
  const others = compoundsForBrowsing.filter((c) => c.name !== product.name);
  const rows: [string, string | undefined][] = [
    ["Compound", product.name],
    ["Class", categoryName(product.category)],
    ["Presentation", `${product.size} per vial`],
    ["Form", spec.form],
    ["CAS number", spec.cas],
    ["Molecular formula", spec.formula],
    ["Molecular weight", spec.weight],
    ["Sequence", spec.sequence],
    ["Blend", spec.blend],
    ["Purity specification", product.category === "lab-supplies" ? undefined : "≥99% (HPLC)"],
    ["Identity method", product.category === "lab-supplies" ? undefined : "Mass spectrometry"],
    ["Storage", spec.storage],
    ["Documentation", "Lot-specific certificate of analysis"],
    ["Intended use", "Laboratory research only"],
  ];

  return (
    <div className="tm-page tm-product" style={tone(product)} ref={root}>
      <section className="tm tm-product-top" aria-labelledby="tm-product-title" ref={top}>
        <nav className="tm-crumbs" aria-label="Breadcrumb">
          <Link to="/products">Shop</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/products?class=${product.category}`}>{categoryName(product.category)}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        {/* The name comes first, so a phone shows what it is (and its price) before the photograph. */}
        <div className="tm-buy-head">
          <p className="tm-eyebrow">{categoryName(product.category)}</p>
          <h1 id="tm-product-title" className="tm-display tm-product-name" data-review="cjc-dose">
            {product.name}
          </h1>
          <p className="tm-product-sub">
            {product.size} <span>·</span> {product.form}
            {product.price !== undefined && (
              <span className="tm-product-sub-price" aria-hidden="true">
                {" "}
                <span>·</span> {money(product.price)}
              </span>
            )}
          </p>
        </div>

        <div className="tm-product-stage">
          <ProductStage items={siblings} index={slide.index} prev={slide.prev} zoomed={zoomed} />
          <div className="tm-stage-tools">
            <button
              type="button"
              className="tm-pill"
              aria-pressed={zoomed}
              onClick={() => setZoomed((z) => !z)}
            >
              {zoomed ? "Whole vial" : "Label detail"}
            </button>
            <span className="tm-stage-lot">
              Lot <span className="tm-mono">{product.lot}</span>
            </span>
          </div>
        </div>

        <div className="tm-buy">
          <p className="tm-product-desc">{describe(product)}</p>

          {siblings.length > 1 && (
            <fieldset className="tm-sizes">
              <legend>Size</legend>
              <div>
                {siblings.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={s.id === product.id}
                    onClick={() =>
                      navigate(`/product/${s.id}`, { replace: true, state: { keepScroll: true } })
                    }
                  >
                    {s.size}
                    {s.price !== undefined && <span>{money(s.price)}</span>}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {product.price !== undefined && (
            <>
              <p className="tm-price-row">
                <span className="tm-price">{money(product.price)}</span>
                <span className="tm-price-note">per vial</span>
              </p>
              {product.stock === 0 && <p className="tm-price-note" role="status">Out of stock</p>}
              {unavailable && product.stock !== 0 && <p className="tm-field-error" role="status">{unavailable}</p>}
              <div className="tm-buy-row">
                <Quantity value={quantity} onChange={setQuantity} label="Quantity" />
                <button
                  type="button"
                  className="tm-button tm-button-primary tm-button-wide"
                  disabled={Boolean(unavailable)}
                  onClick={() => add(product.id, quantity)}
                >
                  Add to bag
                </button>
              </div>
            </>
          )}

          <ul className="tm-buy-notes">
            <li>Shipped with temperature control when applicable</li>
            <li>Certificate of analysis for every lot</li>
            <li>For laboratory research use only</li>
          </ul>

          <Link className="tm-lot-card" to={`/verify?lot=${product.lot}`}>
            <span className="tm-lot-card-label">Current lot</span>
            <span className="tm-mono tm-lot-card-number">{product.lot}</span>
            <span className="tm-lot-card-action">
              Read the record <ArrowUpRight size={15} strokeWidth={1.6} />
            </span>
          </Link>
          <p className="tm-fineprint">Design preview. No order is placed and no payment is collected.</p>
        </div>
      </section>

      <section className="tm tm-product-proof" aria-labelledby="tm-product-proof-title">
        <header className="tm-section-head" data-reveal>
          <p className="tm-eyebrow">The standard</p>
          <h2 id="tm-product-proof-title" className="tm-heading">
            Behind every vial.
            <br />
            <span>On every certificate.</span>
          </h2>
          <Link className="tm-textlink" to="/quality">
            Read our standard <ArrowRight size={16} strokeWidth={1.6} />
          </Link>
        </header>
        <ProofFigures />
      </section>

      <section className="tm tm-product-spec" aria-labelledby="tm-spec-title">
        <header className="tm-spec-head" data-reveal>
          <p className="tm-eyebrow">Specification</p>
          <h2 id="tm-spec-title" className="tm-heading">
            The essentials.
          </h2>
          <p className="tm-section-note">
            Identifiers and handling for {product.name}. Results for your lot are
            on its certificate.
          </p>
        </header>
        <dl className="tm-spec-table" data-reveal>
          {rows
            .filter((row): row is [string, string] => Boolean(row[1]))
            .map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className={/CAS|formula|Sequence/.test(label) ? "tm-mono" : undefined}>
                  {label === "Sequence" ? <SequenceChain sequence={value} name={product.name} /> : value}
                </dd>
              </div>
            ))}
        </dl>
      </section>

      <section className="tm tm-product-more" aria-labelledby="tm-more-title" ref={more}>
        <ContinueExploring compounds={others} />
      </section>
    </div>
  );
}
