/**
 * Staging: a hosted Supabase project carrying the local platform's sample data and simulators, for a walkthrough
 * anyone can open. Never production. Its details live in .local-platform/staging.env (Git-ignored), written when
 * the project was created: STAGING_REF, STAGING_DB_PASSWORD, STAGING_POOLER_HOST, STAGING_SERVICE_ROLE_KEY,
 * STAGING_ANON_KEY and STAGING_SAMPLE_PASSWORD (the sample accounts' password, kept out of the code because
 * staging is public).
 *
 *   node --import tsx scripts/staging.mjs seed
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { root } from './lib/local-platform.mjs';
import { seed } from './local-seed.mjs';

/** The real TrueMark project. Staging tooling refuses it by name. */
const PRODUCTION = 'gydihnfzmuqmbnykaihg';

const command = process.argv[2];
if (command !== 'seed') throw new Error('Usage: node --import tsx scripts/staging.mjs seed');
const env = Object.fromEntries(readFileSync(resolve(root, '.local-platform/staging.env'), 'utf8').split('\n')
  .filter((line) => line.includes('=')).map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
const ref = env.STAGING_REF;
for (const key of ['STAGING_REF', 'STAGING_DB_PASSWORD', 'STAGING_POOLER_HOST', 'STAGING_SERVICE_ROLE_KEY', 'STAGING_ANON_KEY', 'STAGING_SAMPLE_PASSWORD'])
  if (!env[key]) throw new Error(`.local-platform/staging.env is missing ${key}.`);

function assertStaging(config) {
  if (!/^[a-z]{20}$/.test(ref) || ref === PRODUCTION) throw new Error('Refusing: not a staging project.');
  if (config.API_URL !== `https://${ref}.supabase.co`) throw new Error('Refusing: the API is not the staging project.');
  if (!/\.pooler\.supabase\.com$/.test(env.STAGING_POOLER_HOST)) throw new Error('Refusing: unexpected database host.');
  return config;
}

const config = assertStaging({ API_URL: `https://${ref}.supabase.co`, ANON_KEY: env.STAGING_ANON_KEY, SERVICE_ROLE_KEY: env.STAGING_SERVICE_ROLE_KEY });
const sql = postgres(`postgresql://postgres.${ref}:${encodeURIComponent(env.STAGING_DB_PASSWORD)}@${env.STAGING_POOLER_HOST}:5432/postgres`,
  { ssl: 'require', max: 1, connect_timeout: 15, onnotice: () => {} });
await seed(config, { assert: assertStaging, sql, password: env.STAGING_SAMPLE_PASSWORD });
