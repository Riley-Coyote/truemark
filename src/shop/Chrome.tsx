import { live } from "../platform/live/runtime";
import { useResource } from "../platform/store";
import { LIVE } from "../platform/mode";
import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Menu, Search, X } from "lucide-react";
import "@fontsource/poppins/300.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import { BrandLogo } from "../BrandLogo";
import { categoryName, products } from "../data";
import { productCutout } from "./catalog";
import { useShop } from "./context";
import { Modal } from "./Modal";
import { FirstOrderOffer } from "./FirstOrderOffer";
import { MobileAdd } from "./MobileAdd";
import { AskButton, StorefrontAssistant } from "../assistant/Assistant";
import "./tokens.css";
import "./chrome.css";
import "./shop.css";
import "./pages.css";
import "../brand/brand.css";

/** The client's own navigation, in their order. */
const primaryNav = [
  { label: "Products", to: "/products" },
  { label: "Verify", to: "/verify" },
  { label: "Quality", to: "/quality" },
  { label: "Handling", to: "/handling" },
  { label: "About", to: "/about" },
  { label: "Research Blog", to: "/research-blog" },
  { label: "Contact", to: "/contact" },
];

export function Header() {
  const session = useResource(() => LIVE ? live().auth.hasSession() : Promise.resolve(true), []);
  const locked = LIVE && !session.data;
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const location = useLocation();
  const { cart, openCart } = useShop();
  const menuId = useId();
  const header = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);
  // The phone menu drops from the header, as the command center's does: Escape or a tap
  // anywhere outside the header closes it, and Escape hands focus back to the button.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    }
    function onPointer(event: PointerEvent) {
      // The scrim closes the menu on its own click, so the tap that dismisses never lands on the page.
      if (event.target instanceof Element && event.target.closest(".tm-mmenu-scrim")) return;
      if (header.current && event.target instanceof Node && !header.current.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const matches = products.filter((product) => product.active !== false)
    .filter((p) =>
      `${p.name} ${p.size} ${categoryName(p.category)}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .slice(0, 6);
  return (
    <>
      <div className="tm-notice">
        <div className="tm-notice-inner">
          <p>Research use only · Not for human consumption</p>
        </div>
      </div>
      {menuOpen && <div className="tm-mmenu-scrim" aria-hidden="true" onClick={() => setMenuOpen(false)} />}
      <header className="tm-header" ref={header}>
        <div className="tm-header-inner">
          <Link className="tm-logo" to="/" aria-label="TrueMark BioLabs home">
            <BrandLogo />
          </Link>
          <nav className="tm-nav" aria-label="Main navigation">
            {primaryNav.map((item) => (
              <NavLink key={item.to} to={locked && item.to === "/products" ? "/access" : item.to} state={locked && item.to === "/products" ? { from: "/products" } : undefined}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="tm-tools">
            {!locked && <button className="tm-textool tm-hide-small" onClick={() => setSearchOpen(true)}>
              Search
            </button>}
            <Link className="tm-textool tm-hide-small" to="/account">
              Account
            </Link>
            <AskButton />
            {!locked && <button
              className="tm-textool"
              data-cart-target
              aria-label={`Open cart, ${count} ${count === 1 ? "item" : "items"}`}
              onClick={openCart}
            >
              Cart ({count})
            </button>}
            <button
              ref={menuButton}
              type="button"
              className="tm-icon tm-menu-trigger"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={20} strokeWidth={1.6} aria-hidden="true" /> : <Menu size={20} strokeWidth={1.6} aria-hidden="true" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div id={menuId} className="tm-mmenu">
            <nav className="tm-mobile-nav" aria-label="Menu">
              {primaryNav.map((item) => (
                // Closed as it is tapped, so the menu is gone before the next page glides in.
                <NavLink key={item.to} to={locked && item.to === "/products" ? "/access" : item.to} state={locked && item.to === "/products" ? { from: "/products" } : undefined} onClick={() => setMenuOpen(false)}>
                  {item.label}
                  <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
                </NavLink>
              ))}
            </nav>
            <div className="tm-mmenu-foot">
              {!locked && <button
                type="button"
                className="tm-mmenu-tool"
                onClick={() => {
                  setMenuOpen(false);
                  setSearchOpen(true);
                }}
              >
                <Search size={16} strokeWidth={1.6} aria-hidden="true" />
                Search
              </button>}
              <Link className="tm-mmenu-tool" to="/account" onClick={() => setMenuOpen(false)}>
                Research account
              </Link>
            </div>
            <p className="tm-mobile-note">For laboratory research use only.</p>
          </div>
        )}
      </header>
      <MobileAdd />
      <StorefrontAssistant />
      <FirstOrderOffer locked={locked} />
      {!locked && searchOpen && (
        <Modal title="Find a compound" onClose={() => setSearchOpen(false)} field="always">
          <div className="search-input-wrap">
            <Search size={20} strokeWidth={1.6} />
            <input
              type="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="search"
              aria-label="Search the catalog"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by compound or class"
            />
          </div>
          <div className="search-results">
            {matches.map((product) => (
              <Link key={product.id} to={`/product/${product.id}`} onClick={() => setSearchOpen(false)}>
                <span className="tm-search-thumb" aria-hidden="true">
                  <img src={productCutout(product, "sm")} alt="" />
                </span>
                <div>
                  <strong>{product.name}</strong>
                  <span>
                    {product.size} · {categoryName(product.category)}
                  </span>
                </div>
                <ArrowUpRight size={18} strokeWidth={1.5} />
              </Link>
            ))}
            {!matches.length && (
              <div className="empty-inline">
                <p>No compounds match “{query}”.</p>
                <button className="text-button" onClick={() => setQuery("")}>
                  Clear the search
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

/** The client's footer, column for column. */
const footerColumns = [
  {
    title: "Catalog",
    links: [
      ["All compounds", "/products"],
      ["Peptide fragments", "/products?class=peptide-fragments"],
      ["Neuropeptides", "/products?class=neuropeptides"],
      ["Lab supplies", "/products?class=lab-supplies"],
    ],
  },
  {
    title: "Verification",
    links: [
      ["Lot lookup", "/verify"],
      ["Testing standards", "/quality#specification"],
      ["Reading a CoA", "/research-blog/how-to-read-a-certificate-of-analysis"],
    ],
  },
  {
    title: "Handling",
    links: [
      ["Storage", "/handling#storage"],
      ["Shipping and cold chain", "/handling#shipping"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Quality", "/quality"],
      ["Contact", "/contact"],
      ["Terms", "/terms"],
      ["Privacy", "/privacy-policy"],
      ["Returns Policy", "/refund_returns"],
      ["Shipping Policy", "/shipping-policy"],
    ],
  },
];

export function Footer() {
  return (
    <footer className="tm-footer">
      <div className="tm-footer-inner">
        <div className="tm-footer-lead">
          <Link className="tm-logo" to="/" aria-label="TrueMark BioLabs home">
            <BrandLogo />
          </Link>
          <p className="tm-footer-line">
            Research compounds supplied for laboratory use,
            <br />
            <span>with lot-level traceability.</span>
          </p>
        </div>
        {footerColumns.map((column) => (
          <nav className="tm-footer-column" key={column.title} aria-label={column.title}>
            <p className="tm-footer-title">{column.title}</p>
            {column.links.map(([label, to]) => (
              <Link key={label} to={to}>
                {label}
              </Link>
            ))}
          </nav>
        ))}
        <div className="tm-footer-legal">
          <p>
            Research use only. All products supplied by TrueMark BioLabs are
            intended solely for laboratory research applications. They are not
            for human or veterinary use and are not intended to diagnose, treat,
            cure, or prevent any disease. No product listed here has been
            approved by the FDA for any therapeutic purpose. Nothing on this site
            constitutes medical advice. Purchasers are responsible for ensuring
            compliance with all applicable laws and regulations in their
            jurisdiction, and for the safe handling, storage, and disposal of
            these materials.
          </p>
          <div className="tm-footer-meta">
            <span>© 2026 TrueMark BioLabs · Research use only · Not for human consumption</span>
            {!LIVE && <span className="tm-preview-tag">Design preview · sample data</span>}
          </div>
        </div>
      </div>
    </footer>
  );
}
