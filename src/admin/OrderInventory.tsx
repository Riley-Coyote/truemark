import { productById } from "../shop/catalog";
import { useState } from "react";
import { Button, Section, plural } from "../app-kit";
import { store, useResource } from "../platform/store";
import type { LotAllocation, Order, OrderLine } from "../platform/types";
import { inventoryStore } from "../platform/inventory-store";
import { allocatedLines, lotAvailable, lotKey, lotNumber } from "../platform/inventory";
import { SelectField, SwitchRow, TextField } from "./fields";

export function OrderInventory({order,onSaved}:{order:Order;onSaved:()=>void}) {
  const lots=useResource(()=>store.lots.list());const [line,setLine]=useState<OrderLine|null>(null);const [counts,setCounts]=useState<Record<string,string>>({});const [reason,setReason]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  const [returning,setReturning]=useState(false);const [allocation,setAllocation]=useState("");const [quantity,setQuantity]=useState("");const [resale,setResale]=useState(false);const [request,setRequest]=useState(()=>crypto.randomUUID());
  const shipped=order.lines.flatMap(l=>l.allocations ?? []).filter(a=>a.state==="fulfilled" && (a.returnedUnits ?? 0)<a.quantity);
  function begin(l:OrderLine){setLine(l);setCounts(Object.fromEntries((l.allocations ?? []).filter(a=>a.state==="reserved").map(a=>[a.lotId,String(a.quantity)])));setReason("");setError("");}
  async function perform(action:()=>Promise<void>){if(busy)return;setBusy(true);setError("");try{await action();setLine(null);setReturning(false);setRequest(crypto.randomUUID());onSaved();lots.reload();}catch(e){setError(e instanceof Error ? e.message : "Could not save the inventory change.");}finally{setBusy(false);}}
  const link=(a:LotAllocation|undefined,lot:string)=>a?.certificateUrl ?? `/verify?lot=${encodeURIComponent(lot)}`;
  return <Section title="Pick these lots">
    {order.inventoryIssue && <p role="alert" className="kit-field-error">{order.inventoryIssue}</p>}
    <ul className="inventory-history">{allocatedLines(order.lines).map((l,i)=><li key={`${l.productId}-${i}`}><strong>{productById(l.productId)?.name ?? l.productId} · {productById(l.productId)?.size}<br/>{plural(l.quantity,"unit")} · {l.lot}</strong><a className="cc-inline-link" href={link(l.allocations?.[0],l.lot)} target="_blank" rel="noreferrer">{l.allocations?.[0]?.state==="fulfilled" ? "Shipped certificate" : "Lot certificate"} ↗</a></li>)}</ul>
    {["placed","paid","packed"].includes(order.status) && <div className="cc-confirm-actions">{order.lines.map(l=><Button key={l.productId} onClick={()=>begin(l)}>Change lots · {plural(l.quantity,"unit")}</Button>)}</div>}
    {line && <div className="cc-form"><p className="kit-note">Choose a total of {line.quantity} units. A packed order will return to the packing queue for confirmation.</p>
      {(lots.data ?? []).filter(l=>l.productId===line.productId).map(l=><TextField key={lotKey(l)} label={`${lotNumber(l)} (${lotAvailable(l)+(line.allocations ?? []).filter(a=>a.state==="reserved" && a.lotId===lotKey(l)).reduce((n,a)=>n+a.quantity,0)} available to this order)`} inputMode="numeric" value={counts[lotKey(l)] ?? ""} onChange={v=>setCounts({...counts,[lotKey(l)]:v})}/>)}
      <TextField label="Reason for changing lots" value={reason} onChange={setReason}/><div className="cc-confirm-actions"><Button variant="primary" disabled={busy || !reason.trim()} onClick={()=>perform(()=>inventoryStore.substitute(order.id,line.productId,Object.entries(counts).filter(([,q])=>q!=="" && q!=="0").map(([lotId,q])=>({lotId,quantity:Number(q)})),reason))}>Save picking list</Button><Button onClick={()=>setLine(null)} disabled={busy}>Cancel</Button></div>
    </div>}
    {shipped.length>0 && !returning && <Button onClick={()=>{setReturning(true);setReason("");setError("");setResale(false);setQuantity("");setAllocation("");}}>Record returned units</Button>}
    {returning && <div className="cc-form"><SelectField label="Shipped lot" value={allocation} onChange={setAllocation} placeholder="Choose a lot" options={shipped.map(a=>({value:a.id,label:`${a.lot} · ${a.quantity-(a.returnedUnits ?? 0)} units not yet returned`}))}/><TextField label="Units returned" inputMode="numeric" value={quantity} onChange={setQuantity}/><TextField label="Return reason" value={reason} onChange={setReason}/><SwitchRow title="Inspected and suitable for resale" description="Returned units still follow the lot’s testing, certificate and hold status." checked={resale} onChange={setResale}/><div className="cc-confirm-actions"><Button disabled={busy || !allocation || !resale || !reason.trim()} variant="primary" onClick={()=>perform(()=>inventoryStore.returnUnits(allocation,Number(quantity),reason,resale,request))}>Save returned units</Button><Button onClick={()=>setReturning(false)} disabled={busy}>Cancel</Button></div></div>}
    {error && <p role="alert" className="kit-field-error">{error}</p>}
  </Section>;
}
