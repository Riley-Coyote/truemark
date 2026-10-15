import { lowestPurity } from "../platform/certificate-records";
import type { Lot, LotResult } from "../platform/types";

/*
 * What the opening may say of the lots on its plinths (MistOpening.tsx). Nothing here touches the page, so the rules
 * can be tested in Node.
 */

/** The figure the opening reads for a lot: its HPLC purity (a blend's lowest component), only once its record is
 *  released, and never for illustrative sample evidence. */
export function plinthPurity(record: Lot | null | undefined): LotResult | undefined {
  return record?.status === "released" && !record.sample ? lowestPurity(record.results) : undefined;
}

/** The ≥99% minimum the opening's caption promises of every lot it shows. */
export const COLLECTION_PURITY = 99;

/**
 * The opening's caption, "Every lot shown tested ≥99% by HPLC", is true only while every lot shown has its record
 * loaded and released, with an HPLC purity (its lowest component) of 99% or more.
 */
export function collectionVerified(records: (Lot | null | undefined)[]): boolean {
  return records.length > 0 && records.every((record) => {
    const purity = plinthPurity(record);
    return Boolean(purity) && purity!.unit === "%" && Number(purity!.value) >= COLLECTION_PURITY;
  });
}
