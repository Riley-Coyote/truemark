import { certificates } from "../platform/certificate-records";
import type { Peak } from "./runtime";

/**
 * A lot's own HPLC peaks, read from its laboratory certificate, for the line the desk draws. While the
 * client's certificates are held from the public site, the publish carries a version of this file that
 * returns none (docs/handoff/GITHUB-STATUS.md), and the desk simply draws no line.
 */
export function lotPeaks(reference: string | null | undefined): Peak[] {
  const entry = reference ? certificates.find((item) => item.certificate === reference) : undefined;
  return entry ? entry.components.map(({ name, retentionTime }) => ({ name, retentionTime })) : [];
}
