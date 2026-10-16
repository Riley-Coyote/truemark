import type { Buyer } from "../../platform/types";
import { dateWindow, parseCsv } from "./model";

export type ImportRow = {
  line: number;
  name: string;
  email: string;
  institution: string;
  consentAt: string;
  source: string;
  problem: string;
};
export const validEmail = (value: string) =>
  /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(value) && value.length <= 254;

/** Imports are reviewed plans. An email address alone never grants account approval or consent. */
export function contactImport(
  text: string,
  buyers: Pick<Buyer, "email">[],
  kind: "customers" | "subscribers",
  asOf: string,
): ImportRow[] {
  const csv = parseCsv(text);
  if (csv.length < 2)
    throw Error("Include a header row and at least one contact.");
  const headers = csv[0].map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_"),
  );
  const required =
    kind === "customers"
      ? ["name", "email", "institution"]
      : ["name", "email", "consent_at", "source"];
  const missing = required.filter((h) => !headers.includes(h));
  if (missing.length) throw Error(`Missing columns: ${missing.join(", ")}.`);
  if (new Set(headers).size !== headers.length)
    throw Error("Column names must be unique.");
  const known = new Set(buyers.map((b) => b.email.trim().toLowerCase()));
  const seen = new Set<string>();
  return csv
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row, i) => {
      const read = (key: string) => (row[headers.indexOf(key)] ?? "").trim();
      const email = read("email").toLowerCase(),
        name = read("name"),
        institution = read("institution"),
        consentAt = read("consent_at"),
        source = read("source");
      const problems: string[] = [];
      if (row.length !== headers.length)
        problems.push("Column count does not match the header");
      if (!validEmail(email)) problems.push("Invalid email");
      if (!name) problems.push("Name required");
      if (kind === "customers" && !institution)
        problems.push("Institution required");
      if (known.has(email)) problems.push("Already recorded");
      if (seen.has(email)) problems.push("Duplicate in this file");
      seen.add(email);
      if (kind === "subscribers") {
        let validDate = false;
        try {
          dateWindow(consentAt.slice(0, 10), consentAt.slice(0, 10));
          validDate = true;
        } catch {
          /* Report the invalid date with the other row errors. */
        }
        if (
          !validDate ||
          !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
            consentAt,
          ) ||
          !Number.isFinite(Date.parse(consentAt)) ||
          Date.parse(consentAt) > Date.parse(asOf)
        )
          problems.push("Valid, non-future consent timestamp required");
        if (!source) problems.push("Opt-in source required");
      }
      return {
        line: i + 2,
        name,
        email,
        institution,
        consentAt,
        source,
        problem: problems.join(" · "),
      };
    });
}

export type Subscriber = {
  id: string;
  name: string;
  email: string;
  consentAt: string;
  source: string;
  status: "subscribed" | "suppressed";
  reason: string;
};
export function campaignAudience(subscribers: Subscriber[], asOf: string) {
  // Suppression wins even if another local record of the same address is subscribed.
  const blocked = new Set(
    subscribers
      .filter((s) => s.status === "suppressed")
      .map((s) => s.email.trim().toLowerCase()),
  );
  const seen = new Set<string>();
  return subscribers.filter((s) => {
    const key = s.email.trim().toLowerCase();
    if (blocked.has(key) || seen.has(key)) return false;
    const eligible =
      s.status === "subscribed" &&
      validEmail(s.email) &&
      s.source.trim() &&
      Number.isFinite(Date.parse(s.consentAt)) &&
      Date.parse(s.consentAt) <= Date.parse(asOf);
    if (eligible) seen.add(key);
    return Boolean(eligible);
  });
}

export type RewardRules = {
  enabled: boolean;
  perDollar: number;
  pointsPerDollar: number;
  minPoints: number;
  maxPercent: number;
  adjustments: Record<string, number>;
};
export function rewardEstimate(
  netMerchandise: number,
  rules: RewardRules,
  adjustment = 0,
) {
  const earned = Math.floor(
    Math.max(0, netMerchandise) * Math.max(0, rules.perDollar),
  );
  const balance = Math.max(0, earned + Math.trunc(adjustment));
  return {
    earned,
    balance,
    credit:
      rules.pointsPerDollar > 0 && balance >= rules.minPoints
        ? Math.floor((balance / rules.pointsPerDollar) * 100) / 100
        : 0,
  };
}
