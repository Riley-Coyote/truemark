// Safety refusals of `npm run backup` and `npm run backup:check`. No database or
// Storage service is needed: every case is refused before anything is touched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SCRATCH_MARKER, SCRATCH_PATTERN, assertKeptScratch, assertLocalCheckServer, assertOwnScratch, assertSafeBackupLocation,
  filterRestoreList, isPlatformSchema, newScratchName, parseDatabaseUrl, redactor, root, storageFilePath,
} from './lib/backup.mjs';

const secret = 'never-print-this-password';
const serviceKey = 'sb_secret_never-print-this-key';
const hostedUrl = 'postgresql://postgres.gydihnfzmuqmbnykaihg:' + secret + '@aws-0-us-west-2.pooler.supabase.com:5432/postgres';
const scratchDir = () => mkdtempSync(join(tmpdir(), 'truemark-backup-test-'));
function runScript(script, args, env) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', script), ...args], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000,
    env: { ...process.env, TRUEMARK_DB_URL: '', TRUEMARK_SUPABASE_URL: '', TRUEMARK_SERVICE_KEY: '', TRUEMARK_CHECK_DB_URL: '', TRUEMARK_BACKUP_DIR: '', ...env },
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

test('backups are refused inside the repository, behind a symlink into it, and inside any Git project', () => {
  assert.throws(() => assertSafeBackupLocation(root), /inside the TrueMark repository/);
  assert.throws(() => assertSafeBackupLocation(join(root, 'backups', '2026-10-19T00-00-00Z')), /inside the TrueMark repository/);
  const dir = scratchDir();
  try {
    symlinkSync(join(root, 'scripts'), join(dir, 'link'));
    assert.throws(() => assertSafeBackupLocation(join(dir, 'link', 'backups')), /inside the TrueMark repository/);
    mkdirSync(join(dir, 'project'));
    execFileSync('git', ['init', '--quiet', join(dir, 'project')]);
    assert.throws(() => assertSafeBackupLocation(join(dir, 'project', 'backups', 'now')), /inside a Git project/);
    assert.match(assertSafeBackupLocation(join(dir, 'plain', 'now')), /plain[/\\]now$/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('npm run backup refuses a folder in the repository before using any credential, and prints none', () => {
  const target = join(root, 'refused-backups');
  const { status, output } = runScript('backup.mjs', [], {
    TRUEMARK_BACKUP_DIR: target, TRUEMARK_DB_URL: hostedUrl, TRUEMARK_SUPABASE_URL: 'https://gydihnfzmuqmbnykaihg.supabase.co', TRUEMARK_SERVICE_KEY: serviceKey,
  });
  assert.equal(status, 1);
  assert.match(output, /Refusing to write a backup inside the TrueMark repository/);
  assert(!output.includes(secret) && !output.includes(serviceKey));
  assert(!existsSync(target));
});

test('a failed backup prints no credential and leaves no partial folder', () => {
  const dir = scratchDir();
  try {
    const { status, output } = runScript('backup.mjs', ['--skip-files'], {
      TRUEMARK_BACKUP_DIR: dir, TRUEMARK_DB_URL: 'postgresql://postgres:' + secret + '@127.0.0.1:1/postgres',
    });
    assert.equal(status, 1);
    assert.match(output, /Backup failed/);
    assert(!output.includes(secret));
    assert.deepEqual(readdirSync(dir), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('backup refuses mixed projects and public keys', () => {
  const dir = scratchDir();
  try {
    let result = runScript('backup.mjs', [], {
      TRUEMARK_BACKUP_DIR: dir, TRUEMARK_DB_URL: hostedUrl, TRUEMARK_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', TRUEMARK_SERVICE_KEY: serviceKey,
    });
    assert.equal(result.status, 1);
    assert.match(result.output, /different Supabase projects/);
    result = runScript('backup.mjs', [], {
      TRUEMARK_BACKUP_DIR: dir, TRUEMARK_DB_URL: hostedUrl, TRUEMARK_SUPABASE_URL: 'https://gydihnfzmuqmbnykaihg.supabase.co', TRUEMARK_SERVICE_KEY: 'sb_publishable_fixture',
    });
    assert.equal(result.status, 1);
    assert.match(result.output, /public key/);
    assert.deepEqual(readdirSync(dir), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Storage object names cannot escape the backup folder', () => {
  const files = join(tmpdir(), 'files');
  for (const name of ['../escape.pdf', 'lots/../../escape.pdf', '/absolute.pdf', 'lots//R14.pdf', 'lots\\R14.pdf', '', 'lots/\u0000.pdf']) {
    assert.throws(() => storageFilePath(files, 'certificates', name), /unsafe Storage path/, name);
  }
  assert.throws(() => storageFilePath(files, '..', 'R14.pdf'), /unsafe Storage path/);
  assert.equal(storageFilePath(files, 'certificates', 'lots/R14.pdf'), join(files, 'certificates', 'lots', 'R14.pdf'));
});

test('backup:check only restores into, or drops, the empty database it just created', () => {
  const name = newScratchName();
  assert.match(name, SCRATCH_PATTERN);
  const comment = SCRATCH_MARKER + ' 0123456789abcdef: temporary copy of a backup, safe to drop';
  const expected = { name, oid: '91234', owner: 'postgres', comment };
  const observed = { name, exists: true, oid: '91234', owner: 'postgres', comment, relations: 0, extensions: 0 };
  assert.equal(assertOwnScratch(observed, expected, { beforeRestore: true }), true);
  const refusals = [
    [{ name: 'postgres' }, /did not name/],
    [{ name: newScratchName() }, /not the one this check created/],
    [{ exists: false }, /no longer exists/],
    [{ oid: '91235' }, /replaced/],
    [{ owner: 'supabase_admin' }, /not owned/],
    [{ comment: SCRATCH_MARKER + ' fedcba9876543210: temporary copy of a backup, safe to drop' }, /marker/],
    [{ relations: 3 }, /not empty/],
    [{ extensions: 1 }, /not empty/],
  ];
  for (const [patch, message] of refusals) {
    assert.throws(() => assertOwnScratch({ ...observed, ...patch }, expected, { beforeRestore: true }), message);
  }
  // After the restore it holds data, and may still be dropped.
  assert.equal(assertOwnScratch({ ...observed, relations: 120 }, expected), true);
});

test('--drop only removes a marked scratch database owned by the same role', () => {
  const kept = { name: newScratchName(), exists: true, owner: 'postgres', currentUser: 'postgres', comment: SCRATCH_MARKER + ' 0123456789abcdef: temporary' };
  assert.equal(assertKeptScratch(kept), true);
  for (const patch of [{ name: 'postgres' }, { name: '_supabase' }, { name: 'truemark_backup_check_x' }, { comment: null },
    { comment: 'a production database' }, { owner: 'supabase_admin' }, { exists: false }]) {
    assert.throws(() => assertKeptScratch({ ...kept, ...patch }));
  }
});

test('backup:check refuses a database server that is not on this computer, without printing credentials', () => {
  assert.throws(() => assertLocalCheckServer(parseDatabaseUrl(hostedUrl)), /Refusing aws-0-us-west-2\.pooler\.supabase\.com/);
  assert.throws(() => assertLocalCheckServer(parseDatabaseUrl('postgresql://postgres:x@db.gydihnfzmuqmbnykaihg.supabase.co:5432/postgres')));
  assertLocalCheckServer(parseDatabaseUrl('postgresql://postgres:postgres@127.0.0.1:55422/postgres'));
  const dir = scratchDir();
  try {
    const { status, output } = runScript('backup-check.mjs', [dir], { TRUEMARK_CHECK_DB_URL: hostedUrl });
    assert.equal(status, 1);
    assert.match(output, /only creates its throwaway database on a Postgres server on this computer/);
    assert(!output.includes(secret));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the restore skips only platform-only steps', () => {
  const toc = [
    ';',
    '; Archive created at 2026-10-19 02:20:55 CDT',
    '3; 3079 16406 EXTENSION - pgcrypto ',
    '5820; 0 0 COMMENT - EXTENSION pgcrypto ',
    '2; 3079 16395 EXTENSION - uuid-ossp ',
    '5821; 0 0 COMMENT - EXTENSION "uuid-ossp" ',
    '4; 3079 16400 EXTENSION - pgjwt ',
    '234; 1259 17000 TABLE public orders postgres',
    '5001; 0 17000 TABLE DATA public orders postgres',
    '5706; 6104 16388 PUBLICATION - supabase_realtime postgres',
    '5708; 6106 18235 PUBLICATION TABLE public supabase_realtime orders postgres',
    '2791; 826 16451 DEFAULT ACL public DEFAULT PRIVILEGES FOR TABLES postgres',
    '2795; 826 16455 DEFAULT ACL public DEFAULT PRIVILEGES FOR TABLES supabase_admin',
    '4402; 3466 16571 EVENT TRIGGER - issue_graphql_placeholder supabase_admin',
    '6000; 0 0 ACL public TABLE orders postgres',
  ].join('\n');
  const { list, skipped } = filterRestoreList(toc, { availableExtensions: new Set(['pgcrypto', 'uuid-ossp']), currentUser: 'postgres' });
  for (const kept of ['EXTENSION - pgcrypto', 'COMMENT - EXTENSION "uuid-ossp"', 'TABLE DATA public orders', 'DEFAULT PRIVILEGES FOR TABLES postgres', 'ACL public TABLE orders']) {
    assert(list.includes(kept), kept);
  }
  assert.deepEqual(skipped.map((item) => item.kind).sort(), ['default privilege', 'event trigger', 'extension', 'publication', 'publication']);
});

test('backups leave out platform schemas and secrets, keep the shop and its accounts', () => {
  for (const schema of ['vault', 'cron', 'net', 'realtime', 'pg_toast', 'supabase_functions', 'graphql']) assert(isPlatformSchema(schema), schema);
  for (const schema of ['public', 'auth', 'storage', 'supabase_migrations', 'extensions']) assert(!isPlatformSchema(schema), schema);
  const redact = redactor(serviceKey);
  const text = redact('failed for ' + hostedUrl + ' using ' + serviceKey);
  assert(!text.includes(secret) && !text.includes(serviceKey));
});
