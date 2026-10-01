import type { Lot } from "./types";
import { productById } from "../shop/catalog";

export const certificateQuery = (value: string) => value.replace(/\s/g, "").toLocaleLowerCase();
export function certificateLibrary(lots: Lot[], query = ""): Lot[] {
  const needle = certificateQuery(query);
  return lots.filter((lot) => lot.status === "released" &&
    (!needle || [lot.lot, productById(lot.productId)?.name ?? ""].some((value) => certificateQuery(value).includes(needle))))
    .sort((a, b) => (b.releasedAt ?? "").localeCompare(a.releasedAt ?? "") || a.lot.localeCompare(b.lot));
}
export function hplcPurity(lot: Lot) {
  return lot.results.find((result) => /hplc/i.test(result.method) && /purity/i.test(result.label));
}
