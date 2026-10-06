import manifest from "./certificate-manifest.json";
import type { Lot, LotResult } from "./types";

/**
 * The client's certificates of analysis, as one record for every place that shows a lot.
 * The manifest is the transcription (scripts/certificates.test.mjs checks it against the PDFs);
 * this module turns it into lot results and reads results back for display. It imports nothing
 * from the shop, so the preview seed can use it.
 */

export type CertificateComponent = {
  /** Named only in a blend. */
  name: string | null;
  purity: string;
  identity: string;
  /** The main peak's HPLC retention time in minutes, as printed. Recorded for a later round; not shown. */
  retentionTime: string;
  /** "Content" unless the certificate names what it measures (BAC Water: benzyl alcohol). */
  contentLabel?: string;
  content: string;
  contentUnit: string;
  claim: string;
  claimUnit: string;
  /** The percentage of the label claim, exactly as printed. */
  ofClaim: string;
  calculated?: { value: string; unit: string; note: string };
};

export type CertificateEntry = {
  certificate: string;
  pdf: string;
  lot: string;
  productId: string;
  compound: string;
  lab: string;
  sampleReceived: string;
  analyzed: string;
  issued: string;
  verifyUrl: string;
  components: CertificateComponent[];
};

export type PendingCertificate = { productId: string; lot: string; certificate: string; pdf: string; reason: string };

type Manifest = {
  lab: { name: string; company: string; description: string; method: string; verifyPage: string };
  specification: { purity: string };
  certificates: CertificateEntry[];
  pending: PendingCertificate[];
};

const data = manifest as Manifest;
export const LAB = data.lab;
export const certificates = data.certificates;
export const pendingCertificates = data.pending;

/** The certificates' own release specification for HPLC purity, in percent ("95.0"). */
export const PURITY_MINIMUM = data.specification.purity;
export const IDENTITY_METHOD = "HPLC (RT + UV vs. reference)";
/** Results for one component of a blend carry its name after this separator: "Purity · BPC-157". */
export const COMPONENT_SEPARATOR = " · ";

/** What a certificate reports for one component, as the release form asks for it. */
export type ComponentResults = Omit<CertificateComponent, "retentionTime">;

const named = (label: string, component: ComponentResults) =>
  component.name ? `${label}${COMPONENT_SEPARATOR}${component.name}` : label;

/** A certificate's results in the LotResult shape the database stores and every view reads. */
export function resultsFor(entry: CertificateEntry): LotResult[] {
  return resultsOf(entry.components);
}

/** The same results from the release form's entries: purity, identity, content, label claim and % of claim per component. */
export function resultsOf(components: ComponentResults[]): LotResult[] {
  const each = <T,>(make: (component: ComponentResults) => T) => components.map(make);
  return [
    ...each((c) => ({ label: named("Purity", c), method: "HPLC", value: c.purity, unit: "%" })),
    ...each((c) => ({ label: named("Identity", c), method: IDENTITY_METHOD, value: c.identity, unit: "" })),
    ...each((c) => ({ label: named(c.contentLabel ?? "Content", c), method: "HPLC", value: c.content, unit: c.contentUnit })),
    ...each((c) => ({ label: named("Label claim", c), method: "", value: c.claim, unit: c.claimUnit })),
    ...each((c) => ({ label: named("% of label claim", c), method: "", value: c.ofClaim, unit: "%" })),
    // BAC Water's certificate also derives a per-vial amount from the labeled fill, and says so.
    ...components.flatMap((c) => c.calculated ? [{
      label: named(`${(c.contentLabel ?? "Content").replace(/ content$/, "")} per vial`, c),
      method: c.calculated.note.charAt(0).toUpperCase() + c.calculated.note.slice(1),
      value: c.calculated.value,
      unit: c.calculated.unit.replace(/ per vial$/, ""),
    }] : []),
  ];
}

/**
 * A released lot as the import leaves it in the database: the certificate number as its reference,
 * tested on the date analyzed, released on the date of issue (live stamps the real release time),
 * the PDF named by lot (each store turns the path into its link). No certificate states TrueMark's
 * own receipt date, so that stays empty.
 */
export function releasedFields(entry: CertificateEntry) {
  return {
    status: "released",
    receivedAt: null,
    testedAt: entry.analyzed,
    releasedAt: entry.issued,
    results: resultsFor(entry),
    reference: entry.certificate,
    coaPath: `${entry.lot}.pdf`,
    sample: false,
  } satisfies Partial<Lot>;
}

/**
 * The components a lot's release form asks for: those on its product's certificate, or else the
 * product's own name (a blend's parts are separated by " / ").
 */
export function releaseTemplate(productId: string, productName: string): Pick<ComponentResults, "name" | "contentLabel" | "contentUnit" | "claimUnit">[] {
  const known = certificates.find((entry) => entry.productId === productId);
  if (known) return known.components.map(({ name, contentLabel, contentUnit, claimUnit }) => ({ name, contentLabel, contentUnit, claimUnit }));
  const parts = productName.split(" / ");
  return (parts.length > 1 ? parts : [null]).map((name) => ({ name, contentUnit: "mg per vial", claimUnit: "mg" }));
}

/** Where to confirm a certificate with the laboratory: its QR code's link, or the lab's verify page and the number to enter. */
export function labLink(reference?: string): { href: string; enter?: string } | undefined {
  if (!reference) return undefined;
  const known = certificates.find((entry) => entry.certificate === reference);
  return known ? { href: known.verifyUrl } : { href: LAB.verifyPage, enter: reference };
}

/* ---------- Reading results back ---------- */

/** SQL's btrim: spaces only, so the gate below reads a value exactly as the database does. */
const btrim = (value: string) => value.replace(/^ +| +$/g, "");

export function splitLabel(label: string): { base: string; component?: string } {
  const text = btrim(label);
  const at = text.indexOf(COMPONENT_SEPARATOR);
  return at < 0 ? { base: text } : { base: btrim(text.slice(0, at)), component: btrim(text.slice(at + COMPONENT_SEPARATOR.length)) };
}

export type ResultGroup = {
  component?: string;
  purity?: LotResult;
  identity?: LotResult;
  content?: LotResult;
  claim?: LotResult;
  ofClaim?: LotResult;
  other: LotResult[];
};

/** Results grouped by component (one group for a single compound), in the order they first appear. */
export function resultGroups(results: LotResult[]): ResultGroup[] {
  const groups = new Map<string, ResultGroup>();
  for (const result of results) {
    const { base, component } = splitLabel(result.label);
    const group = groups.get(component ?? "") ?? { component, other: [] };
    groups.set(component ?? "", group);
    const kind = base.toLowerCase();
    if (kind === "purity" && !group.purity) group.purity = result;
    else if (kind === "identity" && !group.identity) group.identity = result;
    else if (kind.endsWith("content") && !group.content) group.content = result;
    else if (kind === "label claim" && !group.claim) group.claim = result;
    else if (kind === "% of label claim" && !group.ofClaim) group.ofClaim = result;
    else group.other.push(result);
  }
  return [...groups.values()];
}

const isHplcPurity = (result: LotResult) => splitLabel(result.label).base.toLowerCase() === "purity" && btrim(result.method).toLowerCase() === "hplc";

/** The one purity figure a view may show for a lot: a blend's lowest component, never a higher one. */
export function lowestPurity(results: LotResult[]): LotResult | undefined {
  return results.filter(isHplcPurity).reduce<LotResult | undefined>((low, result) => (!low || Number(result.value) < Number(low.value) ? result : low), undefined);
}

/** Every identity result conforms (an MS identity "Confirmed" counts, for older records). */
export function identityConforms(results: LotResult[]): boolean {
  const identities = results.filter((result) => splitLabel(result.label).base.toLowerCase() === "identity");
  return identities.length > 0 && identities.every((result) => result.value === "Conforms" || result.value === "Confirmed");
}

/** "124.6% of the 10 mg label claim", from the record's own figures. */
export function claimText(group: ResultGroup): string | undefined {
  if (!group.claim || !group.ofClaim) return undefined;
  return `${group.ofClaim.value}% of the ${group.claim.value} ${group.claim.unit} label claim`;
}

/** "12.46 mg" for content per vial, "9.24 mg/mL" otherwise. */
export function contentValue(result: LotResult) {
  return `${result.value} ${result.unit.replace(/ per vial$/, "")}`;
}

/* ---------- The release gate ---------- */

/**
 * The certificates' release specification, exactly as supabase/migrations/20261006000000_certificates.sql
 * applies it: every result is a {label, method, value, unit} of strings; HPLC purity at least 95.0 for
 * every component; every identity result conforms (an MS identity "Confirmed" still counts, for older
 * records); and each component with a purity result has an identity result (its own or one for the
 * whole sample), and each named identity a purity. Returns the database's message, or null.
 * Content is shown, never gated. scripts/validate-certificates-sql.mjs proves the two agree.
 */
export function releaseProblem(results: unknown): string | null {
  if (!Array.isArray(results)) return "Results must be an array";
  if (results.length === 0 || results.length > 30) return "Results are required";
  const purity: string[] = [];
  const identity: string[] = [];
  for (const item of results as unknown[]) {
    if (!isResultShape(item)) return "Each result needs label, method, value and unit strings";
    const label = btrim(item.label);
    const at = label.indexOf(COMPONENT_SEPARATOR);
    const base = (at < 0 ? label : btrim(label.slice(0, at))).toLowerCase();
    const component = at < 0 ? "" : btrim(label.slice(at + COMPONENT_SEPARATOR.length));
    const method = btrim(item.method).toLowerCase();
    if (base === "purity" && method === "hplc") {
      if (at >= 0 && !component) return "Each component needs a name";
      if (!/^[0-9]+([.][0-9]+)?$/.test(btrim(item.value))) return `HPLC purity must be a number at least ${PURITY_MINIMUM}`;
      if (!atLeast(btrim(item.value), PURITY_MINIMUM)) return `HPLC purity must be at least ${PURITY_MINIMUM}`;
      purity.push(component);
    } else if (base === "identity") {
      if (at >= 0 && !component) return "Each component needs a name";
      const conforms = (method.startsWith("hplc") && item.value === "Conforms") || (["ms", "mass spectrometry"].includes(method) && item.value === "Confirmed");
      if (!conforms) return "Identity must conform";
      identity.push(component);
    }
  }
  const whole = identity.includes("");
  if (!purity.length || !identity.length
    || purity.some((component) => !identity.includes(component) && !whole)
    || identity.some((component) => component !== "" && !purity.includes(component))) {
    return `Release needs HPLC purity at least ${PURITY_MINIMUM} and a conforming identity for every component`;
  }
  return null;
}

function isResultShape(item: unknown): item is LotResult {
  if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
  const keys = Object.keys(item).sort().join(",");
  const value = item as Record<string, unknown>;
  return keys === "label,method,unit,value" && ["label", "method", "value", "unit"].every((key) => typeof value[key] === "string")
    && btrim(value.label as string) !== "" && btrim(value.value as string) !== "";
}

/** Decimal strings compared exactly, as Postgres numerics are. */
function atLeast(value: string, minimum: string) {
  const parts = (text: string) => { const [whole, fraction = ""] = text.split("."); return [whole.replace(/^0+(?=\d)/, ""), fraction] as const; };
  const [a, af] = parts(value);
  const [b, bf] = parts(minimum);
  if (a.length !== b.length) return a.length > b.length;
  if (a !== b) return a > b;
  const width = Math.max(af.length, bf.length);
  return af.padEnd(width, "0") >= bf.padEnd(width, "0");
}
