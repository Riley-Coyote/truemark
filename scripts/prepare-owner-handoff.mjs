/** Export selected CURRENT files, not private history. Never deploys or overwrites a checkout. */
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const destination = resolve(root, 'dist/owner-handoff', stamp, 'repository');
const selected = [
  'src', 'public', 'supabase', 'scripts', 'docs/owner-handoff',
  '.agents/skills', '.github/ISSUE_TEMPLATE', 'DESIGN.md', 'BOARD.md',
  'docs/platform/COMMAND-CENTER-IMPLEMENTATION-PLAN.md', 'docs/platform/SHIPPING-WORKFLOW-UPDATE.md',
  'docs/platform/COMMAND-CENTER-COVERAGE.md', 'docs/platform/CONNECTED-PROGRAMS.md',
  'docs/handoff/DECISIONS.md', 'design-lab/command',
  'design-lab/universe', 'design-lab/client-walkthrough', 'studio-content', 'STUDIO.md', '.gitattributes',
  '.env.example', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts',
];
const excluded = new Set(['.git', '.temp', 'node_modules', 'dist', '.DS_Store', '__MACOSX']);
function eligible(path) {
  if (lstatSync(path).isSymbolicLink()) throw new Error(`Refusing symlink: ${relative(root, path)}`);
  const name = path.split('/').at(-1);
  return !excluded.has(name) && !name.startsWith('._') &&
    !(name.startsWith('.env') && name !== '.env.example') &&
    !/\.(local|log|tsbuildinfo)$/.test(name);
}
// Validate inputs before creating the new output. No arbitrary output path is accepted.
for (const name of selected) if (!existsSync(join(root, name))) throw new Error(`Missing handoff input: ${name}`);
mkdirSync(destination, { recursive: true });
for (const name of selected) {
  const target = join(destination, name);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(root, name), target, { recursive: true, filter: eligible, errorOnExist: true, force: false });
}
writeFileSync(join(destination, 'AGENTS.md'), readFileSync(join(root, 'docs/owner-handoff/AGENTS.owner.md')));
writeFileSync(join(destination, 'START_HERE.md'), '# TrueMark owner workspace\n\nRead [the owner handoff](docs/owner-handoff/START_HERE.md) first.\n');
writeFileSync(join(destination, 'README.md'), '# TrueMark\n\nStart with [the owner handoff](docs/owner-handoff/START_HERE.md).\n\nNode 22: `npm ci`, then `npm run dev -- --port 5174`.\n\nRun `node scripts/check-owner-handoff.mjs` for the documented portable validation subset.\n');
writeFileSync(join(destination, '.gitignore'), 'node_modules/\ndist/\ndist-functions/\n.DS_Store\n*.local\n*.tsbuildinfo\n.env\n.env.*\n!.env.example\n*.log\nsupabase/.temp/\n');
mkdirSync(join(destination, '.codex'));
cpSync(join(root, 'docs/owner-handoff/supabase-mcp.toml'), join(destination, '.codex/config.toml'));
const files = [];
function inventory(directory) {
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (lstatSync(path).isDirectory()) inventory(path);
    else {
      const content = readFileSync(path);
      files.push({ path: relative(destination, path), bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') });
    }
  }
}
inventory(destination);
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
writeFileSync(join(destination, 'HANDOFF-MANIFEST.json'), JSON.stringify({
  preparedAt: new Date().toISOString(),
  sourceHead: git('rev-parse', 'HEAD'),
  sourceBranch: git('branch', '--show-current'),
  sourceState: 'Current filesystem snapshot; may include uncommitted selected files. No Git history included.',
  supabaseProject: 'gydihnfzmuqmbnykaihg',
  omitted: ['Git history', 'credentials and local machine state', 'automatic deployment workflows', 'original archives beyond the curated Studio', 'native Ghost', 'other historical design labs'],
  files,
}, null, 2) + '\n');
console.log(JSON.stringify({ destination, files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0), deployed: false }, null, 2));
