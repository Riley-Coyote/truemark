/** Local-only UI acceptance backend: real SQL, synthetic users, zero hosted access. */
import http from 'node:http';
import { createPlatformDb } from './lib/platform-db.mjs';
const h=await createPlatformDb();
const owner='00000000-0000-4000-8000-000000000001',buyer='00000000-0000-4000-8000-000000000003';
for(const [id,role] of [[owner,'owner'],[buyer,'buyer']]){await h.db.query('insert into auth.users(id,email) values($1,$2)',[id,`${role}@fixture.test`]);await h.db.query('update profiles set role=$2 where id=$1',[id,role]);}
await h.db.query("insert into buyers(id,user_id,name,email,institution,status) values($1,$1,'Fixture researcher','buyer@fixture.test','Fixture Research Institute','verified')",[buyer]);
await h.db.exec('update products set stock=10000;');
const allowedTables=new Set(['customer_program_settings','membership_tiers','reward_ledger','marketing_contacts','marketing_campaigns','marketing_flows','marketing_deliveries']);
const allowedRpcs=new Set(['team_customer_wallets','set_customer_programs','save_membership_tier','adjust_reward_points','my_customer_programs','my_checkout_benefits','my_marketing_consent','set_my_marketing_consent','import_marketing_contacts','suppress_marketing_contact','save_marketing_campaign','schedule_marketing_campaign','cancel_marketing_campaign','save_marketing_flow','run_marketing_test_queue']);
const funcs=await h.rows("select proname,proretset,proargnames from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'");
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(origin&&!/^http:\/\/(127\.0\.0\.1|localhost):5337$/.test(origin)){res.writeHead(403);res.end();return;}
 res.setHeader('Access-Control-Allow-Origin',origin??'http://127.0.0.1:5337');res.setHeader('Access-Control-Allow-Headers','content-type,x-fixture-role');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 if(req.method!=='POST'){res.writeHead(405);res.end('{}');return;}
 try{
 let raw='';for await(const data of req){raw+=data;if(raw.length>2100000)throw Error('Request too large');}const args=JSON.parse(raw||'{}');const path=new URL(req.url,'http://127.0.0.1').pathname;const role=req.headers['x-fixture-role']==='buyer'?'buyer':'owner';const user=role==='buyer'?buyer:owner;
 let result;
 if(path.startsWith('/rows/')){const table=path.slice(6);if(!allowedTables.has(table))throw Error('Fixture table unavailable');let sql=`select to_jsonb(r) value from public.${table} r`;const values=[];for(const [k,v]of Object.entries(args.filters??{})){if(!['buyer_id','id'].includes(k))throw Error('Fixture filter unavailable');sql+=values.length?' and ':' where ';values.push(v);sql+=`${k}=$${values.length}`;}result=(await h.auth(user,sql,values)).map(r=>r.value);
 }else if(path.startsWith('/rpc/')){const name=path.slice(5);if(!allowedRpcs.has(name))throw Error('Fixture function unavailable');const f=funcs.find(f=>f.proname===name);const keys=Object.keys(args);if(keys.some(k=>!f.proargnames.includes(k)))throw Error('Unknown argument');const sql=`select to_jsonb(public.${name}(${keys.map((k,i)=>`${k}=>$${i+1}`).join(',')})) value`;const found=await h.auth(user,sql,keys.map(k=>args[k]));result=f.proretset?found.map(r=>r.value):found[0]?.value;
 }else throw Error('Unknown fixture route');
 res.end(JSON.stringify({data:result}));
 }catch(e){res.writeHead(400);res.end(JSON.stringify({error:e.message}));}
});
server.listen(5343,'127.0.0.1',()=>console.log('Synthetic program backend: http://127.0.0.1:5343 · actual SQL/RLS, no hosted calls'));
process.on('SIGINT',()=>{server.close();void h.db.close().then(()=>process.exit(0));});
