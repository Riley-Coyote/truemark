/** Export committed site files, never the private branch history. Local only. */
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sitePaths = ['src', 'public', 'supabase', 'scripts', '.github/workflows', '.env.example',
  'README.md', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts'];
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
if (git('diff', '--name-only', 'HEAD', '--', ...sitePaths) || git('ls-files', '--others', '--exclude-standard', '--', ...sitePaths)) {
  throw new Error('Commit the site changes locally first. Existing private working files are left alone.');
}
const source = git('rev-parse', 'HEAD');
const published = git('rev-parse', 'main');
const files = git('ls-tree', '-r', '--name-only', source, '--', ...sitePaths).split('\n');
for (const path of files) {
  if (!sitePaths.some((allowed) => path === allowed || path.startsWith(allowed + '/')) || /(^|\/)\.env(?!\.example$)(?:\.|$)|(^|\/)\.git(?:\/|$)/.test(path)) {
    throw new Error('A private path entered the publication list. No archive was made.');
  }
}
const directory = resolve(root, 'dist/publication', source.slice(0, 12));
await mkdir(directory, { recursive: true });
const archive = resolve(directory, 'site.tar');
execFileSync('git', ['archive', '--format=tar', '--output', archive, source, '--', ...sitePaths], { cwd: root });
const changes = git('diff', '--name-status', published, source, '--', ...sitePaths).split('\n').filter(Boolean);
const deletions = git('diff', '--name-only', '--diff-filter=D', published, source, '--', ...sitePaths).split('\n').filter(Boolean);
await writeFile(resolve(directory, 'manifest.json'), JSON.stringify({ source, published, createdAt: new Date().toISOString(),
  archiveSha256: createHash('sha256').update(await readFile(archive)).digest('hex'),
  allowedPaths: sitePaths, files, changes, deletions,
  note: 'Local preparation only. Recheck remote main before applying to publish-site. Remove only listed deletions after review. Never push the source branch or merge its history.' }, null, 2) + '\n');
console.log(`Prepared ${files.length} committed site files at ${directory}. Nothing pushed or published.`);
