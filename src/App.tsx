import { useEffect, useRef, useState } from "react";
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
  const previousPath = useRef(location.pathname);
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
    const keepScroll = (location.state as { keepScroll?: boolean } | null)?.keepScroll;
    if (location.pathname !== previousPath.current) {
      if (!keepScroll) window.scrollTo({ top: 0, behavior: "instant" });
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
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
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
    <ShopContext.Provider
      value={{
        cart,
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
          <Modal title="Your bag" onClose={() => setCartOpen(false)} side>
            <BagContents />
          </Modal>
        )}
      </div>
    </ShopContext.Provider>
  );
}
