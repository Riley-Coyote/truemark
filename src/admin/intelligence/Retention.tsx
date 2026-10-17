import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Drawer, EmptyState, PageHeader, Section, formatDate, formatMoney } from '../../app-kit';
import { useResource } from '../../platform/store';
import { LIVE } from '../../platform/mode';
import { worldNow } from '../../platform/storage';
import { retentionStore } from '../../platform/retention-store';
import type { RetentionData, RetentionDraft, RetentionKind } from '../../platform/retention';
import { validateRetention } from '../../platform/retention';
import { inventoryTotals } from '../../platform/inventory';
import { useQueryParam } from '../state';
import { ExportButton, SourceNote, Table, useBusiness, usePlanningScope } from './shared';
import type { BusinessData } from './model';
import { DAY, orderMoney } from './model';
import { customerRows, productHistory, purchaseAt, purchaseCohorts, recordLabel, retentionView } from './retention-model';
import type { CustomerHistory, RetentionFilter } from './retention-model';
import './retention.css';

const empty: RetentionData = {access:{allowed:false,owner:false,members:[]},records:[],events:[],contacts:[]};
const day = (value: string | null | undefined) => value ? formatDate(value) : '—';
const productName = (data: BusinessData, id: string) => {const p=data.products.find(p=>p.id===id);return p?p.name+' '+p.size:id;};
const initialFilter: RetentionFilter = {product:'',from:'',to:'',query:'',group:'all'};
const errorText = (e: unknown) => e instanceof Error ? e.message : 'The change could not be saved.';

export default function Retention() {
  const data=useBusiness(), scope=usePlanningScope(), api=useMemo(()=>retentionStore(scope),[scope]);
  const activity=useResource(()=>api.load(),[api]), retained=activity.data ?? empty;
  const [filter,setFilter]=useState(initialFilter), [openId,setOpenId]=useQueryParam('customer');
  const [horizon,setHorizon]=useState(12), [cohortIds,setCohortIds]=useState<string[]|null>(null), [cohortLabel,setCohortLabel]=useState('');
  const [accessError,setAccessError]=useState(''), [grantBusy,setGrantBusy]=useState(false);
  const view=useMemo(()=>retentionView(data,retained,filter),[data,retained,filter]);
  const cohorts=useMemo(()=>purchaseCohorts(data,filter.product,filter.from,filter.to,horizon),[data,filter.product,filter.from,filter.to,horizon]);
  const invalid=!!(filter.from && filter.to && filter.from>filter.to) || filter.from>data.asOf.slice(0,10) || filter.to>data.asOf.slice(0,10);
  const rows=invalid?[]:cohortIds?view.rows.filter(r=>cohortIds.includes(r.buyer.id)):view.rows;
  const current=customerRows(data,retained).find(r=>r.buyer.id===openId);
  const paidDates=data.orders.filter(o=>orderMoney(o).paid).map(o=>Date.parse(purchaseAt(o))).filter(t=>t<=Date.parse(data.asOf));
  const historyDays=paidDates.length?Math.max(0,Math.floor((Date.parse(data.asOf)-Math.min(...paidDates))/DAY)):0;
  const set = (patch: Partial<RetentionFilter>) => {setFilter(f=>({...f,...patch}));setCohortIds(null);};
  return <div className="bi-page retention-page">
    <PageHeader description="Know your customers. Keep the history. Make the next follow-up clear." />
    <SourceNote />
    <div className="retention-intro">
      <div><span className="kit-label">Learning from real purchase patterns</span><h2>Track purchases and follow-ups.</h2><p>Explore purchases by product, keep useful notes, and plan the next conversation.</p></div>
      <div className="retention-history"><strong>{historyDays} days</strong><span>since the first recorded purchase</span><small>Six months is a review milestone. History keeps growing.</small></div>
    </div>
    <details className="bi-method"><summary>How purchase patterns work · no fixed reorder deadline</summary><p>“Longer gap” means more time has passed than any previous gap for that customer and selection, with at least three purchases. It is a prompt to review, not a prediction. “Bought once” and repeat groups refer to the selected product, or all products when none is selected.</p></details>
    {activity.error && <div role="alert" className="bi-warning">Activity history could not be loaded: {activity.error.message} <Button onClick={activity.reload}>Try again</Button></div>}
    {activity.data && !retained.access.allowed && <p className="bi-source">Purchase insights are available. The owner can grant access to private notes, contact history and follow-ups.</p>}
    <Card title="Find the people behind the numbers">
      <div className="bi-toolbar retention-filters">
        <label className="bi-field">Product<select value={filter.product} onChange={e=>set({product:e.target.value})}><option value="">All products</option>{data.products.map(p=><option key={p.id} value={p.id}>{p.name} {p.size}{p.active===false?' · inactive':''}</option>)}</select></label>
        <label className="bi-field">Find a customer<input placeholder="Name, organization or email" value={filter.query} onChange={e=>set({query:e.target.value})}/></label>
        <label className="bi-field">Purchased from<input type="date" value={filter.from} max={data.asOf.slice(0,10)} onChange={e=>set({from:e.target.value})}/></label>
        <label className="bi-field">Purchased through<input type="date" value={filter.to} max={data.asOf.slice(0,10)} min={filter.from} onChange={e=>set({to:e.target.value})}/></label>
        <Button onClick={()=>{setFilter(initialFilter);setCohortIds(null);}}>Reset filters</Button>
      </div>
      {invalid && <p className="bi-warning" role="alert">Choose a valid range within the recorded period.</p>}
      <div className="retention-groups" aria-label="Customer groups">{view.groups.map(g=><button key={g.id} type="button" disabled={g.id==='due'&&!retained.access.allowed} aria-pressed={filter.group===g.id} onClick={()=>set({group:g.id})}><span>{g.label}</span><strong>{g.id==='due'&&!retained.access.allowed?'—':g.count}</strong></button>)}</div>
      <p className="bi-small">Dates select customers who purchased in that period. Purchase counts and patterns use their full recorded history for the selected product. Cancelled and fully refunded purchases are excluded from these patterns.</p>
    </Card>
    <Card title={cohortIds ? cohortLabel : 'Customer relationships'} meta={<ExportButton name="customer-retention" headers={['Customer ID','Customer','Organization','Email','Product selection','Purchases in full history','Purchases in selected period','Units in selected period','Latest selected purchase','Latest purchase of anything','Recorded lifetime revenue','Observed median days','Observed gaps','Last contact','Marketing consent','Open reminders due','Purchases after last contact']} rows={rows.map(r=>[r.buyer.id,r.buyer.name,r.buyer.institution,r.buyer.email,filter.product?productName(data,filter.product):'All products',r.scoped.length,r.inPeriod.length,r.units,r.scoped[0]?purchaseAt(r.scoped[0]):'',r.purchases[0]?purchaseAt(r.purchases[0]):'',r.lifetime,r.pattern.typical ?? '',r.pattern.intervals,retained.access.allowed?r.contact?.at ?? '':'Unavailable',retained.access.allowed?r.consent:'Unavailable',retained.access.allowed?r.due.length:'Unavailable',retained.access.allowed?r.laterPurchases.length:'Unavailable'])} />}>
      {cohortIds && <Button onClick={()=>setCohortIds(null)}>Show all matching customers</Button>}
      <Table label="Customer relationships" rows={rows} rowKey={r=>r.buyer.id} onSelect={r=>setOpenId(r.buyer.id)} columns={[
        {key:'customer',label:'Customer',get:r=><><strong>{r.buyer.name}</strong><span className="bi-cell-note">{r.buyer.institution}</span></>,sort:r=>r.buyer.name},
        {key:'purchases',label:'Purchases',get:r=><>{r.scoped.length}<span className="bi-cell-note">{r.units} units in selected period</span></>,sort:r=>r.scoped.length},
        {key:'last',label:'Latest purchase',get:r=><>{r.scoped[0]?day(purchaseAt(r.scoped[0])):'No purchases'}<span className="bi-cell-note">{r.pattern.daysSince!==null?r.pattern.daysSince+(r.pattern.daysSince===1?' day ago':' days ago'):''}{filter.product && r.purchases[0]?' · Any product: '+day(purchaseAt(r.purchases[0])):''}</span></>,sort:r=>r.scoped[0]?purchaseAt(r.scoped[0]):''},
        {key:'pattern',label:'Observed pattern',get:r=><><span className={r.pattern.longer?'retention-attention':''}>{r.pattern.longer?'Longer gap':r.pattern.intervals<2?'Still learning':'Pattern recorded'}</span><span className="bi-cell-note">{r.pattern.intervals>=2?Math.round(r.pattern.shortest!)+'–'+Math.round(r.pattern.longest!)+' days across '+r.pattern.intervals+' gaps':'Needs three distinct purchase times'}</span></>},
        {key:'contact',label:'Last contact',get:r=><>{retained.access.allowed?day(r.contact?.at):'Unavailable'}{retained.access.allowed && r.contact && <span className="bi-cell-note">{r.laterPurchases.length} purchases since</span>}</>},
        {key:'followup',label:'Follow-up',get:r=><>{retained.access.allowed?(r.due.length?r.due.length+' due':'No reminders due'):'Owner access'}<span className="bi-cell-note">{retained.access.allowed?r.consent:''}</span></>},
      ]}/>
      <p className="bi-small">A purchase after contact is an observed outcome; it does not establish that the contact caused the order.</p>
    </Card>
    <Card title="Repeat purchasing over time" meta={<label className="bi-field">Months after first purchase<select value={horizon} onChange={e=>setHorizon(Number(e.target.value))}>{[6,12,24].map(n=><option key={n} value={n}>{n} months</option>)}</select></label>}>
      <p className="bi-small">Grouped by first purchase of {filter.product?productName(data,filter.product):'any product'}. Click a month’s count or a percentage to see those customers. The date range selects first-purchase dates; customer search and group filters do not change this chart.</p>
      {cohorts.length && !invalid ? <div className="bi-cohorts"><table><caption className="kit-sr">Monthly repeat purchase groups</caption><thead><tr><th>First purchase</th><th>Customers</th>{Array.from({length:horizon},(_,i)=><th key={i}>Month {i}</th>)}</tr></thead><tbody>{cohorts.map(c=><tr key={c.month}><th scope="row">{c.month}</th><td><button className="retention-cell" onClick={()=>{setFilter(f=>({...f,group:'all',query:''}));setCohortIds(c.ids);setCohortLabel('First purchased '+c.month);}}>{c.ids.length}</button></td>{c.cells.map((ids,i)=><td key={i}>{ids===null?<span title="This calendar month is not complete">—</span>:<button className="retention-cell" aria-label={c.month+', month '+i+': '+ids.length+' of '+c.ids.length+' customers'} onClick={()=>{setFilter(f=>({...f,group:'all',query:''}));setCohortIds(ids);setCohortLabel(c.month+' customers purchasing in month '+i);}}>{Math.round(ids.length/c.ids.length*100)}%</button>}</td>)}</tr>)}</tbody></table></div>:<EmptyState compact title="No completed purchase groups in this selection."/>}
      <p className="bi-small">Blank months are not yet fully observed. A zero means a completed month with no purchases. Month 0 is the first-purchase calendar month.</p>
    </Card>
    {retained.access.owner && <details className="bi-method"><summary>Team access to activity and follow-ups</summary><p>Access includes customer messages, notes, drafts and reminders. Only the owner can change it.</p>{retained.access.members.length?retained.access.members.map(m=><div className="retention-access" key={m.id}><span>{m.email}</span><Button disabled={grantBusy} onClick={async()=>{setGrantBusy(true);setAccessError('');try{await api.grant(m.id,!m.allowed);}catch(e){setAccessError(errorText(e));}finally{setGrantBusy(false);}}}>{m.allowed?'Remove access':'Grant access'}</Button></div>):<p>No staff accounts in this {LIVE?'workspace':'sample preview'}.</p>}{accessError && <p role="alert">{accessError}</p>}</details>}
    <p className="bi-source">{LIVE?'Activity is saved to the shared workspace.':'Sample preview · Notes and follow-ups save only in this browser.'} Email delivery is deferred. Saving a draft or reminder sends nothing.</p>
    {openId && (current?<CustomerRetention key={openId} data={data} row={current} allowed={retained.access.allowed} api={api} onClose={()=>setOpenId(null,{replace:true})}/>:<Drawer title="Customer" onClose={()=>setOpenId(null,{replace:true})}><EmptyState compact title="This customer could not be found."/></Drawer>)}
  </div>;
}

function CustomerRetention({data,row,allowed,api,onClose}:{data:BusinessData;row:CustomerHistory;allowed:boolean;api:ReturnType<typeof retentionStore>;onClose:()=>void}) {
  const [tab,setTab]=useState('overview'),[draft,setDraft]=useState<RetentionDraft|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[limit,setLimit]=useState(30);
  const products=productHistory(data,row);
  function add(kind: RetentionKind) {
    setError('');setNotice('');setTab('followups');
    setDraft({id:crypto.randomUUID(),buyer_id:row.buyer.id,product_id:null,kind,channel:kind==='note'||kind==='reminder'?'other':'email',subject:'',body:'',occurred_at:worldNow(),due_at:kind==='reminder'?data.asOf.slice(0,10)+'T12:00:00Z':null,status:'open'});
  }
  async function save(value: RetentionDraft) {
    setError('');setBusy(true);
    try {validateRetention(value,worldNow());await api.save(value);setDraft(null);setNotice(value.kind==='draft'?'Draft saved. Nothing was sent.':'Activity saved.');}catch(e){setError(errorText(e));}finally{setBusy(false);}
  }
  const records=[...row.records].sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at));
  const events=[...row.events].sort((a,b)=>(b.occurred_at||b.recorded_at).localeCompare(a.occurred_at||a.recorded_at));
  return <Drawer title={row.buyer.name} eyebrow="Customer relationship" subtitle={row.buyer.institution} onClose={onClose}>
    <div className="retention-customer-stats"><div><span>Purchases</span><strong>{row.purchases.length}</strong></div><div><span>Recorded lifetime revenue</span><strong>{formatMoney(row.lifetime)}</strong></div><div><span>Last purchase</span><strong>{day(row.purchases[0]?purchaseAt(row.purchases[0]):null)}</strong></div></div>
    <p>{row.buyer.email}</p>
    <div className="retention-tabs" aria-label="Customer sections">{['overview','activity','followups','orders'].map(t=><Button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t==='followups'?'Notes & follow-ups':t[0].toUpperCase()+t.slice(1)}</Button>)}</div>
    {notice && <p className="bi-source" role="status">{notice}</p>}
    {tab==='overview' && <>
      <Section title="Contact and results"><p>{allowed?row.consent:'Contact history requires retention access.'}</p>{allowed && <><p>Last recorded contact: {day(row.contact?.at)}</p><p>{row.contact?row.laterPurchases.length+' purchases after the latest contact.':'No contact has been recorded.'}</p>{row.laterPurchases.map(o=><p key={o.id}><Link to={'/admin/orders?order='+encodeURIComponent(o.id)}>{o.number}</Link> · {day(purchaseAt(o))} · {formatMoney(orderMoney(o).revenue)}</p>)}<p className="bi-small">Outcomes show sequence, not campaign attribution. Email opens, clicks and delivery receipts will appear only when a provider supplies them.</p><div className="retention-actions"><Button onClick={()=>add('note')}>Add note</Button><Button onClick={()=>add('contact')}>Log contact</Button><Button onClick={()=>add('reminder')}>Set reminder</Button><Button onClick={()=>add('draft')}>Prepare draft</Button></div></>}</Section>
      <Section title="Products purchased">{products.length?products.map(p=>{const stock=inventoryTotals(data.lots.filter(l=>l.productId===p.id));return <article className="retention-product" key={p.id}><h3>{p.name}</h3><p>{p.orders} purchases · {p.units} ordered units · Latest {day(p.last)}</p><p className="bi-small">{p.pattern.intervals>=2?'Observed gaps: '+Math.round(p.pattern.shortest!)+'–'+Math.round(p.pattern.longest!)+' days ('+p.pattern.intervals+' gaps).':'Still learning: at least three purchases are needed to compare gaps.'}</p><span className="retention-pill">{p.active?stock.available+' units available for sale':'Product inactive'}</span></article>}):<p>No product purchases recorded yet.</p>}<p className="bi-small">Ordered units are not estimates of product use. Partial refunds do not identify returned quantities.</p></Section>

    </>}
    {tab==='orders' && <Section title="Complete order history">{row.orders.length?row.orders.map(o=><article className="retention-product" key={o.id}><h3><Link to={'/admin/orders?order='+encodeURIComponent(o.id)}>{o.number}</Link></h3><p>{day(o.createdAt)} · {o.status} · Payment {o.payment.replaceAll('_',' ')}</p>{o.lines.map((l,i)=><p key={i}>{productName(data,l.productId)} · {l.quantity} × {formatMoney(l.unitPrice)}</p>)}<p>Order total {formatMoney(o.total)} · Refunded {formatMoney(orderMoney(o).refund)}</p></article>):<p>No orders yet.</p>}</Section>}
    {tab==='activity' && <Section title="Activity history">{allowed && <ExportButton name="customer-activity" headers={["Event ID","Event","Occurred at","Recorded at","Subject","Details","Status","Related product","Order total","Refunded","Version"]} rows={events.map(e=>[e.id,e.summary,e.occurred_at??"Unknown",e.recorded_at,e.detail.subject??"",e.detail.body??"",e.detail.status??"",typeof e.detail.product_id==="string"?productName(data,e.detail.product_id):"",e.detail.total??"",e.detail.refunded??"",e.detail.version??""])}/>} {!allowed?<p>Owner or granted staff access is required.</p>:<><p className="bi-small">Order, consent, contact and chat events are retained when connected. Existing snapshots have no invented event date. Every saved note and follow-up edit keeps its previous version.</p>{!LIVE && <p className="bi-source">Sample order history is available in Orders. This timeline contains activity saved in this preview.</p>}{events.slice(0,limit).map(e=><article className="retention-event" key={e.id}><h3>{e.summary}</h3><p className="bi-small">{e.occurred_at?day(e.occurred_at):'Original event date unknown'} · Recorded {day(e.recorded_at)}</p>{typeof e.detail.body==='string' && <p className="retention-text">{e.detail.body}</p>}{typeof e.detail.subject==='string' && e.detail.subject && <p>Subject: {e.detail.subject}</p>}{typeof e.detail.status==='string' && <p>Status: {e.detail.status}</p>}{e.detail.total!==undefined && <p>Order total: {formatMoney(Number(e.detail.total))}</p>}{e.detail.refunded!==undefined && <p>Refund recorded: {formatMoney(Number(e.detail.refunded))}</p>}{typeof e.detail.product_id==='string' && <p>{productName(data,e.detail.product_id)}{typeof e.detail.quantity==='number'?' · '+e.detail.quantity+' units':''}</p>}{e.detail.version!==undefined && <p className="bi-small">Version {String(e.detail.version)}</p>}</article>)}{!events.length && <EmptyState compact title="No activity recorded here yet." note="Add a note or follow-up to begin the history."/>}{events.length>limit && <Button onClick={()=>setLimit(n=>n+50)}>Show older activity</Button>}</>}</Section>}
    {tab==='followups' && <Section title="Notes and follow-ups">{!allowed?<p>Owner or granted staff access is required.</p>:<>
      <div className="retention-actions">{(['note','contact','reply','reminder','draft'] as RetentionKind[]).map(k=><Button disabled={busy||!!draft} key={k} onClick={()=>add(k)}>{k==='note'?'Add note':k==='contact'?'Log contact':k==='reply'?'Log reply':k==='reminder'?'Set reminder':'Prepare draft'}</Button>)}</div>
      {draft && <form className="retention-form" onSubmit={e=>{e.preventDefault();void save(draft);}}>
        <h3>{draft.version?'Edit':'New'} {draft.kind}</h3>
        <label className="bi-field">Related product<select value={draft.product_id??''} onChange={e=>setDraft({...draft,product_id:e.target.value||null})}><option value="">Customer overall</option>{data.products.map(p=><option key={p.id} value={p.id}>{p.name} {p.size}</option>)}</select></label>
        {['contact','reply','draft'].includes(draft.kind) && <label className="bi-field">Contact method<select value={draft.channel} onChange={e=>setDraft({...draft,channel:e.target.value as RetentionDraft['channel']})}><option value="email">Email</option><option value="phone">Phone</option><option value="other">Other</option></select></label>}
        <label className="bi-field">{draft.kind==='draft'?'Subject':'Title (optional)'}<input maxLength={200} value={draft.subject} onChange={e=>setDraft({...draft,subject:e.target.value})}/></label>
        <label className="bi-field">{draft.kind==='draft'?'Draft message':'Details'}<textarea required maxLength={10000} rows={5} value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})}/></label>
        <label className="bi-field">Activity date and time (UTC)<input required type="datetime-local" value={draft.occurred_at.slice(0,16)} max={worldNow().slice(0,16)} onChange={e=>setDraft({...draft,occurred_at:e.target.value?e.target.value+':00Z':''})}/></label>
        {draft.kind==='reminder' && <label className="bi-field">Reminder date (UTC)<input type="date" required value={draft.due_at?.slice(0,10)??''} onChange={e=>setDraft({...draft,due_at:e.target.value?e.target.value+'T12:00:00Z':null})}/></label>}
        <label className="bi-field">Status<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as RetentionDraft['status']})}><option value="open">{draft.kind==='draft'?'Draft':'Open / recorded'}</option>{draft.kind==='reminder' && <option value="done">Completed</option>}<option value="cancelled">{draft.kind==='draft'?'Archived':'Cancelled / voided'}</option></select></label>
        {draft.kind==='draft' && <p className="bi-source">{row.consent}. Saving this draft does not send or schedule a message. Consent will need to be checked again before any future sending.</p>}
        <div className="retention-actions"><Button type="submit" disabled={busy}>{busy?'Saving…':'Save '+draft.kind}</Button><Button type="button" disabled={busy} onClick={()=>{setDraft(null);setError('');}}>Cancel edit</Button></div>
      </form>}
      {error && <p role="alert" className="bi-warning">{error}</p>}
      {records.map(r=><article className="retention-product" key={r.id}><div className="retention-record-head"><h3>{r.subject||recordLabel(r)}</h3><span className="retention-pill">{recordLabel(r)}</span></div><p className="retention-text">{r.body}</p><p className="bi-small">{day(r.occurred_at)} · {r.channel}{r.product_id?' · '+productName(data,r.product_id):''} · Version {r.version}</p>{r.due_at && <p>Reminder: {day(r.due_at)}</p>}<div className="retention-actions"><Button disabled={busy||!!draft} onClick={()=>{setDraft({...r});setError('');}}>Edit {r.kind}</Button>{r.kind==='reminder' && r.status==='open' && <Button disabled={busy||!!draft} onClick={()=>void save({...r,status:'done'})}>Mark completed</Button>}</div></article>)}
      {!records.length && !draft && <EmptyState compact title="Start with a note or a follow-up." note="Keep the details your team will want to remember."/>}
    </>}</Section>}
  </Drawer>;
}
