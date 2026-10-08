import { PURITY_SPEC } from "../platform/certificate-records";
import type { TrackStop } from "./Track";

/* The Quality page's own words for how a lot is made ready, shared with the chat so both say the same. */

export const process: TrackStop[] = [
  {
    kicker: "Step 01",
    title: "Sourcing",
    text: "Raw material is purchased against a written specification, with the supplier batch number recorded.",
  },
  {
    kicker: "Step 02",
    title: "Receipt & quarantine",
    text: "Incoming lots are logged, assigned a TrueMark lot number, and held in temperature-controlled quarantine.",
  },
  {
    kicker: "Step 03",
    title: "Independent testing",
    text: "Samples are sent to a contracted laboratory for HPLC purity, MS identity, endotoxin and sterility testing.",
  },
  {
    kicker: "Step 04",
    title: "CoA review & release",
    text: "Results are reviewed against specification. Only approved lots are released; the CoA is published to the lot record.",
    release: true,
  },
  {
    kicker: "Step 05",
    title: "Cold-chain storage",
    text: "Released vials are stored at −20 °C and shipped with temperature control when applicable.",
  },
];

export const specification: [test: string, method: string, requirement: string][] = [
  ["Purity", "HPLC", `≥\u00a0${PURITY_SPEC}%`],
  ["Identity", "Mass spectrometry", "Mass confirmed"],
  ["Endotoxin", "LAL assay", "< 0.25 EU/mg"],
  ["Sterility", "Culture", "No growth"],
  ["Net content", "Gravimetric", "Label claim met"],
];
