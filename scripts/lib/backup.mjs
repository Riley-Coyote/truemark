// Shared pieces of `npm run backup` and `npm run backup:check`. Everything here
// either reads, or guards a write; nothing connects to a service on import.
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const defaultBackupParent = join(homedir(), 'TrueMark-backups');
export const MANIFEST_FORMAT = 'truemark-backup/1';

// Schemas that Supabase creates and maintains itself, or that hold secrets and
// short-lived queues. A new Supabase project already has its own copy of each.
// Matched as pg_dump patterns, so `*` is a wildcard.
export const PLATFORM_SCHEMAS = [
  'information_schema', 'pg_*', '_analytics', '_realtime', '_supavisor', 'realtime', 'graphql', 'graphql_public',
  'pgbouncer', 'pgsodium', 'pgsodium_masks', 'pgtle', 'repack', 'etl', 'net', 'cron', 'vault', 'supabase_functions',
  'dbdev', 'tiger', 'tiger_data', 'topology', 'timescaledb_*', '_timescaledb_*',
];
// Platform services with background workers or encryption keys. Leaving them out
// keeps Vault secrets out of the backup, and stops a restored copy from running
// scheduled jobs or making web requests.
export const PLATFORM_EXTENSIONS = ['pg_cron', 'pg_net', 'supabase_vault', 'pgsodium', 'pg_graphql', 'pg_stat_statements'];
// Supabase's own backup guide leaves out these Storage tables (vector buckets, which TrueMark does not use).
export const PLATFORM_TABLES = ['storage.buckets_vectors', 'storage.vector_indexes'];
export const MINIMUM_PG_TOOLS = 17;

// The throwaway databases that backup:check creates, and the marker it leaves on each.
export const SCRATCH_PREFIX = 'truemark_backup_check_';
export const SCRATCH_PATTERN = /^truemark_backup_check_\d{14}_[0-9a-f]{6}$/;
export const SCRATCH_MARKER = 'TrueMark backup check scratch database';

export function schemaPatternToRegExp(pattern) {
  return new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*') + '$');
}
export function isPlatformSchema(name) {
  return PLATFORM_SCHEMAS.some((pattern) => schemaPatternToRegExp(pattern).test(name));
}

export function stamp(date = new Date()) {
  return date.toISOString().replace(/\.\d+Z$/, 'Z').replaceAll(':', '-');
}

/** Hides every known secret from text before it is printed. */
export function redactor(...secrets) {
  const values = secrets.filter((value) => typeof value === 'string' && value.length >= 4);
  return (text) => values.reduce((out, value) => out.split(value).join('[hidden]'),
    String(text ?? '').replace(/(postgres(?:ql)?:\/\/[^:\s/@]+:)[^@\s]+@/gi, '$1[hidden]@'));
}

export const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
export function isLoopback(host) {
  return loopbackHosts.has(String(host).toLowerCase());
}

/** Reads a postgres:// URL without ever printing it. */
export function parseDatabaseUrl(value, label = 'The database connection string') {
  let url;
  try { url = new URL(String(value ?? '').trim()); } catch { throw new Error(label + ' is not a valid postgresql:// URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error(label + ' must start with postgresql://');
  if (!url.hostname) throw new Error(label + ' has no host.');
  const database = decodeURIComponent(url.pathname.replace(/^\//, '')) || 'postgres';
  const sslmode = url.searchParams.get('sslmode') || (isLoopback(url.hostname) ? 'disable' : 'require');
  return {
    url, host: url.hostname, port: Number(url.port || 5432), database, sslmode,
    user: decodeURIComponent(url.username || 'postgres'), password: decodeURIComponent(url.password || ''),
  };
}

/** libpq settings for pg_dump/pg_restore, so no password appears on a command line. */
export function pgEnv(connection, database = connection.database) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG')));
  return { ...env, PGHOST: connection.host.replace(/^\[|\]$/g, ''), PGPORT: String(connection.port), PGUSER: connection.user,
    PGPASSWORD: connection.password, PGDATABASE: database, PGSSLMODE: connection.sslmode, PGAPPNAME: 'truemark-backup', PGCONNECT_TIMEOUT: '15' };
}

/** Options for the `postgres` client that match the URL's TLS needs. */
export function clientOptions(connection) {
  return { max: 1, connect_timeout: 15, idle_timeout: 5, onnotice: () => {}, prepare: false,
    ssl: connection.sslmode === 'disable' ? false : connection.sslmode === 'require' ? 'require' : connection.sslmode,
    connection: { application_name: 'truemark-backup' } };
}

function pgToolVersion(file) {
  const text = execFileSync(file, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const match = text.match(/\)\s+(\d+)(?:\.(\d+))?/);
  return { text, major: Number(match?.[1] ?? 0), minor: Number(match?.[2] ?? 0) };
}
function cachedPostgresBins(home) {
  const base = join(home, 'cache/stack/slim-services/postgres');
  if (!existsSync(base)) return [];
  const found = [];
  for (const version of readdirSync(base)) for (const platform of readdirSync(join(base, version))) {
    const platformDir = join(base, version, platform);
    if (!statSync(platformDir).isDirectory()) continue;
    for (const build of readdirSync(platformDir)) {
      const bin = join(platformDir, build, 'bin');
      if (existsSync(join(bin, 'pg_dump')) && existsSync(join(bin, 'pg_restore'))) found.push(bin);
    }
  }
  return found;
}

/**
 * Finds pg_dump and pg_restore, newest first: TRUEMARK_PG_BIN, the Postgres the
 * local Supabase CLI downloaded into .local-platform/, then the PATH and Homebrew.
 */
export function findPgTools(env = process.env) {
  const candidates = [];
  if (env.TRUEMARK_PG_BIN) candidates.push({ bin: resolve(env.TRUEMARK_PG_BIN), source: 'TRUEMARK_PG_BIN', explicit: true });
  for (const home of [resolve(root, '.local-platform/supabase'), join(homedir(), '.supabase')]) {
    for (const bin of cachedPostgresBins(home)) candidates.push({ bin, source: 'local Supabase CLI download' });
  }
  for (const dir of (env.PATH ?? '').split(':').filter(Boolean)) candidates.push({ bin: dir, source: 'PATH' });
  for (const bin of ['/opt/homebrew/opt/postgresql@17/bin', '/usr/local/opt/postgresql@17/bin',
    '/opt/homebrew/opt/postgresql@18/bin', '/usr/local/opt/postgresql@18/bin', '/Applications/Postgres.app/Contents/Versions/latest/bin']) {
    candidates.push({ bin, source: 'standard install location' });
  }
  const usable = [];
  for (const candidate of candidates) {
    const pgDump = join(candidate.bin, 'pg_dump');
    const pgRestore = join(candidate.bin, 'pg_restore');
    if (!existsSync(pgDump) || !existsSync(pgRestore)) {
      if (candidate.explicit) throw new Error('TRUEMARK_PG_BIN does not contain pg_dump and pg_restore.');
      continue;
    }
    try {
      const version = pgToolVersion(pgDump);
      usable.push({ ...candidate, pgDump, pgRestore, version });
      if (candidate.explicit) break;
    } catch { if (candidate.explicit) throw new Error('pg_dump in TRUEMARK_PG_BIN could not run.'); }
  }
  const explicit = usable.find((tool) => tool.explicit);
  const chosen = explicit ?? usable.sort((a, b) => b.version.major - a.version.major || b.version.minor - a.version.minor)[0];
  if (!chosen || chosen.version.major < MINIMUM_PG_TOOLS) {
    throw new Error('PostgreSQL ' + MINIMUM_PG_TOOLS + ' or newer client tools (pg_dump, pg_restore) are required'
      + (chosen ? '; the newest found is ' + chosen.version.text + '.' : ' and none were found.')
      + ' Run `npm run platform:setup` once (the local Supabase CLI downloads them into .local-platform/),'
      + ' or install them with `brew install postgresql@17`, or set TRUEMARK_PG_BIN to their folder.');
  }
  return chosen;
}

function gitTopLevel(dir) {
  try {
    return realpathSync(execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
  } catch { return null; }
}
/** The real path of `path`, following symlinks in the part of it that already exists. */
function realTarget(path) {
  let current = resolve(path);
  const missing = [];
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    missing.unshift(current.slice(parent.length).replace(/^[/\\]/, ''));
    current = parent;
  }
  const existing = realpathSync(current);
  return { existing, resolved: missing.length ? join(existing, ...missing) : existing };
}
function inside(child, parent) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
}

/**
 * A backup holds customer data, password hashes and sign-in sessions, so it may
 * never land where Git could pick it up: not in this repository, not in another
 * of its worktrees, and not inside any other Git project.
 */
export function assertSafeBackupLocation(target, repositoryRoot = root) {
  const { existing, resolved } = realTarget(target);
  const repo = realpathSync(repositoryRoot);
  if (inside(resolved, repo)) {
    throw new Error('Refusing to write a backup inside the TrueMark repository (' + resolved + '). Choose a folder outside it, for example ' + defaultBackupParent + '.');
  }
  const project = gitTopLevel(existing);
  if (project) {
    throw new Error('Refusing to write a backup inside a Git project (' + project + '), where it could be committed. Choose a folder outside any repository.');
  }
  return resolved;
}

/**
 * Where a Storage object is written inside the backup. Object names come from the
 * database, so a name with `..`, a leading slash or a control character is refused
 * instead of being allowed to escape the folder.
 */
export function storageFilePath(filesDir, bucket, name) {
  const parts = [bucket, ...String(name).split('/')];
  for (const part of parts) {
    if (!part || part === '.' || part === '..' || part.includes('\\') || /[\0-\x1f]/.test(part)) {
      throw new Error('Refusing an unsafe Storage path: ' + JSON.stringify(bucket + '/' + name));
    }
  }
  const path = resolve(filesDir, ...parts);
  if (!inside(path, resolve(filesDir)) || path === resolve(filesDir)) throw new Error('Refusing an unsafe Storage path: ' + JSON.stringify(bucket + '/' + name));
  return path;
}

export function sha256File(path) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256');
    createReadStream(path).on('error', reject).on('data', (chunk) => hash.update(chunk)).on('end', () => resolveHash(hash.digest('hex')));
  });
}

export function quoteIdent(name) {
  return '"' + String(name).replaceAll('"', '""') + '"';
}
export function tableKey(schema, table) {
  return schema + '.' + table;
}

export function newScratchName(date = new Date()) {
  const digits = date.toISOString().replace(/\D/g, '').slice(0, 14);
  return SCRATCH_PREFIX + digits + '_' + randomBytes(3).toString('hex');
}

/**
 * backup:check only ever restores into, or drops, a database it has just created:
 * the generated name, the same catalog identity it recorded at creation, owned by
 * the connecting role, carrying this run's marker and, before a restore, empty.
 */
export function assertOwnScratch(observed, expected, { beforeRestore = false } = {}) {
  if (!SCRATCH_PATTERN.test(observed?.name ?? '')) throw new Error('Refusing a database that backup:check did not name.');
  if (observed.name !== expected.name) throw new Error('Refusing database ' + observed.name + ': it is not the one this check created.');
  if (!observed.exists) throw new Error('Database ' + observed.name + ' no longer exists.');
  if (String(observed.oid) !== String(expected.oid)) throw new Error('Refusing database ' + observed.name + ': it was replaced after this check created it.');
  if (observed.owner !== expected.owner) throw new Error('Refusing database ' + observed.name + ': it is not owned by the role that created it.');
  if (observed.comment !== expected.comment) throw new Error('Refusing database ' + observed.name + ': its scratch marker does not match this run.');
  if (beforeRestore && (observed.relations !== 0 || observed.extensions !== 0)) {
    throw new Error('Refusing database ' + observed.name + ': it is not empty, so it was not freshly created by this check.');
  }
  return true;
}

/** The checks that apply to dropping a scratch database kept by an earlier `--keep` run. */
export function assertKeptScratch(observed) {
  if (!SCRATCH_PATTERN.test(observed?.name ?? '')) throw new Error('Only databases named ' + SCRATCH_PREFIX + '<time>_<code> can be dropped by backup:check.');
  if (!observed.exists) throw new Error('Database ' + observed.name + ' does not exist.');
  if (!String(observed.comment ?? '').startsWith(SCRATCH_MARKER + ' ')) throw new Error('Refusing database ' + observed.name + ': it has no backup:check marker.');
  if (observed.owner !== observed.currentUser) throw new Error('Refusing database ' + observed.name + ': it is owned by another role.');
  return true;
}

/** The check server must be a Postgres on this computer, never a hosted project. */
export function assertLocalCheckServer(connection) {
  if (!isLoopback(connection.host)) {
    throw new Error('backup:check only creates its throwaway database on a Postgres server on this computer (127.0.0.1). Refusing ' + connection.host + '.');
  }
  return connection;
}

/**
 * Removes restore steps that only a Supabase superuser can perform, or that would
 * start platform services, from a `pg_restore --list` table of contents.
 */
export function filterRestoreList(listText, { availableExtensions, currentUser } = {}) {
  const keep = [];
  const skipped = [];
  const missing = (name) => availableExtensions && !availableExtensions.has(name);
  const unquote = (name) => name.replace(/^"(.*)"$/, '$1').replaceAll('""', '"');
  for (const line of listText.split('\n')) {
    // `<id>; <catalog> <oid> <kind> <schema> <name> <owner>`; kinds and names may contain spaces.
    const body = line.match(/^\d+;\s+\d+\s+\d+\s+(.*)$/)?.[1];
    let skip = null;
    if (body?.startsWith('EVENT TRIGGER ')) skip = { kind: 'event trigger', reason: 'Supabase platform hook; needs a superuser' };
    else if (body && /^PUBLICATION( TABLE| TABLES IN SCHEMA)? /.test(body)) skip = { kind: 'publication', reason: 'Supabase Realtime; not needed to read the data' };
    else if (body?.startsWith('DEFAULT ACL ') && currentUser && body.split(' ').at(-1) !== currentUser) {
      skip = { kind: 'default privilege', reason: 'belongs to a Supabase platform role' };
    } else {
      const extension = body?.match(/^(?:COMMENT - )?EXTENSION -? ?("(?:[^"]|"")+"|\S+)/)?.[1];
      if (extension && missing(unquote(extension))) skip = { kind: 'extension', reason: 'not installed on the check server' };
    }
    if (skip) skipped.push({ ...skip, entry: body }); else keep.push(line);
  }
  return { list: keep.join('\n'), skipped };
}

/** Prompts on the terminal without echoing what is typed or pasted. */
export async function promptHidden(question) {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) return '';
  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return await new Promise((resolveAnswer, reject) => {
    let answer = '';
    const done = (value, error) => {
      stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData); stdout.write('\n');
      if (error) reject(error); else resolveAnswer(value);
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') return done(answer.trim());
        if (char === '\u0003') return done('', new Error('Cancelled.'));
        if (char === '\u007f' || char === '\b') answer = answer.slice(0, -1);
        else if (char >= ' ') answer += char;
      }
    };
    stdin.on('data', onData);
  });
}

export function gitState(repositoryRoot = root) {
  const git = (...args) => execFileSync('git', ['-C', repositoryRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    return { commit: git('rev-parse', 'HEAD'), branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
      uncommittedChanges: git('status', '--porcelain', '--untracked-files=no').length > 0 };
  } catch { return { commit: null, branch: null, uncommittedChanges: null }; }
}

export function newestRepositoryMigration(repositoryRoot = root) {
  const dir = resolve(repositoryRoot, 'supabase/migrations');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((file) => /^\d{14}_.+\.sql$/.test(file)).sort();
  return files.at(-1) ?? null;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024; let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return value.toFixed(value >= 10 ? 0 : 1) + ' ' + units[unit];
}
