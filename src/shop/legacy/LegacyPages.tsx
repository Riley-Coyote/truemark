/**
 * The Quiet-modern pages from the Codex prototype, kept working while each is
 * rebuilt on the platform system. Nothing new should import from here.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import {
  Link,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  Minus,
  PackageCheck,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Snowflake,
  Trash2,
} from "lucide-react";
import {
  articles,
  faqs,
  money,
  processSteps,
  products,
} from "../../data";
import { SectionLink } from "../../SectionLink";
import { assetUrl } from "../../assetUrl";
import { useShop } from "../context";

export function Eyebrow({
  children,
  light = false,
}: {
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <p className={`eyebrow ${light ? "light" : ""}`}>
      <span />
      {children}
    </p>
  );
}

function VerificationBanner() {
  return (
    <section className="verification-banner">
      <div className="verification-icon">
        <img src={assetUrl("images/brand/monogram-white.svg")} alt="" />
      </div>
      <div>
        <Eyebrow>TRACEABLE BY DESIGN</Eyebrow>
        <h2>
          A small number.
          <br />
          The whole story.
        </h2>
      </div>
      <div className="verification-banner-copy">
        <p>
          Your lot number connects the vial in your hand to its testing and
          release record.
        </p>
        <Link className="button button-light" to="/verify">
          Verify a lot <ArrowUpRight size={17} />
        </Link>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section className="faq-section page-width">
      <div>
        <Eyebrow>A FEW USEFUL ANSWERS</Eyebrow>
        <h2>Clarity comes first.</h2>
        <p>More questions? We’re here to help.</p>
        <Link className="understated-link" to="/contact">
          Contact our team <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="faq-list">
        {faqs.map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}
              <Plus size={18} />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function ArticleCard({ article }: { article: (typeof articles)[number] }) {
  return (
    <Link
      className={`article-card article-${article.number}`}
      to={`/research-blog/${article.id}`}
    >
      <div className="article-art">
        <span className="article-index">FIELD NOTES / {article.number}</span>
        <span className="article-symbol">
          {article.number === "01" ? (
            <FileText size={72} strokeWidth={0.7} />
          ) : article.number === "02" ? (
            <ShieldCheck size={72} strokeWidth={0.7} />
          ) : (
            <PackageCheck size={72} strokeWidth={0.7} />
          )}
        </span>
        <img className="article-brand" src={assetUrl("images/brand/monogram.svg")} alt="TrueMark BioLabs" />
      </div>
      <p className="product-category">
        {article.category} <span>· {article.time}</span>
      </p>
      <h3>{article.title}</h3>
      <span className="article-link">
        Read the note <ArrowUpRight size={17} />
      </span>
    </Link>
  );
}

function Quantity({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div className="quantity">
      <button
        aria-label={`Decrease ${label.toLowerCase()}`}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={14} />
      </button>
      <input
        type="number"
        min={1}
        max={99}
        value={value}
        aria-label={label}
        onChange={(e) =>
          onChange(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
        }
      />
      <button
        aria-label={`Increase ${label.toLowerCase()}`}
        disabled={value >= 99}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
}) {
  return (
    <section className="page-intro page-width">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}

export function Quality() {
  return (
    <>
      <PageIntro
        eyebrow="THE TRUEMARK STANDARD"
        title={
          <>
            Confidence doesn’t happen.
            <br />
            <span>It’s documented.</span>
          </>
        }
        description="A considered process from source material to released lot. Each step connected. Each record within reach."
      />
      <section className="quality-opening page-width">
        <div className="quality-image">
          <img
            src={assetUrl("images/studies/glass.png")}
            alt="Curved glass and refracted light, a study in clarity"
          />
          <span>CONSIDERED AT EVERY STEP.</span>
        </div>
        <div>
          <Eyebrow>QUALITY, MADE VISIBLE</Eyebrow>
          <h2>
            Know the material.
            <br />
            Know its history.
          </h2>
          <p>
            Our quality framework follows a controlled path: source, receive,
            quarantine, test, review, and release. A lot is more than a number.
            It is the link between the material and its documentation.
          </p>
          <Link className="understated-link" to="/verify">
            Explore a sample lot record <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>
      <section className="section page-width">
        <div className="section-heading">
          <div>
            <Eyebrow>A CONTINUOUS PROCESS</Eyebrow>
            <h2>From source to your laboratory.</h2>
          </div>
        </div>
        <div className="process-list">
          {processSteps.map((step, i) => (
            <div key={step.title}>
              <span>0{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              <ArrowDown size={17} />
            </div>
          ))}
        </div>
      </section>
      <section className="quality-spec section page-width">
        <div>
          <Eyebrow>THE RELEASE FRAMEWORK</Eyebrow>
          <h2>
            A clear standard.
            <br />
            <span>A readable record.</span>
          </h2>
          <p>
            Testing methods and specifications belong beside their results. The
            framework shown here comes from the client’s prototype.
          </p>
          <p className="small muted">
            Proposed specifications for design review. Final laboratory
            documentation governs each lot.
          </p>
        </div>
        <table className="quality-table">
          <thead>
            <tr>
              <th>Test</th>
              <th>Method</th>
              <th>Specification</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Purity", "HPLC", "≥ 99%"],
              ["Identity", "Mass spectrometry", "Mass confirmed"],
              ["Endotoxin", "LAL assay", "< 0.25 EU/mg"],
              ["Sterility", "Culture", "No growth"],
              ["Net content", "Gravimetric", "Label claim met"],
            ].map((row) => (
              <tr key={row[0]}>
                {row.map((cell) => (
                  <td key={cell}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="section page-width">
        <VerificationBanner />
      </div>
    </>
  );
}

export function Handling() {
  return (
    <>
      <PageIntro
        eyebrow="HANDLING & RECEIVING"
        title={
          <>
            Care, beyond
            <br />
            <span>the delivery.</span>
          </>
        }
        description="Clear documentation supports a considered handoff, from receiving your shipment to retaining the record."
      />
      <section className="handling-layout page-width">
        <aside className="contents-nav">
          <span>IN THIS GUIDE</span>
          <SectionLink section="receiving">01 · Receiving your material</SectionLink>
          <SectionLink section="storage">02 · Storage & documentation</SectionLink>
          <SectionLink section="records">03 · Keeping a clear record</SectionLink>
          <SectionLink section="questions">04 · Questions about a shipment</SectionLink>
        </aside>
        <div className="handling-content">
          <section id="receiving">
            <Eyebrow>01 / RECEIVING</Eyebrow>
            <h2>A considered first check.</h2>
            <p>
              Compare the received products with your order and accompanying
              documentation. Check the packaging and record the printed lot
              identifiers.
            </p>
            <ul className="check-list">
              <li>
                <Check size={16} />
                Match the compound and presentation to your order.
              </li>
              <li>
                <Check size={16} />
                Retain the lot identifier for each received material.
              </li>
              <li>
                <Check size={16} />
                Document visible shipping damage or discrepancies.
              </li>
            </ul>
          </section>
          <section id="storage">
            <Eyebrow>02 / STORAGE</Eyebrow>
            <h2>Follow the material’s record.</h2>
            <p>
              Consult the product-specific storage documentation and your
              laboratory’s standard operating procedures. Requirements can
              differ by material and presentation.
            </p>
            <div className="note-panel">
              <Snowflake size={22} />
              <p>
                Use the applicable product documentation for storage conditions.
                A general guide does not replace the instructions for an
                individual material.
              </p>
            </div>
          </section>
          <section id="records">
            <Eyebrow>03 / DOCUMENTATION</Eyebrow>
            <h2>Keep the connection intact.</h2>
            <p>
              Retain the applicable Certificate of Analysis with your laboratory
              records. The lot number links the received material to its testing
              documentation.
            </p>
            <Link className="understated-link" to="/verify">
              Look up a lot <ArrowUpRight size={17} />
            </Link>
          </section>
          <section id="questions">
            <Eyebrow>04 / SUPPORT</Eyebrow>
            <h2>A clear question gets a clearer answer.</h2>
            <p>
              When contacting the team, include the compound name, presentation,
              lot number, and a description of the issue. Keep the original
              packaging if the inquiry concerns shipping.
            </p>
            <Link className="button button-dark" to="/contact">
              Contact the team <ArrowUpRight size={17} />
            </Link>
          </section>
        </div>
      </section>
    </>
  );
}

export function About() {
  return (
    <>
      <PageIntro
        eyebrow="ABOUT TRUEMARK"
        title={
          <>
            Research, with
            <br />
            <span>a record.</span>
          </>
        }
        description="We believe confidence in a research compound begins with a clear understanding of where it comes from and the documentation behind it."
      />
      <section className="about-image page-width">
        <img
          src={assetUrl("images/studies/tidal.png")}
          alt="Clear shallow water with pale blue ripples and warm refracted morning light"
        />
        <span>TRUEMARK BIOLABS / CONSIDERED AT EVERY STEP</span>
      </section>
      <section className="about-statement page-width">
        <Eyebrow>A CLEAR STARTING POINT</Eyebrow>
        <h2>
          Precision in the material.
          <br />
          <span>Clarity in the details.</span>
        </h2>
        <div>
          <p>
            TrueMark’s premise is straightforward: connect research compounds to
            their lot-level documentation. From the identifier on a vial to the
            associated testing record, the details should be easy to find and
            understand.
          </p>
          <p>
            Our collection is organized by compound class. Our quality framework
            makes the process visible. Our verification experience gives the
            record a clear home.
          </p>
          <Link className="understated-link" to="/quality">
            Explore our standard <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>
      <section className="audience-section page-width">
        <div>
          <Eyebrow>FOR THE RESEARCH COMMUNITY</Eyebrow>
          <h2>
            Supporting the work
            <br />
            of understanding.
          </h2>
        </div>
        <div className="audience-list">
          {[
            "Educational institutions",
            "Hospitals & medical institutions",
            "Pharmaceutical & biotech companies",
            "Government laboratories",
            "Private research organizations",
            "Contract research organizations",
          ].map((name) => (
            <div key={name}>
              {name}
              <ArrowUpRight size={16} />
            </div>
          ))}
        </div>
      </section>
      <div className="section page-width">
        <VerificationBanner />
      </div>
    </>
  );
}

export function Journal() {
  return (
    <>
      <PageIntro
        eyebrow="THE RESEARCH JOURNAL"
        title={
          <>
            A little more
            <br />
            <span>understanding.</span>
          </>
        }
        description="Notes on documentation, traceability, and the details that make a research workflow clearer."
      />
      <section className="page-width journal-page">
        <div className="journal-grid">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>
      <FAQ />
    </>
  );
}

export function Article() {
  const { id } = useParams();
  const article = articles.find((a) => a.id === id);
  if (!article) return <NotFound />;
  return (
    <article className="article-page page-width">
      <Link className="understated-link" to="/research-blog">
        <ArrowLeft size={17} />
        All field notes
      </Link>
      <header>
        <Eyebrow>
          {article.category} / FIELD NOTE {article.number}
        </Eyebrow>
        <h1>{article.title}</h1>
        <p>{article.description}</p>
        <span>{article.time} · TrueMark BioLabs</span>
      </header>
      <div className="article-body">
        {article.sections.map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
        <div className="note-panel">
          <FileText size={25} />
          <p>
            Editorial draft for the TrueMark prototype. Product-specific
            documents and laboratory procedures govern the handling of each
            material.
          </p>
        </div>
        <Link className="button button-dark" to="/verify">
          Explore lot verification <ArrowUpRight size={17} />
        </Link>
      </div>
    </article>
  );
}

export function Contact() {
  const [params] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  return (
    <>
      <PageIntro
        eyebrow="CONTACT TRUEMARK"
        title={
          <>
            Good questions.
            <br />
            <span>Clear answers.</span>
          </>
        }
        description="Ask about a compound, a lot record, or your organization’s research requirements."
      />
      <section className="contact-layout page-width">
        <div className="contact-aside">
          <FileText size={35} strokeWidth={1} />
          <h2>
            A little context
            <br />
            goes a long way.
          </h2>
          <p>
            For product or documentation inquiries, include the compound name
            and lot number where available.
          </p>
          <Link className="understated-link" to="/verify">
            Need a certificate? Start here <ArrowUpRight size={16} />
          </Link>
          <div className="contact-note">
            <span>FOR LABORATORY RESEARCH</span>
            <p>
              Our catalog is intended for qualified research organizations. We
              do not provide guidance for human or veterinary use.
            </p>
          </div>
        </div>
        {submitted ? (
          <div className="form-success" role="status">
            <Check size={32} />
            <h2>
              Your inquiry is ready
              <br />
              for review.
            </h2>
            <p>
              This is a prototype confirmation. Nothing has been sent to
              TrueMark.
            </p>
            <button
              className="button button-outline"
              onClick={() => setSubmitted(false)}
            >
              Compose another inquiry <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <form
            className="contact-form"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
          >
            <div className="form-two">
              <label>
                Your name
                <input
                  name="name"
                  required
                  autoComplete="name"
                  placeholder="Full name"
                />
              </label>
              <label>
                Work email
                <input
                  name="email"
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="you@organization.com"
                />
              </label>
            </div>
            <label>
              Organization
              <input
                name="organization"
                required
                autoComplete="organization"
                placeholder="Research organization"
              />
            </label>
            <label>
              What can we help with?
              <select
                name="topic"
                defaultValue={
                  params.has("compound") ? "Product inquiry" : "General inquiry"
                }
              >
                <option>General inquiry</option>
                <option>Product inquiry</option>
                <option>Lot documentation</option>
                <option>Receiving & shipping</option>
              </select>
            </label>
            <label>
              Your message
              <textarea
                name="message"
                required
                rows={5}
                defaultValue={
                  params.has("compound")
                    ? `I’d like to inquire about ${params.get("compound")}.`
                    : ""
                }
                placeholder="Tell us a little about your question…"
              />
            </label>
            <div className="form-submit">
              <p>Design preview. This form does not send messages.</p>
              <button className="button button-dark" type="submit">
                Preview inquiry <ArrowUpRight size={17} />
              </button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}

export function Access() {
  const [mode, setMode] = useState("Sign in");
  const [complete, setComplete] = useState(false);
  return (
    <section className="access-page page-width">
      <div className="access-image">
        <img
          src={assetUrl("images/studies/water.png")}
          alt="Sunlight moving through clear water"
        />
        <div>
          <Eyebrow>TRUEMARK BIOLABS</Eyebrow>
          <h2>
            A clearer starting point
            <br />
            for your research.
          </h2>
        </div>
      </div>
      <div className="access-form-area">
        {complete ? (
          <div className="form-success" role="status">
            <Check size={30} />
            <h2>You’re ready to explore.</h2>
            <p>
              The account interaction is a demonstration. No account was created
              or authenticated.
            </p>
            <Link className="button button-dark" to="/products">
              Explore compounds <ArrowUpRight size={17} />
            </Link>
          </div>
        ) : (
          <>
            <Eyebrow>YOUR RESEARCH ACCOUNT</Eyebrow>
            <h1>
              {mode === "Sign in" ? (
                <>
                  Welcome
                  <br />
                  <span>back.</span>
                </>
              ) : (
                <>
                  Let’s begin
                  <br />
                  <span>with the details.</span>
                </>
              )}
            </h1>
            <div className="account-tabs">
              {["Sign in", "Request access"].map((name) => (
                <button
                  key={name}
                  className={mode === name ? "active" : ""}
                  onClick={() => setMode(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            <form
              className="contact-form"
              onSubmit={(e) => {
                e.preventDefault();
                setComplete(true);
              }}
            >
              {mode === "Request access" && (
                <>
                  <label>
                    Full name
                    <input required name="name" autoComplete="name" />
                  </label>
                  <label>
                    Research organization
                    <input
                      required
                      name="organization"
                      autoComplete="organization"
                    />
                  </label>
                  <label>
                    Affiliation
                    <select required defaultValue="">
                      <option value="" disabled>
                        Select your affiliation
                      </option>
                      {[
                        "Educational institution",
                        "Hospital / medical institution",
                        "Pharmaceutical / biotech company",
                        "Government laboratory",
                        "Private research organization",
                        "Contract research organization",
                        "Independent researcher",
                      ].map((affiliation) => (
                        <option key={affiliation}>{affiliation}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <label>
                Work email
                <input
                  required
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@organization.com"
                />
              </label>
              <p className="small muted">
                Explore the account flow with a sample email. No credentials are
                collected in this design preview.
              </p>
              <button className="button button-dark full-width" type="submit">
                {mode === "Sign in"
                  ? "Preview account access"
                  : "Preview access request"}
                <ArrowRight size={17} />
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

export function CartContent({ page = false }: { page?: boolean }) {
  const { cart, change, closeCart } = useShop();
  const [review, setReview] = useState(false);
  const total = cart.reduce(
    (sum, item) =>
      sum +
      (products.find((p) => p.id === item.id)?.price ?? 0) * item.quantity,
    0,
  );
  return (
    <div className={page ? "cart-page-content" : "cart-drawer-content"}>
      {cart.length ? (
        <>
          <p className="muted small">Your selected research materials.</p>
          <div className="cart-items">
            {cart.map((item) => {
              const p = products.find((product) => product.id === item.id)!;
              return (
                <div className="cart-item" key={item.id}>
                  <Link to={`/product/${p.id}`} onClick={closeCart}>
                    <img
                      src={assetUrl(p.image ?? "images/brand/monogram.svg")}
                      alt={`${p.name}, ${p.size}, TrueMark BioLabs research vial`}
                    />
                  </Link>
                  <div>
                    <Link to={`/product/${p.id}`} onClick={closeCart}>
                      <h3>{p.name}</h3>
                    </Link>
                    <p>{p.size} · Research compound</p>
                    <Quantity
                      value={item.quantity}
                      onChange={(q) => change(item.id, q)}
                      label={`${p.name} quantity`}
                    />
                  </div>
                  <div className="cart-item-end">
                    <strong>{money((p.price ?? 0) * item.quantity)}</strong>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${p.name} from bag`}
                      onClick={() => change(item.id, 0)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="cart-total">
            <span>Subtotal</span>
            <strong>{money(total)}</strong>
          </div>
          <p className="small muted">
            Shipping and applicable taxes are not calculated in this preview.
          </p>
          <button
            className="button button-dark full-width"
            onClick={() => setReview(true)}
          >
            Review selection <ArrowRight size={17} />
          </button>
          {review && (
            <div className="review-confirmation" role="status">
              <Check size={18} />
              <div>
                <strong>Selection ready for review.</strong>
                <p>
                  This prototype does not place orders or collect payment. Your
                  selected items remain in your bag.
                </p>
              </div>
            </div>
          )}
          <Link
            className="cart-continue understated-link"
            to="/products"
            onClick={closeCart}
          >
            Continue exploring <ArrowRight size={16} />
          </Link>
        </>
      ) : (
        <div className="empty-state">
          <ShoppingBag size={40} strokeWidth={1} />
          <h2>A considered start.</h2>
          <p>Your bag is waiting for your first compound.</p>
          <Link
            className="button button-dark"
            to="/products"
            onClick={closeCart}
          >
            Explore the collection <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </div>
  );
}

export function CartPage() {
  return (
    <>
      <PageIntro
        eyebrow="YOUR SELECTION"
        title={
          <>
            Your research
            <br />
            <span>starts here.</span>
          </>
        }
        description="Review the compounds selected for your organization."
      />
      <section className="page-width cart-page">
        <CartContent page />
      </section>
    </>
  );
}

export function NotFound() {
  return (
    <div className="page-width empty-state not-found">
      <Eyebrow>PAGE NOT FOUND</Eyebrow>
      <h1>
        A different
        <br />
        <span>starting point.</span>
      </h1>
      <p>This page isn’t part of the collection.</p>
      <Link className="button button-dark" to="/products">
        Explore the compounds <ArrowRight size={17} />
      </Link>
    </div>
  );
}

