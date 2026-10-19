import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button, Drawer } from "../app-kit";
import type { Product } from "../data";
import type { Lot } from "../platform/types";
import { inventoryStore } from "../platform/inventory-store";
import { store } from "../platform/store";
import { incomingUnits, lotKey, lotNumber, lotStage } from "../platform/inventory";
import { SelectField, TextField, SwitchRow } from "./fields";

export const localDate=(iso:string)=>{const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const errorText=(e:unknown)=>e instanceof Error ? e.message : "The change could not be saved.";
export function ReceiveInventory({products,lots,productId,onClose,onSaved}:{products:Product[];lots:Lot[];productId?:string;onClose:()=>void;onSaved:(lot:Lot,certificate:boolean)=>void}) {
  const [product,setProduct]=useState(productId ?? ""); const [existing,setExisting]=useState(""); const [number,setNumber]=useState("");
  const [kind,setKind]=useState("received"); const [quantity,setQuantity]=useState("");const [date,setDate]=useState(localDate(new Date().toISOString()));
  const [expected,setExpected]=useState("");const [certificate,setCertificate]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  // A lot this form has already added is the one it receives into, so saving again never adds a second lot.
  const created=useRef<Lot | undefined>(undefined);
  // One receipt key per submission. Saving the same receipt again reuses it, so it is recorded once; corrected details get a new key,
  // unless the last attempt may have been recorded, when the key stays and the store refuses changed details instead of adding units twice.
  const receipt=useRef<{key:string;details:string;unsure:boolean} | null>(null);
  const problem=useRef<HTMLParagraphElement>(null);useEffect(()=>{if(error)problem.current?.scrollIntoView({block:"nearest"});},[error]);
  const untouched=async(l:Lot)=>{try{return (await store.lots.list()).find(x=>lotKey(x)===lotKey(l))?.version===l.version;}catch{return false;}};
  async function save(e:FormEvent) {e.preventDefault();if(busy)return;setError("");
    if(!product || !/^\d+$/.test(quantity) || Number(quantity)<=0 || (!existing && !number.trim())) {setError("Choose a product and enter a lot number and positive whole quantity.");return;}
    if(kind==="received" && !Number.isFinite(Date.parse(date))) {setError("Enter the actual receipt date and time.");return;}
    setBusy(true);try {
      const units=Number(quantity);let l=created.current ?? lots.find(l=>lotKey(l)===existing);
      if(!l) {l=await inventoryStore.save({productId:product,number,expectedUnits:units,expectedAt:expected || undefined,reason:kind==="incoming" ? "Incoming shipment recorded" : "New lot received"});created.current=l;}
      else if(created.current && (lotNumber(l)!==number.trim().toUpperCase() || l.expectedUnits!==units || (l.expectedAt ?? "").slice(0,10)!==expected)) {l=await inventoryStore.save({id:lotKey(l),version:l.version,productId:product,number,expectedUnits:units,expectedAt:expected || undefined,reason:"Receipt details corrected"});created.current=l;}
      if(kind==="received") {const at=new Date(date).toISOString(),details=[lotKey(l),units,at].join(" ");
        if(!receipt.current || receipt.current.details!==details && !receipt.current.unsure) receipt.current={key:crypto.randomUUID(),details,unsure:false};
        try {l=await inventoryStore.receive(lotKey(l),units,at,receipt.current.key);}catch(failure){receipt.current.unsure=!(await untouched(l));throw failure;}
      }
      else if(existing) l=await inventoryStore.save({id:lotKey(l),version:l.version,productId:product,number:lotNumber(l),expectedUnits:(l.expectedUnits ?? 0)+Number(quantity),expectedAt:expected || undefined,reason:"Incoming shipment recorded"});
      onSaved(l,certificate);
    }catch(e){setError(errorText(e));}finally{setBusy(false);}
  }
  return <Drawer title="Receive inventory" eyebrow="Products & inventory" onClose={()=>{if(!busy)onClose();}} footer={<div className="cc-confirm-actions"><Button type="submit" form="receive-stock" variant="primary" disabled={busy}>{busy ? "Saving…" : kind==="incoming" ? "Save incoming shipment" : "Save received inventory"}</Button><Button onClick={onClose} disabled={busy}>Cancel</Button></div>}>
    <form id="receive-stock" className="cc-form" onSubmit={save}><fieldset disabled={busy} className="cc-commerce-fields">
      {created.current && <p className="kit-note">{lotNumber(created.current)} has been added as a new lot. Correct the details and save again; the units are received only once. If you cancel, it stays listed as incoming.</p>}
      <SelectField label="Product" value={product} disabled={Boolean(created.current)} onChange={v=>{setProduct(v);setExisting("");}} placeholder="Choose a product" options={products.map(p=>({value:p.id,label:`${p.name} · ${p.size}`}))}/>
      <SelectField label="Lot" value={existing} disabled={Boolean(created.current)} onChange={v=>{setExisting(v);const l=lots.find(l=>lotKey(l)===v);if(l && incomingUnits(l))setQuantity(String(incomingUnits(l)));}} options={[{value:"",label:"Add a new lot"},...lots.filter(l=>l.productId===product && !["archived","rejected"].includes(l.status)).map(l=>({value:lotKey(l),label:`${lotNumber(l)} · ${incomingUnits(l)} incoming`}))]}/>
      {!existing && <TextField label="New lot number" value={number} onChange={setNumber} mono/>}
      <SelectField label="Shipment stage" value={kind} onChange={setKind} options={[{value:"received",label:"Received — it is here"},{value:"incoming",label:"Incoming — it has not arrived"}]}/>
      <TextField label={kind==="received" ? "Units received now" : "Units expected"} value={quantity} onChange={setQuantity} inputMode="numeric" hint="For a partial delivery, enter only the units that arrived."/>
      {kind==="received" ? <TextField label="Actual receipt date and time" type="datetime-local" value={date} onChange={setDate}/> : <TextField label="Expected arrival (optional)" type="date" value={expected} onChange={setExpected}/>}
    </fieldset><SwitchRow title="Add certificate next" description="Upload the passing results and PDF in the next step." checked={certificate} onChange={setCertificate}/>
      <p className="kit-note">Received units await testing in quarantine. Saving a passing certificate releases them automatically. Incoming units cannot be sold.</p>
      {error && <p ref={problem} role="alert" className="kit-field-error">{error}</p>}
    </form>
  </Drawer>;
}

export function EditInventoryLot({lot,onClose,onSaved}:{lot:Lot;onClose:()=>void;onSaved:()=>void}) {
  const [number,setNumber]=useState(lotNumber(lot));const [units,setUnits]=useState(lot.units===null ? "" : String(lot.units));
  const [expected,setExpected]=useState(String(lot.expectedUnits ?? 0));const [date,setDate]=useState(lot.receivedAt ? localDate(lot.receivedAt) : "");const [arrival,setArrival]=useState(lot.expectedAt?.slice(0,10) ?? "");
  const [status,setStatus]=useState(lot.status==="archived" || lot.status==="rejected" ? lot.status : lot.holdReason ? "held" : "active");const [hold,setHold]=useState(lot.holdReason ?? "");const [reason,setReason]=useState("Count correction");const [note,setNote]=useState("");const [resale,setResale]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function save(e:FormEvent) {e.preventDefault();if(busy)return;setError("");if(!/^\d+$/.test(expected) || (units && !/^\d+$/.test(units))) {setError("Quantities must be whole numbers, zero, or blank for an unknown on-hand count.");return;}
    if(reason==="Returns" && !resale){setError("Confirm returned units are suitable for resale.");return;}
    setBusy(true);try{await inventoryStore.save({id:lotKey(lot),version:lot.version,productId:lot.productId,number,units:units==="" ? null : Number(units),expectedUnits:Number(expected),expectedAt:arrival || undefined,receivedAt:date ? new Date(date).toISOString() : null,status:status as "active",holdReason:hold,reason:note.trim() ? `${reason}: ${note.trim()}` : reason,resaleConfirmed:resale});onSaved();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
  return <Drawer title="Edit lot & quantities" eyebrow={lotNumber(lot)} onClose={()=>{if(!busy)onClose();}} footer={<div className="cc-confirm-actions"><Button type="submit" form="edit-stock" variant="primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button><Button onClick={onClose} disabled={busy}>Cancel</Button></div>}>
    <form id="edit-stock" className="cc-form" onSubmit={save}><fieldset disabled={busy} className="cc-commerce-fields">
      <p className="kit-note">{lotStage(lot)} · {lot.reservedUnits ?? 0} units reserved. On hand includes reserved units.</p>
      <TextField label="Lot number" value={number} onChange={setNumber} mono hint="Existing order and certificate links stay connected."/>
      <TextField label="Units on hand" value={units} onChange={setUnits} inputMode="numeric"/>
      <TextField label="Total units expected" value={expected} onChange={setExpected} inputMode="numeric" hint={`${lot.receivedUnits ?? 0} units already received. Incoming is expected minus received.`}/>
      <TextField label="First receipt date and time" type="datetime-local" value={date} onChange={setDate}/>
      <TextField label="Expected arrival" type="date" value={arrival} onChange={setArrival}/>
      <SelectField label="Status" value={status} onChange={setStatus} options={[{value:"active",label:"Active — availability follows testing and certificate"},{value:"quarantine",label:"Quarantine — awaiting testing results"},{value:"awaiting_certificate",label:"Testing passed — awaiting certificate"},{value:"held",label:"On hold"},{value:"rejected",label:"Rejected"},{value:"archived",label:"Archived"}]}/>
      {status==="held" && <TextField label="Hold reason" value={hold} onChange={setHold}/>}
      <SelectField label="Reason for change" value={reason} onChange={setReason} options={["Count correction","Damaged units","Samples","Returns","Details correction","Other adjustment"].map(value=>({value,label:value}))}/>
      {reason==="Returns" && <SwitchRow title="Suitable for resale" description="These units have been inspected. Testing and certificate rules still apply." checked={resale} onChange={setResale}/>}
      <TextField label="Additional explanation (optional)" value={note} onChange={setNote}/>
    </fieldset>{error && <p role="alert" className="kit-field-error">{error}</p>}</form>
  </Drawer>;
}
