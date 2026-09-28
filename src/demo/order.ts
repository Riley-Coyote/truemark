import * as seed from "../platform/seed";
import type { OrderDraft } from "../platform/types";

/** The researcher and the partner in the live demo: the sample account and the sample partner. */
export const demoBuyer = seed.buyers.find((b) => b.id === seed.demoBuyerId)!;
export const demoPartner = seed.partners.find((p) => p.id === seed.demoPartnerId)!;

/** The order the live demo places: two BPC-157 and a GHK-Cu, through the partner's link. */
export const demoDraft: OrderDraft = {
  lines: [
    { productId: "bpc-157-10-mg", quantity: 2 },
    { productId: "ghk-cu-100-mg", quantity: 1 },
  ],
  address: demoBuyer.addresses[0],
  shipping: seed.shippingMethods[0].id,
  discountCode: demoPartner.code,
  via: "link",
};
