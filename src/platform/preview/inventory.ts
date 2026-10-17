import { products } from "../../data";
import type { Product } from "../../data";
import { refreshCatalog } from "../../shop/catalog";
import * as seed from "../seed";
import { assetUrl } from "../../assetUrl";
import { releaseProblem } from "../certificate-records";
import type { Lot, LotRelease, Order } from "../types";
import { fifoLots, inventoryTotals, lotAvailable, lotKey, lotNumber, lotStage } from "../inventory";
import type { InventoryEvent, LotInput } from "../inventory";
import { read, write } from "./storage";

const KEY="tm-preview-inventory-v1";
type State={lots:Lot[];products:Product[];orders:Order[];events:InventoryEvent[];receipts:Record<string,{id:string;quantity:number;receivedAt:string}>};
const initialProducts=structuredClone(products);
function state(): State {
  return read<State>(KEY,{lots:seed.lots.map(l=>({...l,id:l.lot,number:l.lot,version:1,reservedUnits:0,expectedUnits:l.units ?? 0,receivedUnits:l.units ?? 0,
    testingStatus:l.status==="released" && !releaseProblem(l.results) && l.coaPath ? "passed" : "pending",
    coaUrl:l.coaPath ? assetUrl(`certificates/${l.coaPath}`) : undefined})), products:initialProducts,orders:[],events:[],receipts:{}});
}
function commit(s:State) {
  for(const o of s.orders) for(const line of o.lines) for(const a of line.allocations ?? []) if(a.state==="reserved") {const l=s.lots.find(l=>lotKey(l)===a.lotId);if(l)a.lot=lotNumber(l);}
  s.products=s.products.map(p=>({...p,stock:inventoryTotals(s.lots.filter(l=>l.productId===p.id)).available,
    lot:fifoLots(s.lots.filter(l=>l.productId===p.id && lotAvailable(l)>0))[0]?.lot ?? p.lot}));
  s.orders=s.orders.map(o=>({...o,inventoryIssue:["placed","paid","packed"].includes(o.status) && o.lines.some(line=>line.allocations?.some(a=>a.state==="reserved" && !["Available","Exhausted"].includes(lotStage(s.lots.find(l=>lotKey(l)===a.lotId)!)))) ? "An allocated lot is unavailable. Resolve its certificate, testing or hold before fulfillment." : undefined}));
  write(KEY,s,true);
  products.splice(0,products.length,...s.products); refreshCatalog();
}
function audit(s:State, productId:string, lotId:string|undefined, kind:string, reason:string, before:unknown, after:unknown) {
  s.events.unshift({id:crypto.randomUUID(),productId,lotId,kind,reason,before,after,actor:"Preview operator",at:new Date().toISOString()});
}
function selected(s:State,id:string) {const l=s.lots.find(l=>lotKey(l)===id); if(!l) throw new Error("Lot not found."); return l;}
export const previewLots=()=>state().lots;
export const previewOrders=()=>state().orders;
export const previewProducts=()=>{const s=state();return s.products.map(p=>({...p,stock:inventoryTotals(s.lots.filter(l=>l.productId===p.id)).available}));};
export async function savePreviewProduct(product:Product) {
  const s=state(); const previous=s.products.find(p=>p.id===product.id);
  if(s.products.some(p=>p.id!==product.id && p.name.trim().toLowerCase()===product.name.trim().toLowerCase() && p.size.trim().toLowerCase()===product.size.trim().toLowerCase() && p.form.trim().toLowerCase()===product.form.trim().toLowerCase())) throw new Error("This product and size already exist. Receive inventory for that product.");
  if(previous) s.products=s.products.map(p=>p.id===product.id ? {...product,stock:p.stock,lot:p.lot} : p); else s.products.push({...product,stock:0});
  audit(s,product.id,undefined,"product","Product saved",previous,product); commit(s); return s.products.find(p=>p.id===product.id)!;
}
export const previewInventory={
  async save(input:LotInput):Promise<Lot> {
    const s=state(); let l=input.id ? selected(s,input.id) : undefined;
    const before=l ? structuredClone(l) : undefined;
    const number=input.number.trim().toUpperCase();
    if(!/^[A-Z0-9][A-Z0-9_-]{1,99}$/.test(number)) throw new Error("Enter a lot number using letters, numbers and dashes.");
    if(!input.reason.trim()) throw new Error("Enter a reason for this change.");
    if(s.lots.some(x=>lotKey(x)!==input.id && (lotNumber(x)===number || x.lot===number))) throw new Error("This lot already exists. Choose it to receive more inventory.");
    if(!s.products.some(p=>p.id===input.productId)) throw new Error("Choose a product.");
    if(l && l.version!==input.version) throw new Error("This lot changed. Reopen it before saving.");
    if(!Number.isSafeInteger(input.expectedUnits) || input.expectedUnits<0 || input.expectedUnits<(l?.receivedUnits ?? 0)) throw new Error("Expected quantity cannot be below the quantity received.");
    if(input.units===null && (l?.reservedUnits ?? 0)>0) throw new Error("Resolve reserved allocations before clearing the count.");
    if(input.receivedAt && (!Number.isFinite(Date.parse(input.receivedAt)) || Date.parse(input.receivedAt)>Date.now()+300000)) throw new Error("Enter the actual receipt date.");
    if(input.units!==undefined && input.units!==null && (!Number.isSafeInteger(input.units) || input.units<(l?.reservedUnits ?? 0))) throw new Error("Enter a whole number at least as large as the reserved quantity. Resolve allocations first.");
    if(input.reason.startsWith("Returns") && !input.resaleConfirmed) throw new Error("Confirm returned units are suitable for resale.");
    if(input.status==="held" && !input.holdReason?.trim()) throw new Error("Enter a hold reason.");
    if(!l) { l={id:crypto.randomUUID(),lot:number,number,productId:input.productId,status:"quarantine",testingStatus:"pending",receivedAt:null,units:0,reservedUnits:0,receivedUnits:0,results:[],sample:true,version:0}; s.lots.push(l); }
    Object.assign(l,{number,expectedUnits:input.expectedUnits,expectedAt:input.expectedAt,version:(l.version ?? 0)+1});
    if(input.units!==undefined) l.units=input.units;
    if(input.receivedAt!==undefined) l.receivedAt=input.receivedAt;
    if(input.status==="held") l.holdReason=input.holdReason;
    if(input.status==="active") {l.holdReason=undefined;l.status=l.testingStatus==="passed" && l.coaPath ? "released" : "quarantine";}
    if(input.status==="quarantine") {l.coaPath=undefined;l.coaUrl=undefined;l.testingStatus="pending";l.status="quarantine";}
    if(input.status==="awaiting_certificate") {l.coaPath=undefined;l.coaUrl=undefined;l.testingStatus="passed";l.status="quarantine";}
    if(input.status==="archived" || input.status==="rejected") l.status=input.status;
    if(input.status==="rejected")l.testingStatus="failed";
    audit(s,l.productId,lotKey(l),"lot",input.reason,before,l); commit(s); return l;
  },
  async receive(id:string,quantity:number,receivedAt:string,requestId:string):Promise<Lot> {
    const s=state(); const l=selected(s,id); const prior=s.receipts[requestId];
    if(prior) {if(prior.id!==id || prior.quantity!==quantity || prior.receivedAt!==receivedAt) throw new Error("Receipt reference already used for different details."); return l;}
    if(!Number.isSafeInteger(quantity) || quantity<=0 || !Number.isFinite(Date.parse(receivedAt)) || Date.parse(receivedAt)>Date.now()+300000) throw new Error("Enter a positive quantity and actual receipt date.");
    if(l.units===null) throw new Error("Reconcile the existing count before receiving more units.");
    if(["archived","rejected"].includes(l.status)) throw new Error("Choose an active lot.");
    const before=structuredClone(l);
    l.units+=quantity; l.receivedUnits=(l.receivedUnits ?? 0)+quantity; l.expectedUnits=Math.max(l.expectedUnits ?? 0,l.receivedUnits);
    l.receivedAt=!l.receivedAt || receivedAt<l.receivedAt ? receivedAt : l.receivedAt;
    l.status=l.testingStatus==="passed" && l.coaPath ? "released" : "quarantine"; l.version=(l.version ?? 0)+1;
    s.receipts[requestId]={id,quantity,receivedAt}; audit(s,l.productId,id,"receipt","Shipment received",before,l); commit(s);return l;
  },
  async history(productId:string) {return state().events.filter(e=>e.productId===productId);},
  async removeCertificate(id:string,reason:string) {
    const s=state();const l=selected(s,id); const before=structuredClone(l);
    if(!reason.trim()) throw new Error("Enter a reason.");
    l.coaPath=undefined;l.coaUrl=undefined;if(!["archived","rejected"].includes(l.status)) l.status="quarantine";l.version=(l.version ?? 0)+1;
    audit(s,l.productId,id,"certificate",reason,before,l);commit(s);
  },
  async returnUnits(allocationId:string,quantity:number,reason:string,resaleConfirmed:boolean,requestId:string) {
    const s=state();const a=s.orders.flatMap(o=>o.lines.flatMap(l=>l.allocations ?? [])).find(a=>a.id===allocationId);
    if(s.receipts[requestId]) {if(s.receipts[requestId].id!==allocationId || s.receipts[requestId].quantity!==quantity)throw new Error("Return reference already used.");return;}
    if(!a || a.state!=="fulfilled" || !Number.isInteger(quantity) || quantity<=0 || quantity+(a.returnedUnits ?? 0)>a.quantity || !reason.trim() || !resaleConfirmed)throw new Error("Enter an unreturned shipped quantity, reason, and confirm suitability for resale.");
    const l=selected(s,a.lotId);if(l.units===null)throw new Error("Reconcile this lot count first.");
    a.returnedUnits=(a.returnedUnits ?? 0)+quantity;l.units+=quantity;l.version=(l.version ?? 0)+1;s.receipts[requestId]={id:allocationId,quantity,receivedAt:"return"};
    audit(s,l.productId,lotKey(l),"return",reason,null,{quantity,allocationId});commit(s);
  },
  async substitute(orderId:string,productId:string,allocations:{lotId:string;quantity:number}[],reason:string) {
    const s=state();const o=s.orders.find(o=>o.id===orderId); if(!o || !["placed","paid","packed"].includes(o.status) || !reason.trim()) throw new Error("Choose an unshipped order and enter a reason.");
    const line=o.lines.find(l=>l.productId===productId)!;
    for(const a of line.allocations ?? []) if(a.state==="reserved") {selected(s,a.lotId).reservedUnits!-=a.quantity;a.state="released";}
    if(allocations.reduce((sum,a)=>sum+a.quantity,0)!==line.quantity) throw new Error("Lot quantities must equal the ordered quantity.");
    for(const a of allocations) {const l=selected(s,a.lotId);if(l.productId!==productId || !Number.isInteger(a.quantity) || a.quantity<=0 || lotAvailable(l)<a.quantity) throw new Error("Choose eligible lots with enough units."); l.reservedUnits=(l.reservedUnits ?? 0)+a.quantity;line.allocations!.push({...a,id:crypto.randomUUID(),lot:lotNumber(l),state:"reserved"});}
    if(o.status==="packed")o.status="paid";o.events.push({status:o.status,at:new Date().toISOString(),note:`Lots substituted: ${reason}`});commit(s);
  },
};
export async function savePreviewCertificate(id:string,input:LotRelease,file:File) {
  if(file.type!=="application/pdf" || file.size===0 || file.size>10*1024*1024) throw new Error("Choose a PDF up to 10 MB.");
  const problem=releaseProblem(input.results);if(problem)throw new Error(problem);
  if(!input.reference.trim() || !input.testedAt)throw new Error("Enter the certificate number and test date.");
  const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});
  const s=state();const l=selected(s,id);const before=structuredClone(l);
  Object.assign(l,input,{coaPath:`${l.lot}-${crypto.randomUUID()}.pdf`,coaUrl:data,testingStatus:"passed",releasedAt:l.releasedAt ?? new Date().toISOString(),version:(l.version ?? 0)+1});
  if(!["archived","rejected"].includes(l.status))l.status="released";
  audit(s,l.productId,id,"certificate","Passing test certificate uploaded",before,{...l,coaUrl:"Stored PDF"});commit(s);
}
export function reservePreviewOrder(order:Order) {
  const s=state();
  for(const line of order.lines) {
    const product=s.products.find(p=>p.id===line.productId);if(!product || product.active===false)throw new Error("Product unavailable.");
    if(!Number.isInteger(line.quantity) || line.quantity<=0)throw new Error("Enter a positive whole quantity.");
    let remaining=line.quantity;line.allocations=[];
    for(const l of fifoLots(s.lots.filter(l=>l.productId===line.productId))) {const take=Math.min(remaining,lotAvailable(l));if(!take)continue;
      l.reservedUnits=(l.reservedUnits ?? 0)+take;l.version=(l.version ?? 0)+1;
      line.allocations.push({id:crypto.randomUUID(),lotId:lotKey(l),lot:lotNumber(l),quantity:take,state:"reserved"});remaining-=take;if(!remaining)break;
    }
    if(remaining)throw new Error(`Not enough received, certified units of ${product.name}.`);
    line.lot=line.allocations[0].lot;
  }
  s.orders.unshift(order);commit(s);
}
export function advancePreviewInventory(order:Order) {
  const s=state();const previous=s.orders.find(o=>o.id===order.id);if(!previous)return;
  if(previous.status===order.status)return;
  if(["packed","shipped"].includes(order.status)) for(const line of previous.lines) for(const a of line.allocations ?? []) {
    if(a.state!=="reserved")continue;const l=selected(s,a.lotId);
    if(lotStage(l)!=="Available" || (l.units ?? 0)<(l.reservedUnits ?? 0))throw new Error(`Lot ${lotNumber(l)} is unavailable. Resolve testing, certificate, hold or quantity first.`);
  }
  for(const line of previous.lines) for(const a of line.allocations ?? []) if(a.state==="reserved") {
    const l=selected(s,a.lotId);
    if(order.status==="shipped") {a.lot=lotNumber(l);a.state="fulfilled";a.certificatePath=l.coaPath;a.certificateUrl=l.coaUrl;l.units!-=a.quantity;l.reservedUnits!-=a.quantity;l.version=(l.version ?? 0)+1;}
    if(["cancelled","refunded"].includes(order.status)) {a.state="released";l.reservedUnits!-=a.quantity;}
  }
  Object.assign(previous,order,{lines:previous.lines});commit(s);
}
