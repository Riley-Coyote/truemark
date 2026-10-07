import { faqs } from "../data";
import { policies } from "../brand/policies";

// Verbatim site copy. The parity test checks these against Handling.tsx.
export const handlingCopy = [
  "Store at −20 °C",
  "Keep sealed vials frozen until use. Short transit and receiving periods at 2–8 °C are acceptable.",
  "Lyophilized powder is hygroscopic. Keep the crimp seal intact and protect vials from light.",
  "Return vials to the freezer promptly. Let a sealed vial reach room temperature before opening to prevent condensation.",
  "Record each vial’s lot number in your laboratory records and retain its Certificate of Analysis.",
];
export const shippingCopy = [
  "When applicable, vials ship in insulated packs sized to the transit time, with gel packs rated for the route.",
  "Orders ship with signature on delivery.",
  "Move vials to −20 °C promptly, check seals, and verify each lot number against its CoA.",
];
export function siteAnswers(topic: string, query = "") {
  const values = topic === "faq" ? faqs.map(([question, quote]) => ({ source: "/", question, quote }))
    : topic === "policies" ? policies.flatMap((p) => p.blocks.filter((b) => b.kind !== "heading" && b.kind !== "signoff").map((b) => ({ source: p.path, question: p.title, quote: b.text })))
    : (topic === "storage" ? handlingCopy : [...handlingCopy, ...shippingCopy]).map((quote) => ({ source: "/handling", question: topic, quote }));
  const words = query.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
  const matches = words.length ? values.filter((row) => words.some((word) => `${row.question} ${row.quote}`.toLowerCase().includes(word))) : values;
  return { matches: matches.length, excerpts: matches.slice(0, 6), contact: "/contact" };
}
