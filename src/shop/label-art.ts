import type { Product } from "../data";

/**
 * The lot each supplied label prints, read off the art itself, keyed by the art's file (data.ts `image`). Read for the
 * round-6 claims review from crops of every cutout's lot line (tools/landing/review-r5/claims/r6/labelart-lots-*.png)
 * and checked again for the final pass. Bacteriostatic water's "TM-" runs round the curve of the vial, out of the art's
 * view; what shows reads BAC10-2609-01.
 *
 * CJC (No DAC) / Ipamorelin is sold at the size its certificate tested, 5 mg / 5 mg (lot TM-CJI5-2609-01), while its
 * art is still the supplied 10 mg / 10 mg label: it prints TM-CJI10-2609-01 until the client's 5 mg / 5 mg art arrives.
 */
const PRINTED_LOTS: Record<string, string> = {
  "retatrutide-10-mg": "TM-RET10-2609-01",
  "retatrutide-20-mg": "TM-RET20-2609-01",
  "retatrutide-30-mg": "TM-RET30-2609-01",
  "retatrutide-60-mg": "TM-RET60-2609-01",
  "tirzepatide-30-mg": "TM-TRZ30-2609-01",
  "semaglutide-20-mg": "TM-SEM20-2609-01",
  "cagrilintide-10-mg": "TM-CAG10-2609-01",
  "bpc-157-10-mg": "TM-BPC10-2609-01",
  "bpc-157-tb-500-10-mg-10-mg": "TM-BTB10-2609-01",
  "kpv-10-mg": "TM-KPV10-2609-01",
  "ghk-cu-100-mg": "TM-GHK100-2609-01",
  "glow-70-mg": "TM-GLW70-2609-01",
  "tesamorelin-10-mg": "TM-TES10-2609-01",
  "nad-plus-500-mg": "TM-NAD500-2609-01",
  "mots-c-10-mg": "TM-MOT10-2609-01",
  "semax-10-mg": "TM-SMX10-2609-01",
  "selank-10-mg": "TM-SLK10-2609-01",
  "melanotan-ii-10-mg": "TM-MEL10-2609-01",
  "bac-water-10-ml": "TM-BAC10-2609-01",
  "cjc-no-dac-ipamorelin-10-mg-10-mg": "TM-CJI10-2609-01",
};

/** The lot a product's label art prints, where it has been read; a live catalog's own pictures have not been. */
export function printedLot(product: Product): string | undefined {
  if (!product.image || /^https?:/.test(product.image)) return undefined;
  const file = product.image.split("/").pop()?.replace(/\.png$/, "") ?? "";
  return PRINTED_LOTS[file];
}

/** Whether the label shown is the lot sold "as printed on the vial": only where its art prints that very lot. */
export const labelPrintsLot = (product: Product) => printedLot(product) === product.lot;
