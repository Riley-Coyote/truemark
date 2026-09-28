/**
 * The platform's data contract. The front end is built against these shapes;
 * the eventual backend (self-hosted, the client's own database) implements them.
 * Money is in US dollars. Dates are ISO strings.
 */

export type Money = number;

export type Address = {
  id: string;
  label: string;
  institution: string;
  attention: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  phone?: string;
};

export type BuyerStatus = "verified" | "pending" | "declined" | "suspended";

export type Buyer = {
  id: string;
  name: string;
  email: string;
  institution: string;
  role: string;
  status: BuyerStatus;
  joinedAt: string;
  verifiedAt?: string;
  addresses: Address[];
};

export type ApplicationStatus = "submitted" | "approved" | "declined";

/** A request for a research account; approval is what lets a buyer check out. */
export type Application = {
  id: string;
  submittedAt: string;
  status: ApplicationStatus;
  name: string;
  email: string;
  role: string;
  institution: string;
  institutionType: string;
  website?: string;
  researchArea: string;
  intendedUse: string;
  attestations: string[];
  documents: string[];
  reviewedAt?: string;
  reviewNote?: string;
};

export type ShippingMethodId = "cold-2day" | "cold-overnight";

export type ShippingMethod = {
  id: ShippingMethodId;
  label: string;
  detail: string;
  price: Money;
};

export type OrderStatus = "placed" | "paid" | "packed" | "shipped" | "delivered" | "cancelled" | "refunded";
export type PaymentStatus = "authorized" | "captured" | "refunded" | "failed";

export type OrderLine = {
  productId: string;
  quantity: number;
  unitPrice: Money;
  lot: string;
};

export type OrderEvent = { status: OrderStatus; at: string; note?: string };

export type Order = {
  id: string;
  number: string;
  buyerId: string;
  createdAt: string;
  status: OrderStatus;
  payment: PaymentStatus;
  lines: OrderLine[];
  address: Address;
  shipping: { method: ShippingMethodId; price: Money; carrier?: string; tracking?: string };
  subtotal: Money;
  discount?: { code: string; amount: Money; partnerId?: string };
  total: Money;
  events: OrderEvent[];
};

export type OrderDraft = {
  lines: { productId: string; quantity: number }[];
  address: Address;
  shipping: ShippingMethodId;
  discountCode?: string;
  /** How a partner's code arrived: typed at checkout, or carried by their link. */
  via?: "link" | "code";
};

export type LotStatus = "quarantine" | "testing" | "released" | "rejected" | "archived";

export type LotResult = { label: string; method: string; value: string; unit: string };

/**
 * A production lot. Lots from the client's first batch are real identifiers with
 * no published results; `sample` lots are fictional and exist only to show states.
 */
export type Lot = {
  lot: string;
  productId: string;
  status: LotStatus;
  receivedAt: string;
  testedAt?: string;
  releasedAt?: string;
  results: LotResult[];
  reference?: string;
  units: number;
  sample: boolean;
};

export type PartnerStatus = "active" | "pending" | "paused";

export type Partner = {
  id: string;
  name: string;
  handle: string;
  email: string;
  code: string;
  /** Commission as a fraction of the order subtotal after discount, e.g. 0.12. */
  rate: number;
  /** Discount the partner's code gives the buyer, as a fraction. */
  codeDiscount: number;
  status: PartnerStatus;
  joinedAt: string;
  audience: string;
};

export type ReferralStatus = "pending" | "approved" | "paid" | "void";

export type Referral = {
  id: string;
  partnerId: string;
  orderId: string;
  orderNumber: string;
  createdAt: string;
  orderSubtotal: Money;
  commission: Money;
  status: ReferralStatus;
  via: "link" | "code";
};

export type Payout = {
  id: string;
  partnerId: string;
  periodStart: string;
  periodEnd: string;
  amount: Money;
  referrals: number;
  status: "scheduled" | "paid";
  paidAt?: string;
  method: string;
};

export type Visit = { date: string; clicks: number };

export type Discount = {
  code: string;
  kind: "partner" | "promo";
  percent: number;
  partnerId?: string;
  active: boolean;
  uses: number;
  expiresAt?: string;
};
