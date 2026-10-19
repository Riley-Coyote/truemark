import { live } from "./platform/live/runtime";
import { catalogAccess, catalogReloadNeeded, rememberLink } from "./platform/live/bootstrap";
import { LIVE } from "./platform/mode";
import { store, useResource } from "./platform/store";
import { setCategories } from "./data";
import { refreshCatalog } from "./shop/catalog";
import { stockProblem } from "./platform/commerce";
import { Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { products } from "./data";
import { SectionLink } from "./SectionLink";
import "./brand-refinement.css";
import { Footer, Header } from "./shop/Chrome";
import { CART_STORAGE_KEY, ShopContext, loadCart, rememberReferral } from "./shop/context";
import type { CartItem } from "./shop/context";
import Home from "./shop/Home";
import { Modal } from "./shop/Modal";
import { BagContents, CartPage } from "./shop/pages/checkout/Bag";
// Every page but the opening arrives with its route (pages.tsx).
import { About, Account, Apply, Article, Catalog, Checkout, Confirmation, Contact, Handling, Journal, NotFound, Pay, Policy, ProductPage, Quality, Track, Verify } from "./pages";
import { policies, policyByPath } from "./brand/policies";
import { FlightViews } from "./brand/FlightViews";
import { PageBoundary } from "./PageBoundary";

function RouteEffects() {
  const location = useLocation();
  useEffect(() => {
    // A product page names its size too: the four Retatrutide pages are four pages.
    const product = location.pathname.startsWith("/product/")
      ? products.find((p) => p.id === decodeURIComponent(location.pathname.slice("/product/".length)))
      : undefined;
    const title = location.pathname.startsWith("/product/")
      ? (product ? `${product.name} ${product.size}` : "Research peptide")
      : ({
          "/": "Research peptides. Third-party tested.",
          "/products": "Research peptides",
          "/verify": "Lot verification",
          "/quality": "Quality",
          "/handling": "Handling",
          "/about": "About",
          "/research-blog": "Research Blog",
          "/contact": "Contact",
          "/cart": "Your cart",
          "/checkout": "Checkout",
          "/track": "Track an order",
          "/account": "Research account",
        }[location.pathname] ?? policyByPath(location.pathname)?.title);
    // Pages that name themselves (articles, account sections, not found) set their own titles.
    document.title = title ? `${title} — TrueMark BioLabs` : "TrueMark BioLabs";
    const referral = new URLSearchParams(location.search).get("ref");
    if (referral) rememberReferral(referral);
  }, [location]);
  return null;
}

/** The shop that needs an account: the catalog, the cart, checkout and the account. A product page is open to anyone, so
 *  the landing's vials carry every visitor in; signed out, it asks for an account where the price and Add to cart stand. */
export const gatedShopPath = (path: string) => ["/products", "/cart", "/checkout", "/account"].some((prefix) => path.startsWith(prefix));
export function shopAccess(path: string, loading: boolean, signedIn: boolean) {
  return loading ? "wait" : gatedShopPath(path) && !signedIn ? "redirect" : "render";
}

export default function App() {
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();
  // A change of page puts the bag away in the same step, so it is never drawn open on the page arriving (Modal.tsx).
  const [cartPage, setCartPage] = useState(location.pathname);
  if (cartPage !== location.pathname) {
    setCartPage(location.pathname);
    setCartOpen(false);
  }
  const session = useResource(() => LIVE ? live().auth.hasSession() : Promise.resolve(true), []);
  useEffect(() => {
    if (!LIVE) return;
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref) void rememberLink(ref).catch(() => { /* Referral capture does not block sign-in. */ });
  }, [location.search]);
  const gated = LIVE && gatedShopPath(location.pathname);
  // Pages that show prices to a signed-in visitor: once they sign in, the catalog loaded without prices is replaced.
  const priced = gated || (LIVE && location.pathname.startsWith("/product/"));
  // The opening's haze under the page's first paint (vite.config.ts startHead) belongs to the opening alone, which puts
  // it away itself once its room is drawn (MistOpening.tsx): any other page, a sign-in the opening sends to included,
  // puts it away at once.
  useEffect(() => {
    if (location.pathname !== "/") document.documentElement.removeAttribute("data-tm-dawn");
  }, [location.pathname]);
  useEffect(() => {
    if (!LIVE || session.loading) return;
    if (catalogReloadNeeded(catalogAccess(), Boolean(session.data), priced, sessionStorage)) window.location.reload();
  }, [priced, session.loading, session.data]);
  const catalog = useResource(async () => {
    if (!LIVE) return;
    const [current, classes] = await Promise.all([await live().auth.hasSession() ? store.catalog.products() : live().showcase(), store.catalog.categories()]);
    const retired = products.filter((old) => !current.some((product) => product.id === old.id)).map((product) => ({ ...product, active: false }));
    products.splice(0, products.length, ...current, ...retired);
    setCategories(classes.map((category) => ({ ...category, vial: current.find((product) => product.category === category.id)?.id })));
    refreshCatalog();
  }, [location.pathname]);
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      /* Selection remains usable if browser storage is unavailable. */
    }
  }, [cart]);
  function add(id: string, quantity: number) {
    const product = products.find((item) => item.id === id);
    if (!product || stockProblem(product, quantity + (cart.find((item) => item.id === id)?.quantity ?? 0))) return;
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
  if (LIVE) {
    // Wait only for the first answer. A save elsewhere re-checks the session, and blanking
    // the shop meanwhile would remount every page and lose its place, focus and messages.
    const access = shopAccess(location.pathname, session.loading && session.data === undefined, Boolean(session.data));
    if (access === "wait") return null;
    if (access === "redirect") return <Navigate to="/access" replace state={{ from: location.pathname + location.search }} />;
    if (priced && session.data && catalogAccess() === "showcase") return null;
  }
  return (
    <ShopContext.Provider
      value={{
        cart,
        catalogChecking: LIVE && catalog.loading,
        catalogError: LIVE ? catalog.error?.message : null,
        reloadCatalog: catalog.reload,
        add,
        change,
        clear: () => setCart([]),
        openCart: () => setCartOpen(true),
        closeCart: () => setCartOpen(false),
      }}
    >
      <div className="brand-refinement">
        <RouteEffects />
        <SectionLink className="skip-link" section="main">
          Skip to content
        </SectionLink>
        <Header />
        <main id="main">
          {/* The page is drawn into view slots, so the opening's camera move can draw both pages while it
              runs (src/brand/FlightViews.tsx). Product pages are open to every visitor, so every vial flies. */}
          <FlightViews allowed>
            {(at) => (
              // Each view slot waits for its own page's code, and a page that fails keeps the shop around it.
              <PageBoundary at={at.pathname}>
              <Suspense fallback={null}>
              <Routes location={at}>
                <Route path="/" element={<Home />} />
                <Route path="/products" element={<Catalog />} />
                {/* Open to every visitor; signed out, an account prompt replaces the price and Add to cart. */}
                <Route path="/product/:id" element={<ProductPage signInToOrder={LIVE && !session.data} />} />
                <Route path="/verify" element={<Verify />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/checkout/confirmation/:orderId" element={<Confirmation />} />
                {LIVE && <Route path="/checkout/pay/:orderId" element={<Pay />} />}
                <Route path="/track/:number?" element={<Track />} />
                <Route path="/access/apply" element={<Apply />} />
                <Route path="/my-account" element={<Navigate to="/account" replace />} />
                {/* The client's Terms lived at this address; old links keep working. */}
                <Route path="/terms-and-conditions" element={<Navigate to="/terms" replace />} />
                <Route path="/account/*" element={<Account />} />
                <Route path="/quality" element={<Quality />} />
                <Route path="/handling" element={<Handling />} />
                <Route path="/about" element={<About />} />
                <Route path="/research-blog" element={<Journal />} />
                <Route path="/research-blog/:id" element={<Article />} />
                <Route path="/contact" element={<Contact />} />
                {policies.map((policy) => (
                  <Route key={policy.path} path={policy.path} element={<Policy path={policy.path} />} />
                ))}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              </PageBoundary>
            )}
          </FlightViews>
        </main>
        <Footer />
        <Modal open={cartOpen} title="Your cart" onClose={() => setCartOpen(false)} side field="never">
          <BagContents />
        </Modal>
      </div>
    </ShopContext.Provider>
  );
}
