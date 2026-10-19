/**
 * npm run backup: copies the TrueMark database (schema and data, including
 * accounts) and every Storage file into a new timestamped folder outside the
 * repository, with a manifest that `npm run backup:check` can prove against.
 *
 * Reads only. Connection details come from the environment, or are asked for
 * on the terminal without being shown; they are never written or printed.
 *   TRUEMARK_DB_URL        database connection string (Supabase: Connect > Session pooler)
 *   TRUEMARK_SUPABASE_URL  project URL, e.g. https://<project-ref>.supabase.co
 *   TRUEMARK_SERVICE_KEY   secret (service_role) key, used only to download Storage files
 *   TRUEMARK_BACKUP_DIR    optional parent folder; default ~/TrueMark-backups
 *   TRUEMARK_PG_BIN        optional folder holding pg_dump and pg_restore (17 or newer)
 * Options: --out-dir <folder> (same as TRUEMARK_BACKUP_DIR), --skip-files (database only).
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { chmod, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import postgres from 'postgres';
import {
  MANIFEST_FORMAT, PLATFORM_EXTENSIONS, PLATFORM_SCHEMAS, PLATFORM_TABLES, assertSafeBackupLocation, clientOptions, defaultBackupParent,
  findPgTools, formatBytes, gitState, isLoopback, isPlatformSchema, newestRepositoryMigration, parseDatabaseUrl, pgEnv,
  promptHidden, quoteIdent, redactor, sha256File, stamp, storageFilePath, tableKey,
} from './lib/backup.mjs';

const RESERVED_ROLES = /^(pg_.*|anon|authenticated|authenticator|dashboard_user|pgbouncer|postgres|service_role|supabase_.*|cli_login_.*|pgsodium_key.*|pgtle_admin)$/;

function options(args) {
  let outDir; let skipFiles = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--skip-files') skipFiles = true;
    else if (args[index] === '--out-dir' && args[index + 1] && !args[index + 1].startsWith('--')) outDir = args[++index];
    else throw new Error('Unknown option ' + args[index] + '. Use --out-dir <folder> or --skip-files.');
  }
  return { outDir, skipFiles };
}
let redact = redactor();
let createdFolder = null;

function run(file, args, env) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(file, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolveRun(stdout) : reject(new Error(file.split('/').pop() + ' failed: ' + redact(stderr.trim() || 'exit ' + code))));
  });
}

async function required(name, question) {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (!process.stdin.isTTY) throw new Error(name + ' is not set. Set it in this terminal session (never in a file in the repository) and run again.');
  const answer = await promptHidden(question + ' (input hidden): ');
  if (!answer) throw new Error(name + ' was not provided.');
  return answer;
}

function jwtRole(key) {
  try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role ?? null; } catch { return null; }
}
function projectRef(text) {
  return String(text).match(/(?:^|\.)([a-z0-9]{20})(?:\.|$)/)?.[1] ?? null;
}

async function downloadFiles(storage, objects, filesDir) {
  const headers = { apikey: storage.key, Authorization: 'Bearer ' + storage.key };
  const results = new Array(objects.length);
  let next = 0;
  let failure = null;
  // On the first failure no new download starts, and every running one finishes
  // before the error is raised, so nothing is written after the folder is removed.
  async function worker() {
    while (!failure && next < objects.length) {
      const index = next++;
      const object = objects[index];
      let path;
      try { path = storageFilePath(filesDir, object.bucket, object.name); } catch (error) { failure ??= error; return; }
      const url = storage.url + '/storage/v1/object/authenticated/' + encodeURIComponent(object.bucket) + '/'
        + object.name.split('/').map(encodeURIComponent).join('/');
      let lastError;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await fetch(url, { headers, signal: AbortSignal.timeout(120_000) });
          if (!response.ok) {
            const error = new Error('Storage returned ' + response.status + ' for ' + object.bucket + '/' + object.name);
            if (response.status < 500) { error.final = true; }
            await response.body?.cancel();
            throw error;
          }
          await mkdir(dirname(path), { recursive: true, mode: 0o700 });
          const hash = createHash('sha256');
          let bytes = 0;
          const tap = new Transform({ transform(chunk, _encoding, done) { hash.update(chunk); bytes += chunk.length; done(null, chunk); } });
          await pipeline(Readable.fromWeb(response.body), tap, createWriteStream(path, { mode: 0o600 }));
          if (object.size != null && Number(object.size) !== bytes) {
            throw Object.assign(new Error('Size mismatch for ' + object.bucket + '/' + object.name + ': Storage lists ' + object.size + ' bytes, downloaded ' + bytes), { final: true });
          }
          results[index] = { bucket: object.bucket, name: object.name, bytes, sha256: hash.digest('hex'), contentType: object.mimetype ?? null };
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (error.final) break;
        }
      }
      if (lastError) { failure ??= new Error(redact(lastError.message)); return; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, objects.length) }, worker));
  if (failure) throw failure;
  return results;
}

async function main() {
  const started = Date.now();
  const { outDir, skipFiles } = options(process.argv.slice(2));
  const parent = resolve(outDir || process.env.TRUEMARK_BACKUP_DIR || defaultBackupParent);
  const target = join(parent, stamp());
  // Refuse a bad destination before asking for, or using, any credential.
  assertSafeBackupLocation(target);

  const databaseUrl = await required('TRUEMARK_DB_URL', 'Database connection string (Supabase dashboard > Connect > Session pooler)');
  const connection = parseDatabaseUrl(databaseUrl);
  let storage = null;
  if (!skipFiles) {
    const url = (await required('TRUEMARK_SUPABASE_URL', 'Supabase project URL (https://<project-ref>.supabase.co)')).replace(/\/+$/, '');
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('TRUEMARK_SUPABASE_URL is not a valid URL.'); }
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopback(parsed.hostname))) throw new Error('TRUEMARK_SUPABASE_URL must use https.');
    if (parsed.pathname !== '/' || parsed.search) throw new Error('TRUEMARK_SUPABASE_URL must be the project URL only, without a path.');
    const key = await required('TRUEMARK_SERVICE_KEY', 'Supabase secret (service_role) key');
    if (key.startsWith('sb_publishable_') || jwtRole(key) === 'anon') throw new Error('TRUEMARK_SERVICE_KEY is a public key. Private files need the secret (service_role) key.');
    const apiRef = projectRef(parsed.hostname);
    const dbRef = projectRef(connection.user) ?? projectRef(connection.host.replace(/\.pooler\.supabase\.com$/, ''));
    if (apiRef && dbRef && apiRef !== dbRef) throw new Error('The database (' + dbRef + ') and the project URL (' + apiRef + ') belong to different Supabase projects.');
    storage = { url: parsed.origin, key };
  }
  redact = redactor(connection.password, storage?.key, databaseUrl);

  const tools = findPgTools();
  console.log('Using ' + tools.version.text + ' (' + tools.source + ').');
  const sql = postgres(databaseUrl, clientOptions(connection));
  try {
    const [{ version_num: versionNum, version }] = await sql`select current_setting('server_version_num')::int as version_num, current_setting('server_version') as version`;
    const serverMajor = Math.floor(versionNum / 10000);
    if (tools.version.major < serverMajor) throw new Error('pg_dump ' + tools.version.major + ' cannot back up a PostgreSQL ' + serverMajor + ' server. Install PostgreSQL ' + serverMajor + ' client tools.');
    console.log('Database: ' + connection.host + ':' + connection.port + '/' + connection.database + ' (PostgreSQL ' + version.split(' ')[0] + ').');

    await mkdir(parent, { recursive: true, mode: 0o700 });
    await mkdir(target, { mode: 0o700 });
    createdFolder = target;
    const dumpFile = join(target, 'database.dump');

    // One consistent snapshot: the row counts, the file list and the dump all see
    // the same moment, even while the shop is in use.
    const facts = await sql.begin('isolation level repeatable read read only', async (tx) => {
      const [{ snapshot }] = await tx`select pg_export_snapshot() as snapshot`;
      const schemas = (await tx`select nspname from pg_namespace order by nspname`).map((row) => row.nspname).filter((name) => !isPlatformSchema(name));
      const tables = await tx`
        select n.nspname as schema, c.relname as table from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where c.relkind = 'r' and n.nspname = any(${tx.array(schemas)})
          and not exists (select 1 from pg_depend d where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e')
        order by 1, 2`;
      const counts = {};
      for (const { schema, table } of tables.filter((row) => !PLATFORM_TABLES.includes(tableKey(row.schema, row.table)))) {
        const [{ count }] = await tx.unsafe('select count(*)::bigint as count from ' + quoteIdent(schema) + '.' + quoteIdent(table));
        counts[tableKey(schema, table)] = Number(count);
      }
      const has = async (name) => (await tx`select to_regclass(${name}) is not null as present`)[0].present;
      const migrations = await has('supabase_migrations.schema_migrations')
        ? await tx`select version, name from supabase_migrations.schema_migrations order by version desc` : [];
      const buckets = await has('storage.buckets') ? await tx`select id, public from storage.buckets order by id` : [];
      const objects = await has('storage.objects')
        ? await tx`select bucket_id as bucket, name, metadata->>'size' as size, metadata->>'mimetype' as mimetype from storage.objects where name is not null order by bucket_id, name` : [];
      // A failed query would end the snapshot's transaction, so check the privilege first.
      const jobsReadable = await has('cron.job') && (await tx`select has_table_privilege('cron.job', 'select') as ok`)[0].ok;
      const jobs = !await has('cron.job') ? [] : jobsReadable ? await tx`select jobname, schedule, command, active from cron.job order by jobname` : null;
      const roles = (await tx`select rolname from pg_roles order by rolname`).map((row) => row.rolname).filter((name) => !RESERVED_ROLES.test(name));
      const [{ encoding }] = await tx`select pg_encoding_to_char(encoding) as encoding from pg_database where datname = current_database()`;

      console.log('Dumping ' + Object.keys(counts).length + ' tables from ' + schemas.length + ' schemas…');
      await run(tools.pgDump, ['--format=custom', '--no-password', '--snapshot=' + snapshot, '--file=' + dumpFile,
        ...PLATFORM_SCHEMAS.map((pattern) => '--exclude-schema=' + pattern),
        ...PLATFORM_EXTENSIONS.map((name) => '--exclude-extension=' + name),
        ...PLATFORM_TABLES.map((name) => '--exclude-table=' + name)], pgEnv(connection));
      return { schemas, counts, migrations, buckets, objects, jobs, roles, encoding };
    });
    await chmod(dumpFile, 0o600);

    // The archive must open and must carry the data of every table that was counted.
    const toc = await run(tools.pgRestore, ['--list', dumpFile], process.env);
    const dataEntries = new Set(toc.split('\n').map((line) => line.match(/^\d+;\s+\d+\s+\d+\s+TABLE DATA (.+)$/)?.[1]).filter(Boolean));
    const missingData = Object.keys(facts.counts).filter((key) => {
      const [schema, ...rest] = key.split('.');
      return ![...dataEntries].some((entry) => entry.startsWith(schema + ' ' + rest.join('.') + ' '));
    });
    if (missingData.length) throw new Error('The dump is missing data for ' + missingData.join(', ') + '.');

    let files = null;
    if (storage) {
      console.log('Downloading ' + facts.objects.length + ' Storage files…');
      files = await downloadFiles(storage, facts.objects, join(target, 'files'));
    }

    const dumpStat = await stat(dumpFile);
    const totalRows = Object.values(facts.counts).reduce((sum, count) => sum + count, 0);
    const newest = facts.migrations[0] ?? null;
    const repoNewest = newestRepositoryMigration();
    const notes = [];
    if (facts.roles.length) notes.push('Custom database roles exist and are not in this backup: ' + facts.roles.join(', ') + '. Recreate them before a full restore.');
    if (newest && repoNewest && !repoNewest.startsWith(newest.version)) notes.push('The newest applied migration (' + newest.version + ') differs from the newest in this checkout (' + repoNewest + ').');
    if (facts.jobs === null) notes.push('Scheduled jobs could not be read.');
    const manifest = {
      format: MANIFEST_FORMAT,
      createdAt: new Date(started).toISOString(),
      complete: true,
      source: {
        database: { host: connection.host, port: connection.port, name: connection.database, serverVersion: version.split(' ')[0], encoding: facts.encoding },
        storage: storage ? { url: storage.url } : null,
      },
      tools: { pgDump: tools.version.text },
      git: gitState(),
      migrations: { appliedCount: facts.migrations.length, newestApplied: newest ? { version: newest.version, name: newest.name } : null, newestInCheckout: repoNewest },
      database: {
        file: 'database.dump', format: 'pg_dump custom', bytes: dumpStat.size, sha256: await sha256File(dumpFile),
        schemas: facts.schemas, excludedSchemas: PLATFORM_SCHEMAS, excludedExtensions: PLATFORM_EXTENSIONS, excludedTables: PLATFORM_TABLES,
        tableCount: Object.keys(facts.counts).length, totalRows, rowCounts: facts.counts,
      },
      storage: files ? {
        folder: 'files', fileCount: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0),
        buckets: facts.buckets.map((bucket) => ({ id: bucket.id, public: bucket.public, fileCount: files.filter((file) => file.bucket === bucket.id).length,
          bytes: files.filter((file) => file.bucket === bucket.id).reduce((sum, file) => sum + file.bytes, 0) })),
        files,
      } : { skipped: true, objectsListedInDatabase: facts.objects.length },
      scheduledJobs: facts.jobs,
      notes,
    };
    await writeFile(join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
    createdFolder = null;

    console.log('\nBackup complete: ' + target);
    console.log('  Database: ' + manifest.database.tableCount + ' tables, ' + totalRows + ' rows, ' + formatBytes(dumpStat.size) + ' dump.');
    console.log(files ? '  Files: ' + files.length + ' (' + formatBytes(manifest.storage.bytes) + ') from ' + facts.buckets.length + ' buckets.' : '  Files: skipped (--skip-files).');
    console.log('  Newest applied migration: ' + (newest ? newest.version + ' ' + newest.name : 'none recorded') + '.');
    for (const note of notes) console.log('  Note: ' + note);
    console.log('  This folder holds customer data and password hashes. Keep it private.');
    console.log('Next: npm run backup:check -- "' + target + '"');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(async (error) => {
  if (createdFolder) {
    await rm(createdFolder, { recursive: true, force: true });
    console.error('Removed the incomplete backup folder.');
  }
  console.error('Backup failed: ' + redact(error.message));
  process.exit(1);
});
