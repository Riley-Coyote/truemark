/** Runs the real launch application against the isolated native Supabase stack. */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { cli, root, stateDir, localEnv, appOrigin, accounts, password, status, database, configureFunctions, flush, run } from './lib/local-platform.mjs';
import { seed } from './local-seed.mjs';

const command=process.argv[2]??'dev';
if(!['dev','setup','stop','flush'].includes(command)) throw new Error('Choose dev, setup, stop or flush.');
if(command==='stop') {
  await run(cli,['stop']);process.exit(0);
}
await mkdir(stateDir,{recursive:true,mode:0o700});
if(command!=='flush') {
  await configureFunctions();
  console.log('Starting the native TrueMark backend (Docker is not required).');
  const log=openSync(resolve(stateDir,'start.log'),'a',0o600);
  try {
    await run(cli,['start','--runtime','native','--preparation','on-demand','--exclude','studio,analytics,pooler'],{stdio:['ignore',log,log]});
  } catch (error) {
    throw new Error('Local backend setup failed: '+error.message+'. Details: .local-platform/start.log');
  } finally {closeSync(log);}
}
const config=status();
if(command!=='flush') await seed(config);
if(command==='setup') {
  console.log('Local backend ready. Run npm run dev:platform to open the application.');process.exit(0);
}
if(command==='flush') {
  await flush(config);console.log('Local shipping and message queues processed.');process.exit(0);
}
const functionLog=openSync(resolve(stateDir,'functions.log'),'a',0o600);
const functions=spawn(cli,['functions','serve','--env-file','.local-platform/functions.env','--no-verify-jwt'],{cwd:root,env:localEnv,stdio:['ignore',functionLog,functionLog]});
const sql=database(config);
let working=false, lastError='', ready=false;
const warmUntil=Date.now()+60000;
async function tick() {
  if(working)return;working=true;
  try {
    await sql.unsafe('select public.system_expire_unpaid_orders()');
    await flush(config);
    if(!ready)console.log('Local simulators ready.');
    ready=true;
    lastError='';
  } catch(error) {
    const message=error instanceof Error?error.message:String(error);
    if(Date.now()>warmUntil&&message!==lastError)console.error('Local worker: '+message);
    ready=false;
    lastError=message;
  } finally {working=false;}
}
const child=spawn(process.execPath,[resolve(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5300','--strictPort'],{
  cwd:root,stdio:'inherit',env:{...localEnv,VITE_PLATFORM:'live',VITE_LAUNCH:'1',VITE_ROUTER:'path',VITE_LOCAL_PLATFORM:'1',
    VITE_REVIEW_SUPABASE_URL:config.API_URL,VITE_REVIEW_SUPABASE_ANON_KEY:config.ANON_KEY,VITE_SITE_ORIGIN:'',VITE_INDEX:'0'},
});
console.log('\nTrueMark local platform: '+appOrigin);
console.log('Website: /  ·  Command Center: /admin  ·  Partners: /partners/sign-in');
console.log('Local test accounts: '+accounts.map(a=>a.email).join(', '));
console.log('Local-only password: '+password);
console.log('Auth email inbox: http://127.0.0.1:55424\n');
const timer=setInterval(()=>void tick(),5000);void tick();
let stopping=false;
async function stop(code=0) {
  if(stopping)return;stopping=true;
  clearInterval(timer);child.kill('SIGTERM');functions.kill('SIGTERM');closeSync(functionLog);
  await sql.end();process.exit(code);
}
process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());
child.on('error',error=>{console.error(error.message);void stop(1);});
child.on('exit',code=>{void stop(code??1);});
functions.on('error',error=>{console.error(error.message);void stop(1);});
functions.on('exit',code=>{if(!stopping){console.error('Local function watcher stopped. See .local-platform/functions.log.');void stop(code||1);}});
