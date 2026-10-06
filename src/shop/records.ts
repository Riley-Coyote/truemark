import { products } from "../data";
import type { Product } from "../data";
import type { Lot } from "../platform/types";

export type LotResult = { label: string; method: string; value: string; unit: string };

export type LotRecord = {
  lot: string;
  product: Product;
  /**
   * released: results on file. archived: distributed, record stays open.
   * withheld: failed release, never sold. pending: known lot, certificate not published.
   */
  status: "released" | "archived" | "withheld" | "pending";
  results: LotResult[];
  /** The laboratory's certificate number. */
  reference?: string;
  /** ISO dates, when the lot's record has them. */
  testedAt?: string;
  releasedAt?: string;
  /** The certificate PDF, unmodified. */
  coaUrl?: string;
  sample: boolean;
};

/** Lot numbers are printed as TM-[CODE+DOSE]-[YYMM]-[BATCH]. Be forgiving about spacing and case. */
export function normaliseLot(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "").replace(/[–—]/g, "-");
}

/**
 * The public view of a lot from the store: results only once a lot is released. The command
 * center's fictional SAMPLE-* lots have no public record (lookup, home, assistant).
 */
export function recordFromLot(lot: Lot): LotRecord | null {
  const product = products.find((p) => p.id === lot.productId);
  if (!product || lot.sample) return null;
  const status: LotRecord["status"] =
    lot.status === "released"
      ? "released"
      : lot.status === "archived"
        ? "archived"
        : lot.status === "rejected"
          ? "withheld"
          : "pending";
  const published = status === "released" || status === "archived";
  return {
    lot: lot.lot,
    product,
    status,
    results: published ? lot.results : [],
    reference: published ? lot.reference : undefined,
    testedAt: published ? lot.testedAt : undefined,
    releasedAt: published ? lot.releasedAt : undefined,
    coaUrl: published ? lot.coaUrl : undefined,
    sample: lot.sample,
  };
}
