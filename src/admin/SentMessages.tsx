import { useState } from 'react';
import { DataTable, Drawer, PageHeader, Segmented, formatDateTime } from '../app-kit';
import { SmsPreview } from '../platform/email/EmailPreview';
import { LIVE } from '../platform/mode';
import { live } from '../platform/live/runtime';
import type { OutboxMessage } from '../platform/live/messages';
import { useResource } from '../platform/store';
export function StoredEmail({html}: {html: string}){return <div className="cc-stored-email"><iframe title="Sent email" sandbox="" srcDoc={html}/></div>;}
export const messageStatus=(row: OutboxMessage)=>row.status==='sent'?'Sent':row.status==='failed'?'Failed':row.status==='suppressed'?'Not sent':'Waiting';
export default function SentMessages(){return LIVE?<LiveMessages/>:null;}
function LiveMessages(){
 const rows=useResource(()=>live().messages.outbox());const [channel,setChannel]=useState('all'),[status,setStatus]=useState('All'),[selected,setSelected]=useState<OutboxMessage|null>(null);
 return <div className="kit-grid"><PageHeader/><div className="kit-span-12 cc-stack">
 <Segmented label="Channel" value={channel} onChange={setChannel} options={[{value:'all',label:'All'},{value:'email',label:'Email'},{value:'sms',label:'Text'}]}/>
 <Segmented label="Status" value={status} onChange={setStatus} options={['All','Sent','Failed','Waiting','Not sent'].map(value=>({value,label:value}))}/>
 <div className="kit-card"><DataTable caption="Sent messages" empty={{title:'No messages sent yet.'}} rows={rows.data?.filter(r=>(channel==='all'||r.channel===channel)&&(status==='All'||messageStatus(r)===status))??undefined} loading={rows.loading} error={rows.error} onRetry={rows.reload} rowKey={r=>r.id} onRowClick={setSelected} columns={[
  {key:'to',header:'To',mobile:'primary',cell:r=>r.recipient},
  {key:'what',header:'What',mobile:'secondary',cell:r=>r.subject??r.body_text?.slice(0,60)??''},
  {key:'when',header:'When',cell:r=>formatDateTime(r.sent_at??r.created_at)},
  {key:'status',header:'Status',mobile:'aside',cell:messageStatus},
  {key:'provider',header:'Provider',cell:r=>r.provider==='simulator'?<span className="kit-chip">Simulated</span>:r.provider},
 ]}/></div></div>{selected&&<Drawer title={selected.subject??selected.recipient} subtitle={selected.recipient} onClose={()=>setSelected(null)}>
 {selected.channel==='email'&&selected.body_html?<StoredEmail html={selected.body_html}/>:selected.channel==='sms'&&selected.body_text?<SmsPreview to={selected.recipient} message={selected.body_text}/>:null}
 {selected.status==='failed'&&<p className="kit-field-error">{selected.last_error}</p>}
 </Drawer>}</div>;
}
