import { lazy, useRef } from "react";
import type { ComponentType } from "react";
import { LAUNCH } from "./platform/mode";

type Loaded<P> = { default: ComponentType<P> };

/**
 * A page whose code arrives with its route, kept out of the opening's bundle. Once its code is here it is drawn at once
 * (React.lazy alone would wait a tick even then), so a page readied ahead of time never shows its fallback: the first
 * page of a visit (main.tsx readies it before the first render) and the product page the opening's camera flies into
 * (flight.ts readies it once the opening has loaded, and at once when a vial is pointed at). A page first drawn before
 * its code arrived stays the one it was drawn as, so it is never mounted twice.
 */
export function page<P extends object>(load: () => Promise<Loaded<P>>) {
  let ready: ComponentType<P> | null = null;
  let loading: Promise<ComponentType<P>> | null = null;
  const preload = () =>
    (loading ??= load().then(
      (module) => (ready = module.default),
      (error: unknown) => {
        // A failed fetch (a dropped connection, a deploy that replaced the files) is tried again next time.
        loading = null;
        throw error;
      },
    ));
  const Lazy = lazy(() => preload().then((component) => ({ default: component })));
  function Page(props: P) {
    const Drawn = useRef(ready ?? Lazy).current;
    return <Drawn {...props} />;
  }
  return Object.assign(Page, { preload });
}

/* The shop's pages beyond the opening (App.tsx routes them). */
export const Catalog = page(() => import("./shop/pages/Catalog"));
export const ProductPage = page(() => import("./shop/pages/Product"));
export const Verify = page(() => import("./shop/pages/Verify"));
export const Checkout = page(() => import("./shop/pages/checkout/Checkout"));
export const Pay = page(() => import("./shop/pages/checkout/Pay"));
export const Confirmation = page(() => import("./shop/pages/checkout/Confirmation"));
export const Track = page(() => import("./shop/pages/Track"));
export const Apply = page(() => import("./shop/pages/account/Apply"));
export const Account = page(() => import("./shop/pages/account/Account"));
export const Quality = page(() => import("./shop/pages/content/Quality"));
export const Handling = page(() => import("./shop/pages/content/Handling"));
export const About = page(() => import("./shop/pages/content/About"));
export const Journal = page(() => import("./shop/pages/content/Journal"));
export const Article = page(() => import("./shop/pages/content/Article"));
export const Contact = page(() => import("./shop/pages/content/Contact"));
export const Policy = page(() => import("./shop/pages/content/Policy"));
export const NotFound = page(() => import("./shop/pages/content/NotFound"));
/** The review's overview (AppRoutes.tsx); launch has none. */
export const ReviewOverview = LAUNCH ? null : page(() => import("./Review"));

/**
 * The page an address will show, readied: main.tsx waits for it before the first render, so a visit that starts on a
 * product, the catalog or checkout draws its page at once, as it always has. Unknown addresses ready the not-found page;
 * the opening, the cart (its code is the cart drawer's, always here) and the review's own pages have nothing to ready here.
 */
export function preloadPath(path: string): Promise<unknown> {
  const at = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const first = (prefix: string) => at === prefix || at.startsWith(`${prefix}/`);
  if (at === "/review") return ReviewOverview?.preload() ?? Promise.resolve();
  if (at === "/" || at === "/cart" || first("/admin") || first("/partners") || (first("/access") && at !== "/access/apply")) return Promise.resolve();
  // The review's own pages (launch has none, and names none of them).
  if (!LAUNCH && (first("/review") || at === "/visual-study" || at === "/type-study")) return Promise.resolve();
  if (first("/product")) return ProductPage.preload();
  if (at === "/products") return Catalog.preload();
  if (at === "/verify") return Verify.preload();
  if (first("/checkout/confirmation")) return Confirmation.preload();
  if (first("/checkout/pay")) return Pay.preload();
  if (at === "/checkout") return Checkout.preload();
  if (first("/track")) return Track.preload();
  if (at === "/access/apply") return Apply.preload();
  if (first("/account") || at === "/my-account") return Account.preload();
  if (at === "/quality") return Quality.preload();
  if (at === "/handling") return Handling.preload();
  if (at === "/about") return About.preload();
  if (at === "/research-blog") return Journal.preload();
  if (first("/research-blog")) return Article.preload();
  if (at === "/contact") return Contact.preload();
  // A policy's address, or none the shop knows: both pages are small, and readying both costs one request each.
  return Promise.all([Policy.preload(), NotFound.preload()]);
}

/** The pages a step from any other: the collection, a product, the client's navigation, and checkout from the bag. */
const NEIGHBOURS = [Catalog, ProductPage, Verify, Quality, Handling, About, Journal, Contact, Checkout];

/**
 * Once the first page has loaded and the browser has a quiet moment, the pages a step from any other are readied too:
 * small files, so a first step to any of them glides in whole (Navigation.tsx waits for a page's code before its
 * glide). A visitor saving data, or on the slowest connections, is spared them: each is still readied the moment a link
 * to it is pointed at.
 */
export function readyNeighbours() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || /2g/.test(connection?.effectiveType ?? "")) return;
  const run = () => {
    for (const neighbour of NEIGHBOURS) void neighbour.preload().catch(() => undefined);
  };
  // Safari has no idle callback: a moment after load does.
  const quiet = () => (typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(run, { timeout: 4000 }) : window.setTimeout(run, 1200));
  if (document.readyState === "complete") quiet();
  else window.addEventListener("load", quiet, { once: true });
}
