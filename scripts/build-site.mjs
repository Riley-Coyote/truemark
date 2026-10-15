/** Local build only. This script never deploys or changes a hosted service. */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import { validateLiveConfig } from './lib/release-config.mjs';

const root = resolve(import.meta.dirname, '..');
const [kind = 'preview', ...args] = process.argv.slice(2);
if (!['preview', 'live', 'launch'].includes(kind)) throw new Error('Choose preview, live or launch.');
const env = { ...loadEnv('production', root, ''), ...process.env,
  VITE_PLATFORM: kind === 'preview' ? 'preview' : 'live',
  VITE_LAUNCH: kind === 'launch' ? '1' : '0', VITE_ROUTER: kind === 'launch' ? 'path' : 'hash' };
if (kind !== 'preview') validateLiveConfig(env);
execFileSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '-b'], { cwd: root, env, stdio: 'inherit' });
execFileSync(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', kind === 'preview' ? 'dist' : `dist/${kind}`,
  '--base', kind === 'launch' ? '/' : kind === 'live' ? '/truemark/live/' : './', ...args], { cwd: root, env, stdio: 'inherit' });
