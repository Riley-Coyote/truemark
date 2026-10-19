// Runs the Pages workflow's "Choose the version to publish" step against a
// throwaway Git repository, so the undo guard is proven without publishing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// The owner source snapshot leaves deployment workflows out; there is nothing to test then.
const workflowPath = resolve(import.meta.dirname, '../.github/workflows/pages.yml');
const skip = existsSync(workflowPath) ? false : 'no .github/workflows/pages.yml in this checkout';
const workflow = skip ? '' : readFileSync(workflowPath, 'utf8');

function stepScript(id) {
  const lines = workflow.split('\n');
  const start = lines.findIndex((line) => line.trim() === 'id: ' + id);
  const run = lines.findIndex((line, index) => index > start && /^\s+run: \|$/.test(line));
  const indent = lines[run].indexOf('run:') + 2;
  const body = [];
  for (const line of lines.slice(run + 1)) {
    if (line.trim() && line.search(/\S/) < indent) break;
    body.push(line.slice(indent));
  }
  return body.join('\n');
}

test('the publish workflow keeps the main-only guard and never interpolates the ref input into a script', { skip }, () => {
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
  assert.deepEqual(workflow.match(/\$\{\{\s*inputs\.ref\s*\}\}/g), ['${{ inputs.ref }}']);
  assert.match(workflow, /REQUESTED: \$\{\{ inputs\.ref \}\}/);
  assert.match(workflow, /record:\n\s+needs: \[build, deploy\]/);
});

test('only versions already in main can be chosen for publishing', { skip }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'truemark-pages-ref-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init', '--quiet', '--initial-branch=main');
    git('config', 'user.email', 'test@truemark.test'); git('config', 'user.name', 'Test');
    const commit = (file) => { writeFileSync(join(dir, file), file); git('add', file); git('commit', '--quiet', '-m', file); return git('rev-parse', 'HEAD'); };
    const first = commit('first');
    git('tag', 'published/2026-10-15-120000-' + first.slice(0, 7));
    const second = commit('second');
    git('checkout', '--quiet', '-b', 'claude/private-work');
    const privateWork = commit('private');
    git('tag', 'private-tag');
    git('checkout', '--quiet', 'main');
    const main = commit('third');
    const script = join(dir, '..', 'choose-' + Date.now() + '.sh');
    writeFileSync(script, stepScript('version'));
    const choose = (requested) => {
      git('checkout', '--quiet', 'main');
      const output = join(dir, '.git', 'output'); const summary = join(dir, '.git', 'summary');
      writeFileSync(output, ''); writeFileSync(summary, '');
      const result = spawnSync('bash', ['-e', script], { cwd: dir, encoding: 'utf8',
        env: { ...process.env, REQUESTED: requested, GITHUB_SHA: main, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary } });
      return { status: result.status, out: result.stdout + result.stderr, output: readFileSync(output, 'utf8'), head: git('rev-parse', 'HEAD') };
    };
    try {
      let result = choose('');
      assert.equal(result.status, 0); assert.equal(result.output, 'commit=' + main + '\n'); assert.equal(result.head, main);
      for (const [requested, expected] of [['published/2026-10-15-120000-' + first.slice(0, 7), first], [second, second], [second.slice(0, 8), second], [main, main]]) {
        result = choose(requested);
        assert.equal(result.status, 0, requested + ': ' + result.out);
        assert.equal(result.output, 'commit=' + expected + '\n');
        assert.equal(result.head, expected);
      }
      for (const [requested, message] of [['claude/private-work', /not part of main's history/], ['private-tag', /not part of main's history/],
        [privateWork, /not part of main's history/], ['does-not-exist', /No tag or commit/], ['--upload-pack=touch', /tag name or a commit hash/],
        ['main;id', /tag name or a commit hash/], ['$(id)', /tag name or a commit hash/], ['main~1', /tag name or a commit hash/]]) {
        result = choose(requested);
        assert.notEqual(result.status, 0, requested);
        assert.match(result.out, message, requested);
        assert.equal(result.output, '', requested);
        assert.equal(result.head, main, requested + ' must leave main checked out');
      }
    } finally { rmSync(script, { force: true }); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
