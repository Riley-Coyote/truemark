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

## Record future checkpoints here

### Command Center review with Mason — 16 October 2026

- Mason requested a full interactive review of every section, durable notes, and ideas for a seamless, straightforward, user-friendly experience. Started [the living review](COMMAND_CENTER_REVIEW.md), including the complete visible navigation checklist, proposal/decision separation, and Reports findings. This is discovery and documentation, not blanket implementation or publication authorization.
- Inspected the open local `/admin/reports` screen and its source: sample data, six groupings, CSV, device-local saved definitions with fixed dates, and non-running schedule drafts. Proposed ready-to-use reports, concise summaries, rolling periods and optional shared saved definitions; none selected yet.
- Mason then explicitly required checking other sections and tabs before asking about additions, to avoid unnecessary overlap. He confirmed the reuse-first approach: improve or link existing functionality, or deliberately consolidate it when useful; do not create duplicate screens without a distinct purpose. Source inspection confirms Sales analytics, Profit planner and Retention already provide exports, so export alone does not justify Reports.
- Mason answered “both”: Reports must support his own review and regular sharing, with owner and bookkeeper/accountant as the audiences. He has no accountant-required template. He agreed to a monthly pack with a concise owner summary and accountant-friendly spreadsheet, review before sending and optional automation. Exact columns, file format, recipients, access and sending mechanism remain open. Reuse existing analyses and identify estimates/missing data; no sending or automation was activated.
- Reports' starting direction is recorded. Select exact fields as the underlying financial sections are reviewed, rather than asking duplicate metric questions. Existing schedule controls save drafts only.
- Began Overview review: browser and `src/admin/Overview.tsx` show financial summaries, order pipeline, recent orders, partner information and an existing Needs attention component below the main panels. The prominent Business workbench repeats sidebar destinations. Proposed promoting existing actionable items and using links to their home workspaces; no UI changes made.
- Mason confirmed both he and staff handle daily operations, then explicitly switched the review to Lots and Certificates. Overview is paused; no layout or permission changes are approved. Settings should remain the home for access rules used by other screens.
- Inspected the Lots list, fictional lot details and certificate form without submitting changes, plus Products/Commerce and the live content adapter. Existing features cover status, results, PDF and release/replace actions; a receiving/new-lot UI is absent in those screens. Live product stock and lot quantities remain separate, while the sample inventory sums lot units. Proposed one batch-receiving record feeding product totals rather than duplicate stock entry. Same-path PDF replacement needs historical-evidence review.
- Next: ask who currently assigns the lot number printed on the vials (Mason or supplier), then continue the batch-receiving workflow. Preserve settled sequential/split-lot requirements, all local application edits and production records. Detailed findings and later questions are in the living review.

### Studio running on Mason's computer — 16 October 2026

- Mason requested latest main, the Studio instructions, a local Studio, and its content/source locations. Fetched origin/main and fast-forwarded the existing `setup/mason-local` branch from `b77ab5b` to `74da3b8`. Existing Supabase configuration, logo/mobile edits, original logo and local test fixtures remain intact. Session notes were temporarily stashed and cleanly reapplied; the named stash remains as a recovery copy.
- Read `STUDIO.md` and updated repository guidance. The authenticated coordination-board search returned no open matching threads; no messages were sent.
- Installed locked dependencies using Node 22 (`npm ci`: 0 reported vulnerabilities). All nine `npm run test:studio` checks passed, including integrity of the 3,179 content files and asset aliases.
- Started `npm run dev:studio` on http://127.0.0.1:5292/design-lab/universe/index.html (terminal session 71778). Browser verification confirmed “Local studio · sample data,” the Studio landing page, and both storefront viewports loading from 127.0.0.1:5292; no captured browser errors. Existing edits are included in the current embedded application. No hosted publication or Supabase changes.
- Editable Studio: `design-lab/universe/universe.jsx` and `universe.css`; catalog: `design-lab/universe/inventory/catalog.json`; scene helpers: `design-lab/client-walkthrough/`; current application: `src/`. Frozen media and historical previews live in `studio-content/`, with deduplicated files resolved through `asset-map.json`. Historical builds are compiled snapshots, not editable original branches. See `STUDIO.md` for restart and build instructions.

### iOS outline and scroll-path correction — 16 October 2026

- Mason says desktop is the reference, mobile edges remain rough and the logo catches up during scrolling. Confirmed Safari on iOS 26.6.1; phone model not supplied. Avoid further blanket pixel reductions or claims based on a desktop narrow-width test alone.
- Mobile now separates half-CSS-resolution illumination from an up-to-2x-device-pixel silhouette pass in the same canvas/context and clock. Restored desktop's 5px mask softness, with a deterministic one-time Gaussian fallback if Canvas 2D filters are absent. The first pass has bleed around the shape so its low-resolution coverage cannot define the final outline. Desktop retains the single-pass renderer and prior sizing.
- On touch browsers supporting root scroll timelines, a two-viewport guard band lets a native CSS transform handle half-speed scrolling between drawing updates. The shader's scroll origin rebases before coverage runs out; the opening fade compensates for that offset. This is not a freeze-during-scroll or an easing/catch-up handler. Browsers without that capability retain scroll redraws. WebKit documents compositor-thread scroll animations since Safari 26.4: https://webkit.org/blog/17862/webkit-features-for-safari-26-4/.
- Verified: TypeScript/production build and `scripts/light-mask.test.mjs` passed. Browser fixture `scripts/ios-light-check.html` forces the mobile branch: 80px scroll -> -40px CSS translation with unchanged shader scroll; four long-scroll/rebase checkpoints had zero coordinate error; WebGL error 0. `scripts/ios-light-compare.html` visually compared frozen desktop/mobile paths at 390px width, including the 2x output setting. Actual storefront reported desktop mode with no captured console errors. These are local Chromium checks, not physical iPhone FPS/latency measurements; final iPhone confirmation remains required.
- Rebuilt LAN preview at http://192.168.1.114:5176/; dev remains 5175 (session 4113). No publication, production data, or account changes. Pre-change renderer/component/CSS backup: `/private/tmp/truemark-before-ios-fix.YeYlUv/`. Keep existing setup edits intact.

### Mobile logo edge clarity — 16 October 2026

- After confirming restoration of the 9:15 PM version, Mason reported blurry logos on mobile. Reduced only the one-time silhouette-mask blur from 5px to 1px on coarse-pointer devices. Desktop stays at 5px. Render resolution, shared scroll coordinates, timing and effects remain unchanged; no added per-frame workload.
- Build passed; rebuilt LAN preview at http://192.168.1.114:5176/. Physical-phone clarity still needs Mason's confirmation. This addresses intentional edge softness, not a claim that half-resolution rendering is now pixel-sharp. No deployment.

### Reverted phone performance pass — 16 October 2026

- Mason reported the last optimization made the experience worse and explicitly requested reversal. Removed only the coarse-pointer resolution reduction and cached sizing/ResizeObserver changes from that pass. Restored the prior half-resolution rendering and measurement behavior; all logo design and shared-layer synchronization changes remain intact.
- Mobile smoothness remains unresolved. Do not present the preceding pixel-work reduction or desktop narrow-width harness as proof of iOS performance improvement. Future tuning needs physical-device evidence without changing the approved appearance.

### Phone scrolling performance pass — 16 October 2026

- Mason tested the LAN preview on his phone and reported catch-up/jitter. Optimized the shared light renderer: cache canvas measurements until ResizeObserver invalidation rather than read layout each frame; coarse-pointer devices render at one-third CSS resolution instead of one-half (about 56% fewer fragments). Same shader, animation clock and scroll offsets remain; no scroll pause or easing introduced.
- Build and diff checks passed. Desktop narrow-width harness still rendered in all 12 scroll steps (51 draws, no context loss); this does not verify physical iOS smoothness or the coarse-pointer branch. Ask Mason to retest the rebuilt phone preview at http://192.168.1.114:5176/ on the same Wi-Fi. Preview server session 65341 serves updated dist; dev 5175 restarted as session 3968. No hosted deployment.

### Unified logo background — 16 October 2026

- Mason superseded the pinned placement: put the additional logo in the same layer as the others, scrolling and animating in sync. Kept its requested upright orientation.
- Removed the separate SectionLogoLight component and its clipping/fixed styles. Added the upright projection to the existing wall shader with the same wall-space scroll offset, clock, drift, ripple and visibility/motion lifecycle. Its initial position is measured near the paper-trail section and updates on layout resize.
- Build passed; browser confirmed exactly one shared wall canvas, no separate section canvas, and visual movement on scroll. Preview is still on 5175 (session 1704); not deployed. Removed only the superseded component created during this session; its previous implementation remains in chat history.

### Paper-trail logo pinned to viewport — 16 October 2026

- Mason revised the preceding placement: the upright logo must not move when scrolling. Changed its canvas to viewport-fixed, clipped to the paper-trail section; the section now scrolls over it while its inner shimmer continues. Offscreen observation follows the section rather than the fixed canvas.
- Build passed. Browser geometry confirmed canvas top remained 0 while section top moved from 617.25 to 423.25 after scrolling; screenshot confirmed upright light. Preview remains on 5175, session 49516. No hosted deployment.

### Anchored paper-trail logo — 16 October 2026

- Mason circled the lot timeline and requested another logo projection, front-facing and stationary in that section. Interpreted stationary as fixed placement while retaining the requested shimmer inside the silhouette; explained this before implementation.
- Added `SectionLogoLight` only to the timeline section, reusing the shared renderer with an anchored mode: centered, original aspect ratio, no slant, drift, repetition or scroll parallax. Existing page-wide light is unchanged. The decorative canvas sits behind content, ignores pointer input, resizes with its section and pauses when offscreen/hidden or motion is disabled.
- Build passed; desktop browser confirmed upright logo behind the timeline and section-relative position while scrolling. Local preview restarted on 5175 (session 90976). No hosted deployment; physical mobile verification remains outstanding.

### Logo-shaped backdrop light — 16 October 2026

- Mason requested replacing the four-pane projection with his supplied TrueMark symbol, filled with the same animated light, with matching mobile/desktop behavior.
- Copied the supplied original PNG unchanged to `public/images/brand/light-symbol.png`. The shared wall-light renderer now samples a once-prepared soft logo mask instead of rectangular panes. Preserved caustics, color, cloud dimming, projection lean, alternating placement, half-speed scroll movement and reduced-motion behavior. White/open portions remain transparent; the logo is filled, not outlined.
- `npm run build` passed. Desktop browser visually confirmed the logo-shaped projection. The 390px browser check passed all 12 scroll steps (51 draws, no context loss). Physical phone performance remains unverified.
- Fresh local preview is http://127.0.0.1:5175/ (session 70574). Existing 5174 server served cached old code and could not be stopped under current process permissions. Use 5175 for this change. Hosted Studio remains unchanged; no deployment or commit performed.

### Mobile backdrop scroll correction — 16 October 2026

- Mason supplied a recording of the storefront at mobile width and requested a fix for light lag/jumps during scrolling. The relevant source is `src/brand/WallLight.tsx`, not the Studio overview's wrapper.
- Removed the narrow/coarse-pointer scroll handler that stopped rendering until 180 ms after the final scroll event. Scroll now requests the renderer's deduplicated animation frame, including with motion disabled. Visibility changes stop/resume rendering explicitly. The shared fragment shader skips expensive ripple calculations on fully transparent pixels without changing their appearance.
- Verified `npm run build` with Node 22 and the locked dependencies. Browser regression harness `scripts/mobile-light-check.html` at 390px width observed zero draws over 12 continuous scroll steps with the old served code, and 51 draws with updates in all 12 steps after restarting the server with the fix. No context loss observed. Physical iPhone/touch GPU performance remains to be checked.
- Local preview restarted at http://127.0.0.1:5174/. Published Pages/Studio release remains unchanged; no deployment performed. Existing setup/configuration edits preserved.

### Mason local setup — 16 October 2026

- Mason introduced himself as owner and requested local setup and account verification. Handoff and continuation instructions reviewed.
- Reused the public checkout at commit `b77ab5b`; local setup branch is `setup/mason-local`.
- GitHub connector authenticated as `TrueMarkBioLabs`; collaborator permission API confirmed `write` on `Riley-Coyote/truemark`. This does not verify shell push credentials.
- Installed official Node 22.23.3 in the adjacent task work folder, verified its SHA-256 against the official distribution, and installed the repository's exact npm lockfile dependencies. Portable owner validation passed: three builds, four portable test files, seven SQL validators, five function bundles and browser artifact audit.
- Sample storefront opened successfully at http://127.0.0.1:5174/. No production data, migrations, provider configuration, or deployments changed.
- Supabase project remains `gydihnfzmuqmbnykaihg`. Default OAuth scopes were blocked by automatic approval review as too broad for access verification. Project configuration now requests read-only mode; narrower OAuth login initiated with organization/project/database read scopes. User sign-in and actual project/schema access remain pending.
- Repository is not yet registered as a saved Codex project. Native app automation is unavailable for this app; user must select the existing repository folder in the app. Application-owner role remains unverified.
- Supabase follow-up: Mason completed read-only authorization. Initial callback expired; the next attempt could not save its credential lock under the sandbox. After Mason granted settings-directory write permission and repeated authorization, CLI confirmed successful login to `truemark_supabase`. Authenticated browser access to exact project `gydihnfzmuqmbnykaihg` verified: “TrueMark Website” in “TrueMark Biolabs,” status Healthy. MCP tools are not yet exposed in this existing chat; schema access through MCP and the separate application-owner role remain unverified. No production changes made.


For each meaningful update, add a short dated entry with:

- **Decision and source:** what Mason explicitly chose, versus an assumption or engineering recommendation.
- **Result:** relevant files/commit and observable behavior; label local, connected test or deployed state.
- **Verification:** checks and observed outcome, with links to detailed evidence when useful.
- **Next:** one recommended action and the question, if any, it depends on.

Replace stale next-step guidance as work progresses; preserve the dated decision history. Do not record example wording from the collaboration guide as an answer from Mason.
