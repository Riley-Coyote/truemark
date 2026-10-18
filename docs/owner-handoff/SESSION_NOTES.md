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

Follow Mason's current request. If he is starting without a specific task, verify the delivered checkout and access, open the sample preview, then walk through one stock/packing example. Recommend receiving and lot allocation as the next substantial workflow. Ask how he chooses between two eligible lots before implementing their ordering rule; ask for real lot quantities only when reconciling stock. Do not open with every unresolved question.

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
