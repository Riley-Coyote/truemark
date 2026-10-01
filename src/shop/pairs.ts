import type { Product } from "../data";

type PricedProduct = Product & { price: number };

/** BAC water takes priority; otherwise use class line counts, then name. */
export function pairsFor(catalog: readonly Product[], bag: readonly { id: string }[]): PricedProduct[] {
  const inBag = new Set(bag.map((line) => line.id));
  const held = catalog.filter((product) => inBag.has(product.id));
  if (!held.length) return [];

  const available = catalog.filter((product): product is PricedProduct =>
    !inBag.has(product.id) && product.active !== false && (product.stock == null || product.stock > 0) &&
    product.price !== undefined && Number.isFinite(product.price) && product.price >= 0);
  const water = available.find((product) => product.id === "bacteriostatic-water-10-ml");
  if (water && held.some((product) => product.form === "Lyophilized powder")) return [water];

  const classLines = new Map<string, number>();
  for (const product of held) classLines.set(product.category, (classLines.get(product.category) ?? 0) + 1);
  return available.filter((product) => classLines.has(product.category)).sort((a, b) =>
    classLines.get(b.category)! - classLines.get(a.category)! ||
    a.name.localeCompare(b.name, "en") || a.size.localeCompare(b.size, "en", { numeric: true }) ||
    a.id.localeCompare(b.id, "en")).slice(0, 2);
}
