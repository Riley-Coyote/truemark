/** Repeatable local release checks. All service transports and databases are fixtures. */
import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const testsOnly = process.argv.includes('--tests-only');
const env = { ...process.env, VITE_REVIEW_SUPABASE_URL: 'https://fixture.test', VITE_REVIEW_SUPABASE_ANON_KEY: 'fixture-anon',
  VITE_SITE_ORIGIN: 'https://fixture.test', VITE_INDEX: '0', WP27_LAUNCH_DIR: resolve(root, 'dist/release-check/launch') };
function run(label, script, args = []) {
  console.log(`\n${label}`);
  execFileSync(process.execPath, [resolve(root, script), ...args], { cwd: root, env, stdio: 'inherit' });
}
for (const kind of testsOnly ? ['launch'] : ['preview', 'live', 'launch']) {
  run(`Build ${kind} with inert public configuration`, 'scripts/build-site.mjs', [kind, '--outDir', `dist/release-check/${kind}`]);
}
const scripts = await readdir(resolve(root, 'scripts'));
run('TypeScript and TSX tests', 'node_modules/tsx/dist/cli.mjs', ['--test', ...scripts.filter((f) => /\.test\.tsx?$/.test(f)).map((f) => `scripts/${f}`)]);
console.log('\nNode and bundle tests');
execFileSync(process.execPath, ['--test', ...scripts.filter((f) => f.endsWith('.test.mjs')).map((f) => `scripts/${f}`)], { cwd: root, env, stdio: 'inherit' });
if (!testsOnly) {
  for (const file of scripts.filter((f) => /^validate-.*-sql\.mjs$/.test(f)).sort()) run(`Local SQL proof: ${file}`, `scripts/${file}`);
  run('Bundle server functions without deploying', 'scripts/bundle-functions.mjs');
  run('Audit generated browser artifacts', 'scripts/assistant-bundle-audit.mjs', ['dist/release-check']);
}
console.log('\nPASS local release checks. Hosted acceptance and publication are separate, approval-gated steps.');
