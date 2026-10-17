# Run, verify and deploy

## Local setup

Use Node 22 and the checked-in package lock. Open this folder as a project in the client's own Codex desktop app. Use their GitHub credentials for clone/push and their Supabase account for MCP/CLI. Voice can be used if available on their account; confirm it with one small edit/preview trial. Text conversation works without voice.

```sh
npm ci
npm run dev -- --port 5174
```

Open `http://127.0.0.1:5174/` for the fixture preview. Codex should start the server, open the preview and leave it running during the working session. The editable Command Center lab is at `/design-lab/command/index.html`. A screenshot of a fixture does not prove that live persistence works.

### Live connection

Copy `.env.example` to ignored `.env.local`. Set the existing project URL and the **public publishable/anon key** from the Supabase dashboard. The variable names retain the older review-layer naming:

```dotenv
VITE_REVIEW_SUPABASE_URL=https://gydihnfzmuqmbnykaihg.supabase.co
VITE_REVIEW_SUPABASE_ANON_KEY=<public key from dashboard>
VITE_REVIEW_PROJECT=truemark
VITE_PLATFORM=live
VITE_LAUNCH=0
VITE_ROUTER=hash
VITE_INDEX=0
```

Do not put a service-role key, `sb_secret_` key, database password or provider credential in any VITE variable. Restart Vite after changing environment configuration. Live mode can affect real data under the signed-in user's permissions. Use the fixture preview for design exploration and a separate test project/branch when testing transactions or migrations; do not manufacture test orders in production during setup.

For Supabase CLI operations, sign in with the client's account, run `supabase init` only if local configuration is absent, then `supabase link --project-ref gydihnfzmuqmbnykaihg`. The prepared source has no verified complete CLI config; a custom `.temp` file from another machine is not a working link. Inspect remote migration history before `db push`; do not use `db reset` against the hosted project. Establish backups and assess existing data before applying a migration. Existing functions are deployed without gateway JWT verification and perform application-specific checks: inspect each handler before choosing deployment flags.

MCP gives Codex database capabilities but does not configure domain DNS, printer drivers, email accounts or repository ownership. Each service still needs its own authorized login/configuration.

## Portable validation

```sh
node scripts/check-owner-handoff.mjs
```

This performs TypeScript/build checks for fixture preview, live and launch modes, four portable release/security/routing test files, all current local SQL validators, Edge Function bundling and browser artifact scanning. It uses inert public configuration and local PGlite databases; it does not deploy or change the hosted database.

This is a documented **subset** of `npm run verify:release`, not a substitute for every relevant feature regression test. Several historical tests require private Git commits, original certificate source files or native Ghost code. A fresh source snapshot cannot truthfully pass those historical comparisons without their inputs. The original test scripts remain intact. Run additional targeted tests for changes and record skipped checks and reasons. Restore or replace historical fixtures as a follow-up before claiming the full release suite is portable.

For every feature, verify owner, permitted staff, denied staff and customer behavior as applicable, plus persistence, failure states and narrow-screen UI. Provider simulator tests and real provider acceptance are separate evidence.

## Builds and deployment ownership

`npm run build` makes the preview; `npm run build:live` makes the connected review surface; `npm run build:launch` makes the path-routed customer build. Build configuration is embedded at build time. Confirm the real origin and hosting base path before publication.

The current public GitHub Pages workflow builds multiple surfaces plus archived Studio material. It depends on historical repository refs and pinned release assets. The owner source snapshot intentionally omits automatic deployment workflows; importing it into the existing transferred repository should preserve that repository's `.github/` and public refs while the new owner checks the workflow. Do not overwrite the transferred repository with a mirror push or delete its release assets.

For a dedicated production domain, the launch build defaults to `/` and needs hosting that serves the app for customer path routes. Confirm SPA fallback, canonical URLs, Auth callbacks and email links. GitHub Pages project paths require explicit base-path handling. Do not assume transferring the repo keeps the old Pages URL working.

Before the client's first release:

1. Fetch the actual public branch and compare the owner source snapshot on a reviewable branch. Source snapshot metadata records origin, not remote publication.
2. Confirm client-controlled hosting, repository Actions variables, domain and Supabase Auth redirect URLs. Only public Supabase configuration belongs in frontend build variables.
3. Run portable checks plus feature-specific tests. Inspect the preview and test the deployed preview URL.
4. Verify real provider mode and configuration separately. In particular: actual shipment evidence, ShipStation printer workflow, mail sender/routing, payment settlement and webhook authentication.
5. For schema changes, inspect existing migration history/data and capture a backup/forward-repair plan; coordinate code/function/schema versions. A website rollback does not reverse a database migration.
6. Publish under the client's authorization. Record commit, migration IDs, deployed function versions, URLs and rollback steps. Test a small deployment and rollback using the client's accounts.

Current function names: `assistant`, `messages`, `payments`, `shipping`, `uploads`. Existing server secret names include `FUNCTIONS_KEY`, assistant/provider keys and simulator/webhook settings; do not blindly regenerate these or break existing scheduled worker/webhook connections. Inspect vault/cron configuration as part of integration review without printing secrets.

## Independent daily work

The client tells Codex what they want, reviews examples and authorizes changes/releases. Codex edits, runs checks, presents the preview and records decisions. No installed Riley-specific skill or continuing access to Riley's computer is required for the storefront/platform source. The editable Studio and curated collection also run from this checkout: see [STUDIO.md](../../STUDIO.md). The native Ghost app and broader original recovery archive remain optional separate deliveries in ACCESS.md.

References: [Codex browser](https://learn.chatgpt.com/docs/browser), [Codex voice](https://learn.chatgpt.com/docs/features/voice). These features can vary by account/version; verify availability during setup.
