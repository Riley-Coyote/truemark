import type { Peak } from "./runtime";

/**
 * A lot's own HPLC peaks, for the line the desk draws. Lot lines are drawn from published certificate
 * data; none is published here yet, so the desk draws no line.
 */
export function lotPeaks(_reference: string | null | undefined): Peak[] {
  return [];
}
