import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
} from "lucide-react";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource-variable/bodoni-moda/standard.css";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/newsreader/wght-italic.css";
import { SectionLink } from "./SectionLink";
import { assetUrl } from "./assetUrl";
import "./type-study.css";

const directions = [
  {
    id: "sculptural",
    number: "01",
    name: "Sculptural",
    pairing: "Instrument Serif / Manrope",
    character: "Warm. Assured. Distinctive.",
    description:
      "A narrow, beautifully curved serif gives the headlines a recognizable silhouette. Upright letters do the expressive work; a clear, generous sans handles everything you need to read closely.",
    strength: "The most character with the lightest touch.",
    watch:
      "Keep the serif for short statements. Too much of it would soften the scientific tone.",
    source: "https://github.com/Instrument/instrument-serif",
    font: "Instrument Serif",
  },
  {
    id: "precise",
    number: "02",
    name: "Precise",
    pairing: "Bodoni Moda / Manrope",
    character: "Poised. Exact. Established.",
    description:
      "Fine hairlines and strong vertical strokes bring an almost engraved quality. Carefully sized optical forms and spacious composition give the brand a more formal, enduring presence.",
    strength: "The strongest sense of ceremony and permanence.",
    watch:
      "Keep the finer strokes large and dark. This direction can tip toward luxury cosmetics if overused.",
    source: "https://github.com/indestructible-type/Bodoni",
    font: "Bodoni Moda",
  },
  {
    id: "quiet",
    number: "03",
    name: "Quiet modern",
    pairing: "Manrope / Manrope",
    character: "Clear. Composed. Contemporary.",
    description:
      "One sans-serif family, with the expression coming from scale, weight, and breathing room. Open letterforms and uninterrupted lines make the site feel quietly exact rather than decorated.",
    strength: "The clearest connection between the brand and its data.",
    watch:
      "The restraint asks more of the wordmark and photography to make TrueMark recognizable.",
    source: "https://github.com/google/fonts/tree/main/ofl/manrope",
    font: "Manrope",
  },
] as const;

type Direction = (typeof directions)[number]["id"] | "original";
type Scene = "collection" | "compound" | "record";
const scenes: { id: Scene; label: string }[] = [
  { id: "collection", label: "Collection" },
  { id: "compound", label: "Product" },
  { id: "record", label: "Documentation" },
];

function Brand() {
  return (
    <div className="ts-brand" aria-label="TrueMark Biolabs">
      TrueMark<span>Biolabs</span>
    </div>
  );
}

function Statement() {
  return (
    <>
      <span>Precisely sourced.</span>
      <span className="ts-second-line">Clearly documented.</span>
    </>
  );
}

function Collection() {
  return (
    <section className="ts-collection" aria-label="Collection specimen">
      <div className="ts-hero-copy">
        <p className="ts-kicker">The research collection</p>
        <h2 className="ts-display">
          <Statement />
        </h2>
        <p className="ts-body">
          Explore research compounds backed by lot-level documentation. A clear
          starting point for your next discovery.
        </p>
        <Link className="ts-text-link" to="/products">
          Explore the collection <ArrowRight size={17} />
        </Link>
      </div>
      <figure className="ts-hero-photo">
        <img
          src={assetUrl("images/hero-still-life.png")}
          alt="TrueMark ivory packaging and glass research vials"
        />
        <figcaption>Every lot has a record.</figcaption>
      </figure>
    </section>
  );
}

function Compound() {
  return (
    <section className="ts-compound" aria-label="Product specimen">
      <div className="ts-product-photo">
        <p className="ts-kicker">The research collection / 01</p>
        <img
          src={assetUrl("images/research-vial.png")}
          alt="TrueMark research vial packaging concept"
        />
      </div>
      <div className="ts-product-copy">
        <p className="ts-kicker">Peptides & proteins</p>
        <h2 className="ts-product-title">BPC-157</h2>
        <p className="ts-spec-line">
          10 mg <span>Clear liquid</span>
        </p>
        <p className="ts-body">
          BPC-157, supplied for laboratory research with lot-level traceability.
          Review the specifications and the documentation for your lot before
          beginning your work.
        </p>
        <div className="ts-product-assurances">
          <span>
            <Check size={15} /> Lot documented
          </span>
          <span>Research use only</span>
        </div>
        <div className="ts-price-row">
          <span>10 mg / vial</span>
          <span className="ts-price">
            $100<span>.00</span>
          </span>
        </div>
        <Link className="ts-solid-link" to="/product/bpc-157-10-mg">
          View compound <ArrowUpRight size={18} />
        </Link>
        <Link className="ts-record-link" to="/verify">
          <FileText size={22} />
          <span>
            Know your lot.<small>Find its Certificate of Analysis.</small>
          </span>
          <ArrowUpRight size={17} />
        </Link>
      </div>
    </section>
  );
}

function Record() {
  return (
    <section className="ts-record" aria-label="Documentation specimen">
      <div className="ts-record-intro">
        <p className="ts-kicker">A clear line from source to certificate</p>
        <h2 className="ts-display">
          <span>Research,</span>
          <span>with a record.</span>
        </h2>
        <p className="ts-body">
          The details matter. Find the documentation associated with your
          compound and lot, all in one place.
        </p>
        <Link className="ts-text-link" to="/verify">
          Verify your lot <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="ts-certificate">
        <div className="ts-certificate-top">
          <span className="ts-kicker">Certificate of Analysis</span>
          <FileText size={20} />
        </div>
        <h3 className="ts-record-title">BPC-157</h3>
        <p className="ts-lot">
          10 mg <span>/</span> Lot BP10-2611A
        </p>
        <div className="ts-result">
          <span className="ts-data-number">
            99.31<span>%</span>
          </span>
          <span>HPLC purity</span>
        </div>
        <dl>
          <div>
            <dt>Presentation</dt>
            <dd>Clear liquid</dd>
          </div>
          <div>
            <dt>Lot identifier</dt>
            <dd>BP10-2611A</dd>
          </div>
          <div>
            <dt>Intended use</dt>
            <dd>Laboratory research</dd>
          </div>
        </dl>
        <p className="ts-sample-note">
          Illustrative prototype record · Not a live certificate
        </p>
      </div>
    </section>
  );
}

function ComparisonCard({
  direction,
  onChoose,
}: {
  direction: (typeof directions)[number];
  onChoose: () => void;
}) {
  return (
    <article className="ts-comparison-card" data-direction={direction.id}>
      <div className="ts-card-label">
        <span>
          {direction.number} / {direction.name}
        </span>
        <ArrowDown size={15} />
      </div>
      <div className="ts-mini-sheet">
        <Brand />
        <h2 className="ts-display">
          <Statement />
        </h2>
        <p className="ts-body">
          Explore research compounds backed by lot-level documentation. A clear
          starting point for your next discovery.
        </p>
        <div className="ts-mini-product">
          <h3>BPC-157</h3>
          <span>10 mg / $100.00</span>
        </div>
        <div className="ts-mini-data">
          <span className="ts-data-number">
            99.31<span>%</span>
          </span>
          <span>HPLC purity · Illustrative</span>
        </div>
      </div>
      <div className="ts-card-detail">
        <p>{direction.character}</p>
        <span>{direction.pairing}</span>
        <button onClick={onChoose}>
          Explore {direction.name.toLowerCase()} <ArrowRight size={16} />
        </button>
      </div>
    </article>
  );
}

export default function TypeStudy() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("direction");
  const direction: Direction =
    requested === "original" || directions.some((item) => item.id === requested)
      ? (requested as Direction)
      : "quiet";
  const scene =
    scenes.find((item) => item.id === params.get("scene"))?.id ?? "collection";
  const compare = params.get("view") === "compare";
  const selected = directions.find((item) => item.id === direction);
  const previousDirection = useRef<Direction>("quiet");

  useEffect(() => {
    if (direction !== "original") previousDirection.current = direction;
  }, [direction]);

  useEffect(() => {
    document.title = "Typography studies — TrueMark Biolabs";
  }, []);

  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) => next.set(key, value));
    setParams(next, { replace: true, preventScrollReset: true });
  }

  return (
    <div className="type-study">
      <SectionLink className="ts-skip" section="type-preview">
        Skip to typography preview
      </SectionLink>
      <header className="ts-studio-header">
        <Link to="/products">
          TrueMark <span>/ Type studies</span>
        </Link>
        <Link to="/products">
          Back to prototype <ArrowUpRight size={15} />
        </Link>
      </header>
      <main className="ts-workspace">
        <div className="ts-intro">
          <div>
            <p className="ts-studio-eyebrow">A study in quiet distinction</p>
            <h1>The character of TrueMark.</h1>
            <p>
              Three typographic directions. The same words, considered
              differently.
            </p>
          </div>
          <div
            className="ts-view-switch"
            role="group"
            aria-label="Preview layout"
          >
            <button
              aria-pressed={!compare}
              onClick={() => update({ view: "context" })}
            >
              In context
            </button>
            <button
              aria-pressed={compare}
              onClick={() => update({ view: "compare" })}
            >
              Side by side
            </button>
          </div>
        </div>

        {compare ? (
          <section
            className="ts-comparison"
            id="type-preview"
            tabIndex={-1}
            aria-label="Compare three typography directions"
          >
            {directions.map((item) => (
              <ComparisonCard
                key={item.id}
                direction={item}
                onChoose={() => update({ direction: item.id, view: "context" })}
              />
            ))}
          </section>
        ) : (
          <>
            <div
              className="ts-directions"
              role="group"
              aria-label="Typography direction"
            >
              {directions.map((item) => (
                <button
                  key={item.id}
                  aria-pressed={direction === item.id}
                  onClick={() => update({ direction: item.id })}
                >
                  <span className="ts-direction-number">{item.number}</span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.pairing}</small>
                  </span>
                  <span className="ts-chosen">
                    {direction === item.id ? (
                      <Check size={17} />
                    ) : (
                      <ArrowUpRight size={17} />
                    )}
                  </span>
                </button>
              ))}
            </div>
            <div className="ts-preview-toolbar">
              <div role="group" aria-label="Preview content">
                {scenes.map((item) => (
                  <button
                    key={item.id}
                    aria-pressed={scene === item.id}
                    onClick={() => update({ scene: item.id })}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button
                className="ts-original"
                aria-pressed={direction === "original"}
                onClick={() =>
                  update({
                    direction:
                      direction === "original"
                        ? previousDirection.current
                        : "original",
                  })
                }
              >
                Original font pairing
                {direction === "original" && <Check size={14} />}
              </button>
            </div>
            <section
              id="type-preview"
              tabIndex={-1}
              className="ts-preview"
              data-direction={direction}
              aria-label={`${selected?.name ?? "Original pairing"} typography preview`}
            >
              <div className="ts-site-header">
                <span className="ts-kicker">Research, with a record.</span>
                <Brand />
                <span className="ts-kicker">For laboratory research only</span>
              </div>
              {scene === "collection" ? (
                <Collection />
              ) : scene === "compound" ? (
                <Compound />
              ) : (
                <Record />
              )}
              <div className="ts-detail-strip">
                <div>
                  <span className="ts-kicker">Compound name</span>
                  <span className="ts-detail-name">BPC-157</span>
                </div>
                <div>
                  <span className="ts-kicker">Specifications</span>
                  <span className="ts-detail-spec">
                    10 mg <span>/</span> 99.31%
                  </span>
                  <small>Illustrative purity figure</small>
                </div>
                <div>
                  <span className="ts-kicker">
                    The small print, made readable
                  </span>
                  <p>
                    For laboratory research use only.
                    <br />
                    Not for human or veterinary use.
                  </p>
                </div>
              </div>
            </section>
            <section
              className="ts-direction-notes"
              aria-live="polite"
              aria-atomic="true"
            >
              <div>
                <p className="ts-studio-eyebrow">
                  {selected
                    ? `${selected.number} / ${selected.name}`
                    : "Original pairing / Newsreader + DM Sans"}
                </p>
                <h2>{selected?.character ?? "Our starting point."}</h2>
                <p>
                  {selected?.description ??
                    "The initial prototype’s font pairing, preserved in the study composition. The repeated italic second lines and denser proportions give it a more familiar editorial character. Quiet modern is now the selected direction for the site."}
                </p>
              </div>
              <div>
                <h3>{selected ? "What it brings" : "What we’re exploring"}</h3>
                <p>
                  {selected?.strength ??
                    "A more distinctive silhouette, less reliance on italics, and a more generous reading scale."}
                </p>
                <h3>Keep in mind</h3>
                <p>
                  {selected?.watch ??
                    "This is a font-pairing reference, not a pixel-for-pixel before view."}
                </p>
              </div>
            </section>
          </>
        )}
        <footer className="ts-studio-footer">
          <p>
            Quiet modern selected for the prototype. Packaging artwork is held
            constant in this study.
          </p>
          <div>
            {directions.map((item) => (
              <a
                key={item.id}
                href={item.source}
                target="_blank"
                rel="noreferrer"
              >
                {item.font} <ArrowUpRight size={12} />
              </a>
            ))}
          </div>
        </footer>
      </main>
    </div>
  );
}
