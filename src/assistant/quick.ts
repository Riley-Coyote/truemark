import type { ChatContext } from "./chat-context";
import type { ToolCall, ToolSchema } from "./protocol";
import type { Artifact, Panel, Source, ToolOutput } from "./runtime";
import { faqs, products } from "../data";
import { compoundsOf, planFromLines, type Plan } from "./planner";

/*
 * The desk's own questions answer at once. A suggestion the desk offers (and the same words typed)
 * is answered from the records on this side, without the model: the record arrives with a line the
 * site itself would say. Anything else goes to the model as before.
 */

/** An answer the desk gives itself; `plan` opens the order planner (fresh, continued, or with a compound added). */
export type QuickAnswer = { lead: string; artifact?: Artifact; source?: Source; plan?: { mode: "fresh" | "continue" | "add"; seed?: Partial<Plan> } };
export type QuickTurn = { call?: ToolCall; answer: (output: ToolOutput | null) => QuickAnswer };

const str = { type: "string", maxLength: 200 };
const schema = (name: string, properties: ToolSchema["parameters"]["properties"] = {}, required: string[] = []): ToolSchema =>
  ({ name, description: name, parameters: { type: "object", properties, required, additionalProperties: false } });
/** The server's visitor schemas for the tools these answers use, so they are checked the same way. */
export const QUICK_SCHEMAS: ToolSchema[] = [
  schema("search_catalog", { query: str, offset: { type: "integer", minimum: 0, maximum: 10000 }, limit: { type: "integer", minimum: 1, maximum: 10 } }),
  schema("get_product", { id: str }, ["id"]),
  schema("compare_products", { first: str, second: str, third: str }, ["first", "second"]),
  schema("lookup_lot", { lot: str }, ["lot"]),
  schema("compound_profile", { name: str }, ["name"]),
  schema("shipping_info"),
  schema("site_answers", { topic: { type: "string", enum: ["faq", "storage", "handling", "policies"] }, query: str }, ["topic"]),
  schema("order_status", { number: str }, ["number"]),
];

const call = (name: string, args: Record<string, unknown> = {}): ToolCall => ({ type: "tool_call", id: `quick-${crypto.randomUUID()}`, name, arguments: args });
const same = (a: string, ...b: string[]) => b.some((x) => a === x.toLowerCase());

function sizesOf(id: string) {
  const here = products.find((p) => p.id === id);
  return here ? products.filter((p) => p.name === here.name && p.active !== false) : [];
}

function lotAnswer(lot: string): QuickTurn {
  const printed = lot.toUpperCase();
  return { call: call("lookup_lot", { lot: printed }), answer: (output) => output?.artifact
    ? { lead: `Here's the certificate for lot ${printed}.`, artifact: output.artifact, source: output.source }
    : { lead: `I couldn't find lot ${printed}. Check the number printed on the vial's label, or talk to a person and we'll look it up.` } };
}

/** What a compound is: its profile when there is one, else its product card; the runtime decides. */
function profileAnswer(named: string): QuickTurn {
  return { call: call("compound_profile", { name: named }), answer: (output) => output?.artifact?.kind === "profile"
    ? { lead: `Here's ${output.artifact.profile.name}: what it is, what it acts on, and the published research behind it.`, artifact: output.artifact, source: output.source }
    : output?.artifact ? { lead: "Here it is, with its current lot.", artifact: output.artifact, source: output.source }
    : { lead: "That one isn't in the catalog right now." } };
}

function productAnswer(id: string): QuickTurn {
  return { call: call("get_product", { id }), answer: (output) => output?.artifact
    ? { lead: "Here it is, with its current lot.", artifact: output.artifact, source: output.source }
    : { lead: "That one isn't in the catalog right now." } };
}

function compareAnswer(ids: string[]): QuickTurn {
  const [first, second, third] = ids;
  return { call: call("compare_products", { first, second, ...(third ? { third } : {}) }), answer: (output) => ({ lead: "Here are its sizes side by side.", artifact: output?.artifact, source: output?.source }) };
}

/** The lot the desk shows when someone asks to see a real certificate: the catalog's best seller's. */
export function exampleLot() {
  const live = products.filter((p) => p.active !== false);
  return (live.find((p) => p.tag === "Best seller") ?? live[0])?.lot;
}

/** A certificate read line by line, from the same lookup that shows it. */
function explainAnswer(lot: string, focus: "certificate" | "purity"): QuickTurn {
  const printed = lot.toUpperCase();
  return { call: call("lookup_lot", { lot: printed }), answer: (output) => {
    const found = output?.artifact?.kind === "certificate" ? output.artifact : null;
    if (!found || !found.record.results.length) return { lead: `Lot ${printed}'s certificate isn't published yet, so there's nothing to read on it. Every released lot's certificate is on Verify.`, source: { label: "Verify a lot", href: "/verify" } };
    const lead = focus === "purity"
      ? "HPLC separates everything in a sample and draws each part as a peak. Purity is the main peak's share of all of them. Here it is on a real lot."
      : `Here's lot ${found.record.lot}, read line by line: each figure is the laboratory's own, and beside it is what it measures.`;
    return { lead, artifact: { kind: "explain", record: found.record, peaks: found.peaks, focus }, source: output?.source };
  } };
}

const byName = (named: string) => {
  const n = named.toLowerCase();
  return products.find((p) => p.active !== false && `${p.name} ${p.size}`.toLowerCase() === n) ?? products.find((p) => p.active !== false && p.name.toLowerCase() === n);
};

/** The answer for one of the desk's own questions, or null when the model should answer. `recent` is the
 *  lot whose certificate the conversation showed last; `planned` says an order plan is in progress. */
export function quickTurn(text: string, context: ChatContext | null, recent?: string, planned = false): QuickTurn | null {
  const asked = text.trim().replace(/\s+/g, " ");
  const bare = asked.replace(/[?.!]+$/, "");
  const q = bare.toLowerCase();
  const signedIn = Boolean(context?.signedIn);
  const viewing = context?.product;

  // The desk's services, each a card to act on without leaving the conversation.
  const panel = (kind: Panel, lead: string, topic?: string): QuickTurn => ({ answer: () => ({ lead, artifact: { kind: "panel", panel: kind, ...(topic ? { topic } : {}) } }) });
  if (same(q, "what can you do", "what can you help with", "what else can you do", "see everything i can help with", "help", "menu")) return panel("menu", "Here's everything I can help with. Tap any of it.");
  if (same(q, "track an order", "track my order") || (!signedIn && same(q, "where is my order"))) return panel("track", "Enter the order number and the email it was placed with, and I'll show where it is. No account needed.");
  if (same(q, "what's in my bag", "whats in my bag", "show my bag", "review my bag", "my bag", "check out", "checkout", "go to checkout")) return panel("bag", signedIn ? "Here's your bag, ready to change or check out." : "Here's where your bag stands.");
  if (same(q, "apply a discount code", "apply a code", "i have a discount code", "i have a code", "discount code", "promo code")) return panel("code", "Enter it here. It applies to your bag and comes off at checkout.");
  const policy = same(q, "what's your return policy", "whats your return policy", "return policy", "returns", "can i return an order") ? "returns"
    : same(q, "refund policy", "refunds") ? "refunds" : same(q, "shipping policy") ? "shipping"
    : same(q, "terms", "terms and conditions", "terms of sale") ? "terms" : same(q, "privacy policy", "privacy") ? "privacy" : null;
  if (policy) return panel("policy", `Here's our ${policy === "returns" || policy === "refunds" ? "refund and returns" : policy === "terms" ? "terms and conditions" : policy} policy, word for word. Open any section.`, policy);
  if (same(q, "common questions", "faq", "frequently asked questions")) return panel("faq", "Here are the questions researchers ask most. Open any of them.");
  const faq = faqs.find(([question]) => same(q, question.toLowerCase().replace(/[?]+$/, "").replace(/’/g, "'"), question.toLowerCase().replace(/[?]+$/, "")));
  if (faq) return panel("faq", "Here's the answer, with the other common questions beside it.", faq[0]);
  if (same(q, "talk to a person", "contact the team", "contact support", "i need to talk to someone", "speak to a person", "contact you")) return panel("contact", "Write to the team here. It goes straight to the right inbox, and a person replies by email.");
  if (same(q, "apply for an account", "open an account", "start my application", "start an application")) return panel("apply", signedIn ? "You already have a research account." : "Let's start it here: four short steps. The application page then takes your password and any documents.");
  if (same(q, "show me the research blog", "research blog", "research articles", "show me your research articles", "what have you written")) return panel("articles", "Here's the research blog, written for laboratory researchers.");
  if (same(q, "about truemark", "tell me about truemark", "who are you", "who is truemark", "what is truemark")) return panel("about", "Here's who we are, in our own words.");

  // The order planner: a few questions, then the order itself.
  if (same(q, "help me plan an order", "plan an order", "help me choose", "help me decide what to order", "continue my order plan")) return { answer: () => ({
    lead: planned ? "Here's your plan, right where you left it." : "Happy to. A few quick questions, and I'll put the order together. You can change any answer as you go.",
    plan: { mode: "continue" } }) };
  const around = /^plan an order with (.+)$/i.exec(bare);
  if (around) {
    const p = byName(around[1]);
    if (p) return { answer: () => ({ lead: `Let's plan it around ${p.name}. Set how much you need, and I'll work out the vials.`, plan: { mode: "add", seed: { picks: [p.name], step: "amount" } } }) };
  }
  const restock = /^restock order (tm-\d{3,})$/i.exec(bare);
  if (restock) {
    const number = restock[1].toUpperCase();
    return { call: call("order_status", { number }), answer: (output) => {
      const lines = output?.artifact?.kind === "order" ? output.artifact.order.lines : [];
      const from = planFromLines(lines, compoundsOf(products));
      if (!from.picks.length) return { lead: `None of the products in order ${number} are in the catalog right now.`, artifact: output?.artifact, source: output?.source };
      return { lead: `Here's order ${number} again as a plan, at today's lots and prices. Change anything you like, or add it all in one go.`,
        plan: { mode: "fresh", seed: { why: "restock", ...from, when: "flexible", freezer: "yes", step: "plan" } } };
    } };
  }
  const where = /^where is order (tm-\d{3,})$/i.exec(bare);
  if (where) return { call: call("order_status", { number: where[1].toUpperCase() }), answer: (output) => ({ lead: `Here's where order ${where[1].toUpperCase()} stands.`, artifact: output?.artifact, source: output?.source }) };
  const again = /^show me (.+) again$/i.exec(bare);
  if (again) { const p = byName(again[1]); if (p) return productAnswer(p.id); }

  if (same(q, "how is every lot tested", "how are lots tested", "how do you test your products", "how is it tested")) return { answer: () => ({
    lead: "Every lot goes through five stations, and only approved lots are released. Here they are, with the standard each lot is held to.",
    artifact: { kind: "process" }, source: { label: "Our quality process", href: "/quality" } }) };

  if (same(q, "show me a real certificate", "show me a certificate", "show me an example certificate")) {
    const lot = exampleLot();
    if (lot) return { call: call("lookup_lot", { lot }), answer: (output) => output?.artifact?.kind === "certificate"
      ? { lead: `Here's a real one, exactly as the laboratory reported it: lot ${output.artifact.record.lot}, ${output.artifact.record.product.name} ${output.artifact.record.product.size}.`, artifact: output.artifact, source: output.source }
      : { lead: "Every released lot's certificate is on Verify; enter the lot number from any label.", source: { label: "Verify a lot", href: "/verify" } } };
  }

  if (same(q, "how do i start ordering", "how do i open an account", "how do i create an account", "how do i get an account", "how do i order")) return { answer: () => ({
    lead: signedIn ? "You're signed in, so pricing and ordering are already open to you. Here's how an account opens, for anyone you'd send our way."
      : "Research accounts are for laboratories and research institutions. Opening one takes four short steps, and every application is reviewed.",
    artifact: { kind: "account" } }) };

  if (same(q, "how do i read a certificate", "how do i read this certificate", "what does a certificate show")) {
    const lot = recent ?? viewing?.lot ?? exampleLot();
    if (lot) return explainAnswer(lot, "certificate");
  }
  if (same(q, "what does hplc purity measure", "what is hplc", "what does purity mean")) {
    const lot = recent ?? viewing?.lot ?? exampleLot();
    if (lot) return explainAnswer(lot, "purity");
  }

  if (same(q, "verify a lot")) return { answer: () => ({ lead: "Every vial's lot number is printed on its label. Enter it here and I'll open that lot's certificate.", artifact: { kind: "lot-field" } }) };
  const lot = /^(?:verify|read|check|show)(?: me)? lot ([a-z0-9][a-z0-9-]{3,40})(?:'s certificate)?$/i.exec(asked.replace(/[?.!]+$/, ""));
  if (lot) return lotAnswer(lot[1]);
  if (viewing && same(q, "read its certificate", "get its certificate", "read their certificates")) return lotAnswer(viewing.lot);

  if (same(q, "find a compound", "browse the catalog", "show me the catalog", "what do you carry", "what do you sell")) return { call: call("search_catalog", { limit: 10 }), answer: (output) => ({
    lead: `Here's the catalog. Tap a compound for its sizes, current lot and certificate.${signedIn ? "" : " Prices open with a research account."}`,
    artifact: output?.artifact, source: output?.source }) };

  if (same(q, "how does shipping work", "how far am i from free shipping", "how are they shipped", "when would it arrive", "how is it kept cold")) return { call: call("shipping_info"), answer: (output) => ({
    lead: "Orders ship with signature on delivery, in insulated packs when applicable. Here's what each option costs.", artifact: output?.artifact, source: output?.source }) };

  if (same(q, "how is it stored", "how should it be stored", "how should they be stored", "how should i store it on arrival", "how should vials be stored", "storage")) return { answer: () => ({
    lead: "Here's how to keep it, from the day it arrives to the day it's opened.", artifact: { kind: "storage" }, source: { label: "Storage and handling", href: "/handling" } }) };

  if (viewing && same(q, "compare the sizes", "which sizes are there")) {
    const sizes = sizesOf(viewing.id);
    return sizes.length > 1 ? compareAnswer(sizes.slice(0, 3).map((p) => p.id)) : productAnswer(viewing.id);
  }

  const about = /^(?:tell me about|what is|what's) (.+)$/i.exec(asked.replace(/[?.!]+$/, ""));
  if (about) {
    const named = about[1].toLowerCase();
    const found = products.find((p) => `${p.name} ${p.size}`.toLowerCase() === named) ?? products.find((p) => p.name.toLowerCase() === named);
    if (found) return profileAnswer(`${found.name} ${found.size}`);
  }

  if (same(q, "what are your most popular compounds", "what's popular", "what is popular", "most popular", "what are your best sellers", "what's new")) return { call: call("search_catalog", { limit: 10 }), answer: (output) => {
    const tiles = output?.artifact?.kind === "catalog" ? output.artifact.tiles : [];
    const named = (tag: string) => tiles.filter((t) => t.tag === tag).map((t) => t.name);
    const list = (names: string[]) => names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
    const best = named("Best seller"), fresh = named("New");
    const lead = [best.length ? `Our best ${best.length > 1 ? "sellers are" : "seller is"} ${list(best)}` : "", fresh.length ? `${best.length ? ", and " : ""}${list(fresh)} ${fresh.length > 1 ? "are" : "is"} new` : ""].join("");
    return { lead: `${lead ? `${lead}. ` : ""}Here's the whole shelf, with those first; tap any vial to see what it is and how it's studied.`,
      artifact: output?.artifact?.kind === "catalog" ? { ...output.artifact, tiles: [...tiles].sort((a, b) => Number(Boolean(b.tag)) - Number(Boolean(a.tag))) } : output?.artifact, source: output?.source };
  } };
  return null;
}
