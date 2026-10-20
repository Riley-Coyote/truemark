# TrueMark continuation notes

Read this before asking Mason to explain the project again. Maintain a concise record of project decisions and the next useful action, with dates and sources. Do not store credentials, private customer records or unrelated personal conversation here.

## Current handoff checkpoint — 16 October 2026

Source: Riley's instructions and local work with Codex; not a completed first session on Mason's computer.

- Mason is the client/product decision-maker and will work directly with Codex. Riley is not a required technical intermediary or release approver. Read [Working with Mason](WORKING_WITH_MASON.md) for the collaboration approach.
- Riley reports Mason has **accepted both GitHub and Supabase invitations**. GitHub contributor access comes first; ownership transfer is deferred. Effective permissions, authenticated Codex connections, local setup and the TrueMark application owner login have not been tested on Mason's machine.
- The source accompanying this handoff includes the shipping correction, Command Center lab and owner instructions. The shipping follow-up describes local implementation evidence, not hosted deployment. Verify the checkout version before presenting changes as available; an older clone or ZIP may predate this delivery.
- Shipping corrections have passed local checks: label receipt is separate from shipment; packing confirmation and queue behavior are improved; Review Moderation is removed. See [verification and remaining carrier work](../platform/SHIPPING-WORKFLOW-UPDATE.md).
- Larger remaining work: receive/release stock with certificates; sequential lot quantities and split-lot orders; unified communications and permissions; financial actuals versus inventory scenarios; then retention and the client's specific risk/forecast changes. See [current state](CURRENT_STATE.md) and the [implementation plan](../platform/COMMAND-CENTER-IMPLEMENTATION-PLAN.md).

## Source publication checkpoint — 16 October 2026

Riley requested publication of the current source and handoff to the existing GitHub repository. This delivery includes the application/shipping correction, the editable Command Center lab, owner instructions, plain-language collaboration guide, continuation notes, project-scoped Supabase connection configuration, and portable setup checks. Root `AGENTS.md` and README lead here. Use Git history for the publication commit identity.

The public checkout passed 35 targeted shipping/business tests, 29 portable routing/security/release tests, preview/live/launch builds, all seven local SQL validators, all five function bundles, and the browser artifact scan. Handoff links and staged credential/machine-path checks passed. The new shipping migration uses unique version `20261016000200`; the setup check now rejects duplicate versions. Existing Pages workflow and Studio release pin are preserved.

This is source publication only. It does not apply the new migration, deploy functions, activate real providers, or update the compiled Studio. Original design archives, editable Studio and optional Ghost source remain separate delivery items in ACCESS.md. Do not mistake a pre-publication ZIP or an older checkout for this source.

## Workspace guidance and coordination — 16 October 2026

Riley requested a tailored company-account experience and a way for the two Codex workspaces to coordinate. Added a source-grounded DESIGN.md, two project-local skills (operating workflows and coordination), a GitHub Issues coordination template/protocol, and copyable company ChatGPT preferences. AGENTS.md links the relevant guidance; the owner exporter carries these files.

This prepares the workflow. Account preferences and client-machine discovery are not applied or verified remotely. The board uses public engineering context only; no issue/comment has been sent, and no automated monitor or reply permission has been configured. Read BOARD.md before any exchange. Mason remains able to continue without Riley.

## Next useful session

### Studio portability — 16 October 2026

Riley requested that Mason receive all Studio content in the repository. This supersedes the earlier note that editable Studio delivery was pending. Added the editable shell/catalog and scene helpers, plus the entire checksum-verified public v25 package: 3,179 files (610 MB), including all catalog photographs, films, brand materials and historical compiled previews. See [STUDIO.md](../../STUDIO.md). Original private Git history and the broader recovery archive are not part of this delivery; optional native Ghost source remains separate.

`npm run dev:studio` now runs without Riley's filesystem, local servers, environment files or historical Git refs. `build:studio` rebuilds the current shell/application with committed historical content; `preview:studio` handles deduplicated asset paths locally without a service worker. The hosted Studio still uses the existing pinned release. This does not deploy the website or change Supabase.

Verification: all nine Studio tests pass, including hashes of every content file, all 7,621 asset aliases, catalog media, historical routes, media ranges and traversal rejection. A clean copy containing only staged repository files passed a fresh `npm ci`, all nine tests, the portable build and browser artifact credential scan. Browser checks confirmed the Studio homepage, photography catalog, historical design rendering and actual local film playback. Fixed a desktop-only empty comparison dialog and kept historical next/previous navigation on packaged routes; removed links to unpublished development-only labs.

Follow Mason's current request. If he is starting without a specific task, verify the delivered checkout and access, open the sample preview, then walk through one stock/packing example. Receiving and lot allocation were implemented locally on 17 October; the first-received rule is settled. Ask for real lot quantities only when reconciling production stock. Do not open with every unresolved question.

Codex can independently inspect the lot model, trace its order/payment/certificate consumers, and research real carrier events while waiting for business details. No production migration, provider activation or customer communication is authorized merely by this checkpoint.

## Website, Partners and Command Center polish — 18 October 2026

**Decision and source:** Riley explicitly requested a comprehensive final experience pass and publication of Website, Partners, Command Center and their nested product areas. Studio and Overview are outside this scope; the existing pinned Studio package and Pages workflow are preserved.

**Result:** Search now handles compound names and strengths consistently, with correct results/prices and Enter submission. Mobile menu/search/cart transitions and sheet gestures are more interruptible; canceled or second-finger drags no longer dismiss a sheet. Notifications respect focus and background tabs. Partners has compact layouts, loading feedback, stale-link recovery, retryable payout/discount failures and clearer submission/copy states. Command Center message search includes displayed email addresses and resets filters between Inbox and Email & SMS. Shared drawers retain nested focus/scroll behavior, and explicit keyboard traversal fixes Safari skipping controls. Homepage imagery loads as needed, data-saving connections avoid speculative product downloads, and the photographed room paints before optional mist compilation.

**Verification:** Chrome route/journey checks cover all three areas at phone and desktop widths, all 20 product variants and seven articles, account/checkout review states, all 28 Command Center navigation routes, partner workflows and injected fixture failures. WebKit verifies the same core journeys and 144 forward/reverse dialog focus traversals. An iPhone Safari simulator was also visually inspected; this is not physical-device acceptance. Local regression coverage totals 363 distinct tests including the new search, sheet gesture and focus cases. Portable release checks cover preview/live/launch builds, seven SQL validators, five function bundles and browser artifact isolation. Historical comparisons requiring private commits or original certificate files remain excluded; this is not a claim that the full historical suite is portable.

A throttled mobile lab sample transferred 2.38 MB versus 3.24 MB before this pass, with FCP/LCP 4.224 s versus 7.816 s. Timing is directional (single samples and baseline contention), not field-performance certification. The existing large initial JavaScript chunk warning remains.

**Release boundary:** This source checkpoint is prepared for the authorized publication through the existing GitHub Pages workflow. Verify its successful deployment run and hosted assets for the deployed identity. No migration, hosted data change, provider activation, real payment, shipment or customer message is part of this release. Connected-provider and client-machine acceptance remain separate work.

## Record future checkpoints here

For each meaningful update, add a short dated entry with:

- **Decision and source:** what Mason explicitly chose, versus an assumption or engineering recommendation.
- **Result:** relevant files/commit and observable behavior; label local, connected test or deployed state.
- **Verification:** checks and observed outcome, with links to detailed evidence when useful.
- **Next:** one recommended action and the question, if any, it depends on.

Replace stale next-step guidance as work progresses; preserve the dated decision history. Do not record example wording from the collaboration guide as an answer from Mason.

## Unified lot inventory — 17 October 2026

**Decision and source:** Mason supplied the complete build brief after confirming first actual receipt first, quarantine means received/awaiting testing, and uploading a matching passing certificate automatically clears testing quarantine. Independent holds and incoming units stay unavailable. Products may have multiple lots; counts, names, receipt details, statuses and attachments are editable with audit history. Command Center remains the fulfillment interface.

**Result:** Implemented on `codex/unified-lot-inventory` in the public source checkout. One Products & inventory workspace, guided creation/receiving, partial deliveries, atomic FIFO reservations, split-lot picking/substitution, shipped certificate snapshots, bounded inspected returns and migration preservation. Local preview is running at `http://127.0.0.1:5184/admin/products`. Synthetic browser entries are local only. See [workflow, verification and rollout](../platform/LOT-INVENTORY-WORKFLOW.md).

**Verification:** Portable owner checks passed (three builds, 29 boundary tests, eight SQL validators, five function bundles, artifact audit); 59 adapter/shipping/message regressions and four new inventory/customer tests passed. Desktop and a 390-pixel embedded viewport were inspected. A populated legacy migration fixture preserves quantities/order lines and blocks incomplete open allocations without cancellation. No production state was changed. Native multi-connection PostgreSQL and hosted Realtime remain connected acceptance checks.

**Next:** Review the local workflow, then inspect existing Supabase migration history/backups and reconcile actual stock before deploying this migration and matching frontend/functions. No authenticated Supabase tool was available. Existing invitation acceptance does not need to be requested again. The earlier handoff questions about FIFO and manual quarantine release are settled by Mason's current brief.

## Native local platform — 18 October 2026

**Decision/source:** Riley requested a single ongoing version of the actual platform,
runnable locally with functional simulated data, ahead of Mason's incoming repository
handoff. Use codex/platform-local, based on public main 117997d. The older private
checkout is preserved. No new coordination issue was present when checked this session.

**Result:** npm run dev:platform starts the real launch application at
http://127.0.0.1:5300 using native local Supabase 2.121.0 (Docker is not required).
Website, researcher accounts, Partners and Command Center share the actual database,
Auth, Storage, checked RPCs and server functions. Six initial accounts, 90 historical
orders, stock, rewards, referrals and certificates support demonstration. Historical
orders also have simulator payment/shipment records. Local keys/data/logs live in the
ignored .local-platform directory. Auth emails use default templates and local mail capture (native template
serving is not supported; branded production templates remain preserved); shipping and transactional message workers run every five seconds.
The clean-install assistant migration now tolerates absence of the optional legacy
review layer. Existing hosted databases/services were not modified.

**Evidence:** All 20 application migrations installed on an empty native database.
Ten real-local acceptance checks cover role enforcement, application approval,
checkout/stock, payment callbacks, referral attribution, label/packing/shipping/delivery,
simulated notices, refund/reversal, declined-payment cancellation, contacts and catalog
saves. The production launch build passes; 27 focused regression/isolation tests pass;
61 built browser artifacts pass the credential/server-prompt scan. Browser acceptance
includes a customer checkout (TM-10505), owner label/packing/carrier/delivery actions,
and a signed-in partner portal at 390 px with no horizontal overflow or runtime errors.
Native stop/start retained the records, the ten acceptance checks passed again, and
a password-reset email reached the local inbox. See the local guide and
.local-platform/verification.json. Local state is denied by Vite (403).

**Boundary/next:** Local native CLI support is experimental and pinned. Simulated
providers do not establish real processor/carrier/sender readiness. Full receiving,
split-lot quantities and unified in-app email replies remain in the owner implementation
plan. Read Mason's incoming handoff, reconcile it with these requirements, and continue
from this application. No publication or hosted provider activation is part of this setup.


## Desktop opening scroll centering — 20 October 2026

**Request:** Mason supplied a screen recording of the staging landing page drifting sideways during the opening zoom; mobile already behaved correctly.

**Cause and change:** The desktop procession chose its camera pivot from the collection's initial class. Staging's class representatives omit Semax (the middle hero vial), so the initial class resolves to BPC-157 on a side pedestal. The camera now uses the middle vial actually drawn in the opening, matching the existing phone passage. Carousel ordering, approved artwork, phone controller and database behavior are unchanged. Source base: public `claude/staging` at `e82d092b3385f77a04f6b19dfc1403ca58e989ad`; fix branch: `codex/fix-desktop-scroll-centering`.

**Evidence:** The new controller regression failed before the fix and passes afterward, including widths 701/1440/1920, inset layouts and forward/reverse scrolling with a side vial as the initial class. All 37 targeted procession, native carousel, pinned passage and hero shelf tests pass. TypeScript and the production preview build pass (existing large-chunk warning only). Browser checks cover 1280×800 desktop, 768×900 tablet-sized layout and 390×844 phone layout, return scrolling, collection arrival and Motion off/on. In a 1413-pixel-wide browser at scroll 271, staging moved the middle vial from x=694.686 to x=831.889; the corrected sample preview with the same eight class representatives holds x=694.690 (under 0.01 px drift). No horizontal overflow or browser error logs observed in the checked desktop state.

**Preview and boundary:** Local sample preview runs on port 5186. `scroll-check.local/index.html` is an ignored visual fixture with desktop/phone controls, rendering the actual storefront component and matching staging's public class representatives; it excludes onboarding and does not submit or persist a researcher attestation. It is not included in the published fix. No hosted data, migrations, main branch or deployment was changed. Review the local preview before publishing to staging.
