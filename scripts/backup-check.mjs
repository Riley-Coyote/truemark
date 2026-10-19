/**
 * npm run backup:check -- <backup folder>: proves a backup can be restored.
 *
 * Verifies every hash in the manifest, restores the database dump into a brand-new
 * throwaway database on a Postgres server on this computer, compares every table's
 * row count with the manifest, then drops the throwaway database. It never restores
 * into an existing database: it only ever touches a database it has just created,
 * by its own generated name, and checks that identity again before restoring and
 * before dropping.
 *   TRUEMARK_CHECK_DB_URL  optional; a local (127.0.0.1) Postgres where it may create a database.
 *                          Default: the local Supabase stack from `npm run platform:setup`.
 *   TRUEMARK_PG_BIN        optional folder holding pg_restore (17 or newer).
 * Options: --keep leaves the restored copy for looking up rows (it prints how to drop it);
 *          --drop <name> drops a copy an earlier --keep left behind.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import postgres from 'postgres';
import {
  MANIFEST_FORMAT, SCRATCH_MARKER, assertKeptScratch, assertLocalCheckServer, assertOwnScratch, clientOptions,
  filterRestoreList, findPgTools, formatBytes, newScratchName, parseDatabaseUrl, pgEnv, quoteIdent, redactor,
  sha256File, storageFilePath,
} from './lib/backup.mjs';

let redact = redactor();

function options(args) {
  const parsed = { folder: null, keep: false, drop: null };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--keep') parsed.keep = true;
    else if (arg === '--drop' && args[index + 1]) parsed.drop = args[++index];
    else if (!arg.startsWith('--') && !parsed.folder) parsed.folder = arg;
    else throw new Error('Unknown option ' + arg + '. Usage: npm run backup:check -- <backup folder> [--keep], or --drop <name>.');
  }
  if (!parsed.folder && !parsed.drop) throw new Error('Name the backup folder: npm run backup:check -- <backup folder>');
  return parsed;
}

async function checkServerUrl() {
  if (process.env.TRUEMARK_CHECK_DB_URL) return process.env.TRUEMARK_CHECK_DB_URL;
  try {
    const { status } = await import('./lib/local-platform.mjs');
    return status().DB_URL;
  } catch {
    throw new Error('No local Postgres to restore into. Start the local platform once with `npm run platform:setup`, '
      + 'or set TRUEMARK_CHECK_DB_URL to a Supabase Postgres on this computer (127.0.0.1).');
  }
}

function run(file, args, env) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(file, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolveRun({ code, stdout, stderr: redact(stderr) }));
  });
}

async function observe(admin, name) {
  const [row] = await admin`select oid::text as oid, pg_get_userbyid(datdba) as owner, shobj_description(oid, 'pg_database') as comment,
    current_user as current_user from pg_database where datname = ${name}`;
  return row ? { name, exists: true, oid: row.oid, owner: row.owner, comment: row.comment, currentUser: row.current_user } : { name, exists: false };
}

async function dropKept(admin, name) {
  const observed = await observe(admin, name);
  assertKeptScratch(observed);
  await admin.unsafe('drop database ' + quoteIdent(name) + ' with (force)');
  console.log('Dropped ' + name + '.');
}

async function verifyFiles(folder, manifest) {
  const dump = join(folder, manifest.database.file);
  if (!existsSync(dump)) throw new Error('The database dump is missing from the backup folder.');
  if ((await stat(dump)).size !== manifest.database.bytes || await sha256File(dump) !== manifest.database.sha256) {
    throw new Error('The database dump does not match its recorded SHA-256 hash; this backup is damaged.');
  }
  if (manifest.storage?.skipped) return { files: 0, bytes: 0, skipped: true };
  const filesDir = join(folder, manifest.storage.folder);
  const bad = [];
  for (const file of manifest.storage.files) {
    const path = storageFilePath(filesDir, file.bucket, file.name);
    if (!existsSync(path) || (await stat(path)).size !== file.bytes || await sha256File(path) !== file.sha256) bad.push(file.bucket + '/' + file.name);
  }
  if (bad.length) throw new Error(bad.length + ' Storage files are missing or changed, e.g. ' + bad.slice(0, 3).join(', ') + '.');
  return { files: manifest.storage.files.length, bytes: manifest.storage.bytes, skipped: false };
}

async function main() {
  const args = options(process.argv.slice(2));
  const serverUrl = await checkServerUrl();
  const server = assertLocalCheckServer(parseDatabaseUrl(serverUrl, 'TRUEMARK_CHECK_DB_URL'));
  redact = redactor(server.password, serverUrl);
  const admin = postgres(serverUrl, clientOptions(server));
  try {
    if (args.drop) return await dropKept(admin, args.drop);

    const folder = resolve(args.folder);
    const manifest = JSON.parse(await readFile(join(folder, 'manifest.json'), 'utf8').catch(() => {
      throw new Error('No manifest.json in ' + folder + '. Is this a folder made by npm run backup?');
    }));
    if (manifest.format !== MANIFEST_FORMAT || manifest.complete !== true) throw new Error('This manifest is not a complete TrueMark backup.');

    console.log('Checking the backup made ' + manifest.createdAt + ' from ' + manifest.source.database.host + '.');
    const fileCheck = await verifyFiles(folder, manifest);
    console.log('Hashes match: the database dump' + (fileCheck.skipped ? ' (files were not backed up)' : ' and ' + fileCheck.files + ' files (' + formatBytes(fileCheck.bytes) + ')') + '.');

    const tools = findPgTools();
    const name = newScratchName();
    if ((await observe(admin, name)).exists) throw new Error('Refusing to continue: a database named ' + name + ' already exists.');
    const encoding = /^[A-Z0-9_]+$/.test(manifest.source.database.encoding ?? '') ? manifest.source.database.encoding : 'UTF8';
    const comment = SCRATCH_MARKER + ' ' + randomBytes(8).toString('hex') + ': temporary copy of a backup, safe to drop';
    await admin.unsafe('create database ' + quoteIdent(name) + ' template template0 encoding ' + "'" + encoding + "'");
    const created = await observe(admin, name);
    try {
      await admin.unsafe('comment on database ' + quoteIdent(name) + ' is ' + "'" + comment.replaceAll("'", "''") + "'");
    } catch (error) {
      if (created.exists && created.owner === created.currentUser) await admin.unsafe('drop database ' + quoteIdent(name));
      throw error;
    }
    const expected = { name, oid: created.oid, owner: created.currentUser, comment };
    console.log('Created throwaway database ' + name + ' on ' + server.host + ':' + server.port + '.');

    const scratchUrl = new URL(serverUrl);
    scratchUrl.pathname = '/' + name;
    const scratch = postgres(scratchUrl.toString(), clientOptions(server));
    const workDir = await mkdtemp(join(tmpdir(), 'truemark-backup-check-'));
    let passed = false;
    try {
      const identity = async () => {
        const [inside] = await scratch`select
          (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg_toast%') as relations,
          (select count(*)::int from pg_extension where extname <> 'plpgsql') as extensions,
          current_database() as database`;
        if (inside.database !== name) throw new Error('Connected to the wrong database.');
        return { ...await observe(admin, name), relations: inside.relations, extensions: inside.extensions };
      };
      assertOwnScratch(await identity(), expected, { beforeRestore: true });

      const available = new Set((await scratch`select name from pg_available_extensions`).map((row) => row.name));
      const [{ user: currentUser }] = await scratch`select current_user as user`;
      const dump = join(folder, manifest.database.file);
      const listed = await run(tools.pgRestore, ['--list', dump], process.env);
      if (listed.code !== 0) throw new Error('pg_restore could not read the dump: ' + listed.stderr.trim());
      const { list, skipped } = filterRestoreList(listed.stdout, { availableExtensions: available, currentUser });
      const listFile = join(workDir, 'restore.list');
      await writeFile(listFile, list, { mode: 0o600 });

      // Same database, same identity, still empty: only then restore.
      assertOwnScratch(await identity(), expected, { beforeRestore: true });
      console.log('Restoring…');
      const restored = await run(tools.pgRestore, ['--no-owner', '--no-password', '--use-list=' + listFile, '--dbname=' + name, dump], pgEnv(server, name));
      const errors = restored.stderr.split('\n').filter((line) => /error:/.test(line) && !/errors ignored on restore/.test(line));

      const rows = [];
      for (const [key, expectedCount] of Object.entries(manifest.database.rowCounts)) {
        const [schema, ...rest] = key.split('.');
        const table = rest.join('.');
        const [{ present }] = await scratch`select to_regclass(${quoteIdent(schema) + '.' + quoteIdent(table)}) is not null as present`;
        const actual = present ? Number((await scratch.unsafe('select count(*)::bigint as count from ' + quoteIdent(schema) + '.' + quoteIdent(table)))[0].count) : null;
        rows.push({ key, expected: expectedCount, actual });
      }
      const mismatched = rows.filter((row) => row.actual !== row.expected);
      const expectedTotal = rows.reduce((sum, row) => sum + row.expected, 0);
      const actualTotal = rows.reduce((sum, row) => sum + (row.actual ?? 0), 0);

      console.log('\nRow counts, backup vs restored copy:');
      const bySchema = {};
      for (const row of rows) {
        const schema = row.key.split('.')[0];
        bySchema[schema] ??= { tables: 0, expected: 0, actual: 0 };
        bySchema[schema].tables++; bySchema[schema].expected += row.expected; bySchema[schema].actual += row.actual ?? 0;
      }
      for (const [schema, total] of Object.entries(bySchema)) {
        console.log('  ' + schema.padEnd(22) + String(total.tables).padStart(4) + ' tables ' + String(total.expected).padStart(8) + ' → ' + String(total.actual).padStart(8) + (total.expected === total.actual ? '' : '  MISMATCH'));
      }
      console.log('  ' + 'total'.padEnd(22) + String(rows.length).padStart(4) + ' tables ' + String(expectedTotal).padStart(8) + ' → ' + String(actualTotal).padStart(8));
      for (const row of mismatched) console.log('  MISMATCH ' + row.key + ': backup ' + row.expected + ', restored ' + (row.actual ?? 'table missing'));
      if (skipped.length) {
        const kinds = {};
        for (const item of skipped) kinds[item.kind + ' (' + item.reason + ')'] = (kinds[item.kind + ' (' + item.reason + ')'] ?? 0) + 1;
        console.log('Not restored into the copy, as expected: ' + Object.entries(kinds).map(([kind, count]) => count + ' ' + kind).join('; ') + '.');
      }
      if (errors.length) {
        console.log('\npg_restore reported ' + errors.length + ' errors:');
        for (const line of errors.slice(0, 10)) console.log('  ' + line.trim());
      }
      passed = mismatched.length === 0 && errors.length === 0 && restored.code === 0;
      console.log(passed
        ? '\nPASS: the backup restores, and all ' + rows.length + ' tables hold the same ' + expectedTotal + ' rows.'
        : '\nFAIL: this backup did not restore cleanly. Do not rely on it; take a new backup and check that one.');
    } finally {
      await scratch.end({ timeout: 5 });
      await rm(workDir, { recursive: true, force: true });
      if (args.keep) {
        console.log('\nKept the restored copy as ' + name + ' on ' + server.host + ':' + server.port + '. It holds customer data: drop it when done with');
        console.log('  npm run backup:check -- --drop ' + name);
      } else {
        assertOwnScratch(await observe(admin, name), expected);
        await admin.unsafe('drop database ' + quoteIdent(name) + ' with (force)');
        console.log('Dropped the throwaway database ' + name + '.');
      }
    }
    if (!passed) process.exitCode = 1;
  } finally {
    await admin.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error('Backup check failed: ' + redact(error.message));
  process.exit(1);
});
