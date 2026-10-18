import { categoryName } from "../data";
import type { Product } from "../data";
import type { Compound } from "./catalog";

const compact = (value: string) => value.normalize("NFKD").toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]/g, "");

/** Search the same names, sizes and classes in both storefront entry points.
 * Punctuation and spacing on a label should not be required knowledge. */
export function matchesProductSearch(product: Pick<Product, "name" | "size" | "category" | "active">, query: string): boolean {
  if (product.active === false) return false;
  if (!query.trim()) return true;
  const terms = query.trim().split(/\s+/).map(compact).filter(Boolean);
  if (!terms.length) return false;
  const fields = [compact(`${product.name} ${product.size}`), compact(categoryName(product.category))];
  return terms.every(term => fields.some(field => field.includes(term)));
}

/** A strength-specific search opens and adds that strength, with its own price. */
export function searchCompounds(compounds: Compound[], query: string, category = "all"): Compound[] {
  return compounds.flatMap(compound => {
    if (category !== "all" && compound.lead.category !== category) return [];
    const variants = compound.variants.filter(product => matchesProductSearch(product, query));
    if (!variants.length) return [];
    if (variants.length === compound.variants.length) return [compound];
    const prices = variants.flatMap(product => product.price === undefined ? [] : [product.price]);
    return [{ ...compound, lead: variants[0], variants, fromPrice: prices.length ? Math.min(...prices) : undefined }];
  });
}
