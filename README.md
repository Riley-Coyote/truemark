# TrueMark BioLabs

React/TypeScript storefront, research accounts, lot certificates, partner portal, owner command
center and contextual chat. The approved landing is integrated with the platform. Production
activation still requires host/service configuration and acceptance; real payment processing
is a separate integration.

## Mason and Codex: start here

Read [the owner handoff](docs/owner-handoff/START_HERE.md). It covers the project, current implementation, remaining decisions, account setup and how Codex should work with Mason. Root `AGENTS.md` directs Codex there automatically. For the first chat, use [this short introduction](docs/owner-handoff/FIRST_PROMPT.md).

The shipping correction and owner handoff are included in this source. Publishing source does not apply database migrations, deploy server functions, activate providers or rebuild the pinned Studio release. See [shipping rollout notes](docs/platform/SHIPPING-WORKFLOW-UPDATE.md) before deploying these changes.

For the company account and project skills, see [account setup](docs/owner-handoff/ACCOUNT_SETUP.md). UI work follows [DESIGN.md](DESIGN.md); cross-workspace questions use the [coordination board](BOARD.md).

## Local development

Use Node 22 and the lockfile:

```sh
npm ci
npm run dev -- --port 5174
```

The default mode is a review preview with sample records kept in the browser. Open `/` for the
storefront and `/review` for the presentation. Production review builds use hash routes.

## Build modes

Copy `.env.example` to `.env.local` and set the public Supabase URL/publishable key for connected
builds. Never put server or payment/model-provider secrets in a `VITE_` variable.

```sh
npm run build          # review preview, dist/
npm run build:live     # connected review, dist/live/, hash routes
npm run build:launch   # customer build, dist/launch/, ordinary paths, no review tools
```

Launch hosting must serve `index.html` for paths that are not static files, including `/verify`.
For subdirectory hosting, pass `-- --base /prefix/` to the build command. Set `VITE_SITE_ORIGIN`
to the confirmed HTTPS production origin. Keep `VITE_INDEX=0` until launch is approved. Configure
Supabase Auth's Site URL and allowed redirect roots to match, retaining the trailing slash.

The launch site keeps the existing account gate. Public information and certificate verification
remain available while signed out; shopping and checkout require the appropriate account access.

## Checks

```sh
npm run verify:release # all three builds, tests, local SQL proofs, function bundles and artifact audit
npm test               # launch fixture build and all application tests
npm audit
```

Release checks use inert fixtures and PGlite; they do not change hosted services. Historical
comparison tests require the original local repository history. The public Pages workflow runs
the portable Auth/routing/configuration checks and artifact audit without those private commits.
Hosted Auth, provider delivery, uploads, webhooks and customer workflows need separate acceptance.

`npm run preview:messages` renders the existing 20 email templates and eight texts into
`dist/message-preview/` using synthetic records. Serve that directory locally to review HTML
and plain text; it reads no credentials and sends nothing. Browser previews do not certify
delivery or email-client compatibility.

## Source map

- `src/brand/`, `src/shop/`: landing, storefront and customer flows.
- `src/admin/`, `src/partners/`: operator and partner applications.
- `src/platform/`: contracts, preview state and live adapters.
- `src/assistant/`: contextual chat, local record cards and tool execution.
- `supabase/migrations/`, `supabase/functions/`, `supabase/templates/`: server contracts and Auth emails.
- `public/`: browser assets, original branding and supplied product imagery.
- `scripts/`: verification and local build/publication preparation.

## Publication

The working repository contains private client materials. Never push the development branch or
its history. `npm run prepare:publish` exports only committed site paths to a local archive and
manifest. It performs no deployment. Inspect the manifest and use the dedicated publication
checkout to make a site-only publish commit after approval. Pages remains a manual workflow.

## Studio

The editable Studio and all curated content are included in this checkout. Run `npm run dev:studio` after `npm ci`. See [STUDIO.md](STUDIO.md) for preview, build and content locations. No access to Riley’s machine is required.
