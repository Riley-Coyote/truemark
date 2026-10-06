import { useState } from 'react';
import { Button, DataTable, Drawer, EmptyState, PageHeader, Segmented, formatDateTime } from '../app-kit';
import { LIVE } from '../platform/mode';
import { live } from '../platform/live/runtime';
import { useResource } from '../platform/store';
import { useQueryParam } from './state';
export default function Inbox(){return LIVE?<LiveInbox/>:<EmptyState title="The inbox works in the live platform."/>;}
function LiveInbox(){
 const messages=useResource(()=>live().messages.contacts()),routes=useResource(()=>live().messages.routes());
 const [filter,setFilter]=useState<'new'|'all'>('new'),[id,setId]=useQueryParam('message'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const label=(topic: string)=>routes.data?.find(r=>r.topic===topic)?.label??topic;
 const selected=messages.data?.find(m=>m.id===id);
 return <div className="kit-grid"><PageHeader/><div className="kit-span-12">
  <Segmented label="Filter messages" value={filter} onChange={setFilter} options={[{value:'new',label:'New'},{value:'all',label:'All'}]}/>
  <div className="kit-card"><DataTable caption="Inbox" rows={messages.data?.filter(m=>filter==='all'||m.status==='new')??undefined} loading={messages.loading} error={messages.error??routes.error} onRetry={()=>{messages.reload();routes.reload();}} rowKey={m=>m.id} onRowClick={m=>{setError('');setId(m.id);}} activeKey={id} empty={{title:'No messages yet.'}} columns={[
   {key:'from',header:'From',mobile:'primary',cell:m=><span className="cc-alerts-person"><span>{m.name}</span>{m.organization&&<span className="kit-quiet">{m.organization}</span>}</span>},
   {key:'topic',header:'Topic',mobile:'secondary',cell:m=>label(m.topic)},
   {key:'received',header:'Received',cell:m=>formatDateTime(m.created_at)},
   {key:'status',header:'Status',mobile:'aside',cell:m=><span className="kit-chip" data-tone={m.status==='new'?'signal':'quiet'}>{m.status==='new'?'New':'Handled'}</span>},
  ]}/></div>
 </div>{selected&&<Drawer title={selected.name} subtitle={label(selected.topic)} onClose={()=>setId(null,{replace:true})} footer={<div className="cc-actions">
  <a className="kit-button kit-button-quiet" href={`mailto:${selected.email}?subject=${encodeURIComponent('Re: '+label(selected.topic))}`}>Reply by email</a>
  <Button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await live().messages.setContactStatus(selected.id,selected.status==='new'?'handled':'new');messages.reload();}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}}>{selected.status==='new'?'Mark handled':'Mark as new'}</Button>
  {error&&<p className="kit-field-error" role="alert">{error}</p>}
 </div>}><p className="kit-note">{selected.email}</p><p className="cc-message-body">{selected.message}</p></Drawer>}</div>;
}
