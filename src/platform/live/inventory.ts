import type { SupabaseClient } from "@supabase/supabase-js";
import type { InventoryEvent, LotInput } from "../inventory";
import { lot, type Row } from "./rows";
type RPC = <T>(name: string, args?: Record<string, unknown>) => Promise<T>;
export function createInventoryAdapter(client: SupabaseClient, rpc: RPC, changed: () => void) {
  return {
    async save(input: LotInput) { const saved=lot(await rpc<Row>("save_inventory_lot",{draft:input})); changed(); return saved; },
    async receive(id: string, quantity: number, receivedAt: string, requestId: string) { const saved=lot(await rpc<Row>("receive_inventory",{lot_id:id,quantity,received_at:receivedAt,request_id:requestId})); changed(); return saved; },
    async history(productId: string): Promise<InventoryEvent[]> {
      const {data,error}=await client.from("inventory_events").select("*").eq("product_id",productId).order("created_at",{ascending:false}).limit(100);
      if(error) throw new Error(error.message);
      return (data ?? []).map(r=>({id:r.id,productId:r.product_id,lotId:r.lot_id,kind:r.kind,reason:r.reason,before:r.before_value,after:r.after_value,actor:r.actor_label ?? r.actor_id,at:r.created_at}));
    },
    async removeCertificate(id: string, reason: string) { await rpc("remove_inventory_certificate",{lot_id:id,reason}); changed(); },
    async returnUnits(allocationId:string, quantity:number, reason:string, resaleConfirmed:boolean, requestId:string) { await rpc("return_inventory",{allocation_id:allocationId,quantity,reason,resale_confirmed:resaleConfirmed,request_id:requestId}); changed(); },
    async substitute(orderId: string, productId: string, allocations: {lotId:string;quantity:number}[], reason: string) { await rpc("substitute_inventory",{order_id:orderId,product_id:productId,allocations,reason}); changed(); },
  };
}
