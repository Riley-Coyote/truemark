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

## Retention direction and email-provider evaluation — 17 October 2026

**Decision and source:** Mason approved the proposed customer groups, product purchase drill-down, unified customer history, follow-up notes/reminders/drafts and outcome tracking. He said reorder timing varies too much for a standard timeframe. Collect relevant purchase and customer-interaction history from the beginning so six months of activity can inform future decisions. Do not label a customer overdue using an assumed universal interval; show observed gaps, sample sizes and insufficient-history states. Mason requested an email-provider recommendation before implementation starts.

**Assessment:** The local retention screen currently uses a changeable 45-day inactivity threshold across all products, shows six monthly cohort columns and links to customer records. It uses fictional records in the preview. Existing marketing delivery is simulated; a Resend adapter in source is not a production connection. Provider-independent history should include product/quantity/order/refund events, contacts and replies where connected, follow-up activity, consent changes, delivery outcomes and later purchases. Six months is an analysis milestone, not a guarantee of sufficient evidence or an automatic deletion date.

**Provider research:** Amazon SES is the engineering recommendation to evaluate for delivery with Command Center retaining customer records and controls; Mason has not selected it and TrueMark eligibility is unconfirmed. [SES pricing](https://aws.amazon.com/ses/pricing/) currently lists Essentials at $0.16/1,000 emails and optional a-la-carte outbound at $0.10/1,000 before extras. [Production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html) requires review. [SES events](https://docs.aws.amazon.com/ses/latest/dg/event-destinations-manage.html) can feed delivery/engagement history; persist received events in TrueMark rather than relying on vendor reporting windows. [Resend's policy](https://resend.com/legal/acceptable-use) explicitly excludes RUO product content. [Klaviyo's policy](https://www.klaviyo.com/legal/acceptable-use-policy) restricts pharmaceutical products and related services. Omnisend is mentioned in ACCESS.md, but account usage and catalog eligibility remain unconfirmed. No provider was activated or contacted and no customer messages were sent.

**Next (superseded by Mason's following instruction):** Mason deferred the provider decision and asked implementation to continue. Do not repeat provider/account questions before completing the approved retention workspace. Confirm catalog eligibility and intended use when live delivery is resumed. Keep email opens/clicks as imperfect signals; actual replies and purchases remain recorded outcomes rather than proof that a campaign caused an order.

## Customer retention implementation — 17 October 2026

**Decision and source:** Mason said “we ill worry about that later, lets go ahead and continue,” deferring email delivery/provider selection. His prior approval covers customer groups, product drill-down, unified history, notes, contact/reply logs, reminders, unsent drafts and outcomes. No standard reorder timeframe; collect durable evidence for later analysis.

**Result:** Implemented on `codex/customer-retention`, building on the local unified inventory commit. The running sample preview is `http://127.0.0.1:5175/admin/retention`. Filters distinguish the latest selected-product purchase from the latest purchase of anything. Purchase groups and gap observations use full history; monthly comparisons offer 6/12/24 columns. Customer drawers contain orders, product history, consent, editable follow-ups and audit history; customer/activity exports are available. Database migration `20261017000100_retention.sql` supplies shared records, owner-default staff grants and known interaction capture. Drafts never enqueue messages. See [workflow, verification and rollout](../platform/CUSTOMER-RETENTION.md).

**Verification:** Seven new model/adapter tests, 23 existing business-intelligence tests, TypeScript, three builds, 29 portable boundary tests, nine SQL validators, five function bundles and the public artifact scan passed locally. SQL acceptance covers denial/revocation/demotion, duplicate and stale writes, preserved versions, reminders, order/refund/consent/contact events, simulator exclusion, customer-only chat and populated reruns. Browser checks confirmed product/date distinctions, seven-customer monthly drill-down, empty search, reminder completion, draft persistence, logged phone contact, 390 px layout and Escape/focus return. All browser records are explicitly synthetic. GitHub coordination search was authenticated and returned no open matching issues; no message was sent.

**Next:** Review the local workspace, then verify existing Supabase migration history/backups and apply pending migrations with the matching frontend when deployment is authorized. Live activity collection has not begun through this new feature. Hosted Realtime, multi-session and production-volume checks remain outstanding. No authenticated Supabase tool was available; do not ask Mason to accept the invitation again. No production data, deployment, provider or customer communication changed.

## Consolidated conversation handoff — 18 October 2026

**Decision and source:** Mason asked for everything completed and outlined in this conversation to be assembled into a handoff in the repository.

**Result:** Added [the consolidated Command Center handoff](COMMAND-CENTER-HANDOFF-2026-10-18.md) and preserved [the full approved inventory brief](../platform/LOT-INVENTORY-APPROVED-BRIEF.md). The handoff identifies inventory commit `31a8eaf` and retention commit `7b137fd`, settled business rules, implemented behavior, local verification, preview instructions, source files, deferred provider selection, related unfinished work and the production rollout sequence. Linked it from START_HERE.md. Documentation work is on `codex/command-center-handoff`.

**Verification:** Checked local commit ancestry and source/migration references, preserved the supplied brief, and checked documentation links. Authenticated GitHub coordination search returned no open matching issues. No application behavior changed, so application tests were not rerun for this documentation pass; historical results remain labeled as implementation-session evidence. Hosted state was not revalidated. No message, push, deployment or production mutation was performed.

**Next:** Continue from the consolidated handoff and Mason's current priority. Both features remain locally implemented; email-provider selection stays deferred. Verify real migration history, backups and application-owner access before the shared-data rollout.
