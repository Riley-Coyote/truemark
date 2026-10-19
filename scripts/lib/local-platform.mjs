import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const stateDir = resolve(root, '.local-platform');
export const cli = resolve(root, 'node_modules/.bin/supabase');
export const appOrigin = 'http://127.0.0.1:5300';
// Keep hosted credentials and build overrides out of the isolated native services.
export const localEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/^(VITE_|SUPABASE_|OPENAI_|ANTHROPIC_|OPENROUTER_|RESEND_|TWILIO_|SHIPSTATION_|FUNCTIONS_KEY$|PAYMENTS_SIM_SECRET$|SHIPPING_SIM_SECRET$|SHIPPING_WEBHOOK_KEY$|SITE_URL$)/.test(key))),
  SUPABASE_HOME: resolve(stateDir, 'supabase') };
export const password = 'TrueMark-local-2026!';
export const accounts = [
  { role: 'owner', email: 'owner@truemark.test', name: 'TrueMark owner' },
  { role: 'staff', email: 'staff@truemark.test', name: 'TrueMark fulfilment' },
  { role: 'buyer', email: 'researcher@truemark.test', name: 'Dr. Mara Ellison' },
  { role: 'partner', email: 'partner@truemark.test', name: 'Alex Morgan' },
  { role: 'buyer', email: 'pending@truemark.test', name: 'Owen Hartley', pending: true },
  { role: 'buyer', email: 'procurement@truemark.test', name: 'Priya Raman' },
];
export function assertLocal(config) {
  if (config.API_URL !== 'http://127.0.0.1:55421') throw new Error('Refusing a non-local API. Start the TrueMark local stack first.');
  const db = new URL(config.DB_URL);
  if (!['postgres:','postgresql:'].includes(db.protocol) || db.hostname !== '127.0.0.1' || db.port !== '55422' || db.pathname !== '/postgres') throw new Error('Refusing a non-local database.');
  if (!config.ANON_KEY || !config.SERVICE_ROLE_KEY) throw new Error('Local stack keys are unavailable.');
  return config;
}
export function status() {
  const raw = execFileSync(cli, ['status', '--output-format', 'json'], { cwd: root, env: localEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const result = JSON.parse(raw);
  if (result.runtime !== 'native') throw new Error('This project expects the native local runtime.');
  return assertLocal(result.env);
}
export function database(config) {
  assertLocal(config);
  return postgres(config.DB_URL, { max: 1, connect_timeout: 10, onnotice: () => {} });
}
export async function secrets() {
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  const path = resolve(stateDir, 'providers.json');
  try { return JSON.parse(await readFile(path, 'utf8')); } catch (failure) {
    if (failure.code !== 'ENOENT') throw failure;
    const generated = Object.fromEntries(['FUNCTIONS_KEY', 'PAYMENTS_SIM_SECRET', 'SHIPPING_SIM_SECRET', 'SHIPPING_WEBHOOK_KEY'].map(key => [key, randomBytes(32).toString('hex')]));
    await writeFile(path, JSON.stringify(generated), { mode: 0o600 });
    return generated;
  }
}
export async function configureFunctions() {
  const values = { ...await secrets(), SITE_URL: appOrigin, EMAIL_FROM: 'TrueMark Local <orders@truemark.test>' };
  await writeFile(resolve(stateDir, 'functions.env'), Object.entries(values).map(([key, value]) => key + '=' + value).join('\n') + '\n', { mode: 0o600 });
  return values;
}
export async function flush(config) {
  assertLocal(config);
  const { FUNCTIONS_KEY } = await secrets();
  const outcomes = [];
  for (const service of ['shipping', 'messages']) {
    const response = await fetch(config.API_URL + '/functions/v1/' + service + '/flush', {
      method: 'POST', headers: { 'x-functions-key': FUNCTIONS_KEY, 'Content-Type': 'application/json' },
      body: '{}', signal: AbortSignal.timeout(50_000),
    });
    if (!response.ok) throw new Error(service + ' worker returned ' + response.status + ': ' + await response.text());
    outcomes.push(await response.json());
  }
  return outcomes;
}
export function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: root, env: localEnv, stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolveRun() : reject(new Error(command + ' exited with ' + code)));
  });
}
