import { LIVE } from "./mode";
import { live } from "./live/runtime";
import { previewInventory } from "./preview/inventory";
export const inventoryStore: typeof previewInventory = {
  save: input => LIVE ? live().inventory.save(input) : previewInventory.save(input),
  receive: (id,q,at,request) => LIVE ? live().inventory.receive(id,q,at,request) : previewInventory.receive(id,q,at,request),
  history: id => LIVE ? live().inventory.history(id) : previewInventory.history(id),
  removeCertificate: (id,reason) => LIVE ? live().inventory.removeCertificate(id,reason) : previewInventory.removeCertificate(id,reason),
  returnUnits: (id,q,reason,resale,request) => LIVE ? live().inventory.returnUnits(id,q,reason,resale,request) : previewInventory.returnUnits(id,q,reason,resale,request),
  substitute: (order,product,allocations,reason) => LIVE ? live().inventory.substitute(order,product,allocations,reason) : previewInventory.substitute(order,product,allocations,reason),
};
