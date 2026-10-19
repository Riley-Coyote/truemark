import { createClient } from '@supabase/supabase-js';
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { accounts, password, root, database, assertLocal } from './lib/local-platform.mjs';
import { certificates, releasedFields } from '../src/platform/certificate-records.ts';

const id = name => {
  const h = createHash('sha256').update('truemark-local:' + name).digest('hex');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);
};
const daysAgo = n => new Date(Date.now()-n*86400000).toISOString();
async function query(tx, text, args=[]) { return tx.unsafe(text, args); }
async function insert(tx, table, row, conflict='') {
  const pairs=Object.entries(row), values=pairs.map(([,v]) => v);
  return query(tx,'insert into public.'+table+' ('+pairs.map(([key])=>key).join(',')+') values ('+pairs.map((_,i)=>'$'+(i+1)).join(',')+') on conflict '+conflict+' do nothing',values);
}
export async function seed(config) {
  assertLocal(config);
  const sql=database(config);
  const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  try {
    await sql.unsafe('create schema if not exists local_development; revoke all on schema local_development from public; create table if not exists local_development.checkpoints (name text primary key, at timestamptz default now());');
    if ((await query(sql,"select name from local_development.checkpoints where name='functional-v1'")).length) {
      await linkHistory(sql);console.log('Existing local records retained.');return;
    }
    const users=new Map(), listed=await admin.auth.admin.listUsers({perPage:1000});
    if(listed.error) throw listed.error;
    for(const account of accounts) {
      let user=listed.data.users.find(u=>u.email===account.email);
      if(!user) {
        const created=await admin.auth.admin.createUser({email:account.email,password,email_confirm:true});
        if(created.error) throw created.error;user=created.data.user;
      }
      users.set(account.email,user.id);
    }
    // Release the first batch before history exists, so every historical line has a certified lot to come from.
    for(const certificate of certificates) {
      const fields=releasedFields(certificate);
      const path=resolve(root,'public/certificates',fields.coaPath);
      try {await access(path);} catch {continue;}
      const result=await admin.storage.from('certificates').upload(fields.coaPath,await readFile(path),{contentType:'application/pdf',upsert:true});
      if(result.error)throw result.error;
      // Lot inventory sells only received, counted, passing lots whose certificate file exists.
      await sql.begin(async tx=>{
        await query(tx,"select set_config('inventory.reason','Sample batch received and certified',true)");
        await query(tx,"update public.lots set status='released',testing_status='passed',received_at=$6,units=120,received_units=120,expected_units=120,tested_at=$1,released_at=$7,results=$2,reference=$3,coa_path=$4 where lot=$5",[fields.testedAt,fields.results,fields.reference,fields.coaPath,certificate.lot,certificate.sampleReceived,fields.releasedAt]);
      });
    }
    await sql.begin(async tx=>{
      for(const account of accounts) {
        await query(tx,'update public.profiles set role=$1 where id=$2',[account.role,users.get(account.email)]);
        if(account.role!=='buyer')continue;
        const buyer=id(account.email), institution=account.pending?'Calder Bio Institute (sample)':'Northfield Research Laboratory (sample)';
        await insert(tx,'buyers',{id:buyer,user_id:users.get(account.email),name:account.name,email:account.email,institution,role:'Research scientist',status:account.pending?'pending':'verified',joined_at:daysAgo(180),verified_at:account.pending?null:daysAgo(30)},'(id)');
        await insert(tx,'addresses',{id:id(account.email+'-address'),buyer_id:buyer,label:'Sample laboratory',institution,attention:account.name,line1:'120 Research Park Drive',city:'Madison',region:'WI',postal:'53706',country:'United States'},'(id)');
        await insert(tx,'applications',{id:id(account.email+'-application'),buyer_id:buyer,name:account.name,email:account.email,role:'Research scientist',institution,institution_type:'Research laboratory',research_area:'Analytical research',intended_use:'In vitro laboratory research only',attestations:['research-use-only','authorized-researcher'],status:account.pending?'submitted':'approved',submitted_at:daysAgo(30)},'(id)');
      }
      const partner=accounts.find(a=>a.role==='partner');
      await insert(tx,'partners',{id:id('partner'),user_id:users.get(partner.email),name:partner.name,handle:'@alexresearch',email:partner.email,code:'ALEX10',rate:0.12,status:'active',joined_at:daysAgo(180),audience:'Research community (sample)'},'(id)');
      await insert(tx,'discounts',{code:'ALEX10',kind:'partner',percent:10,partner_id:id('partner'),active:true},'(code)');
      await query(tx,"update public.discounts set active=true where code in ('FIRSTLOT','WELCOME5')");
      await query(tx,'update public.settings set shipping_rates_confirmed=true');
      // The sample world ships free from $200; a hosted database keeps its own setting.
      await query(tx,'update public.settings set free_shipping_threshold=200');
      await query(tx,"update public.shipping_methods set label=case when id='cold-2day' then 'Standard · 2 business days' else 'Express · overnight' end,detail='Sample rate for the local simulation'");
      await query(tx,'update public.customer_program_settings set rewards_enabled=true,memberships_enabled=true,earn_per_dollar=10');
      await query(tx,"update public.connections set mode='simulated',provider=''");
      for(const account of accounts.filter(a=>a.role==='buyer'&&!a.pending))
        await insert(tx,'reward_ledger',{buyer_id:id(account.email),points:1500,kind:'adjustment',entry_key:'local-opening-'+account.email,note:'Sample opening points for local testing'},'(entry_key)');
      const catalog=await query(tx,'select * from public.products order by id');
      // History is inserted in its final state, so reserve and ship its lots below instead of through checkout's trigger.
      await query(tx,'alter table public.order_lines disable trigger inventory_allocate');
      for(let i=0;i<90;i++) {
        const at=daysAgo(i*2+1),orderId=id('history-'+i),buyerEmail=i%3===0?'procurement@truemark.test':'researcher@truemark.test',product=catalog[i%catalog.length];
        const quantity=1+i%4,subtotal=Number(product.price)*quantity,partnerOrder=i%3===0;
        const discount=partnerOrder?Math.round(subtotal*10)/100:0,total=Math.round((subtotal-discount+24)*100)/100;
        const state=i===0?'paid':i===1?'packed':i===2?'shipped':'delivered';
        const address={id:id(buyerEmail+'-address'),label:'Sample laboratory',institution:'Northfield Research Laboratory (sample)',attention:'Dr. Mara Ellison',line1:'120 Research Park Drive',city:'Madison',region:'WI',postal:'53706',country:'United States'};
        await insert(tx,'orders',{id:orderId,number:'TM-LOCAL-'+(1000+i),buyer_id:id(buyerEmail),created_at:at,status:state,payment:'captured',address,shipping_method_id:'cold-2day',shipping_price:24,subtotal,discount_code:partnerOrder?'ALEX10':null,discount_amount:discount,discount_partner_id:partnerOrder?id('partner'):null,total,paid_at:at,payment_provider:'simulator',carrier:i>1?'Local carrier':null,tracking:i>1?'SIM'+i:null},'(id)');
        await insert(tx,'order_lines',{order_id:orderId,product_id:product.id,quantity,unit_price:product.price,lot:product.lot},'(order_id,product_id)');
        const steps=['placed','paid',...(i!==0?['packed']:[]),...(i>1?['shipped']:[]),...(i>2?['delivered']:[])];
        for(let step=0;step<steps.length;step++)
          await insert(tx,'order_events',{id:id('history-event-'+i+'-'+step),order_id:orderId,status:steps[step],at:new Date(Date.parse(at)+step*3600000).toISOString(),note:'Seeded local history',actor_id:users.get('owner@truemark.test'),source:'team'});
        if(partnerOrder)await insert(tx,'referrals',{partner_id:id('partner'),order_id:orderId,order_number:'TM-LOCAL-'+(1000+i),created_at:at,order_subtotal:subtotal-discount,commission:Math.round((subtotal-discount)*12)/100,status:i<7?'pending':'approved',via:'code'},'(order_id)');
      }
      await query(tx,'alter table public.order_lines enable trigger inventory_allocate');
      await query(tx,"select set_config('inventory.reason','Sample order history',true)");
      await query(tx,`insert into public.order_lot_allocations(order_line_id,lot_id,quantity,state,lot_number,certificate_path,certificate_snapshot)
        select li.id,l.inventory_id,li.quantity,case when o.status in ('paid','packed') then 'reserved' else 'fulfilled' end,coalesce(l.lot_number,l.lot),
          case when o.status in ('shipped','delivered') then l.coa_path end,
          case when o.status in ('shipped','delivered') then jsonb_build_object('reference',l.reference,'results',l.results,'testedAt',l.tested_at,'lot',coalesce(l.lot_number,l.lot)) end
        from public.order_lines li join public.orders o on o.id=li.order_id join public.lots l on l.lot=li.lot
        where o.number like 'TM-LOCAL-%' and not exists(select 1 from public.order_lot_allocations a where a.order_line_id=li.id)`);
      await query(tx,`update public.lots l set units=l.received_units-coalesce((select sum(a.quantity) from public.order_lot_allocations a where a.lot_id=l.inventory_id and a.state='fulfilled'),0),
        reserved_units=coalesce((select sum(a.quantity) from public.order_lot_allocations a where a.lot_id=l.inventory_id and a.state='reserved'),0)
        where exists(select 1 from public.order_lot_allocations a where a.lot_id=l.inventory_id)`);
      for(let i=0;i<90;i++)await insert(tx,'visits',{partner_id:id('partner'),date:daysAgo(i).slice(0,10),clicks:15+i%27});
    });
    await demoLots(sql,admin);
    await query(sql,"insert into local_development.checkpoints(name) values('functional-v1') on conflict do nothing");
    await linkHistory(sql);
    console.log('Seeded six local accounts, 90 orders, referrals, rewards, lot inventory and available certificate files.');
  } finally {await sql.end();}
}

// One lot in each inventory state for walkthroughs, plus a second BPC-157 lot so a 15-unit order splits 10 + 5.
// SAMPLE lots carry a labeled sample certificate, never a laboratory result.
async function demoLots(sql,admin) {
  const samplePath='SAMPLE-BPC10-B.pdf';
  const upload=await admin.storage.from('certificates').upload(samplePath,samplePdf(['Sample certificate for local demonstration','Lot SAMPLE-BPC10-B - BPC-157 10 mg','Not a laboratory result. Created by the TrueMark local seed.']),{contentType:'application/pdf',upsert:true});
  if(upload.error)throw upload.error;
  const product=async(tx,lot)=>(await query(tx,'select product_id from public.lots where lot=$1',[lot]))[0]?.product_id;
  const add=async(tx,reason,row)=>{
    await query(tx,"select set_config('inventory.reason',$1,true)",[reason]);
    await insert(tx,'lots',{lot_number:row.lot,...row},'(lot)');
  };
  await sql.begin(async tx=>{
    const bpc=await product(tx,'TM-BPC10-2609-01');
    await query(tx,"select set_config('inventory.reason','Count correction: sample older lot nearly sold through',true)");
    await query(tx,"update public.lots set units=reserved_units+10,version=version+1 where lot='TM-BPC10-2609-01' and units>reserved_units+10");
    await add(tx,'Sample newer lot received and certified',{lot:'SAMPLE-BPC10-B',product_id:bpc,status:'released',testing_status:'passed',received_at:daysAgo(6),tested_at:daysAgo(4),released_at:daysAgo(3),
      units:100,received_units:100,expected_units:100,reference:'SAMPLE-COA-BPC10-B',coa_path:samplePath});
    await query(tx,"update public.lots set results=$1 where lot='SAMPLE-BPC10-B'",[[{label:'Purity',method:'HPLC',value:'99.21',unit:'%'},{label:'Identity',method:'HPLC (RT + UV vs. reference)',value:'Conforms',unit:''}]]);
    await add(tx,'Sample shipment expected',{lot:'TM-RET10-2610-02',product_id:await product(tx,'TM-RET10-2609-01'),status:'quarantine',testing_status:'pending',
      units:0,received_units:0,expected_units:100,expected_at:daysAgo(-5).slice(0,10)});
    await add(tx,'Sample shipment received, awaiting test results',{lot:'TM-TRZ30-2610-02',product_id:await product(tx,'TM-TRZ30-2609-01'),status:'quarantine',testing_status:'pending',
      received_at:daysAgo(3),units:100,received_units:100,expected_units:100});
    await add(tx,'Sample lot passed testing, certificate not yet uploaded',{lot:'TM-SEM20-2610-02',product_id:await product(tx,'TM-SEM20-2609-01'),status:'quarantine',testing_status:'passed',
      received_at:daysAgo(9),tested_at:daysAgo(2),units:80,received_units:80,expected_units:80});
  });
}
// A one-page PDF with plain text, enough for the certificate viewer and download links.
function samplePdf(lines) {
  const text=lines.map((line,i)=>`BT /F1 ${i?11:16} Tf 72 ${720-i*28} Td (${line.replace(/[\\()]/g,m=>'\\'+m)}) Tj ET`).join('\n');
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`];
  let body='%PDF-1.4\n';const offsets=[];
  objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(body));body+=`${i+1} 0 obj\n${object}\nendobj\n`;});
  const xref=Buffer.byteLength(body);
  body+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body,'latin1');
}

async function linkHistory(sql) {
  if((await query(sql,"select name from local_development.checkpoints where name='linked-history-v1'")).length)return;
  await sql.begin(async tx=>{
    await query(tx,"insert into public.payments(order_id,kind,provider,amount,status,provider_ref,created_at,completed_at,created_by) select o.id,'charge','simulator',o.total,'succeeded','sim_history_'||o.id,o.created_at,o.paid_at,p.id from public.orders o cross join (select id from public.profiles where role='owner' limit 1) p where o.number like 'TM-LOCAL-%' on conflict(provider,provider_ref) do nothing");
    await query(tx,"update public.orders o set charge_id=p.id from public.payments p where o.number like 'TM-LOCAL-%' and p.order_id=o.id and p.kind='charge' and o.charge_id is null");
    await query(tx,"insert into public.shipments(order_id,provider,status,provider_order_id,carrier,service,tracking,pushed_at,shipped_at,delivered_at,label_created_at,provider_shipment_id) select o.id,'simulator',case when o.status in ('paid','packed') then 'pushed' else o.status end,'local_'||o.id,case when o.status='paid' then null else 'Local carrier' end,'Standard',case when o.status='paid' then null else 'SIM'||o.number end,o.created_at,case when o.status in ('shipped','delivered') then o.created_at+interval '2 hours' else null end,case when o.status='delivered' then o.created_at+interval '3 hours' else null end,case when o.status='paid' then null else o.created_at+interval '1 hour' end,case when o.status='paid' then null else 'label_'||o.id end from public.orders o where o.number like 'TM-LOCAL-%' and o.status in ('paid','packed','shipped','delivered') on conflict(order_id) do nothing");
    await query(tx,"insert into public.marketing_contacts(email,name,status,consent_at,source) select email,name,'subscribed',now()-interval '30 days','Synthetic opt-in for local demonstration' from public.buyers where email in ('researcher@truemark.test','procurement@truemark.test') on conflict(email) do nothing");
    await query(tx,"create or replace function local_development.reject_live_provider() returns trigger language plpgsql as $$ begin if new.mode='live' then raise exception 'Local development supports simulated or off connections only.' using errcode='22023'; end if; return new; end $$");
    await query(tx,"drop trigger if exists local_simulated_connections on public.connections; create trigger local_simulated_connections before insert or update on public.connections for each row execute function local_development.reject_live_provider()");
    await query(tx,"insert into local_development.checkpoints(name) values('linked-history-v1')");
  });
}
