import { LIVE, PATH_ROUTER } from "../platform/mode";
/**
 * The partner program's words and rules, in one place: the public pages, the
 * application and the portal all read from here, so a partner is held to the
 * same guidelines they were shown when they applied.
 */
import { assetUrl } from "../assetUrl";
import { compounds } from "../shop/catalog";

/** Sample terms for the public pages. The client sets the real ones; partner records carry their own. */
export const SAMPLE_TERMS = { rate: 0.12, discount: 0.1, payoutDay: 5 };

/** The client's domain, as partner links will be shared. */
export const SITE = "https://www.truemarkbiolabs.com";

export const percent = (fraction: number) => `${Math.round(fraction * 1000) / 10}%`;

/** "5th", "1st", "22nd". */
export function ordinal(day: number): string {
  const teen = day % 100 >= 11 && day % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th";
  return `${day}${suffix}`;
}

/** A link that carries a partner's code; the shop remembers `?ref=` and checkout applies it. */
export function partnerLink(path: string, code: string): string {
  // The review site shows the brand's own address. A live link must land on the
  // deployment it came from, which routes by hash inside its own folder.
  const ref = `?ref=${encodeURIComponent(code)}`;
  if (!LIVE) return `${SITE}${path}${ref}`;
  // The launch site routes by path from its own base, wherever the partner happens to be in the portal.
  if (PATH_ROUTER) return `${location.origin}${new URL(import.meta.env.BASE_URL ?? "/", location.href).pathname.replace(/\/$/, "")}${path}${ref}`;
  return `${location.origin}${location.pathname}#${path}${ref}`;
}

export type DestinationKind = "home" | "shop" | "compound" | "verify";

export const destinations: { value: DestinationKind; label: string; path: string; note: string }[] = [
  { value: "home", label: "Home", path: "/", note: "The home page: the collection and the paper trail of one lot." },
  { value: "shop", label: "Shop", path: "/products", note: "The full catalog, organized by compound class." },
  { value: "compound", label: "A compound", path: "", note: "" },
  { value: "verify", label: "Verify", path: "/verify", note: "Lot verification: anyone can read a lot's certificate." },
];

/** One destination per compound; sizes share a product page. Lab supplies are left out. */
export const compoundDestinations = compounds
  .filter((c) => c.lead.category !== "lab-supplies")
  .map((c) => ({ value: c.lead.id, label: c.name, product: c.lead, sizes: c.variants.map((v) => v.size) }));

/* ---------- Guidelines ---------- */

export type Rule = { title: string; detail: string };

export const doRules: Rule[] = [
  {
    title: "Talk about testing, lot records and certificates.",
    detail: "What each lot is tested for, how it is released, and how anyone can read its certificate at /verify.",
  },
  {
    title: "Show the vial and its label.",
    detail: "Use the supplied renders and cut-outs, with the label whole and legible.",
  },
  {
    title: "Say “for research use only”.",
    detail: "In the post itself, every time you mention TrueMark.",
  },
  {
    title: "Disclose that you earn a commission.",
    detail: "Plainly, before your link or code, and not only in your profile.",
  },
];

/** Each "don't" reads as a rule on its own, so a quoted or cropped line can never read as advice. */
export const dontRules: Rule[] = [
  {
    title: "No claims about effects on people or animals.",
    detail: "That includes benefits, outcomes and personal experiences, in posts, captions and replies.",
  },
  {
    title: "No dosing, injection or reconstitution for use.",
    detail: "Not as advice, not as a story, not in the comments.",
  },
  {
    title: "No before-and-after content.",
    detail: "Of any kind, from any source.",
  },
  {
    title: "No medical or health advice.",
    detail: "Not in posts and not in replies. TrueMark compounds are not for human use.",
  },
  {
    title: "No suggestion of approval by a regulator.",
    detail: "No TrueMark compound is approved by the FDA or any other regulator for any therapeutic purpose.",
  },
];

/** Where the disclosure goes. */
export const disclosurePlacement = [
  "In the post itself, in words.",
  "Before the link or code.",
  "Not only in a profile, and not only as a hashtag.",
];

/** The line a partner puts in every post. With no code, it reads for the public pages. */
export function disclosure(code?: string): string {
  const where = code ? `with my code ${code}` : "with my link or code";
  return `I'm a TrueMark BioLabs partner and earn a commission on orders placed ${where}. For research use only. Not for human consumption.`;
}

/** The four commitments every applicant makes; ids are stable for the eventual backend. */
export const commitments = [
  { id: "no-effect-claims", label: "I won't make claims about effects on people or animals." },
  { id: "no-dosing", label: "I won't publish dosing, injection or reconstitution-for-use content." },
  { id: "disclose", label: "I'll disclose the partnership in every post." },
  { id: "platform-rules", label: "I'll follow the rules of every platform I publish on." },
];

/** The check a post passes before it goes out, as a lot is checked before release. */
export const releaseChecks = [
  { id: "research-use", label: "It says the compounds are for research use only." },
  { id: "disclosed", label: "It discloses that I earn a commission, before the link or code." },
  { id: "no-effects", label: "It makes no claim about effects on people or animals." },
  { id: "no-dosing", label: "It mentions no dosing, injection or reconstitution for use." },
];

/* ---------- Media ---------- */

export function scene(name: string) {
  return {
    src: assetUrl(`images/scenes/${name}.webp`),
    srcSet: `${assetUrl(`images/scenes/${name}-sm.webp`)} 1200w, ${assetUrl(`images/scenes/${name}.webp`)} 2400w`,
  };
}
