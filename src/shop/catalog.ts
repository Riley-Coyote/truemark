import { assetUrl } from "../assetUrl";
import { products } from "../data";
import { discounts } from "../platform/seed";
import type { Product } from "../data";

/** Web derivatives of the supplied renders; the original PNGs stay untouched. */
export function productImage(product: Product, size: "sm" | "lg" = "lg") {
  const file = (product.image ?? "").split("/").pop()?.replace(/\.png$/, "");
  if (!file) return assetUrl("images/brand/monogram.svg");
  return assetUrl(`images/web/${file}${size === "sm" ? "-640" : ""}.webp`);
}

/** The vial cut from its render (labels untouched, glass see-through): public/images/cutouts. */
export function productCutout(product: Product, size: "sm" | "lg" = "lg") {
  const file = (product.image ?? "").split("/").pop()?.replace(/\.png$/, "");
  if (!file) return assetUrl("images/brand/monogram.svg");
  return assetUrl(`images/cutouts/${file}${size === "sm" ? "-sm" : ""}.webp`);
}

export function productSrcSet(product: Product) {
  return `${productImage(product, "sm")} 640w, ${productImage(product, "lg")} 1254w`;
}

export function studyImage(name: string, size: "sm" | "lg" = "lg") {
  return assetUrl(`images/web/study-${name}${size === "sm" ? "-960" : ""}.webp`);
}

export const productById = (id: string) => products.find((p) => p.id === id);

/** The first-order offer the shop advertises: the store's own promo code, so checkout honours it. */
export const firstOrderOffer = discounts.find((d) => d.code === "FIRSTLOT")!;

function pick(ids: string[]): Product[] {
  return ids.map(productById).filter((p): p is Product => Boolean(p));
}

/** One vial per label colour, ordered around the colour wheel from the brand purple. */
export const spectrum = pick([
  "retatrutide-30-mg",
  "ghk-cu-100-mg",
  "melanotan-ii-10-mg",
  "nad-500-mg",
  "semax-10-mg",
  "bpc-157-10-mg",
  "tesamorelin-10-mg",
]);

export type Compound = {
  key: string;
  name: string;
  lead: Product;
  variants: Product[];
  fromPrice?: number;
};

/** Sizes of one compound share a product page; group them for browsing. */
export const compounds: Compound[] = (() => {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const list = groups.get(product.name) ?? [];
    list.push(product);
    groups.set(product.name, list);
  }
  return Array.from(groups.values()).map((variants) => {
    const prices = variants.flatMap((v) => (v.price === undefined ? [] : [v.price]));
    return {
      key: variants[0].id,
      name: variants[0].name,
      lead: variants[0],
      variants,
      fromPrice: prices.length ? Math.min(...prices) : undefined,
    };
  });
})();

/** Browse order: one of each label colour first, then the rest by colour family. */
export const compoundsForBrowsing: Compound[] = (() => {
  const colourOrder = ["#7A39B1", "#058F93", "#CC3358", "#0273D0", "#B97102", "#4E762E", "#AB531A", "#486377"];
  const first = colourOrder.slice(0, 7)
    .map((colour) => compounds.find((c) => c.lead.color === colour))
    .filter((c): c is Compound => Boolean(c));
  const rest = compounds
    .filter((c) => !first.includes(c))
    .sort((a, b) => colourOrder.indexOf(a.lead.color) - colourOrder.indexOf(b.lead.color));
  return [...first, ...rest];
})();

export type CompoundSpec = {
  cas?: string;
  formula?: string;
  weight?: string;
  sequence?: string;
  /** A blend's components, as the client lists them. */
  blend?: string;
  form: string;
  storage: string;
};

const powder: CompoundSpec = { form: "Lyophilized powder", storage: "−20 °C, protected from light" };

/**
 * Compound data as published on the client's current site (captured 2026-09-24).
 * Only BPC-157 lists identifiers there; the rest stay blank until the client supplies them.
 */
const specs: Record<string, CompoundSpec> = {
  "BPC-157": {
    ...powder,
    cas: "137525-51-0",
    formula: "C62H98N16O22",
    weight: "1419.53 g/mol",
    sequence: "GEPPPGKPADDAGLV",
  },
  // From the client's first-batch lot list (2026-09-24).
  GLOW: { ...powder, blend: "GHK-Cu 50 mg · BPC-157 10 mg · TB-500 10 mg" },
  "BAC Water": { form: "Sterile solution", storage: "Room temperature, protected from light" },
};

export const specFor = (product: Product): CompoundSpec => specs[product.name] ?? powder;

export function describe(product: Product): string {
  if (product.category === "lab-supplies") {
    return "Bacteriostatic water, a sterile solution supplied for laboratory use. Traceable to its lot, like every TrueMark vial.";
  }
  return `${product.name}, supplied as a lyophilized powder for laboratory research. Every vial is traceable to its lot and released with a certificate of analysis.`;
}

/** The client mockup's sample lot lives with the platform data; re-exported for the storefront. */
export { sampleRecord } from "../platform/seed";

