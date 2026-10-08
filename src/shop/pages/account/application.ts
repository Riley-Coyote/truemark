/* The research-account application's questions, choices and checks, shared by the Apply page and the
   chat, which asks them in the conversation and hands the answers to the page to finish. */

export const USE_MIN = 30;
export const USE_MAX = 800;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEBSITE = /^(https?:\/\/)?[^\s/$.?#]+\.[^\s]{2,}$/i;

export const institutionTypes = [
  "University",
  "Contract research organization",
  "Biotechnology company",
  "Independent laboratory",
  "Other",
];

/** Ids match the sample applications in the store. */
export const attestations = [
  { id: "research-only", label: "The materials are for laboratory research use only." },
  { id: "not-for-human-use", label: "They are not for human or veterinary use." },
  { id: "storage-sop", label: "They will be stored and handled under our laboratory’s procedures." },
  { id: "terms", label: "I accept TrueMark’s terms of sale." },
];

export type Values = {
  name: string;
  email: string;
  role: string;
  institution: string;
  institutionType: string;
  website: string;
  country: string;
  researchArea: string;
  intendedUse: string;
};
export type Key = keyof Values | "attestations";

export function problem(key: Key, values: Values, confirmed: string[]): string | undefined {
  if (key === "attestations") {
    return confirmed.length === attestations.length ? undefined : "Confirm all four statements to continue.";
  }
  const v = values[key].trim();
  switch (key) {
    case "name":
      return v.length > 1 ? undefined : "Enter your full name.";
    case "email":
      return !v ? "Enter your email." : EMAIL.test(v) ? undefined : "Enter a full email address.";
    case "role":
      return v ? undefined : "Enter your role in the lab.";
    case "institution":
      return v ? undefined : "Enter the institution’s name.";
    case "institutionType":
      return v ? undefined : "Choose the type of institution.";
    case "website":
      return !v || WEBSITE.test(v) ? undefined : "Enter a full web address, or leave it blank.";
    case "country":
      return v ? undefined : "Enter the country.";
    case "researchArea":
      return v ? undefined : "Enter your research area.";
    case "intendedUse":
      return v.length >= USE_MIN ? undefined : `A sentence or two is enough, at least ${USE_MIN} characters.`;
    default:
      return undefined;
  }
}

/** Answers the chat gathered, waiting for the Apply page in this tab. */
const DRAFT = "tm-apply-draft";
export function giveDraft(values: Values, confirmed: string[]) {
  try { sessionStorage.setItem(DRAFT, JSON.stringify({ values, confirmed })); } catch { /* The page starts blank instead. */ }
}
/** The chat's answers, if it left any for this tab. */
export function readDraft(): { values: Values; confirmed: string[] } | null {
  try { const raw = sessionStorage.getItem(DRAFT); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
/** Once the page has them, they are forgotten. */
export function clearDraft() {
  try { sessionStorage.removeItem(DRAFT); } catch { /* Nothing to clear. */ }
}
