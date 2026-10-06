import { live } from "./platform/live/runtime";
import { catalogAccess, catalogReloadNeeded, rememberLink } from "./platform/live/bootstrap";
import { LIVE } from "./platform/mode";
import { store, useResource } from "./platform/store";
import { setCategories } from "./data";
import { refreshCatalog } from "./shop/catalog";
import { stockProblem } from "./platform/commerce";
import { useEffect, useState } from "react";
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
import Checkout from "./shop/pages/checkout/Checkout";
import Pay from "./shop/pages/checkout/Pay";
import Confirmation from "./shop/pages/checkout/Confirmation";
import Apply from "./shop/pages/account/Apply";
import Account from "./shop/pages/account/Account";
import Catalog from "./shop/pages/Catalog";
import ProductPage from "./shop/pages/Product";
import Verify from "./shop/pages/Verify";
import Track from "./shop/pages/Track";
import About from "./shop/pages/content/About";
import Article from "./shop/pages/content/Article";
import Contact from "./shop/pages/content/Contact";
import Handling from "./shop/pages/content/Handling";
import Journal from "./shop/pages/content/Journal";
import NotFound from "./shop/pages/content/NotFound";
import Policy from "./shop/pages/content/Policy";
import { policies, policyByPath } from "./brand/policies";
import Quality from "./shop/pages/content/Quality";

function RouteEffects() {
  const location = useLocation();
  useEffect(() => {
    const title = location.pathname.startsWith("/product/")
      ? (products.find((p) => location.pathname.endsWith(p.id))?.name ??
        "Research compound")
      : ({
          "/": "Research peptides. Third-party tested.",
          "/products": "Research compounds",
          "/verify": "Lot verification",
          "/quality": "Quality",
          "/handling": "Handling",
          "/about": "About",
          "/research-blog": "Research Blog",
          "/contact": "Contact",
          "/cart": "Your bag",
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

export const gatedShopPath = (path: string) => ["/products", "/product/", "/cart", "/checkout", "/account"].some((prefix) => path.startsWith(prefix));
export function shopAccess(path: string, loading: boolean, signedIn: boolean) {
  return loading ? "wait" : gatedShopPath(path) && !signedIn ? "redirect" : "render";
}

export default function App() {
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();
  const session = useResource(() => LIVE ? live().auth.hasSession() : Promise.resolve(true), []);
  useEffect(() => {
    if (!LIVE) return;
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref) void rememberLink(ref).catch(() => { /* Referral capture does not block sign-in. */ });
  }, [location.search]);
  const gated = LIVE && gatedShopPath(location.pathname);
  useEffect(() => {
    if (!LIVE || session.loading) return;
    if (catalogReloadNeeded(catalogAccess(), Boolean(session.data), gated, sessionStorage)) window.location.reload();
  }, [gated, session.loading, session.data]);
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
  useEffect(() => {
    setCartOpen(false);
  }, [location.pathname]);
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
    if (gated && session.data && catalogAccess() === "showcase") return null;
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
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Catalog />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/checkout/confirmation/:orderId" element={<Confirmation />} />
            {LIVE && <Route path="/checkout/pay/:orderId" element={<Pay />} />}
            <Route path="/track/:number?" element={<Track />} />
            <Route path="/access/apply" element={<Apply />} />
            <Route path="/my-account" element={<Navigate to="/account" replace />} />
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
        </main>
        <Footer />
        {cartOpen && (
          <Modal title="Your bag" onClose={() => setCartOpen(false)} side field="never">
            <BagContents />
          </Modal>
        )}
      </div>
    </ShopContext.Provider>
  );
}
