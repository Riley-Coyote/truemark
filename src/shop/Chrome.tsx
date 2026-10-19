import { live } from "../platform/live/runtime";
import { useResource } from "../platform/store";
import { LIVE, LOCAL } from "../platform/mode";
import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Search, X } from "lucide-react";
import "@fontsource/poppins/300.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import { BrandLogo } from "../BrandLogo";
import { readyPage } from "../Navigation";
import { HEADER_FOLLOWS_LIGHT } from "../brand/dusk";
import { categoryName, products, business } from "../data";
import { productCutout } from "./catalog";
import { matchesProductSearch } from "./search";
import { useShop } from "./context";
import { Modal } from "./Modal";
import { usePresence } from "./motion";
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
  const navigate = useNavigate();
  const searchInput = useRef<HTMLInputElement>(null);
  const { cart, openCart } = useShop();
  const menuId = useId();
  const header = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  // A change of address puts the menu and search away in the same step, so neither is drawn open on the page arriving.
  const address = location.pathname + location.search;
  const [shownAt, setShownAt] = useState(address);
  const moved = shownAt !== address;
  if (moved) {
    setShownAt(address);
    setMenuOpen(false);
    setSearchOpen(false);
  }
  // The menu leaves the way it dropped (chrome.css). What was tapped in it stays lit as it goes, so the tap is seen to
  // have taken while the next page readies itself. Still open when the page changes (the logo tapped beside it), it is
  // closed in that very render, so a glide takes it with the page it was on rather than drawing it leaving on the next.
  const menu = usePresence<HTMLDivElement>(menuOpen && !moved, location.pathname);
  const [chosen, setChosen] = useState<string | null>(null);
  const choose = (item: string) => {
    setChosen(item);
    setMenuOpen(false);
  };
  // The menu's pages are a tap away once it is open: their code is asked for now, so the one tapped glides in whole.
  useEffect(() => {
    if (menuOpen) for (const item of primaryNav) void readyPage(item.to);
  }, [menuOpen]);
  useEffect(() => {
    if (searchOpen) void readyPage("/products");
  }, [searchOpen]);
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
  const results = products.filter(product => matchesProductSearch(product, query));
  const matches = results.slice(0, 6);
  const catalogSearch = query.trim() ? `/products?q=${encodeURIComponent(query.trim())}` : "/products";
  const clearSearch = () => { setQuery(""); searchInput.current?.focus(); };
  return (
    <>
      <div className="tm-notice">
        <div className="tm-notice-inner">
          <p>Research use only · Not for human consumption</p>
        </div>
      </div>
      {menu.shown && (
        <div className="tm-mmenu-scrim" data-state={menu.closing ? "closing" : undefined} inert={menu.closing} aria-hidden="true" onClick={() => setMenuOpen(false)} />
      )}
      <header className="tm-header" ref={header}>
        <div className="tm-header-inner">
          <Link className="tm-logo" to="/" aria-label="TrueMark BioLabs home">
            <BrandLogo />
            {/* By night, on the home page, the client's white lockup (chrome.css). */}
            {HEADER_FOLLOWS_LIGHT && <span className="tm-logo-night" aria-hidden="true"><BrandLogo variant="white" /></span>}
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
              onClick={() => {
                setChosen(null);
                setMenuOpen((open) => !open);
              }}
            >
              <span className="tm-menu-mark" aria-hidden="true"><span /><span /><span /></span>
            </button>
          </div>
        </div>
        {menu.shown && (
          <div id={menuId} ref={menu.exit} className="tm-mmenu" data-state={menu.closing ? "closing" : undefined} inert={menu.closing}>
            <nav className="tm-mobile-nav" aria-label="Menu">
              {primaryNav.map((item) => (
                // Closed as it is tapped: the menu lifts away while the next page readies; on a phone, a page that is
                // ready at once glides in over the menu as the tap left it.
                <NavLink key={item.to} to={locked && item.to === "/products" ? "/access" : item.to} state={locked && item.to === "/products" ? { from: "/products" } : undefined} data-chosen={chosen === item.to || undefined} onClick={() => choose(item.to)}>
                  {item.label}
                  <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
                </NavLink>
              ))}
            </nav>
            <div className="tm-mmenu-foot">
              {!locked && <button
                type="button"
                className="tm-mmenu-tool"
                data-chosen={chosen === "search" || undefined}
                onClick={() => {
                  // Search outlives this menu. Give it a stable place to return focus.
                  menuButton.current?.focus({ preventScroll: true });
                  choose("search");
                  setSearchOpen(true);
                }}
              >
                <Search size={16} strokeWidth={1.6} aria-hidden="true" />
                Search
              </button>}
              <Link className="tm-mmenu-tool" to="/account" data-chosen={chosen === "account" || undefined} onClick={() => choose("account")}>
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
      {!locked && (
        <Modal open={searchOpen} title="Find a compound" onClose={() => setSearchOpen(false)} field="always">
          <form className="search-input-wrap" role="search" onSubmit={(event) => {
            event.preventDefault();
            setSearchOpen(false);
            navigate(catalogSearch);
          }}>
            <Search size={20} strokeWidth={1.6} aria-hidden="true" />
            <input
              ref={searchInput}
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
            {query && <button type="button" className="tm-search-clear" aria-label="Clear search" onClick={clearSearch}><X size={18} strokeWidth={1.6} aria-hidden="true" /></button>}
            <button type="submit" className="tm-search-submit" aria-label="Search all compounds"><ArrowRight size={20} strokeWidth={1.6} aria-hidden="true" /></button>
          </form>
          <p className="tm-search-summary" role="status" aria-atomic="true">
            {results.length} {results.length === 1 ? "result" : "results"}{results.length > matches.length ? ` · Showing ${matches.length}` : ""}
          </p>
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
                <button type="button" className="text-button" onClick={clearSearch}>
                  Clear the search
                </button>
              </div>
            )}
          </div>
          <Link className="tm-search-all" to={results.length ? catalogSearch : "/products"} onClick={() => setSearchOpen(false)}>
            {query.trim() && results.length ? "View all results" : "Browse all compounds"}<ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
          </Link>
        </Modal>
      )}
    </>
  );
}

/** The client's footer, column for column; its policy pages stand in the footer's last row (footerPolicies). */
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
    ],
  },
];

/** The client's policy pages, in a row beside the copyright line. */
const footerPolicies = [
  ["Terms", "/terms"],
  ["Privacy", "/privacy-policy"],
  ["Returns Policy", "/refund_returns"],
  ["Shipping Policy", "/shipping-policy"],
] as const;

export function Footer() {
  return (
    <footer className="tm-footer">
      <div className="tm-footer-inner">
        <div className="tm-footer-lead">
          <Link className="tm-logo" to="/" aria-label="TrueMark BioLabs home">
            <BrandLogo />
            {/* By night, on the home page, the client's white lockup (chrome.css). */}
            {HEADER_FOLLOWS_LIGHT && <span className="tm-logo-night" aria-hidden="true"><BrandLogo variant="white" /></span>}
          </Link>
          <p className="tm-footer-line">
            Research peptides supplied for laboratory use,
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
            <strong>Research use only.</strong> All products supplied by TrueMark BioLabs are
            intended solely for laboratory research applications. They are{" "}
            <strong>not for human or veterinary use</strong> and are not intended to diagnose, treat,
            cure, or prevent any disease. No product listed here has been
            approved by the FDA for any therapeutic purpose. Nothing on this site
            constitutes medical advice. Purchasers are responsible for ensuring
            compliance with all applicable laws and regulations in their
            jurisdiction, and for the safe handling, storage, and disposal of
            these materials.
          </p>
          <address className="tm-footer-address">
            <span>{business.legalName} DBA {business.tradeName}</span>
            {/* Each address line stays whole; a narrow footer wraps only between them. */}
            <span>Mailing address: {business.mailingAddress.map((line) => line.replace(/ /g, "\u00a0")).join(", ")}</span>
          </address>
        </div>
        <div className="tm-footer-base">
          <p className="tm-footer-copy">
            <span>© 2026 TrueMark BioLabs</span> <span>Research use only · Not for human consumption</span>
          </p>
          <nav className="tm-footer-policies" aria-label="Policies">
            {footerPolicies.map(([label, to]) => (
              <Link key={label} to={to}>
                {label}
              </Link>
            ))}
          </nav>
          {(!LIVE || LOCAL) && <span className="tm-preview-tag">{LOCAL ? "Local simulation · sample data" : "Design preview · sample data"}</span>}
        </div>
      </div>
    </footer>
  );
}
