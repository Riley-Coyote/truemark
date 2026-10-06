import type { Lot } from "./types";
import { productById } from "../shop/catalog";
import { lowestPurity } from "./certificate-records";

export const certificateQuery = (value: string) => value.replace(/\s/g, "").toLocaleLowerCase();
/** Released lots for the public library; the command center's fictional sample lots never appear. */
export function certificateLibrary(lots: Lot[], query = ""): Lot[] {
  const needle = certificateQuery(query);
  return lots.filter((lot) => lot.status === "released" && !lot.sample &&
    (!needle || [lot.lot, productById(lot.productId)?.name ?? ""].some((value) => certificateQuery(value).includes(needle))))
    .sort((a, b) => (b.releasedAt ?? "").localeCompare(a.releasedAt ?? "") || a.lot.localeCompare(b.lot));
}
/** The lot's HPLC purity as one figure: a blend's lowest component. */
export function hplcPurity(lot: Lot) {
  return lowestPurity(lot.results);
}
