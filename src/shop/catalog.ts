import { assetUrl } from "../assetUrl";
import { products } from "../data";
import { discounts } from "../platform/seed";
import type { Product } from "../data";

/** Web derivatives of the supplied renders; the original PNGs stay untouched. */
export function productImage(product: Product | undefined, size: "sm" | "lg" = "lg") {
  if (product?.image?.startsWith("https://")) return product.image;
  const file = (product?.image ?? "").split("/").pop()?.replace(/\.png$/, "");
  if (!file) return assetUrl("images/brand/monogram.svg");
  return assetUrl(`images/web/${file}${size === "sm" ? "-640" : ""}.webp`);
}

/** The vial cut from its render (labels untouched, glass see-through): public/images/cutouts. */
export function productCutout(product: Product | undefined, size: "sm" | "lg" = "lg") {
  if (product?.image?.startsWith("https://")) return product.image;
  const file = (product?.image ?? "").split("/").pop()?.replace(/\.png$/, "");
  if (!file) return assetUrl("images/brand/monogram.svg");
  return assetUrl(`images/cutouts/${file}${size === "sm" ? "-sm" : ""}.webp`);
}

export function productSrcSet(product: Product) {
  return `${productImage(product, "sm")} 640w, ${productImage(product, "lg")} 1254w`;
}

export function studyImage(name: string, size: "sm" | "lg" = "lg") {
  return assetUrl(`images/web/study-${name}${size === "sm" ? "-960" : ""}.webp`);
}

export const productById = (id: string) => products.find((p) => p.id === id && p.active !== false);

/** The first-order offer the shop advertises: the store's own promo code, so checkout honours it. */
export const firstOrderOffer = discounts.find((d) => d.code === "FIRSTLOT")!;

function pick(ids: string[]): Product[] {
  return ids.map(productById).filter((p): p is Product => Boolean(p));
}

/** One vial per label colour, ordered around the colour wheel from the brand purple. */
const spectrumIds = [
  "retatrutide-30-mg",
  "ghk-cu-100-mg",
  "melanotan-ii-10-mg",
  "nad-500-mg",
  "semax-10-mg",
  "bpc-157-10-mg",
  "tesamorelin-10-mg",
];
export let spectrum = pick(spectrumIds);

export type Compound = {
  key: string;
  name: string;
  lead: Product;
  variants: Product[];
  fromPrice?: number;
};

/** Sizes of one compound share a product page; group them for browsing. */
function groupCompounds(): Compound[] {
  const groups = new Map<string, Product[]>();
  for (const product of products.filter((p) => p.active !== false)) {
    const group = `${product.category}/${product.name}`;
    const list = groups.get(group) ?? [];
    list.push(product);
    groups.set(group, list);
  }
  return Array.from(groups.values()).map((variants) => {
    variants.sort((a, b) => a.size.localeCompare(b.size, "en", { numeric: true }));
    const prices = variants.flatMap((v) => (v.price === undefined ? [] : [v.price]));
    return {
      key: variants[0].id,
      name: variants[0].name,
      lead: variants[0],
      variants,
      fromPrice: prices.length ? Math.min(...prices) : undefined,
    };
  });
}
export let compounds = groupCompounds();

/** The artwork's colour order stays fixed even when a product changes class. */
const rainbowColors = ["#CC3358", "#AB531A", "#B97102", "#4E762E", "#058F93", "#0273D0", "#7A39B1", "#486377"];
const rainbowPosition = (product: Product) => {
  const index = rainbowColors.indexOf(product.color.toUpperCase());
  return index < 0 ? rainbowColors.length : index;
};
const sortRainbow = (values: Compound[]) => [...values].sort((a, b) =>
  rainbowPosition(a.lead) - rainbowPosition(b.lead) ||
  a.name.localeCompare(b.name, "en") || a.lead.size.localeCompare(b.lead.size, "en", { numeric: true }));

export let compoundsForBrowsing = sortRainbow(compounds);
export function refreshCatalog() {
  compounds = groupCompounds();
  compoundsForBrowsing = sortRainbow(compounds);
  spectrum = pick(spectrumIds);
}

export type CompoundSpec = {
  /** What the compound is, as the client's subtitle names it ("Pentadecapeptide"). */
  descriptor?: string;
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

/** The client's "Testing and traceability" notes from every product page, NFC now a QR code and
 *  shipping worded as their review of Sept 30 asked. A lab supply keeps its own storage, so it
 *  carries no cold-chain note. */
export function traceability(product: Product): [title: string, text: string][] {
  return [
    ["Tested on receipt", "Every lot is sampled and sent to a contracted laboratory for HPLC purity and MS identity testing before release."],
    ["Quarantined until release", "Lots are held in temperature-controlled quarantine and released only after the Certificate of Analysis is approved."],
    ["Traceable to source batch", "The printed lot number and QR code on each vial resolve to the CoA and the full testing record for that batch."],
    ...(product.category === "lab-supplies" ? [] : [["Cold chain to your door", "Stored at −20 °C and shipped with temperature control when applicable."] as [string, string]]),
  ];
}

/** The client's notice beside the buy button on every product page, word for word. */
export const researchUseNote = "Research use only. Not for human or veterinary administration. Supplied to verified research organizations for laboratory research applications.";

/**
 * Compound data as published on the client's current site (captured 2026-09-24).
 * Only BPC-157 lists identifiers there; the rest stay blank until the client supplies them.
 */
const specs: Record<string, CompoundSpec> = {
  "BPC-157": {
    ...powder,
    descriptor: "Pentadecapeptide",
    cas: "137525-51-0",
    formula: "C62H98N16O22",
    weight: "1419.53 g/mol",
    sequence: "GEPPPGKPADDAGLV",
  },
  // From the client's first-batch lot list (2026-09-24).
  GLOW: { ...powder, blend: "GHK-Cu 50 mg · BPC-157 10 mg · TB-500 10 mg" },
  "BAC Water": { form: "Sterile solution", storage: "Room temperature, protected from light" },
};

export const specFor = (product: Product): CompoundSpec => ({ ...(specs[product.name] ?? powder), form: product.form === "Research diluent" ? "Sterile solution" : product.form });

export function describe(product: Product): string {
  if (product.description?.trim()) return product.description;
  if (product.category === "lab-supplies") {
    return "Bacteriostatic water, a sterile solution supplied for laboratory use. Traceable to its lot, like every TrueMark vial.";
  }
  return `${product.name}, supplied as ${product.form === "Lyophilized powder" ? "a lyophilized powder" : product.form.toLowerCase()} for laboratory research. Every vial is traceable to its lot and released with a certificate of analysis.`;
}

/** The client mockup's sample lot lives with the platform data; re-exported for the storefront. */
export { sampleRecord } from "../platform/seed";
