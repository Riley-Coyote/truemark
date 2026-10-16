/** Portable subset of release checks; fixtures only, no hosted mutations. */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist/owner-check');
const env = {
  ...process.env,
  VITE_REVIEW_SUPABASE_URL: 'https://fixture.test',
  VITE_REVIEW_SUPABASE_ANON_KEY: 'fixture-anon',
  VITE_SITE_ORIGIN: 'https://fixture.test',
  VITE_INDEX: '0',
  WP27_LAUNCH_DIR: resolve(output, 'launch'),
};
const run = (...args) => execFileSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });

// Supabase identifies migrations by numeric version, not the descriptive suffix.
const versions = new Set();
for (const file of readdirSync(resolve(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql'))) {
  const version = file.match(/^(\d{14})_/)?.[1];
  if (!version || versions.has(version)) throw new Error(`Invalid or duplicate migration version: ${file}`);
  versions.add(version);
}
console.log(`PASS ${versions.size} unique migration versions.`);

for (const kind of ['preview', 'live', 'launch']) {
  run('scripts/build-site.mjs', kind, '--outDir', resolve(output, kind));
}
run('--test', ...[
  'auth-navigation', 'release-config', 'browser-secrets', 'shop-gate',
].map((name) => `scripts/${name}.test.mjs`));
for (const file of readdirSync(resolve(root, 'scripts')).filter((name) => /^validate-.*-sql\.mjs$/.test(name)).sort()) {
  run(`scripts/${file}`);
}
run('scripts/bundle-functions.mjs');
run('scripts/assistant-bundle-audit.mjs', output);
console.log('PASS portable owner checks. No hosted deployment or live provider acceptance performed.');
console.log('Scope: 3 builds, 4 Node test files, all local SQL validators, function bundle and browser audit.');
console.log('Other regression tests are not included. Historical comparisons need original Git/source inputs; see docs/owner-handoff/OPERATIONS.md.');
