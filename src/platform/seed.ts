/**
 * Sample data for the design preview. Every person, institution, order and
 * partner here is fictional (emails use the reserved .example domain).
 * Lots from the client's first batch use their real identifiers but carry no
 * results; fictional sample lots exist only to show each state.
 * Rates and prices marked "sample" are placeholders for the client to set.
 */
import { products } from "../data";
import type {
  Address,
  Application,
  Buyer,
  Discount,
  Lot,
  Order,
  OrderEvent,
  OrderStatus,
  Partner,
  Payout,
  Referral,
  ShippingMethod,
  Visit,
} from "./types";

/** Deterministic PRNG so the sample data is identical on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(2609);
const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
const round2 = (n: number) => Math.round(n * 100) / 100;

export const TODAY = "2026-09-25";
const day = (offset: number, hour = 10) => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - offset);
  d.setUTCHours(hour, Math.floor(rand() * 60));
  return d.toISOString();
};

/**
 * A tracking number in UPS's own shape: 1Z, a six-character shipper account (a sample
 * one), a two-digit service (01 next day, 02 second day) and an eight-digit parcel number.
 */
export function upsTracking(parcel: number, service: "01" | "02" = "02") {
  return `1Z4TM82V${service}${String(parcel % 100_000_000).padStart(8, "0")}`;
}

export const shippingMethods: ShippingMethod[] = [
  { id: "cold-2day", label: "Cold chain · 2 business days", detail: "Shipped with temperature control", price: 24 },
  { id: "cold-overnight", label: "Cold chain · overnight", detail: "Shipped with temperature control, next business day", price: 42 },
];

const institutions = [
  ["Northfield Research Laboratory", "Principal investigator", "Dr. Mara Ellison", "northfield-lab.example"],
  ["Calder Bio Institute", "Lab manager", "Owen Hartley", "calder-bio.example"],
  ["Harrow Analytical", "Research scientist", "Dr. Priya Raman", "harrow-analytical.example"],
  ["Westbrook Cell Lab", "Procurement lead", "Nina Castell", "westbrook-cell.example"],
  ["Linden Peptide Group", "Postdoctoral fellow", "Dr. Tomas Ruiz", "linden-peptide.example"],
  ["Ashgrove Molecular", "Research associate", "Hana Kobayashi", "ashgrove-mol.example"],
  ["Brightwater Research", "Principal investigator", "Dr. Elise Moreau", "brightwater-research.example"],
  ["Kestrel Biosciences", "Lab manager", "Felix Aldana", "kestrel-bio.example"],
  ["Marlow Assay Lab", "Research scientist", "Dr. Ines Varga", "marlow-assay.example"],
  ["Halden Research", "Graduate researcher", "Leo Brandt", "halden-research.example"],
  ["Corvin Labs", "Procurement lead", "Sofia Lindqvist", "corvin-labs.example"],
  ["Ellery Biochem", "Principal investigator", "Dr. Kwame Mensah", "ellery-biochem.example"],
  ["Vantor Analytical", "Research associate", "Mei Tanaka", "vantor-analytical.example"],
  ["Silverleaf Bio", "Lab manager", "Arjun Mehta", "silverleaf-bio.example"],
  ["Thornbury Lab", "Research scientist", "Dr. Clara Weiss", "thornbury-lab.example"],
] as const;

const cities = [
  ["Madison", "WI", "53706"],
  ["Durham", "NC", "27701"],
  ["Boulder", "CO", "80302"],
  ["Ann Arbor", "MI", "48109"],
  ["Pittsburgh", "PA", "15213"],
  ["San Diego", "CA", "92121"],
  ["Cambridge", "MA", "02139"],
  ["Austin", "TX", "78712"],
] as const;

function addressFor(index: number, institution: string, attention: string): Address {
  const [city, region, postal] = cities[index % cities.length];
  return {
    id: `a-${1000 + index}`,
    label: "Laboratory",
    institution,
    attention,
    line1: `${120 + index * 17} Research Park Drive`,
    line2: `Suite ${200 + index * 3}`,
    city,
    region,
    postal,
    country: "United States",
    phone: `(555) 01${String(index).padStart(2, "0")}-${4000 + index * 7}`,
  };
}

export const buyers: Buyer[] = institutions.map(([institution, role, name, domain], i) => {
  const local = name.replace(/^Dr\. /, "").toLowerCase().split(" ");
  return {
    id: `b-${1001 + i}`,
    name,
    email: `${local[0][0]}.${local[local.length - 1]}@${domain}`,
    institution,
    role,
    status: i === 13 ? "suspended" : "verified",
    joinedAt: day(200 - i * 9),
    verifiedAt: day(198 - i * 9),
    addresses: [addressFor(i, institution, name)],
  };
});

/** The buyer the storefront signs in as in the preview. */
export const demoBuyerId = "b-1001";

export const applications: Application[] = [
  ["Dr. Rhea Castellano", "Principal investigator", "Morrow Institute for Protein Science", "University", "Cell signalling"],
  ["Daniel Osei", "Lab manager", "Fenwick Contract Research", "Contract research organization", "Assay development"],
  ["Dr. Yuki Sato", "Research scientist", "Aldergrove Biotech", "Biotechnology company", "Metabolic research"],
  ["Grace Holloway", "Graduate researcher", "Lakemont University", "University", "Neuropeptide research"],
  ["Marco Bellini", "Procurement lead", "Sable Point Laboratories", "Independent laboratory", "Analytical chemistry"],
  ["Dr. Amara Nwosu", "Principal investigator", "Crestline Research", "Independent laboratory", "Tissue research"],
  ["Peter Lund", "Research associate", "Ivybridge Analytical", "Contract research organization", "Stability testing"],
].map(([name, role, institution, institutionType, researchArea], i) => ({
  id: `app-${301 + i}`,
  submittedAt: day(i < 4 ? i : 6 + i * 3, 9 + i),
  status: i < 4 ? "submitted" : i === 6 ? "declined" : "approved",
  name,
  email: `${name.replace(/^Dr\. /, "").toLowerCase().replace(/ /g, ".")}@${institution.toLowerCase().split(" ")[0]}.example`,
  role,
  institution,
  institutionType,
  website: `https://${institution.toLowerCase().split(" ")[0]}.example`,
  researchArea,
  intendedUse: "In vitro laboratory research under our institutional protocols. Materials are stored and handled under our standard operating procedures.",
  attestations: ["research-only", "not-for-human-use", "storage-sop", "terms"],
  documents: i % 2 === 0 ? ["Institutional letter.pdf"] : ["Institution ID.pdf", "Purchasing approval.pdf"],
  reviewedAt: i < 4 ? undefined : day(4 + i * 3),
  reviewNote: i === 6 ? "Could not confirm the institution's address." : undefined,
})) as Application[];

export const partners: Partner[] = [
  ["Jordan Vale", "@valelabnotes", "VALE10", 0.12, 0.1, "active", "Lab methods newsletter"],
  ["Priya Anand", "@benchnotes", "BENCH10", 0.12, 0.1, "active", "Research supply reviews"],
  ["Sam Okafor", "@okafor.methods", "OKAFOR10", 0.1, 0.1, "active", "Assay walkthroughs"],
  ["Lena Brandt", "@brandtlab", "BRANDT8", 0.1, 0.08, "active", "Lab operations podcast"],
  ["Chris Marlow", "@marlowmethod", "MARLOW10", 0.1, 0.1, "paused", "Protocol explainers"],
  ["Ava Chen", "@chen.research", "CHEN10", 0.12, 0.1, "active", "Research education"],
  ["Theo Price", "@priceofprotocol", "PRICE5", 0.08, 0.05, "pending", "Methods blog"],
].map(([name, handle, code, rate, codeDiscount, status, audience], i) => ({
  id: `p-${201 + i}`,
  name: name as string,
  handle: handle as string,
  email: `${(name as string).toLowerCase().replace(/ /g, ".")}@partners.example`,
  code: code as string,
  rate: rate as number,
  codeDiscount: codeDiscount as number,
  status: status as Partner["status"],
  joinedAt: day(150 - i * 14),
  audience: audience as string,
}));

/** The partner the portal signs in as in the preview. */
export const demoPartnerId = "p-201";

export const discounts: Discount[] = [
  ...partners.map((p) => ({
    code: p.code,
    kind: "partner" as const,
    percent: p.codeDiscount * 100,
    partnerId: p.id,
    active: p.status === "active",
    uses: 0,
  })),
  // The first-order offer the shop advertises (sample terms for the client to set).
  { code: "FIRSTLOT", kind: "promo", percent: 10, active: true, uses: 0 },
  { code: "WELCOME5", kind: "promo", percent: 5, active: true, uses: 0 },
  { code: "SPRING26", kind: "promo", percent: 10, active: false, uses: 0, expiresAt: "2026-05-31T23:59:00.000Z" },
];

const statusFlow: OrderStatus[] = ["placed", "paid", "packed", "shipped", "delivered"];

function buildOrder(i: number, buyer: Buyer, offset: number): Order {
  const lineCount = 1 + Math.floor(rand() * 3);
  const chosen = new Set<string>();
  const priced = products.filter((p) => p.price !== undefined);
  while (chosen.size < lineCount) chosen.add(pick(priced).id);
  const lines = [...chosen].map((productId) => {
    const product = priced.find((p) => p.id === productId)!;
    return { productId, quantity: 1 + Math.floor(rand() * 4), unitPrice: product.price!, lot: product.lot };
  });
  const subtotal = round2(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
  // One in three referred orders goes to the preview partner, so the portal shows a partner
  // with a working month: commission paid, approved for the next payout, and pending. The
  // same draws are made either way, so every other order is unchanged.
  const picked = rand() < 0.38 ? pick(partners.filter((p) => p.status !== "pending")) : undefined;
  const partner = picked && i % 3 === 2 ? partners.find((p) => p.id === demoPartnerId) : picked;
  const discountAmount = partner ? round2(subtotal * partner.codeDiscount) : 0;
  const method = rand() < 0.7 ? shippingMethods[0] : shippingMethods[1];
  // Newer orders are earlier in their journey.
  const stage = offset === 0 ? 0 : offset <= 1 ? 1 : offset <= 3 ? 2 : offset <= 6 ? 3 : 4;
  const cancelled = i % 29 === 11;
  const events: OrderEvent[] = statusFlow.slice(0, stage + 1).map((status, k) => {
    const on = Math.max(0, offset - k * (k < 3 ? 0 : 2));
    // A step that lands on the last sample day happens in its morning, before the sample clock's
    // afternoon begins (storage.ts), so the Live feed and the pipeline tell the same story.
    return { status, at: day(on, on === 0 ? 10 + k : 10 + k * 2) };
  });
  // A cancelled order stops where it was cancelled: placed and paid at most, then refunded. The
  // later steps' dates are still drawn above, so every other order's draws are unchanged.
  if (cancelled) {
    events.splice(2);
    events.push({ status: "cancelled", at: day(Math.max(0, offset - 1), 16), note: "Cancelled at the buyer's request." });
  }
  const status: OrderStatus = cancelled ? "cancelled" : statusFlow[stage];
  return {
    id: `o-${10421 + i}`,
    number: `TM-${10421 + i}`,
    buyerId: buyer.id,
    createdAt: events[0].at,
    status,
    payment: cancelled ? "refunded" : stage === 0 ? "authorized" : "captured",
    lines,
    address: buyer.addresses[0],
    shipping: {
      method: method.id,
      price: method.price,
      carrier: stage >= 3 && !cancelled ? "UPS" : undefined,
      tracking: stage >= 3 && !cancelled ? upsTracking(48213000 + i * 7919, method.id === "cold-overnight" ? "01" : "02") : undefined,
    },
    subtotal,
    discount: partner ? { code: partner.code, amount: discountAmount, partnerId: partner.id } : undefined,
    total: round2(subtotal - discountAmount + method.price),
    events,
  };
}

const history: Order[] = (() => {
  const list: Order[] = [];
  let i = 0;
  // Roughly twelve weeks of orders, busier toward the present.
  for (let offset = 84; offset >= 0; offset--) {
    const count = rand() < 0.35 + (84 - offset) / 200 ? (rand() < 0.3 ? 2 : 1) : 0;
    for (let k = 0; k < count; k++) {
      const buyer = pick(buyers.filter((b) => b.status === "verified"));
      list.push(buildOrder(i++, buyer, offset));
    }
  }
  // The preview buyer always has a short, legible history.
  const demo = buyers.find((b) => b.id === demoBuyerId)!;
  for (const offset of [2, 19, 47]) list.push(buildOrder(i++, demo, offset));
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
})();

/**
 * The last sample day's morning: three orders, so the command center opens on a working day.
 * They are written out rather than drawn, so no random draw moves and every earlier figure,
 * referral and payout stays exactly as it was.
 */
function morningOrder(
  n: number,
  buyerId: string,
  time: string,
  items: [string, number][],
  partnerCode: string | undefined,
  paid: boolean,
): Order {
  const buyer = buyers.find((b) => b.id === buyerId)!;
  const lines = items.map(([productId, quantity]) => {
    const product = products.find((p) => p.id === productId)!;
    return { productId, quantity, unitPrice: product.price!, lot: product.lot };
  });
  const subtotal = round2(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
  const partner = partnerCode ? partners.find((p) => p.code === partnerCode) : undefined;
  const discountAmount = partner ? round2(subtotal * partner.codeDiscount) : 0;
  const method = shippingMethods[0];
  const at = (clock: string) => `${TODAY}T${clock}:00.000Z`;
  const [h, m] = time.split(":").map(Number);
  const events: OrderEvent[] = [{ status: "placed", at: at(time) }];
  if (paid) events.push({ status: "paid", at: at(`${String(h).padStart(2, "0")}:${String(m + 12).padStart(2, "0")}`) });
  return {
    id: `o-${10421 + n}`,
    number: `TM-${10421 + n}`,
    buyerId,
    createdAt: at(time),
    status: paid ? "paid" : "placed",
    payment: paid ? "captured" : "authorized",
    lines,
    address: buyer.addresses[0],
    shipping: { method: method.id, price: method.price },
    subtotal,
    discount: partner ? { code: partner.code, amount: discountAmount, partnerId: partner.id } : undefined,
    total: round2(subtotal - discountAmount + method.price),
    events,
  };
}

const morning: Order[] = [
  morningOrder(history.length + 2, "b-1004", "13:37", [["ghk-cu-100-mg", 2], ["semax-10-mg", 2]], "VALE10", false),
  morningOrder(history.length + 1, "b-1002", "11:02", [["bpc-157-10-mg", 2]], "BENCH10", false),
  morningOrder(history.length, "b-1007", "09:14", [["retatrutide-20-mg", 1], ["bacteriostatic-water-10-ml", 2]], undefined, true),
];

export const orders: Order[] = [...morning, ...history];

const historyReferrals: Referral[] = history
  .filter((o) => o.discount?.partnerId && o.status !== "cancelled")
  .map((o, i) => {
    const partner = partners.find((p) => p.id === o.discount!.partnerId)!;
    const base = o.subtotal - o.discount!.amount;
    const ageDays = (Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(o.createdAt)) / 86_400_000;
    return {
      id: `r-${5001 + i}`,
      partnerId: partner.id,
      orderId: o.id,
      orderNumber: o.number,
      createdAt: o.createdAt,
      orderSubtotal: round2(base),
      commission: round2(base * partner.rate),
      status: ageDays > 31 ? "paid" : ageDays > 14 ? "approved" : "pending",
      via: rand() < 0.55 ? "code" : "link",
    };
  });

/** The morning's two partner orders, written out like the orders themselves. */
const morningVia: Record<string, Referral["via"]> = { VALE10: "link", BENCH10: "code" };
const morningReferrals: Referral[] = morning
  .filter((o) => o.discount?.partnerId)
  .map((o, k) => {
    const partner = partners.find((p) => p.id === o.discount!.partnerId)!;
    const base = round2(o.subtotal - o.discount!.amount);
    return {
      id: `r-${5901 + k}`,
      partnerId: partner.id,
      orderId: o.id,
      orderNumber: o.number,
      createdAt: o.createdAt,
      orderSubtotal: base,
      commission: round2(base * partner.rate),
      status: "pending",
      via: morningVia[o.discount!.code],
    };
  });

export const referrals: Referral[] = [...morningReferrals, ...historyReferrals];

for (const d of discounts) {
  d.uses = orders.filter((o) => o.discount?.code === d.code).length;
}

export const payouts: Payout[] = partners.flatMap((partner) =>
  [
    ["2026-07-01", "2026-07-31", "2026-08-05"],
    ["2026-08-01", "2026-08-31", "2026-09-05"],
  ].map(([start, end, paidAt], k) => {
    const inPeriod = referrals.filter(
      (r) => r.partnerId === partner.id && r.createdAt >= start && r.createdAt <= `${end}T23:59:59Z` && r.status === "paid",
    );
    return {
      id: `pay-${partner.id}-${k}`,
      partnerId: partner.id,
      periodStart: start,
      periodEnd: end,
      amount: round2(inPeriod.reduce((s, r) => s + r.commission, 0)),
      referrals: inPeriod.length,
      status: "paid" as const,
      paidAt,
      method: "Bank transfer",
    };
  }),
).filter((p) => p.referrals > 0);

/** The shape of a partner's traffic over the last 60 days: weekday rhythm, slow growth. */
const visitShape: Visit[] = Array.from({ length: 60 }, (_, i) => {
  const offset = 59 - i;
  const weekday = new Date(Date.parse(`${TODAY}T00:00:00Z`) - offset * 86_400_000).getUTCDay();
  const base = 48 + (59 - offset) * 0.5 + (weekday === 0 || weekday === 6 ? -12 : 0);
  return { date: day(offset).slice(0, 10), clicks: Math.max(4, Math.round(base + (rand() - 0.5) * 30)) };
});

/**
 * A partner's clicks: the shared shape, scaled to their own referrals so that the last 30
 * days convert at a believable 1.1–1.9% (sample figures; each partner has a steady rate).
 */
export function visitsFor(partnerId: string): Visit[] {
  const recent = visitShape.slice(30);
  const since = Date.parse(`${recent[0].date}T00:00:00Z`);
  const referred = referrals.filter((r) => r.partnerId === partnerId && Date.parse(r.createdAt) >= since).length;
  const hash = [...partnerId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7);
  const rate = 0.011 + (hash % 9) * 0.001;
  const scale = Math.max(referred, 1) / rate / recent.reduce((sum, v) => sum + v.clicks, 0);
  return visitShape.map((v) => ({ date: v.date, clicks: Math.max(1, Math.round(v.clicks * scale)) }));
}

/** The illustrative record from the client's original mockup. Not a real lot. */
export const sampleRecord = {
  lot: "BP10-2611A",
  productId: "bpc-157-10-mg",
  compound: "BPC-157",
  presentation: "10 mg · Lyophilized powder",
  reference: "TM-COA-0114",
  results: [
    { label: "Purity", method: "HPLC", value: "99.31", unit: "%" },
    { label: "Identity", method: "Mass spectrometry", value: "Confirmed", unit: "" },
    { label: "Endotoxin", method: "LAL", value: "< 0.25", unit: "EU/mg" },
    { label: "Sterility", method: "", value: "Pass", unit: "" },
  ],
  status: "Released",
  laboratory: "Contracted laboratory",
  /** Dates agree with the client's paper trail below. */
  receivedAt: "2026-08-02T14:00:00.000Z",
  testedAt: "2026-08-11T14:00:00.000Z",
  releasedAt: "2026-08-12T14:00:00.000Z",
  /** The client's own paper trail for this lot. */
  trail: [
    { step: "Received", date: "02 Aug", iso: "2026-08-02", detail: "Batch logged" },
    { step: "Quarantined", date: "02 Aug", iso: "2026-08-02", detail: "Held at −20 °C" },
    { step: "Sampled", date: "05 Aug", iso: "2026-08-05", detail: "Sent to laboratory" },
    { step: "Tested", date: "11 Aug", iso: "2026-08-11", detail: "HPLC · MS" },
    { step: "Released", date: "12 Aug", iso: "2026-08-12", detail: "Certificate published" },
    { step: "Shipped", date: "14 Aug", iso: "2026-08-14", detail: "Cold chain" },
  ],
};

export const lots: Lot[] = [
  // The client's first batch: real identifiers, results not yet supplied.
  ...products.map((p, i) => ({
    lot: p.lot,
    productId: p.id,
    status: "testing" as const,
    receivedAt: day(20 - (i % 5)),
    results: [],
    units: 80 + (i % 4) * 40,
    sample: false,
  })),
  // Fictional lots that show the other states. The first is the client mockup's record.
  {
    lot: sampleRecord.lot,
    productId: sampleRecord.productId,
    status: "released",
    receivedAt: sampleRecord.receivedAt,
    testedAt: sampleRecord.testedAt,
    releasedAt: sampleRecord.releasedAt,
    results: sampleRecord.results,
    reference: sampleRecord.reference,
    units: 0,
    sample: true,
  },
  { lot: "SAMPLE-RT30-A", productId: "retatrutide-30-mg", status: "released", receivedAt: day(70), releasedAt: day(61), results: [{ label: "Purity", method: "HPLC", value: "99.12", unit: "%" }, { label: "Identity", method: "Mass spectrometry", value: "Confirmed", unit: "" }], reference: "TM-COA-0109", units: 0, sample: true },
  { lot: "SAMPLE-GH100-A", productId: "ghk-cu-100-mg", status: "archived", receivedAt: day(140), releasedAt: day(131), results: [{ label: "Purity", method: "HPLC", value: "99.04", unit: "%" }], reference: "TM-COA-0088", units: 0, sample: true },
  { lot: "SAMPLE-SM20-C", productId: "semaglutide-20-mg", status: "rejected", receivedAt: day(33), results: [{ label: "Purity", method: "HPLC", value: "97.40", unit: "%" }], reference: "TM-COA-0121", units: 0, sample: true },
  { lot: "SAMPLE-TZ30-B", productId: "tirzepatide-30-mg", status: "quarantine", receivedAt: day(1), results: [], units: 120, sample: true },
] as Lot[];
