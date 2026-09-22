import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  FileText,
  FlaskConical,
  Menu,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Snowflake,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  articles,
  categories,
  categoryName,
  faqs,
  money,
  processSteps,
  products,
} from "./data";
import type { Product } from "./data";

type CartItem = { id: string; quantity: number };
type AppContextValue = {
  cart: CartItem[];
  add: (id: string, quantity: number) => void;
  change: (id: string, quantity: number) => void;
  openCart: () => void;
  closeCart: () => void;
};
const AppContext = createContext<AppContextValue | null>(null);
const useShop = () => useContext(AppContext)!;

function loadCart(): CartItem[] {
  try {
    const raw: unknown = JSON.parse(
      localStorage.getItem("truemark-preview-cart") ?? "[]",
    );
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is CartItem =>
        typeof item === "object" &&
        item !== null &&
        products.some((p) => p.id === item.id && p.price !== undefined) &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 99,
    );
  } catch {
    return [];
  }
}

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

function Wordmark({ footer = false }: { footer?: boolean }) {
  return (
    <Link
      className={`wordmark ${footer ? "footer-wordmark" : ""}`}
      to="/"
      aria-label="TrueMark Biolabs home"
    >
      TrueMark<span>BIOLABS</span>
    </Link>
  );
}

function Modal({
  children,
  title,
  onClose,
  side = false,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  side?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = panel.current!;
    const timer = window.setTimeout(
      () =>
        root.querySelector<HTMLElement>("input, button, a, select")?.focus(),
      40,
    );
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const focusable = Array.from(
          root.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex="0"]',
          ),
        ).filter((el) => el.getClientRects().length);
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className={`modal-backdrop ${side ? "side-modal" : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panel}
      >
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Header() {
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [resources, setResources] = useState(false);
  const location = useLocation();
  const { cart, openCart } = useShop();
  const resourceArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMobile(false);
    setResources(false);
    setSearch(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!resourceArea.current?.contains(e.target as Node))
        setResources(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const matches = products
    .filter((p) =>
      `${p.name} ${p.size} ${categoryName(p.category)}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 6);
  return (
    <>
      <div className="announcement">
        <span>Research, with a record.</span>
        <span>For laboratory research use only</span>
        <Link to="/verify">
          Verify your lot <ArrowUpRight size={12} />
        </Link>
      </div>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="icon-button mobile-menu-trigger"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={23} />
          </button>
          <nav className="desktop-nav" aria-label="Main navigation">
            <NavLink to="/products">Compounds</NavLink>
            <NavLink to="/quality">Our standard</NavLink>
            <div
              className="resources-menu"
              ref={resourceArea}
              onKeyDown={(e) => {
                if (e.key === "Escape") setResources(false);
              }}
            >
              <button
                aria-expanded={resources}
                aria-controls="resources-dropdown"
                onClick={() => setResources(!resources)}
              >
                Explore <ChevronDown size={13} />
              </button>
              {resources && (
                <div id="resources-dropdown" className="nav-dropdown">
                  <Link to="/about">
                    About TrueMark <ArrowUpRight size={14} />
                  </Link>
                  <Link to="/research-blog">
                    Research journal <ArrowUpRight size={14} />
                  </Link>
                  <Link to="/handling">
                    Handling & receiving <ArrowUpRight size={14} />
                  </Link>
                  <Link to="/contact">
                    Contact our team <ArrowUpRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          </nav>
          <Wordmark />
          <div className="header-tools">
            <Link className="verify-header" to="/verify">
              Verify a lot <ArrowUpRight size={14} />
            </Link>
            <span className="header-divider" />
            <button
              className="icon-button"
              aria-label="Search compounds"
              onClick={() => setSearch(true)}
            >
              <Search size={19} />
            </button>
            <Link
              className="icon-button account-icon"
              to="/access"
              aria-label="Research account"
            >
              <UserRound size={19} />
            </Link>
            <button
              className="icon-button bag-button"
              aria-label={`Open bag, ${count} ${count === 1 ? "item" : "items"}`}
              onClick={openCart}
            >
              <ShoppingBag size={19} />
              <span>{count}</span>
            </button>
          </div>
        </div>
      </header>
      {mobile && (
        <Modal title="Explore TrueMark" onClose={() => setMobile(false)} side>
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {[
              ["Compounds", "/products"],
              ["Verify a lot", "/verify"],
              ["Our standard", "/quality"],
              ["Handling & receiving", "/handling"],
              ["About TrueMark", "/about"],
              ["Research journal", "/research-blog"],
              ["Contact", "/contact"],
              ["Research account", "/access"],
            ].map(([label, path]) => (
              <Link key={path} to={path}>
                {label}
                <ArrowUpRight size={22} />
              </Link>
            ))}
          </nav>
          <p className="small muted">For laboratory research use only.</p>
        </Modal>
      )}
      {search && (
        <Modal title="Find your compound." onClose={() => setSearch(false)}>
          <div className="search-input-wrap">
            <Search size={21} />
            <input
              type="search"
              autoComplete="off"
              aria-label="Search the catalog"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by compound or class"
            />
          </div>
          <p className="eyebrow search-caption">
            {query ? "Matching compounds" : "Explore the catalog"}
          </p>
          <div className="search-results">
            {matches.map((product) => (
              <Link key={product.id} to={`/product/${product.id}`}>
                <img src="/images/research-vial.png" alt="" />
                <div>
                  <strong>{product.name}</strong>
                  <span>
                    {product.size} · {categoryName(product.category)}
                  </span>
                </div>
                <ArrowUpRight size={19} />
              </Link>
            ))}
            {!matches.length && (
              <div className="empty-inline">
                <Search size={30} />
                <p>No compounds found for “{query}”.</p>
                <button className="text-button" onClick={() => setQuery("")}>
                  Clear your search
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top page-width">
        <div className="footer-brand">
          <Wordmark footer />
          <p>
            A clear line from source
            <br />
            to certificate.
          </p>
          <span className="footer-tag">RESEARCH, WITH A RECORD.</span>
        </div>
        <div className="footer-column">
          <h3>Discover</h3>
          <Link to="/products">Research compounds</Link>
          <Link to="/about">About TrueMark</Link>
          <Link to="/research-blog">Research journal</Link>
        </div>
        <div className="footer-column">
          <h3>Documentation</h3>
          <Link to="/verify">Verify a lot</Link>
          <Link to="/quality">Quality & testing</Link>
          <Link to="/handling">Handling & receiving</Link>
        </div>
        <div className="footer-column">
          <h3>Here to help</h3>
          <Link to="/contact">Contact our team</Link>
          <Link to="/access">Research account</Link>
          <Link to="/cart">Your bag</Link>
        </div>
      </div>
      <div className="footer-bottom page-width">
        <p>
          For laboratory research use only. Not for human or veterinary use.
          Products are not intended to diagnose, treat, cure, or prevent
          disease.
        </p>
        <div>
          <span>© 2026 TrueMark Biolabs</span>
          <span className="preview-label">Design preview</span>
          <span>Considered at every step.</span>
        </div>
      </div>
    </footer>
  );
}

function TrustStrip() {
  return (
    <div className="trust-strip">
      <div>
        <FlaskConical size={20} />
        <span>Independent testing</span>
      </div>
      <div>
        <FileCheck2 size={20} />
        <span>Lot-level documentation</span>
      </div>
      <div>
        <Snowflake size={20} />
        <span>Controlled storage</span>
      </div>
      <div>
        <PackageCheck size={20} />
        <span>Considered fulfillment</span>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  index = 0,
}: {
  product: Product;
  index?: number;
}) {
  return (
    <Link
      className="product-card"
      to={`/product/${product.id}`}
      style={{ animationDelay: `${Math.min(index, 7) * 35}ms` }}
    >
      <div className="product-visual">
        <span className="product-size">{product.size}</span>
        <img
          src="/images/research-vial.png"
          alt={`TrueMark research packaging concept for ${product.name}`}
          loading="lazy"
        />
        <span className="product-open" aria-hidden="true">
          <ArrowUpRight size={19} />
        </span>
        <span className="image-caption">TRUEMARK / RESEARCH COLLECTION</span>
      </div>
      <div className="product-meta">
        <div>
          <p className="product-category">{categoryName(product.category)}</p>
          <h3>{product.name}</h3>
        </div>
        <span className="product-price">
          {product.price !== undefined ? (
            money(product.price)
          ) : (
            <ArrowRight size={18} />
          )}
        </span>
      </div>
      <p className="product-note">
        {product.category === "lab-supplies"
          ? "Laboratory supply"
          : "Clear liquid"}
        <span>Lot traceable</span>
      </p>
    </Link>
  );
}

function VerificationBanner() {
  return (
    <section className="verification-banner">
      <div className="verification-icon">
        <FileCheck2 strokeWidth={1} size={46} />
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

function Home() {
  return (
    <>
      <section className="home-hero page-width">
        <div className="home-hero-copy">
          <Eyebrow>TRUEMARK BIOLABS</Eyebrow>
          <h1>
            True research.
            <br />
            Clear <span>confidence.</span>
          </h1>
          <p>
            Research compounds with a clear line from source to certificate.
            Precisely documented. Considered at every step.
          </p>
          <div className="hero-actions">
            <Link className="button button-dark" to="/products">
              Explore the compounds <ArrowUpRight size={18} />
            </Link>
            <Link className="understated-link" to="/quality">
              Our standard <ArrowRight size={16} />
            </Link>
          </div>
          <div className="hero-footnote">
            <span className="tiny-mark">TM</span>
            <span>
              For the work that moves
              <br />
              understanding forward.
            </span>
          </div>
        </div>
        <div className="home-hero-image">
          <img
            src="/images/hero-still-life.png"
            alt="TrueMark research vials and ivory packaging photographed in natural light"
          />
          <div className="photo-caption">
            <span>THE TRUEMARK COLLECTION</span>
            <span>01 / RESEARCH COMPOUNDS</span>
          </div>
        </div>
      </section>
      <div className="page-width">
        <TrustStrip />
      </div>
      <section className="section page-width">
        <div className="section-heading">
          <div>
            <Eyebrow>THE RESEARCH COLLECTION</Eyebrow>
            <h2>Purpose in every detail.</h2>
          </div>
          <Link className="understated-link" to="/products">
            Explore all 24 compounds <ArrowRight size={18} />
          </Link>
        </div>
        <div className="product-grid featured-grid">
          {[products[0], products[12], products[15], products[17]].map(
            (p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ),
          )}
        </div>
      </section>
      <section className="standard-feature page-width">
        <div className="standard-title">
          <Eyebrow>ONE LOT. ONE CONTINUOUS RECORD.</Eyebrow>
          <h2>
            Confidence is
            <br />
            <span>documented.</span>
          </h2>
          <p>
            Good research starts with knowing your material. Our standard
            connects each lot to the checks, results, and records behind it.
          </p>
          <Link className="button button-outline" to="/quality">
            Meet our standard <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="standard-steps">
          {processSteps.slice(0, 4).map((step, i) => (
            <div key={step.title}>
              <span className="step-number">0{i + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.label}</p>
              </div>
              <Check size={18} />
            </div>
          ))}
        </div>
      </section>
      <section className="section page-width">
        <VerificationBanner />
      </section>
      <section className="section page-width journal-preview">
        <div className="section-heading">
          <div>
            <Eyebrow>THE RESEARCH JOURNAL</Eyebrow>
            <h2>A little more understanding.</h2>
          </div>
          <Link className="understated-link" to="/research-blog">
            Read the journal <ArrowRight size={18} />
          </Link>
        </div>
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

function Catalog() {
  const [params, setParams] = useSearchParams();
  const activeCategory = params.get("class") ?? "all";
  const query = params.get("q") ?? "";
  const sort = params.get("sort") ?? "curated";
  const [showFilters, setShowFilters] = useState(false);
  const filtered = products.filter(
    (p) =>
      (activeCategory === "all" || p.category === activeCategory) &&
      `${p.name} ${p.size}`.toLowerCase().includes(query.toLowerCase()),
  );
  if (sort === "az") filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "za") filtered.sort((a, b) => b.name.localeCompare(a.name));
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value || value === "all" || value === "curated") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true, preventScrollReset: true });
  }
  return (
    <>
      <section className="catalog-hero page-width">
        <div className="catalog-hero-copy">
          <Eyebrow>THE RESEARCH COLLECTION</Eyebrow>
          <h1>
            Precisely sourced.
            <br />
            <span>Clearly documented.</span>
          </h1>
          <p>
            Explore research compounds backed by lot-level documentation. A
            clear starting point for your next discovery.
          </p>
          <a href="#collection" className="hero-scroll">
            Explore the collection <ArrowDown size={16} />
          </a>
        </div>
        <div className="catalog-hero-image">
          <img
            src="/images/hero-still-life.png"
            alt="TrueMark Biolabs ivory packaging and research vials"
          />
          <div className="hero-image-badge">
            <FileCheck2 size={18} />
            <span>Every lot has a record.</span>
          </div>
        </div>
      </section>
      <div className="page-width">
        <TrustStrip />
      </div>
      <section className="collection page-width" id="collection">
        <div className="collection-title">
          <div>
            <h2>
              Research compounds<span>24</span>
            </h2>
            <p>Find the right material. Know exactly where it starts.</p>
          </div>
          <button
            className={`filter-toggle ${showFilters ? "selected" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls="catalog-filters"
          >
            <SlidersHorizontal size={16} />
            Search & sort
            <ChevronDown size={14} />
          </button>
        </div>
        <div className="category-list" aria-label="Filter by compound class">
          {categories.map((category) => (
            <button
              key={category.id}
              className={activeCategory === category.id ? "active" : ""}
              onClick={() => update("class", category.id)}
              aria-pressed={activeCategory === category.id}
            >
              {category.short}
              <span>
                {category.id === "all"
                  ? products.length
                  : products.filter((p) => p.category === category.id).length}
              </span>
            </button>
          ))}
        </div>
        {(showFilters || query || sort !== "curated") && (
          <div className="catalog-filters" id="catalog-filters">
            <label className="catalog-search">
              <Search size={18} />
              <input
                type="search"
                value={query}
                onChange={(e) => update("q", e.target.value)}
                placeholder="Search compounds"
                aria-label="Search compounds in collection"
              />
            </label>
            <label className="sort-label">
              Sort by
              <select
                value={sort}
                onChange={(e) => update("sort", e.target.value)}
              >
                <option value="curated">Collection order</option>
                <option value="az">Name: A to Z</option>
                <option value="za">Name: Z to A</option>
              </select>
            </label>
            {(query || activeCategory !== "all" || sort !== "curated") && (
              <button className="text-button" onClick={() => setParams({})}>
                Reset filters <X size={14} />
              </button>
            )}
          </div>
        )}
        <div className="collection-status" aria-live="polite">
          <span>
            {filtered.length} {filtered.length === 1 ? "compound" : "compounds"}
            {activeCategory !== "all" &&
              ` in ${categoryName(activeCategory).toLowerCase()}`}
          </span>
          <span>FOR LABORATORY RESEARCH</span>
        </div>
        {filtered.length ? (
          <div className="product-grid">
            {filtered.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Search size={32} strokeWidth={1} />
            <h3>A fresh search might help.</h3>
            <p>No compounds match the current filters.</p>
            <button
              className="button button-dark"
              onClick={() => setParams({})}
            >
              View all compounds <ArrowRight size={17} />
            </button>
          </div>
        )}
        <div className="collection-end">
          <span />
          <p>Considered from source to shipment.</p>
          <span />
        </div>
        <VerificationBanner />
      </section>
    </>
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
        <span className="article-wordmark">TrueMark</span>
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

function ProductPage() {
  const { id } = useParams();
  const product = products.find((p) => p.id === id);
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState("Overview");
  const { add } = useShop();
  useEffect(() => {
    setQuantity(1);
    setTab("Overview");
  }, [id]);
  if (!product) return <NotFound />;
  const siblings = products.filter((p) => p.name === product.name);
  const related = products
    .filter((p) => p.id !== product.id && p.category === product.category)
    .slice(0, 4);
  const isSupply = product.category === "lab-supplies";
  return (
    <div className="page-width product-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/products">Compounds</Link>
        <ChevronRight size={12} />
        <Link to={`/products?class=${product.category}`}>
          {categoryName(product.category)}
        </Link>
        <ChevronRight size={12} />
        <span>{product.name}</span>
      </nav>
      <section className="product-detail">
        <div className="detail-image">
          <span className="detail-image-label">
            THE RESEARCH COLLECTION /{" "}
            {String(products.indexOf(product) + 1).padStart(2, "0")}
          </span>
          <img
            src="/images/research-vial.png"
            alt={`TrueMark packaging concept for ${product.name}`}
          />
          <span className="detail-image-footer">
            A clear line from source to certificate.
          </span>
        </div>
        <div className="detail-copy">
          <Eyebrow>{categoryName(product.category)}</Eyebrow>
          <h1>{product.name}</h1>
          <div className="detail-subtitle">
            <span>{product.size}</span>
            <span>{isSupply ? "Laboratory supply" : "Clear liquid"}</span>
          </div>
          <p className="detail-intro">
            {isSupply
              ? "A considered addition to your laboratory workflow. Review the applicable documentation before use."
              : `${product.name}, supplied for laboratory research with lot-level traceability. Review the specifications and the documentation for your lot before beginning your work.`}
          </p>
          <div className="detail-assurances">
            <span>
              <FileCheck2 size={17} />
              Lot documented
            </span>
            <span>
              <FlaskConical size={17} />
              Research use only
            </span>
          </div>
          <div className="variant-label">
            Presentation <span>Choose a size</span>
          </div>
          <div className="variant-options">
            {siblings.map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                aria-current={p.id === product.id ? "page" : undefined}
                className={p.id === product.id ? "active" : ""}
              >
                {p.size}
              </Link>
            ))}
          </div>
          <div className="purchase-block">
            {product.price !== undefined ? (
              <>
                <div className="detail-price">
                  {money(product.price)}
                  <span>per vial</span>
                </div>
                <div className="purchase-row">
                  <Quantity
                    value={quantity}
                    onChange={setQuantity}
                    label="Product quantity"
                  />
                  <button
                    className="button button-dark"
                    onClick={() => add(product.id, quantity)}
                  >
                    Add to bag <Plus size={18} />
                  </button>
                </div>
                <p className="purchase-footnote">
                  Prototype selection · no payment is collected.
                </p>
              </>
            ) : (
              <>
                <p className="inquiry-price">
                  Availability & pricing on request
                </p>
                <Link
                  className="button button-dark full-width"
                  to={`/contact?compound=${encodeURIComponent(`${product.name} ${product.size}`)}`}
                >
                  Inquire about this compound <ArrowUpRight size={18} />
                </Link>
              </>
            )}
          </div>
          <Link
            className="detail-verify"
            to={
              product.id === "bpc-157-10-mg"
                ? "/verify?lot=BP10-2611A"
                : "/verify"
            }
          >
            <FileText size={26} strokeWidth={1.2} />
            <span>
              <strong>Know your lot.</strong>
              <small>Find its Certificate of Analysis.</small>
            </span>
            <ArrowUpRight size={20} />
          </Link>
        </div>
      </section>
      <section className="product-information">
        <div
          className="information-tabs"
          role="tablist"
          aria-label="Product information"
        >
          {["Overview", "Specifications", "Handling & documentation"].map(
            (name) => (
              <button
                key={name}
                id={`tab-${name.split(" ")[0].toLowerCase()}`}
                aria-controls="product-information-panel"
                role="tab"
                aria-selected={tab === name}
                tabIndex={tab === name ? 0 : -1}
                onClick={() => setTab(name)}
                onKeyDown={(event) => {
                  const tabs = [
                    "Overview",
                    "Specifications",
                    "Handling & documentation",
                  ];
                  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                    event.preventDefault();
                    const next =
                      tabs[
                        (tabs.indexOf(tab) +
                          (event.key === "ArrowRight" ? 1 : 2)) %
                          3
                      ];
                    setTab(next);
                    document
                      .getElementById(`tab-${next.split(" ")[0].toLowerCase()}`)
                      ?.focus();
                  }
                }}
              >
                {name}
              </button>
            ),
          )}
        </div>
        <div
          className="information-content"
          role="tabpanel"
          id="product-information-panel"
          aria-labelledby={`tab-${tab.split(" ")[0].toLowerCase()}`}
        >
          {tab === "Overview" && (
            <>
              <h2>
                A defined material.
                <br />A documented starting point.
              </h2>
              <div>
                <p>
                  This {isSupply ? "laboratory supply" : "research compound"}{" "}
                  belongs to our {categoryName(product.category).toLowerCase()}{" "}
                  collection. Each product is identified by its compound,
                  presentation, and applicable lot record.
                </p>
                <p>
                  Intended exclusively for qualified laboratory research. Not
                  for human or veterinary use. Consult the product-specific
                  documentation and your institution’s procedures.
                </p>
              </div>
            </>
          )}
          {tab === "Specifications" && (
            <>
              <h2>
                The essentials,
                <br />
                at a glance.
              </h2>
              <dl className="spec-table">
                {[
                  ["Compound", product.name],
                  ["Compound class", categoryName(product.category)],
                  ["Presentation", product.size],
                  [
                    "Form",
                    isSupply ? "Laboratory reagent" : "Clear liquid",
                  ],
                  ["Intended use", "Laboratory research only"],
                  ["Documentation", "Lot-specific Certificate of Analysis"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          {tab === "Handling & documentation" && (
            <>
              <h2>
                Care continues
                <br />
                after arrival.
              </h2>
              <div>
                <p>
                  Match the received label to your order and retain its lot
                  identifier. Review the applicable storage documentation and
                  follow your institution’s standard operating procedures.
                </p>
                <Link className="understated-link" to="/handling">
                  Handling & receiving <ArrowUpRight size={16} />
                </Link>
                <Link className="understated-link" to="/quality">
                  Read our quality standard <ArrowUpRight size={16} />
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
      {related.length > 0 && (
        <section className="section">
          <div className="section-heading">
            <div>
              <Eyebrow>CONTINUE EXPLORING</Eyebrow>
              <h2>Within the same class.</h2>
            </div>
            <Link
              className="understated-link"
              to={`/products?class=${product.category}`}
            >
              View the class <ArrowRight size={17} />
            </Link>
          </div>
          <div className="product-grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
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

function Verify() {
  const [params, setParams] = useSearchParams();
  const [lot, setLot] = useState(params.get("lot") ?? "");
  const submitted = params.get("lot") ?? "";
  const found = submitted.toUpperCase() === "BP10-2611A";
  useEffect(() => setLot(submitted), [submitted]);
  function lookup(event?: FormEvent) {
    event?.preventDefault();
    if (lot.trim())
      setParams(
        { lot: lot.trim().toUpperCase() },
        { preventScrollReset: true },
      );
  }
  return (
    <>
      <section className="verify-intro page-width">
        <Eyebrow>LOT VERIFICATION</Eyebrow>
        <h1>
          Trust the process.
          <br />
          <span>Read the record.</span>
        </h1>
        <p>
          One identifier connects your compound to its testing documentation.
          <br className="desktop-break" /> Enter the lot number printed on your
          vial.
        </p>
        <form className="lot-form" onSubmit={lookup}>
          <FileCheck2 size={22} strokeWidth={1.5} />
          <label className="sr-only" htmlFor="lot-number">
            Lot number
          </label>
          <input
            id="lot-number"
            required
            maxLength={40}
            autoComplete="off"
            placeholder="Enter a lot number"
            value={lot}
            onChange={(e) => setLot(e.target.value)}
          />
          <button type="submit">
            Find my record <ArrowRight size={17} />
          </button>
        </form>
        <div className="sample-lot">
          Explore an illustrative record{" "}
          <button
            onClick={() => {
              setLot("BP10-2611A");
              setParams({ lot: "BP10-2611A" }, { preventScrollReset: true });
            }}
          >
            BP10-2611A <ArrowUpRight size={13} />
          </button>
        </div>
      </section>
      <section className="verify-results page-width" aria-live="polite">
        {!submitted && (
          <div className="verify-empty">
            <div className="document-symbol">
              <FileText size={42} strokeWidth={1} />
            </div>
            <h2>Every lot has a story.</h2>
            <p>
              Your record will appear here, with the compound,
              <br />
              testing methods, and reported results together.
            </p>
            <span>NO ACCOUNT NEEDED TO EXPLORE</span>
          </div>
        )}
        {submitted && !found && (
          <div className="verify-empty">
            <Search size={34} strokeWidth={1} />
            <h2>No sample record found.</h2>
            <p>
              “{submitted}” is not included in this prototype.
              <br />
              Check the lot number or explore the sample below.
            </p>
            <button
              className="button button-dark"
              onClick={() => {
                setLot("BP10-2611A");
                setParams({ lot: "BP10-2611A" }, { preventScrollReset: true });
              }}
            >
              View sample record <ArrowRight size={16} />
            </button>
          </div>
        )}
        {found && (
          <div className="certificate">
            <div className="certificate-topline">
              <span>TRUEMARK / LOT RECORD</span>
              <span className="sample-record-tag">ILLUSTRATIVE RECORD</span>
            </div>
            <div className="certificate-heading">
              <div>
                <Eyebrow>CERTIFICATE OF ANALYSIS</Eyebrow>
                <h2>
                  BPC-157<span>10 mg</span>
                </h2>
                <p>Lot BP10-2611A</p>
              </div>
              <div className="certificate-seal">
                <ShieldCheck size={31} strokeWidth={1} />
                <span>RELEASE STATUS</span>
                <strong>Approved</strong>
              </div>
            </div>
            <div className="certificate-metrics">
              <div>
                <span>HPLC PURITY</span>
                <strong>
                  99.31<small>%</small>
                </strong>
              </div>
              <div>
                <span>IDENTITY · MS</span>
                <strong>Confirmed</strong>
              </div>
              <div>
                <span>ENDOTOXIN</span>
                <strong>
                  &lt; 0.25<small> EU/mg</small>
                </strong>
              </div>
              <div>
                <span>STERILITY</span>
                <strong>Pass</strong>
              </div>
            </div>
            <div className="certificate-details">
              <div>
                <span>Compound</span>
                <strong>BPC-157</strong>
              </div>
              <div>
                <span>Presentation</span>
                <strong>10 mg · clear liquid</strong>
              </div>
              <div>
                <span>Record reference</span>
                <strong>TM-COA-0114</strong>
              </div>
              <div>
                <span>Laboratory</span>
                <strong>To be supplied by client</strong>
              </div>
            </div>
            <div className="certificate-bottom">
              <p>
                Sample values from the client’s original mockup.
                <br />
                This is a design preview, not a laboratory release document.
              </p>
              <Link className="understated-link" to="/product/bpc-157-10-mg">
                View compound <ArrowUpRight size={17} />
              </Link>
            </div>
          </div>
        )}
      </section>
      <section className="section page-width">
        <div className="section-heading">
          <div>
            <Eyebrow>FROM VIAL TO VERIFICATION</Eyebrow>
            <h2>Clarity, in three steps.</h2>
          </div>
        </div>
        <div className="three-steps">
          {[
            [
              "Find the number.",
              "Look for the lot identifier on the vial label. It connects your material to a specific record.",
            ],
            [
              "Look up the lot.",
              "Enter the number above to locate its Certificate of Analysis and supporting information.",
            ],
            [
              "Keep the record.",
              "Match the details to your vial and retain the applicable certificate with your laboratory records.",
            ],
          ].map(([title, text], i) => (
            <div key={title}>
              <span>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="page-width reading-cta">
        <FileText size={32} strokeWidth={1} />
        <div>
          <h3>A first look at a CoA?</h3>
          <p>
            Understand the identifiers, methods, and results behind the record.
          </p>
        </div>
        <Link
          className="understated-link"
          to="/research-blog/reading-a-certificate"
        >
          Read the guide <ArrowRight size={18} />
        </Link>
      </section>
    </>
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

function Quality() {
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
            src="/images/hero-still-life.png"
            alt="TrueMark packaging and research vials"
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

function Handling() {
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
          <a href="#receiving">01 · Receiving your material</a>
          <a href="#storage">02 · Storage & documentation</a>
          <a href="#records">03 · Keeping a clear record</a>
          <a href="#questions">04 · Questions about a shipment</a>
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

function About() {
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
          src="/images/hero-still-life.png"
          alt="The proposed TrueMark research collection in warm natural light"
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

function Journal() {
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

function Article() {
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
        <span>{article.time} · TrueMark Biolabs</span>
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

function Contact() {
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

function Access() {
  const [mode, setMode] = useState("Sign in");
  const [complete, setComplete] = useState(false);
  return (
    <section className="access-page page-width">
      <div className="access-image">
        <img
          src="/images/hero-still-life.png"
          alt="TrueMark research packaging"
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

function CartContent({ page = false }: { page?: boolean }) {
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
                      src="/images/research-vial.png"
                      alt={`${p.name} packaging concept`}
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

function CartPage() {
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

function NotFound() {
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

function RouteEffects() {
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    const title = location.pathname.startsWith("/product/")
      ? (products.find((p) => location.pathname.endsWith(p.id))?.name ??
        "Research compound")
      : ({
          "/": "Research, with a record.",
          "/products": "Research compounds",
          "/verify": "Lot verification",
          "/quality": "Our standard",
          "/handling": "Handling & receiving",
          "/about": "About",
          "/research-blog": "Research journal",
          "/contact": "Contact",
          "/access": "Research account",
          "/cart": "Your bag",
        }[location.pathname] ?? "Field notes");
    document.title = `${title} — TrueMark Biolabs`;
    if (location.pathname !== previousPath.current) {
      window.scrollTo({ top: 0, behavior: "instant" });
      previousPath.current = location.pathname;
    }
  }, [location]);
  return null;
}

export default function App() {
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    try {
      localStorage.setItem("truemark-preview-cart", JSON.stringify(cart));
    } catch {
      /* Selection remains usable if browser storage is unavailable. */
    }
  }, [cart]);
  useEffect(() => {
    setCartOpen(false);
  }, [location.pathname]);
  function add(id: string, quantity: number) {
    setCart((current) => {
      const existing = current.find((item) => item.id === id);
      return existing
        ? current.map((item) =>
            item.id === id
              ? { ...item, quantity: Math.min(99, item.quantity + quantity) }
              : item,
          )
        : [...current, { id, quantity }];
    });
    setCartOpen(true);
  }
  function change(id: string, quantity: number) {
    setCart((current) =>
      quantity <= 0
        ? current.filter((item) => item.id !== id)
        : current.map((item) =>
            item.id === id
              ? { ...item, quantity: Math.min(99, quantity) }
              : item,
          ),
    );
  }
  return (
    <AppContext.Provider
      value={{
        cart,
        add,
        change,
        openCart: () => setCartOpen(true),
        closeCart: () => setCartOpen(false),
      }}
    >
      <RouteEffects />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Catalog />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/quality" element={<Quality />} />
          <Route path="/handling" element={<Handling />} />
          <Route path="/about" element={<About />} />
          <Route path="/research-blog" element={<Journal />} />
          <Route path="/research-blog/:id" element={<Article />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/access" element={<Access />} />
          <Route path="/my-account" element={<Access />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      {cartOpen && (
        <Modal title="Your bag" onClose={() => setCartOpen(false)} side>
          <CartContent />
        </Modal>
      )}
    </AppContext.Provider>
  );
}
