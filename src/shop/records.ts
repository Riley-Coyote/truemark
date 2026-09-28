import { products } from "../data";
import type { Product } from "../data";
import type { Lot } from "../platform/types";
import { productById, sampleRecord } from "./catalog";

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
  reference?: string;
  /** ISO dates, when the lot's record has them. */
  testedAt?: string;
  releasedAt?: string;
  sample: boolean;
};

/** Lot numbers are printed as TM-[CODE+DOSE]-[YYMM]-[BATCH]. Be forgiving about spacing and case. */
export function normaliseLot(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "").replace(/[–—]/g, "-");
}

export function findRecord(input: string): LotRecord | null {
  const lot = normaliseLot(input);
  if (!lot) return null;
  if (lot === sampleRecord.lot) {
    return {
      lot,
      product: productById(sampleRecord.productId)!,
      status: "released",
      results: sampleRecord.results,
      reference: sampleRecord.reference,
      testedAt: sampleRecord.testedAt,
      releasedAt: sampleRecord.releasedAt,
      sample: true,
    };
  }
  const product = products.find((p) => p.lot === lot);
  if (!product) return null;
  // The client has not supplied laboratory results; never invent them for a real lot.
  return { lot, product, status: "pending", results: [], sample: false };
}

/** The public view of a lot from the store: results only once a lot is released. */
export function recordFromLot(lot: Lot): LotRecord | null {
  const product = products.find((p) => p.id === lot.productId);
  if (!product) return null;
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
    sample: lot.sample,
  };
}
