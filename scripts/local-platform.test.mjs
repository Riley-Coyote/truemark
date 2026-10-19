import test from 'node:test';
import assert from 'node:assert/strict';
import { assertLocal, localEnv } from './lib/local-platform.mjs';

const valid={API_URL:'http://127.0.0.1:55421',DB_URL:'postgresql://postgres:postgres@127.0.0.1:55422/postgres',ANON_KEY:'local-anon',SERVICE_ROLE_KEY:'local-service'};
test('local setup refuses hosted, redirected and mismatched services',()=>{
  assert.equal(assertLocal(valid),valid);
  for(const patch of [
    {API_URL:'https://gydihnfzmuqmbnykaihg.supabase.co'},
    {API_URL:'http://127.0.0.1:55421/redirect'},
    {DB_URL:'http://127.0.0.1:55422/postgres'},
    {DB_URL:'postgresql://postgres:postgres@db.example:55422/postgres'},
    {DB_URL:'postgresql://postgres:postgres@127.0.0.1:5432/postgres'},
    {DB_URL:'postgresql://postgres:postgres@127.0.0.1:55422/other'},
    {SERVICE_ROLE_KEY:''},
  ])assert.throws(()=>assertLocal({...valid,...patch}));
});
test('local services do not inherit hosted build or provider configuration',()=>{
  assert(!Object.keys(localEnv).some(key=>/^(VITE_|TRUEMARK_|OPENAI_|ANTHROPIC_|OPENROUTER_|RESEND_|TWILIO_|SHIPSTATION_)/.test(key)));
  assert.deepEqual(Object.keys(localEnv).filter(key=>key.startsWith('SUPABASE_')),['SUPABASE_HOME']);
});
