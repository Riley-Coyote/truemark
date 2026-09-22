import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { SectionLink } from "./SectionLink";
import { assetUrl } from "./assetUrl";
import "./visual-study.css";

const directions = [
  {
    id: "horizon",
    name: "Open horizon",
    number: "01",
    kind: "Environment",
    feeling: "Perspective. Possibility. Room to think.",
    description: "An expansive coast brings the visitor into a world beyond the product. Natural light, distance, and an uninterrupted horizon lend the brand a feeling of openness and considered optimism.",
    association: "There is more to understand.",
    alt: "Pale coastal cliffs curve into a quiet silver-blue sea in the early morning light",
    caption: "A world worth understanding.",
  },
  {
    id: "water",
    name: "Living patterns",
    number: "02",
    kind: "Abstract nature",
    feeling: "Presence. Connection. Quiet energy.",
    description: "Light and water form a living pattern at an intimate scale. It connects research with the complexity of the natural world, while leaving the visitor space to bring their own meaning to it.",
    association: "Look closer. There is more here.",
    alt: "Silver ripples and refracted sunlight form intricate natural patterns in shallow clear water",
    caption: "Extraordinary, in the ordinary.",
  },
  {
    id: "glass",
    name: "Light through glass",
    number: "03",
    kind: "Material study",
    feeling: "Clarity. Care. Close attention.",
    description: "An extreme crop turns the familiar vial into a study of light and material. The scale is unexpected; the tactile detail expresses the care behind the work.",
    association: "The details deserve attention.",
    alt: "An extreme close-up of curved glass and its refracted shadow across a warm white surface",
    caption: "Considered at every scale.",
  },
  {
    id: "object",
    name: "The research object",
    number: "04",
    kind: "Product sculpture",
    feeling: "Precision. Composure. Substance.",
    description: "A single object, architectural space, and directional light. This is the most literal product introduction, with the confidence and restraint of an industrial design photograph.",
    association: "A clear starting point.",
    alt: "A single TrueMark research vial on a pale limestone plinth with a long architectural shadow",
    caption: "Purpose in every detail.",
  },
] as const;

type Direction = (typeof directions)[number];

function StudyBrand() {
  return <Link className="vs-brand" to="/" aria-label="TrueMark Biolabs home">TrueMark<span>BIOLABS</span></Link>;
}

function Hero({ direction, compact = false }: { direction: Direction; compact?: boolean }) {
  return (
    <div className={`vs-composition vs-${direction.id}${compact ? " vs-compact" : ""}`}>
      {!compact && (
        <>
          <div className="vs-announcement"><span>Research, with a record.</span><span>For laboratory research use only</span><Link to="/verify">Verify your lot <ArrowUpRight size={12} /></Link></div>
          <header className="vs-site-header">
            <nav aria-label="Study storefront navigation"><Link to="/products">Compounds</Link><Link to="/quality">Our standard</Link></nav>
            <StudyBrand />
            <nav aria-label="Study resources"><Link to="/research-blog">Journal</Link><Link to="/verify">Verify a lot <ArrowUpRight size={14} /></Link></nav>
          </header>
        </>
      )}
      <section className="vs-hero" aria-label={`${direction.name} homepage composition`}>
        <img className="vs-hero-image" src={assetUrl(`images/studies/${direction.id}.png`)} alt={direction.alt} fetchPriority={compact ? "auto" : "high"} loading={compact ? "lazy" : "eager"} />
        <div className="vs-hero-wash" />
        <div className="vs-hero-copy">
          <p className="vs-eyebrow">TRUEMARK BIOLABS</p>
          {compact ? <h3>True research.<br />Clear confidence.</h3> : <h1>True research.<br />Clear confidence.</h1>}
          <p className="vs-intro">Research compounds with a clear line from source to certificate. Precisely documented. Considered at every step.</p>
          {!compact && <div className="vs-actions"><Link className="vs-primary" to="/products">Explore the compounds <ArrowUpRight size={18} /></Link><Link className="vs-secondary" to="/quality">Our standard <ArrowRight size={17} /></Link></div>}
        </div>
        <div className="vs-hero-bottom"><span>{direction.caption}</span>{!compact && <SectionLink section="visual-notes" aria-label="Read the direction notes"><ArrowDown size={17} /></SectionLink>}<span>RESEARCH, WITH A RECORD.</span></div>
      </section>
      {!compact && <div className="vs-proof"><span>Independent testing</span><span>Lot-level documentation</span><span>Considered at every step</span></div>}
    </div>
  );
}

export default function VisualStudy() {
  const [params, setParams] = useSearchParams();
  const selected = directions.find((item) => item.id === params.get("direction")) ?? directions[0];
  const compare = params.get("view") === "compare";
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.title;
    document.title = "First impressions — TrueMark visual studies";
    return () => { document.title = previous; };
  }, []);

  function choose(id: Direction["id"]) {
    setParams({ direction: id, view: "context" });
    previewRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }

  return (
    <div className="vs-study" ref={previewRef}>
      <SectionLink className="vs-skip" section="visual-preview">Skip to visual preview</SectionLink>
      <div className="vs-controls">
        <Link className="vs-return" to="/" aria-label="Return to current homepage"><ArrowLeft size={16} /><span>Current site</span></Link>
        <nav aria-label="Visual directions">{directions.map((item) => <button key={item.id} aria-pressed={!compare && selected.id === item.id} onClick={() => choose(item.id)}><span>{item.number}</span>{item.name}</button>)}</nav>
        <button className="vs-compare-button" aria-pressed={compare} onClick={() => setParams({ direction: selected.id, view: compare ? "context" : "compare" })}>{compare ? "Full preview" : "Compare all"}</button>
      </div>
      <main id="visual-preview">
        {compare ? (
          <section className="vs-comparison">
            <div className="vs-comparison-heading"><p className="vs-eyebrow">TRUEMARK / VISUAL EXPLORATION</p><h1>Four ways to begin.</h1><p>The same words. The same typography. A different first feeling.</p></div>
            <div className="vs-comparison-grid">{directions.map((item) => <article key={item.id}><button className="vs-preview-button" onClick={() => choose(item.id)} aria-label={`Open ${item.name} full preview`}><Hero direction={item} compact /></button><div className="vs-card-caption"><div><p className="vs-eyebrow">{item.number} / {item.kind}</p><h2>{item.name}</h2><p>{item.feeling}</p></div><button onClick={() => choose(item.id)} aria-label={`Explore ${item.name}`}><ArrowUpRight size={23} /></button></div></article>)}</div>
          </section>
        ) : <Hero direction={selected} />}
        <section className="vs-notes" id="visual-notes" aria-label="Art direction notes">
          <div className="vs-note-heading"><p className="vs-eyebrow">{compare ? "THE CREATIVE INTENT" : `${selected.number} / ${selected.kind}`}</p><h2>{compare ? "A feeling of possibility." : selected.name}</h2><p className="vs-feeling">{compare ? "Presence. Curiosity. Connection." : selected.feeling}</p></div>
          <div className="vs-note-body"><p>{compare ? "Build an emotional connection through the world around the work: open space, natural light, living systems, and attention to detail. These are associations for the brand, not promises about personal health or performance." : selected.description}</p><blockquote>{compare ? "A world worth understanding." : selected.association}</blockquote><p className="vs-boundary">Art-direction study · Original generated imagery · Research-only positioning</p></div>
        </section>
        <section className="vs-image-system" aria-labelledby="vs-system-title">
          <div><p className="vs-eyebrow">VARIETY, WITH A COMMON THREAD</p><h2 id="vs-system-title">One world.<br />Different perspectives.</h2><p>Natural light, tactile detail, restrained color. Give each part of the site its own subject and scale.</p></div>
          <div className="vs-image-roles">
            <div><span>01</span><h3>Home</h3><p>One immersive environmental image, reserved for the opening.</p></div>
            <div><span>02</span><h3>Collection & products</h3><p>Clear, consistent object photography. Let the compounds be easy to compare.</p></div>
            <div><span>03</span><h3>Our standard</h3><p>Glass, paper, and material details. Bring the visitor closer to the work.</p></div>
            <div><span>04</span><h3>About & journal</h3><p>Distinct natural scenes and observations. New subjects, the same quality of light.</p></div>
          </div>
        </section>
      </main>
      <footer className="vs-footer"><span>TrueMark / First impressions</span><span>Quiet modern typography · Visual directions for review</span><Link to="/">Return to current homepage <ArrowUpRight size={14} /></Link></footer>
    </div>
  );
}
