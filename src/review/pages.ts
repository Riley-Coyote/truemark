/**
 * Routes as the review layer sees them: the page a note belongs to, whether it is the page
 * on screen, and a plain name for it.
 */
import { products } from "../data";

/** The layer's own query parameters; they never become part of a note's page. */
const REVIEW_PARAMS = ["note", "question", "as", "key"];

function split(route: string): { path: string; params: URLSearchParams } {
  const index = route.indexOf("?");
  return index === -1
    ? { path: route || "/", params: new URLSearchParams() }
    : { path: route.slice(0, index) || "/", params: new URLSearchParams(route.slice(index + 1)) };
}

/** The route for a note left now: the path and its own query, without the layer's params. */
export function routeOf(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  REVIEW_PARAMS.forEach((key) => params.delete(key));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * A note belongs on screen when its path is this path and every parameter it was left with
 * is present now: a note on /verify shows on /verify?lot=…, a note on that lot only there.
 */
export function onRoute(route: string, pathname: string, search: string): boolean {
  const note = split(route);
  if (note.path !== pathname) return false;
  const now = new URLSearchParams(search);
  for (const [key, value] of note.params) {
    if (now.get(key) !== value) return false;
  }
  return true;
}

/** A route with one extra parameter, e.g. the deep link to a note. */
export function withParam(route: string, key: string, value: string): string {
  const { path, params } = split(route);
  params.set(key, value);
  return `${path}?${params.toString()}`;
}

const names: Record<string, string> = {
  "/": "Home",
  "/review": "Overview",
  "/products": "Catalog",
  "/verify": "Lot verification",
  "/quality": "Quality",
  "/handling": "Handling",
  "/about": "About",
  "/research-blog": "Research blog",
  "/contact": "Contact",
  "/cart": "Your bag",
  "/checkout": "Checkout",
  "/account": "Research account",
  "/access": "Sign in",
  "/access/apply": "Account application",
  "/partners": "Partner program",
  "/partners/app": "Partner portal",
  "/admin": "Command center",
  "/visual-study": "Landing visuals",
  "/type-study": "Typography",
};

/** A plain name for a route: "Home", "Lot verification · TM-BPC10-2609-01", a product's name. */
export function pageLabel(route: string): string {
  const { path, params } = split(route);
  let name = names[path];
  if (!name && path.startsWith("/product/")) {
    const product = products.find((p) => p.id === path.slice("/product/".length));
    name = product ? product.name : "Product";
  }
  if (!name && path.startsWith("/admin/")) name = `Command center · ${titleCase(path.split("/")[2] ?? "")}`;
  if (!name && path.startsWith("/partners/app/")) name = `Partner portal · ${titleCase(path.split("/")[3] ?? "")}`;
  if (!name) name = titleCase(path.split("/").filter(Boolean).pop() ?? "Page");
  const lot = params.get("lot");
  return lot ? `${name} · ${lot}` : name;
}

function titleCase(slug: string): string {
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Page";
}

/** The page's own title as the site set it, without the site name; else its plain name. */
export function pageTitleNow(route: string): string {
  const { path } = split(route);
  if (path === "/" || path === "/review") return pageLabel(route);
  const own = document.title
    .replace(/\s+—\s+TrueMark BioLabs$/, "")
    .replace(/^TrueMark\s+—\s+/, "")
    .trim();
  return own && own !== "TrueMark BioLabs" ? own : pageLabel(route);
}
