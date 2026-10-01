import type * as Preview from "../preview/store";
import type { OrderDraft } from "../types";
import { live } from "./runtime";

// Lazy wrappers prevent importing this adapter from initializing a client.
export const store: typeof Preview.store = {
  assistant: {
    saveModels: (models) => live().store.assistant.saveModels(models),
    identity: () => live().store.assistant.identity(),
    capabilities: () => live().store.assistant.capabilities(),
    products: () => live().store.assistant.products(),
    productRecord: (id) => live().store.assistant.productRecord(id),
    journal: (all) => live().store.assistant.journal(all),
  },
  settings: { get: () => live().store.settings.get(), save: (patch) => live().store.settings.save(patch) },
  session: { get: () => live().store.session.get(), signIn: (email) => live().store.session.signIn(email), signOut: () => live().store.session.signOut() },
  catalog: { products: (all) => live().store.catalog.products(all), categories: () => live().store.catalog.categories(),
    saveProduct: (draft, expectedStock) => live().store.catalog.saveProduct(draft, expectedStock), saveCategory: (draft) => live().store.catalog.saveCategory(draft),
    uploadPhoto: (id, file) => live().store.catalog.uploadPhoto(id, file), shippingMethods: () => live().store.catalog.shippingMethods(), validateCode: (code) => live().store.catalog.validateCode(code) },
  orders: { list: () => live().store.orders.list(), listForBuyer: (id) => live().store.orders.listForBuyer(id), get: (id) => live().store.orders.get(id), place: (id, draft) => live().store.orders.place(id, draft), advance: (id, status, extra) => live().store.orders.advance(id, status, extra) },
  lots: { list: () => live().store.lots.list(), get: (lot) => live().store.lots.get(lot), setStatus: (lot, status) => live().store.lots.setStatus(lot, status) },
  buyers: { list: () => live().store.buyers.list(), get: (id) => live().store.buyers.get(id) },
  applications: { list: () => live().store.applications.list(), submit: (form) => live().store.applications.submit(form), review: (id, status, note) => live().store.applications.review(id, status, note) },
  partners: { list: () => live().store.partners.list(), get: (id) => live().store.partners.get(id), me: () => live().store.partners.me(), referrals: (id) => live().store.partners.referrals(id), payouts: (id) => live().store.partners.payouts(id), visits: (id) => live().store.partners.visits(id), discounts: () => live().store.partners.discounts() },
};
export function quote(_draft: OrderDraft): ReturnType<typeof Preview.quote> {
  throw new Error("The preview quote needs the preview world. Live orders are priced by the database.");
}
/** An async estimate from current public rows; place_order remains authoritative. */
export const quoteLive = (draft: OrderDraft) => live().quote(draft);
