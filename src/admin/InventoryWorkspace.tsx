import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Button, DataTable, Dot, Drawer, EmptyState, Facts, PageHeader, Section, formatCount, formatDate, formatMoney } from "../app-kit";
import type { Column } from "../app-kit";
import { categoryName } from "../data";
import type { Product } from "../data";
import { productCutout } from "../shop/catalog";
import type { Lot } from "../platform/types";
import { LIVE } from "../platform/mode";
import { store, useResource } from "../platform/store";
import { inventoryStore } from "../platform/inventory-store";
import { fifoLots, incomingUnits, inventoryTotals, lotAvailable, lotKey, lotNumber, lotStage } from "../platform/inventory";
import { ProductEditor, ClassesEditor } from "./Commerce";
import { LotCertificateDrawer } from "./LotCertificateDrawer";
import { LotDetail } from "./LotDetail";
import { EditInventoryLot, ReceiveInventory } from "./InventoryForms";
import { Mark, SelectField, SwitchRow, TextField } from "./fields";
import { useSearchQuery, matches } from "./state";
import "./inventory.css";

type Row={product:Product;lots:Lot[];totals:ReturnType<typeof inventoryTotals>};
export default function InventoryWorkspace() {
  const catalog=useResource(()=>store.catalog.products(true));const lots=useResource(()=>store.lots.list());const classes=useResource(()=>store.catalog.categories());
  const [params,setParams]=useSearchParams();const query=useSearchQuery();const [filter,setFilter]=useState("all");
  const [receiving,setReceiving]=useState<string|null>(null);const [editing,setEditing]=useState<Lot|null>(null);const [certificate,setCertificate]=useState<Lot|null>(null);
  const [newProduct,setNewProduct]=useState<Product|null>(null);const [firstLot,setFirstLot]=useState(true);const [notice,setNotice]=useState("");
  const selected=params.get("product");const openLot=params.get("lot");
  useEffect(()=>{if(openLot && !selected){const l=lots.data?.find(l=>l.lot===openLot || lotNumber(l)===openLot);if(l)setParams(p=>{p.set("product",l.productId);return p;},{replace:true});}},[openLot,selected,lots.data,setParams]);
  const refresh=()=>{catalog.reload();lots.reload();};
  const open=(id:string|null)=>setParams(p=>{if(id)p.set("product",id);else {p.delete("product");p.delete("lot");}return p;});
  const rows=(catalog.data ?? []).map(product=>{const own=fifoLots((lots.data ?? []).filter(l=>l.productId===product.id));return {product,lots:own,totals:inventoryTotals(own)};});
  const visible=rows.filter(r=>matches(query,r.product.name,r.product.size,r.product.form,r.product.id,...r.lots.map(lotNumber)) && (filter==="all" || filter==="incoming" && r.totals.incoming>0 || filter==="quarantine" && r.totals.quarantine>0 || filter==="certificate" && r.totals.awaiting>0 || filter==="available" && r.totals.available>0 || filter==="attention" && (r.totals.unknown>0 || r.totals.held>0)));
  const totals=inventoryTotals(lots.data ?? []);const row=rows.find(r=>r.product.id===selected);
  const columns:Column<Row>[]=[
    {key:"product",header:"Product",width:"23%",mobile:"primary",cell:r=><span className="kit-cell-name"><span>{r.product.name}<span className="kit-cell-sub">{r.product.size} · {r.product.form}<br/>{r.product.active===false ? "Archived product" : `Active · ${formatMoney(r.product.price ?? 0)}`}</span></span></span>},
    {key:"available",header:"Available",width:"9%",align:"end",mobile:"aside",cell:r=><strong>{formatCount(r.totals.available)}</strong>},
    {key:"reserved",header:"Reserved",width:"9%",align:"end",cell:r=>formatCount(r.totals.reserved)},
    {key:"incoming",header:"Incoming",width:"9%",align:"end",mobile:"meta",cell:r=>formatCount(r.totals.incoming)},
    {key:"testing",header:"Quarantine",width:"10%",align:"end",mobile:"meta",cell:r=>formatCount(r.totals.quarantine)},
    {key:"held",header:"Other held",width:"12%",align:"end",cell:r=><span>{formatCount(r.totals.awaiting+r.totals.held)}{r.totals.unknown>0 && <span className="kit-cell-sub">{r.totals.unknown} records to check</span>}</span>},
    {key:"lots",header:"Selling now",width:"28%",mobile:"secondary",cell:r=>{const current=r.lots.find(l=>lotAvailable(l)>0);return <span className="kit-mono">{current ? lotNumber(current) : "No eligible lot"}<span className="kit-cell-sub">{r.lots.length} lots · {r.totals.onHand} on hand</span></span>;}},
  ];
  function createProduct(){setNewProduct({id:`product-${crypto.randomUUID()}`,name:"",size:"",category:classes.data?.[0]?.id ?? "",form:"Lyophilized powder",price:0,stock:0,lot:"",active:true,color:"#7A39B1",colorInk:"#7A39B1"});}
  return <div className="kit-grid">
    <PageHeader description="Products, lots and certificates together. Receive stock, follow testing, and sell the first eligible lot received." meta={<span>{rows.length} products · {totals.onHand} units on hand{totals.unknown ? ` · ${totals.unknown} lot records need reconciliation` : ""}</span>}/>
    {!LIVE && <p className="kit-note kit-span-12">Working sample preview. Changes stay in this browser and do not affect live inventory.</p>}
    <div className="inventory-summary kit-span-12">{[["Available",totals.available],["Incoming",totals.incoming],["Quarantine",totals.quarantine],["Awaiting certificate",totals.awaiting]].map(([label,value])=><div className="kit-card" key={label}><span className="kit-label">{label}</span><strong className="kit-figure">{value}</strong></div>)}</div>
    <div className="inventory-toolbar kit-span-12"><div className="cc-confirm-actions"><Button variant="primary" onClick={()=>setReceiving("")} disabled={!catalog.data}>Receive inventory</Button><Button onClick={createProduct} disabled={!classes.data}>Add new product</Button></div><SelectField label="Show inventory" value={filter} onChange={setFilter} options={[{value:"all",label:"All products"},{value:"available",label:"Available to sell"},{value:"incoming",label:"Incoming shipments"},{value:"quarantine",label:"Awaiting testing"},{value:"certificate",label:"Awaiting certificate"},{value:"attention",label:"Holds or records to check"}]}/></div>
    {notice && <p role="status" className="inventory-notice kit-span-12">{notice}</p>}
    <div className="kit-card kit-span-12 inventory-table"><DataTable caption="Products and lot inventory" columns={columns} rows={visible} rowKey={r=>r.product.id} onRowClick={r=>open(r.product.id)} activeKey={selected} loading={catalog.loading || lots.loading} error={catalog.error ?? lots.error} onRetry={refresh} empty={{title:"No products match.",note:"Add a product or change the search or filter."}}/></div>
    {classes.data && <ClassesEditor classes={classes.data} onSaved={classes.reload}/>}
    {receiving!==null ? <ReceiveInventory products={catalog.data ?? []} lots={lots.data ?? []} productId={receiving || undefined} onClose={()=>setReceiving(null)} onSaved={(l,upload)=>{refresh();setReceiving(null);open(l.productId);setNotice(`${lotNumber(l)} saved · ${lotStage(l)}. ${l.units ?? 0} on hand, ${incomingUnits(l)} incoming.`);if(upload)setCertificate(l);}}/>
    : certificate ? <LotCertificateDrawer key={lotKey(certificate)} lot={certificate} onClose={()=>setCertificate(null)} onSaved={()=>{setCertificate(null);refresh();setNotice("Certificate saved. Passing results clear testing quarantine automatically; incoming stock and other holds remain unavailable.");}}/>
    : editing ? <EditInventoryLot key={lotKey(editing)} lot={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);refresh();setNotice("Lot updated. Inventory and history are up to date.");}}/>
    : newProduct ? <Drawer title="Add new product" eyebrow="Products & inventory" onClose={()=>setNewProduct(null)}><SwitchRow title="Add first lot next" description="Continue to incoming or received inventory after saving the product." checked={firstLot} onChange={setFirstLot}/><ProductEditor product={newProduct} classes={classes.data ?? []} onSaved={()=>{const id=newProduct.id;setNewProduct(null);refresh();open(id);if(firstLot)setReceiving(id);}}/></Drawer>
    : row ? <ProductInventory row={row} classes={classes.data ?? []} openLot={openLot} onLot={id=>setParams(p=>{if(id)p.set("lot",id);else p.delete("lot");return p;})} onClose={()=>open(null)} onRefresh={refresh} onReceive={()=>setReceiving(row.product.id)} onEdit={setEditing} onCertificate={setCertificate}/>
    : selected && !catalog.loading ? <Drawer title="Product" onClose={()=>open(null)}><EmptyState title="This product could not be loaded." action={<Button onClick={refresh}>Try again</Button>}/></Drawer> : null}
  </div>;
}

function ProductInventory({row,classes,openLot,onLot,onClose,onRefresh,onReceive,onEdit,onCertificate}:{row:Row;classes:import("../data").Category[];openLot:string|null;onLot:(lot:string|null)=>void;onClose:()=>void;onRefresh:()=>void;onReceive:()=>void;onEdit:(lot:Lot)=>void;onCertificate:(lot:Lot)=>void}) {
  const [editProduct,setEditProduct]=useState(false);const [remove,setRemove]=useState<Lot|null>(null);const [reason,setReason]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  const history=useResource(()=>inventoryStore.history(row.product.id),[row.product.id,row.lots.map(l=>l.version).join(",")]);
  const eligible=row.lots.filter(l=>lotAvailable(l)>0);
  const other=row.lots.filter(l=>lotAvailable(l)===0).sort((a,b)=>Number((b.units ?? 0)>0 || incomingUnits(b)>0)-Number((a.units ?? 0)>0 || incomingUnits(a)>0));
  const ordered=[...eligible,...other];const detail=openLot ? row.lots.find(l=>l.lot===openLot || lotNumber(l)===openLot || l.id===openLot) : undefined;
  const p=row.product;const category=classes.find(c=>c.id===p.category)?.name ?? categoryName(p.category);
  return <Drawer title={`${p.name} · ${p.size}`} eyebrow="Product inventory" subtitle={`${p.form} · ${category}`} tags={p.active===false ? <Mark>Archived product</Mark> : undefined} onClose={onClose} footer={<div className="cc-confirm-actions"><Button variant="primary" onClick={onReceive}>Receive inventory</Button><Button onClick={()=>setEditProduct(!editProduct)}>{editProduct ? "Close product editor" : "Edit product"}</Button></div>}>
    <div className="cc-product-head inventory-product-head"><span className="cc-vial" aria-hidden="true"><img src={productCutout(p,"sm")} alt=""/></span>
      <div className="inventory-product-counts">{[["Available",row.totals.available],["Reserved",row.totals.reserved],["On hand",row.totals.onHand],["Incoming",row.totals.incoming]].map(([label,value])=><div key={label}><span className="kit-label">{label}</span><strong className="kit-figure">{value}</strong></div>)}</div></div>
    {editProduct && <Section title="Product details"><ProductEditor key={row.product.id} product={row.product} classes={classes} onSaved={onRefresh}/></Section>}
    <Section title="Lots · first received, first sold"><p className="kit-note">Quarantine means received and awaiting testing. A passing certificate releases testing quarantine automatically.</p>
      {!row.lots.length && <EmptyState compact title="No lots yet." note="Receive stock or record an incoming shipment to add the first lot." action={<Button onClick={onReceive}>Add first lot</Button>}/>}
      {ordered.map(l=><article className="inventory-lot" key={lotKey(l)}><div className="inventory-lot-heading"><strong className="kit-mono">{lotNumber(l)}</strong><span className="inventory-stage" data-available={lotStage(l)==="Available"}>{lotStage(l)}</span></div>
        {eligible[0]===l ? <p className="inventory-queue">Selling now · oldest eligible receipt</p> : eligible[1]===l ? <p className="inventory-queue">Up next</p> : null}
        <p className="kit-note">{l.receivedAt ? `First received ${formatDate(l.receivedAt)}` : (l.units ?? 0)>0 ? "Receipt date needs reconciliation" : "Not received"}{l.expectedAt ? ` · expected ${formatDate(l.expectedAt)}` : ""}{l.holdReason ? ` · ${l.holdReason}` : ""}</p>
        <dl className="inventory-lot-counts">{[["On hand",l.units ?? "Count needed"],["Available",lotAvailable(l)],["Reserved",l.reservedUnits ?? 0],["Incoming",incomingUnits(l)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <div className="cc-confirm-actions"><Button onClick={()=>onLot(l.lot)}>Lot details</Button><Button onClick={()=>onEdit(l)}>Edit lot / adjust count</Button><Button onClick={()=>onCertificate(l)}>{l.coaPath ? "Update certificate" : "Upload certificate"}</Button>{l.coaUrl && <a className="kit-button" href={l.coaUrl} target="_blank" rel="noreferrer">View certificate ↗</a>}{l.coaPath && <Button variant="text" onClick={()=>{setRemove(l);setReason("");setError("");}}>Remove certificate</Button>}</div>
      </article>)}
    </Section>
    <Section title="Product"><Facts items={[{label:"Compound",value:<span className="cc-dot-name"><Dot colour={p.color}/>{p.name}</span>},{label:"Size",value:p.size},{label:"Form",value:p.form},{label:"Category",value:category},{label:"Price",value:p.price===undefined ? <span className="kit-quiet">Not priced</span> : formatMoney(p.price)},{label:"Shown in the shop",value:p.active===false ? "No, archived" : "Yes"}]}/></Section>
    <Section title="In the shop"><Link className="cc-public-link" to={`/product/${p.id}`} target="_blank" rel="noreferrer"><span className="kit-mono">/product/{p.id}</span><ArrowUpRight aria-hidden="true" strokeWidth={1.6}/><span className="kit-sr">, opens in a new tab</span></Link></Section>
    {remove && <Section title={`Remove certificate · ${lotNumber(remove)}`}><p className="kit-note">Remaining units will become unavailable. Shipped certificate records stay on file.</p><TextField label="Reason for removing certificate" value={reason} onChange={setReason}/><div className="cc-confirm-actions"><Button variant="danger" disabled={busy || !reason.trim()} onClick={async()=>{setBusy(true);try{await inventoryStore.removeCertificate(lotKey(remove),reason);setRemove(null);onRefresh();}catch(e){setError(e instanceof Error ? e.message : "Could not remove certificate.");}finally{setBusy(false);}}}>Remove attachment</Button><Button onClick={()=>setRemove(null)} disabled={busy}>Cancel</Button></div>{error && <p role="alert" className="kit-field-error">{error}</p>}</Section>}
    {detail && <LotDetail key={lotKey(detail)} lot={detail} product={row.product} onClose={()=>onLot(null)}/>}
    <Section title="Recent inventory history">{history.error ? <p role="alert">{history.error.message}</p> : !history.data?.length ? <p className="kit-note">{history.loading ? "Loading history…" : "Changes and receipts will appear here."}</p> : <ol className="inventory-history">{history.data.map(e=><li key={e.id}><strong>{e.reason}</strong><span className="kit-note">{new Date(e.at).toLocaleString()} · {e.actor ?? "System"}</span><details><summary>View change</summary><HistoryChange before={e.before} after={e.after}/></details></li>)}</ol>}</Section>
  </Drawer>;
}

function HistoryChange({before,after}:{before:unknown;after:unknown}) {
 const b=(before ?? {}) as Record<string,unknown>,a=(after ?? {}) as Record<string,unknown>;
 const fields:[[string,string],...Array<[string,string]>]=[["number","Lot number"],["lot_number","Lot number"],["name","Product name"],["size","Strength / size"],["price","Price"],["units","On hand"],["quantity","Quantity"],["expectedUnits","Expected"],["expected_units","Expected"],["receivedAt","First received"],["received_at","First received"],["received_units","Received"],["reserved_units","Reserved"],["status","Status"],["hold_reason","Hold reason"],["testing_status","Testing"],["reference","Certificate number"],["coa_path","Certificate file"],["coaPath","Certificate file"]];
 return <dl className="inventory-changes">{fields.filter(([key])=>JSON.stringify(b[key])!==JSON.stringify(a[key])).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{String(b[key] ?? "Not set")} → {String(a[key] ?? "Not set")}</dd></div>)}</dl>;
}
