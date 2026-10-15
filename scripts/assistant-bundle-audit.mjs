import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertBrowserArtifact } from './lib/browser-secrets.mjs';

// Scan only generated public artifacts. Never inspect environment files or emit matched material.
const roots = process.argv.slice(2);
assert(roots.length, 'Provide the preview and live build directories.');
let count = 0;
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { await scan(path); continue; }
    if (!/\.(js|css|html|json|map)$/.test(path)) continue;
    const source = await readFile(path, 'utf8'); count++;
    assertBrowserArtifact(source);
  }
}
for (const root of roots) await scan(root);
console.log(`PASS no detected service credential markers, privileged tokens, model endpoints or server prompts in ${count} public build artifacts.`);
