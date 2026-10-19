# Backups and undo

This is the routine that keeps TrueMark from losing data and lets a bad release be undone. Codex runs the commands. Mason types the database password and secret key himself when the terminal asks for them, and approves every release and every undo. No password or key belongs in Git, in a file in this folder, or in a Codex chat.

`npm run backup` only reads from the project. `npm run backup:check` only restores into a throwaway copy on this computer. Nothing here changes the live site or the hosted database unless a step says so.

## What is protected

| Part | How it is kept | How it is undone |
| --- | --- | --- |
| Database: products, lots, orders, customers, partners, settings, accounts and their sign-ins, file records, migration history | `npm run backup` (`database.dump`) | A forward-fix migration; putting back rows from a backup; or a whole-project restore |
| Uploaded files: certificate PDFs, catalog and journal images, application files | `npm run backup` (`files/`) | Uploading them again from the backup |
| Website | Every version is a commit on `main`; every publish is tagged `published/<time>-<commit>` | Publishing an earlier tag again |
| Server functions (`assistant`, `messages`, `payments`, `shipping`, `uploads`) | Their code is in Git | Deploying the previous release's code again |

Not in a backup, on purpose or by nature: Vault values (`tm_functions_url`, `tm_functions_key`) and function secrets; Supabase platform settings such as Auth URLs and email templates; the Supabase platform's own internal schemas; provider accounts (ShipStation, payments, email); and the Studio release files on GitHub. Scheduled jobs are created by the migrations; the manifest lists them so they can be compared after a restore.

## One-time setup

1. **Postgres 17 client tools.** Run `npm run platform:setup` once. The local Supabase CLI downloads its own Postgres into `.local-platform/`, and both commands find `pg_dump` and `pg_restore` there. The same local stack is where `backup:check` restores its throwaway copy, so this one step covers both; it keeps running until `npm run platform:stop`, and `npm run platform:setup` starts it again. Alternatively install the tools with `brew install postgresql@17`, or point `TRUEMARK_PG_BIN` at a folder holding them. The tools must be at least as new as the project's Postgres version; the backup refuses older ones and says so.
2. **Three values, entered by Mason.** `npm run backup` asks for any that are not already set, without showing what is typed. Letting it ask is better than `export` lines, which stay in the shell history.
   - Database connection string: Supabase dashboard, project, **Connect**, **Session pooler** (port 5432). It contains the database password; if nobody knows it, reset it in the database settings. Nothing in this repository stores it.
   - Project URL: `https://gydihnfzmuqmbnykaihg.supabase.co`
   - Secret key: Project Settings, API Keys, the secret key (`sb_secret_...`) or the legacy `service_role` key. It is used only to download private files. A public (publishable or anon) key is refused.
3. **Where backups go.** `~/TrueMark-backups/<time>/` by default; choose another parent folder with `TRUEMARK_BACKUP_DIR` or `--out-dir`. `npm run backup` refuses a folder inside this repository or any other Git project, so a backup can never be committed. A backup holds customer details and password hashes: keep it on the owner's encrypted disk (FileVault), keep a second copy somewhere private such as an encrypted external drive, and do not email it or put it on a shared drive. The owner decides how many to keep.

## Before every release: back up, then check

```sh
npm run backup
npm run backup:check -- ~/TrueMark-backups/<time>
```

The backup takes one consistent snapshot while the shop keeps running, then downloads every Storage file. Its last lines give the folder, the table and row totals, the file count and the newest applied migration.

The check verifies every SHA-256 hash, restores the dump into a new database named `truemark_backup_check_<time>_<code>` on the local Postgres, compares every table's row count with the manifest and drops the copy. It leaves out only Supabase platform parts that a new project already has (event triggers, the Realtime publication and the default privileges of Supabase's own roles), and any extension the local Postgres lacks, and lists them as expected. Success ends with `PASS: the backup restores, and all N tables hold the same M rows.` Anything else means the backup is not usable: do not release; take a new backup and check that one.

The check only ever restores into a database it has just created: its own generated name, the identity recorded at creation, owned by the connecting role, marked for this run and empty. It checks that again before restoring and before dropping, and it only connects to a Postgres on this computer.

## Releasing

1. Merge the reviewed change into `main` of the shared repository.
2. Back up and check, as above.
3. Apply the database change, if any: inspect the remote migration history, then `npx supabase db push` (see [OPERATIONS.md](OPERATIONS.md)).
4. Deploy changed functions: `npx supabase functions deploy <name> --project-ref gydihnfzmuqmbnykaihg`. `supabase/config.toml` keeps each function's existing `verify_jwt = false`.
5. Publish the website: GitHub, **Actions**, **Deploy review to GitHub Pages**, **Run workflow**, branch `main`, leave `ref` empty. After a successful deploy the workflow adds a tag `published/<UTC time>-<commit>`.
6. Record the release in [SESSION_NOTES.md](SESSION_NOTES.md): the commit, the backup folder and its PASS line, the migrations applied, the functions deployed, and the new `published/...` tag.

## Undoing the website

Publish the previous version again. In GitHub: **Actions**, **Deploy review to GitHub Pages**, **Run workflow**, branch `main`, and set `ref` to the previous `published/...` tag (or a commit hash on `main`). With the GitHub CLI:

```sh
git fetch origin --tags
git tag --list 'published/*' --sort=-refname | head -5
gh workflow run pages.yml --ref main -f ref=published/<time>-<commit>
```

Until the first publish with this workflow has created a tag, use a commit hash from `git log --oneline origin/main`.

Limits:

- Only versions that are already part of `main`'s history are accepted; anything else, such as a private working branch, is refused before it is built. The workflow itself still runs only from `main`.
- Commits older than `cf8aa9e` (14 October 2026) lack scripts the current workflow calls. Their build fails and nothing is published.
- The older version is built with today's repository variables and published next to the same first-design archive. It brings back that version's own Studio pin (`scripts/studio-release.json`).
- It does not undo database migrations or functions. If the bad release changed the database, check that the older website still works with the current database, or undo that change too.
- When production moves to another host, use the same rule there: deploy the previous tag again. Most hosts also keep earlier deploys for an instant rollback; check the chosen host.
- The undo path was checked for correctness but has not been run on GitHub; running it publishes the live site. Rehearse it once as part of the handoff's trial deployment and rollback.

## Undoing a database change

Migrations only go forward. Never use `supabase db reset`, `supabase migration down` or `supabase migration repair` on the hosted project to undo something: they rebuild or rewrite the database instead of reversing one change.

1. **Usually: a forward-fix migration.** Write a new migration that reverses or corrects the change, test it with the local SQL validators, which run every migration in order (`node scripts/check-owner-handoff.mjs` runs them all), and release it like any other change.
2. **If data was lost or damaged:** put back the affected rows from the backup taken just before the release (see below), as part of, or after, the fix.
3. **Worst case, the whole database is wrong:** restore the whole project, from Supabase's own backup if the plan includes one, otherwise from this backup into a new project. Everything written after that backup is lost, including orders and sign-ups, so export recent records first. Then publish the website and deploy the functions that match the restored database; the manifest records the commit and the newest applied migration.

### What Supabase itself keeps depends on the plan

Check it rather than assume:

- Dashboard: **Database**, **Backups** lists any scheduled backups and shows whether Point in Time recovery is on. The organization's billing page shows the plan.
- Or, read-only: `npx supabase backups list --project-ref gydihnfzmuqmbnykaihg`.

Supabase's [backup documentation](https://supabase.com/docs/guides/platform/backups) (read 19 October 2026) says daily backups come with paid plans, Point in Time recovery is a paid add-on, a restore makes the project unavailable for a while, and its backups do not contain the Storage files themselves. Confirm the current terms there. `npm run backup` is needed either way: it includes the files and stays in the owner's hands.

## Undoing a function

Deploy the previous release's code again, from a separate checkout so the working folder is untouched:

```sh
git fetch origin --tags
git worktree add ../truemark-previous <previous published/... tag or commit>
cd ../truemark-previous
npm ci
npx supabase link --project-ref gydihnfzmuqmbnykaihg
npx supabase functions deploy <name> --project-ref gydihnfzmuqmbnykaihg
cd - && git worktree remove ../truemark-previous
```

Use the commit recorded for the release whose functions were working. Redeploying does not change function secrets. If the bad release changed a function together with a migration, check that the older function works with the current database before deploying it.

## Restoring data

**A few rows or one table** (the usual case):

```sh
npm run backup:check -- ~/TrueMark-backups/<time> --keep
```

This leaves the restored copy on the local Postgres and prints its name. Codex looks up the lost rows there (connect with the local database URL from `SUPABASE_HOME=.local-platform/supabase npx supabase status`, using the copy's name as the database), prepares SQL that puts back exactly those rows, shows Mason what it will change, and applies it to the live project only after he approves. Then remove the copy, which holds customer data:

```sh
npm run backup:check -- --drop truemark_backup_check_<time>_<code>
```

**Lost files:** each file is in the backup at `files/<bucket>/<path>`, byte-for-byte (its SHA-256 is in the manifest). Upload it to the same bucket and path, so certificate links keep working: a few through the dashboard's Storage page, many with `npx supabase storage cp -r files/<bucket> ss:///<bucket> --linked --experimental` (not yet rehearsed; try it on a test project first). The upload recreates the file's database record.

**Everything** (the project is lost or beyond repair):

1. Prefer Supabase's own restore, if the plan has one (**Database**, **Backups**). Then upload any files that were lost since.
2. Otherwise restore this backup into a **new** Supabase project, never over the live one, following Supabase's guide, [Backup and restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). With this backup: build the structure by running this repository's migrations at the backup's commit (`npx supabase db push` against the new project); clear the rows the migrations seed; load the data of the `public`, `auth` and `storage` schemas from `database.dump` (`pg_restore --data-only`, leaving out `auth.schema_migrations` and `storage.migrations`) with `SET session_replication_role = replica`, as Supabase's guide does; upload the files; re-enter the Vault values and function secrets; deploy the functions; and update the website's build variables, Auth redirect URLs and provider webhooks. This path has not been rehearsed. Rehearse it on a throwaway project before relying on it.

## The backup folder

- `database.dump`: a `pg_dump` custom-format archive of the `public`, `auth`, `storage`, `supabase_migrations` and `extensions` schemas, plus any other schema the application adds. It leaves out Supabase's platform schemas, Vault, scheduled jobs, the web-request queue and Supabase's vector-bucket tables (left out by Supabase's own guide too), so no Vault secret is copied and a restored copy cannot run jobs or make web requests.
- `files/<bucket>/<path>`: every Storage file.
- `manifest.json`: the time, the source host, the tool version, the Git commit and branch, the newest applied migration, the row count of every table, every file's size and SHA-256, the scheduled jobs and any notes.

## Settings

| Variable | Used by | Meaning |
| --- | --- | --- |
| `TRUEMARK_DB_URL` | backup | Database connection string (session pooler). Asked for when missing. |
| `TRUEMARK_SUPABASE_URL` | backup | Project URL. Asked for when missing. |
| `TRUEMARK_SERVICE_KEY` | backup | Secret key, for private files. Asked for when missing. |
| `TRUEMARK_BACKUP_DIR` | backup | Parent folder. Default `~/TrueMark-backups`. |
| `TRUEMARK_PG_BIN` | both | Folder holding `pg_dump` and `pg_restore`, if they are not found on their own. |
| `TRUEMARK_CHECK_DB_URL` | check | A Postgres on this computer (127.0.0.1) to restore into. Default: the local stack from `npm run platform:setup`. |

Options: `npm run backup -- --skip-files` backs up the database only (the manifest says the files were skipped). `npm run backup:check -- <folder> --keep` and `--drop <name>` are described above. Options after the command need the `--`.

## What has been tested

On 19 October 2026, against the local platform: `npm run backup` copied 87 tables (1,526 rows) and 21 certificate files (12 MB); `npm run backup:check` restored the copy and every table's count matched, then dropped it. A changed file and a changed row count were each caught and reported as a failure. Both a `sb_secret_` key and a legacy `service_role` key downloaded the files through the signed-in Storage endpoint; all 21 were in the public `certificates` bucket, as the private `application-files` bucket was empty, so a private download has not been seen yet. The refusals (a folder inside a repository, a server not on this computer, a database the check did not create, a public key, a database and project URL from different projects) are covered by `scripts/backup.test.mjs`, and the website version guard by `scripts/pages-workflow.test.mjs`. Not yet tested: a backup of the hosted project, the GitHub undo itself, re-uploading files, and a restore into a new project.
