import type { Lot, OrderLine } from "./types";
import { releaseProblem } from "./certificate-records";

export type LotInput = { id?: string; version?: number; productId: string; number: string; expectedUnits: number; expectedAt?: string; receivedAt?: string | null; units?: number | null; status?: "active" | "held" | "archived" | "rejected" | "quarantine" | "awaiting_certificate"; holdReason?: string; reason: string; resaleConfirmed?: boolean };
export type InventoryEvent = { id: string; productId: string; lotId?: string; kind: string; reason: string; before?: unknown; after?: unknown; actor?: string; at: string };
export const lotNumber = (lot: Lot) => lot.number || lot.lot;
export const lotKey = (lot: Lot) => lot.id || lot.lot;
export function lotStage(lot: Lot): string {
  if (lot.status === "archived") return "Archived";
  if (lot.status === "rejected" || lot.testingStatus === "failed") return "Rejected";
  if (lot.holdReason) return "On hold";
  if (!lot.receivedAt) return (lot.units ?? 0)>0 ? "Receipt date needed" : "Incoming";
  if (lot.testingStatus !== "passed") return "Quarantine";
  if (!lot.coaPath && !lot.coaUrl) return "Awaiting certificate";
  if (lot.status !== "released" || releaseProblem(lot.results)) return "Quarantine";
  if (lot.units === null) return "Count needed";
  if (lot.units < (lot.reservedUnits ?? 0)) return "Count conflict";
  return lot.units === 0 ? "Exhausted" : "Available";
}
export const lotAvailable = (lot: Lot) => lotStage(lot) === "Available" ? Math.max(0, (lot.units ?? 0) - (lot.reservedUnits ?? 0)) : 0;
/** The lots anyone may read: released, with results. The database's released_lots() keeps the same rows. */
export const publiclyReleased = (lot: Lot) => lot.status === "released" && lot.results.length > 0;
/**
 * A released lot as visitors and customers read it: what the storefront shows, and nothing of its stock, its
 * hold or rejection notes, who last saved it or its bookkeeping. The live and preview stores both give this shape.
 */
export function publicLot(lot: Lot): Lot {
  const { lot: id, number, productId, status, testingStatus, testedAt, releasedAt, results, reference, coaPath, coaUrl, sample } = lot;
  return { lot: id, number, productId, status, testingStatus, testedAt, releasedAt, results, reference, coaPath, coaUrl, receivedAt: null, units: null, sample };
}
export const incomingUnits = (lot: Lot) => Math.max(0, (lot.expectedUnits ?? 0) - (lot.receivedUnits ?? 0));
export const fifoLots = (lots: Lot[]) => [...lots].sort((a,b) => (a.receivedAt ?? "9999").localeCompare(b.receivedAt ?? "9999") || lotKey(a).localeCompare(lotKey(b)));
export function inventoryTotals(lots: Lot[]) {
  return lots.reduce((s,l) => { const free=Math.max(0,(l.units ?? 0)-(l.reservedUnits ?? 0)); const stage=lotStage(l);
    s.onHand += l.units ?? 0; s.reserved += l.reservedUnits ?? 0; s.incoming += incomingUnits(l); s.available += lotAvailable(l);
    if(stage === "Quarantine") s.quarantine += free;
    else if(stage === "Awaiting certificate") s.awaiting += free;
    else if(!["Available","Exhausted"].includes(stage)) s.held += free;
    if(l.units === null || stage === "Receipt date needed") s.unknown += 1;
    return s;
  },{onHand:0,reserved:0,incoming:0,available:0,quarantine:0,awaiting:0,held:0,unknown:0});
}
/** Physical picking/certificates can span lots while the commercial line stays intact. */
export function allocatedLines(lines: OrderLine[]): OrderLine[] {
  return lines.flatMap(line => {
    if (!line.allocations?.length) return [line];
    // A line's free units (the free BAC Water vial) are counted on its last lots, so each part charges what it holds.
    let free = line.freeQuantity ?? 0;
    return line.allocations.filter(a=>a.state!=="released").reverse().map(a=>{
      const here = Math.min(free, a.quantity); free -= here;
      const { freeQuantity: _whole, ...rest } = line;
      return {...rest,quantity:a.quantity,lot:a.lot,allocations:[a],...(here ? { freeQuantity: here } : {})};
    }).reverse();
  });
}

/** Null is an unknown count/date, always last regardless of sort direction. */
export function compareNullable(a: string | number | null, b: string | number | null, direction: "asc" | "desc") {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  const order = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
  return order * (direction === "asc" ? 1 : -1);
}

/** Sum recorded counts. An entirely untracked inventory is not zero stock. */
export function sumTracked(values: (number | null)[]): number | null {
  const tracked = values.filter((value): value is number => value !== null);
  return values.length && !tracked.length ? null : tracked.reduce((sum, value) => sum + value, 0);
}
