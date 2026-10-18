# Command Center handoff — inventory, lots, certificates and customer retention

Prepared 18 October 2026 from Mason's instructions in this conversation, the approved inventory brief, the repository's continuation notes and the two implementation commits below. This is the consolidated continuation document for this work. It records decisions and evidence; it is not a claim that the changes are deployed.

## Current position

Two connected workflows are implemented and locally tested: **Products & inventory** and **Customer retention**. The first unifies products, lots, receiving, certificates and fulfillment allocations. The second adds product/customer purchase analysis and a durable foundation for customer activity and manual follow-ups. Email-provider selection and delivery are deferred by Mason.

| Work | Source checkpoint | Status |
| --- | --- | --- |
| Unified product/lot inventory and FIFO fulfillment | `31a8eaf09fceea37d7efe5c0c06babf44b2c93b1` — `Unify product and lot inventory with FIFO fulfillment` | Implemented and tested locally |
| Customer retention history and follow-ups | `7b137fdfe5cce694e264ecfb79debc5c5a5153cb` — `Build customer retention history and follow-ups` | Implemented and tested locally; includes the inventory commit |
| Consolidated handoff and preserved inventory request | Branch `codex/command-center-handoff`, based on `codex/customer-retention` | Documentation only |
| Production migration, website/function deployment and connected acceptance | Existing Supabase project `gydihnfzmuqmbnykaihg` | Not performed in this conversation |
| Real email sending, provider account activation and customer outreach | No provider selected | Deferred; no customer messages sent |

The earlier inventory branch is `codex/unified-lot-inventory`. The two feature commits are already in this checkout's ancestry; do not apply them a second time when continuing from this branch. These feature commits were not pushed, merged or deployed by this conversation. Remote publication or hosted changes by other workspaces have not been established here. On 18 October, the authenticated GitHub coordination search returned no open matching issues; no issue, comment or message was sent.

Read this with [Working with Mason](WORKING_WITH_MASON.md), [continuation notes](SESSION_NOTES.md), [inventory implementation/rollout](../platform/LOT-INVENTORY-WORKFLOW.md) and [retention implementation/rollout](../platform/CUSTOMER-RETENTION.md). The [full approved inventory brief](../platform/LOT-INVENTORY-APPROVED-BRIEF.md) is now preserved in the repository, so the original chat attachment is not needed. Specific settled decisions here supersede earlier discovery questions or manual-release assumptions in the historical implementation plan.

## Decisions already made — do not ask Mason again

| Topic | Settled direction |
| --- | --- |
| Operator experience | Routine receiving and fulfillment must be simple enough for an ordinary authorized employee to perform manually. Keep forms short, actions obvious and related information together. |
| Product and lot relationship | One product may have many lots. Add a new product when needed, or receive another lot against an existing product. Do not create a duplicate product just because its lot changes. |
| Lot sequence | First actually received, first sold, among eligible lots. Certificate upload, release time, record creation and expected arrival do not determine FIFO. |
| Quarantine | Stock has physically arrived and is awaiting testing results. It is on hand but unavailable for sale or allocation. |
| Certificate requirement | Stock stays unavailable until received, passing results are recorded and the matching certificate is uploaded. An unrelated attachment or failed result does not release stock. |
| Automatic release | Saving the matching passing certificate clears testing quarantine automatically; no separate manual release step. Independent holds remain effective. |
| Editing | Product names, strengths/variants, lot numbers, quantities, receipt details, expectations, statuses and certificates must be editable with history. Edits cannot bypass reservations or eligibility rules. |
| Fulfillment | Command Center is the fulfillment interface. Show the actual lots and quantities to pick, including split-lot orders. Customers need the certificate for every lot actually shipped. |
| Retention timing | There is no standard reorder timeframe. Learn from observed purchase gaps and show when evidence is insufficient. |
| Retention history | Keep useful purchase and interaction data from the beginning so six months of customer activity can inform decisions. Six months is a review milestone, not a retention limit or automatic deletion date. |
| Follow-up tools | Customer groups, product drill-down, history, notes, contact/reply logs, reminders, drafts and outcome tracking are approved. |
| Email provider | Mason asked for advice, then deferred that decision and instructed implementation to continue. Do not block the completed manual workflow on choosing a provider. |

Mason owns product and release decisions. Riley is not a required reviewer or intermediary. Use existing authorization for routine work, ask one missing business question at a time, and keep technical investigation with Codex. GitHub/Supabase invitation acceptance was already reported; verify usable access and the separate application-owner role rather than asking for invitations again.

## Products, lots and certificates: the agreed example

The original example is a 30 mg product with 10 units in an older eligible lot and another 100 units arriving under a new lot number. These are acceptance-example quantities, not a declaration of actual production inventory.

| Stage | On hand | Available | Incoming | Unavailable on hand |
| --- | ---: | ---: | ---: | ---: |
| New supply ordered, not received | 10 | 10 | 100 | 0 |
| New supply received, awaiting tests | 110 | 10 | 0 | 100 in quarantine |
| Passing results recorded, certificate still missing | 110 | 10 | 0 | 100 awaiting certificate |
| Matching passing certificate saved; no reservations or independent holds | 110 | 110 | 0 | 0 |

With both lots eligible, an order for 15 units reserves 10 from the older lot and 5 from the next. The commercial order remains one priced product line. Reservations reduce available stock; shipment deducts physical on-hand stock. Another order cannot claim the same reserved units. A certificate uploaded before arrival never makes incoming stock available.

### What was built

- **One workspace:** Products & inventory replaces the disconnected Products/Lots navigation. A product opens its lots, counts, incoming supply, certificate actions and recent history. Existing lot links still resolve. Staff can see which eligible lot sells now, what comes next and why another lot is unavailable.
- **Creation and receiving:** Create a product and continue into receiving, or choose an existing product and existing/new lot. Support expected quantities/dates, partial receipts and outstanding supply. Repeated receipt submissions do not add units twice; duplicate products/lots are rejected with a useful error.
- **Authoritative quantities:** Counts live on lots; product availability is derived. On hand includes reservations. Available means eligible on-hand stock minus reservations. Missing source counts/dates remain unknown rather than guessed.
- **Safe editing and adjustments:** Stable identifiers retain relationships when names or lot labels change. Corrections, damage, samples, other additions/deductions and inspected order returns use recorded adjustments. Conflicting counts/reservations and stale edits are rejected. Archiving preserves history. Audit entries retain before/after values, reason, time and operator; the current inventory view shows the latest 100 entries while older entries remain stored.
- **Testing and certificates:** The upload form records/asks staff to confirm matching identity and passing results. The application does not read or authenticate the PDF automatically. Returning a lot to pending testing detaches its current certificate so a status edit cannot reuse old evidence to bypass testing. Certificate replacement uses versioned files.
- **Allocation and picking:** Checkout reserves eligible lots in actual receipt order. Picking shows every lot/quantity. Explicit substitution verifies eligibility, records a reason and sends a previously packed order back to the packing queue.
- **Shipment and customer evidence:** Shipment deducts stock once and snapshots actual lot labels and certificate versions. Customers can access both certificates when an order spans two lots. Removing/replacing the current certificate does not rewrite completed shipment evidence.
- **Cancellation and returns:** Cancellation releases reservations to their original lots. A refund alone does not restore physical stock. Returns are bounded by the unreturned shipped amount, require resale inspection and still obey availability rules.
- **Certificate loss:** Removing a required certificate makes remaining stock unavailable and blocks affected unshipped allocations for resolution. It does not cancel historical orders or erase completed shipments.

Existing owner/staff inventory permissions remain in effect; customers cannot edit inventory or view internal adjustment history. Fine-grained inventory grant redesign was not added by this work.

### Migration consequences to understand

The inventory migration preserves existing lot keys, introduces stable UUID identity plus editable display numbers, and retains existing product/order relationships. It does not invent passing tests, receipt dates or the split of a product total across lots. Missing evidence may reduce derived availability, even to zero, until staff reconcile it. Affected open orders remain on file and need corrected evidence or explicit substitution.

Legacy fulfilled allocations retain the certificate association available at migration time and are marked legacy. Certificate files overwritten before this work cannot be reconstructed or presented as original shipment evidence. Preserve backups. After new allocations exist, prefer a forward correction or a coordinated database/application restore over reversing schema changes in isolation.

## Customer retention: experience and meaning

Choose a product to see who bought it, how often, when they last bought that product and when they last purchased anything. Open a customer to see product history, complete order history, contact/results, private activity and editable follow-ups. Customer records also link into this workflow through **Activity & follow-ups**.

### Analysis built

- Product, name/organization/email and purchase-date filters; groups for all customers, bought once, repeat buyers, three or more purchases, longer gaps and follow-ups due.
- A date range selects customers who purchased during that period. Repeat status and observed gaps use their full recorded history for the selected product, so a repeat buyer does not become a first-time buyer just because the range is narrow.
- “Longer gap” means the current gap exceeds the customer's previous gaps for that selection, with at least three distinct purchase times. Fewer observations remain “Still learning.” This is a review prompt, not a churn prediction or an estimate of product use.
- Paid purchases with retained collected value count toward patterns. Unpaid, cancelled and fully refunded purchases are excluded from those patterns; the full order history remains visible. Partial refunds do not manufacture returned quantities. Existing purchase/refund calculations are reused.
- Monthly comparisons offer 6, 12 or 24 months after first purchase and retain all recorded first-purchase months. Incomplete months are blank; a zero means a completed month with no purchases. Click counts or percentages to inspect the underlying customers.
- Customer and activity CSV exports support later analysis. Product history displays current eligible availability, respecting inventory quarantine/certificate rules.

### Activity and manual follow-up built

Notes, contact logs, replies, reminders and drafts are editable. Reminders can be completed; records can be cancelled/voided or drafts archived. Saving edits preserves previous versions, rejects stale updates and handles an identical retried create without duplicating the record. Saving a draft or reminder never sends or schedules a message.

The shared-data migration captures changes to orders, product lines, refunds, consent, matched contact forms, recorded delivery outcomes and authenticated customer chat. Existing known history is imported; snapshots with unknown original change dates are explicitly undated. Customer contact forms use a unique email match and are labeled unverified. Ambiguous matches are not assigned.

Only live visitor/customer chat tied to an authenticated buyer is copied into customer history. Anonymous chat, preview conversations, internal owner/partner chat and tool payloads are excluded. Contact forms received before a buyer exists remain in the source inbox; automatic retrospective identity reconciliation is not included.

Private activity defaults to owner access, with owner-configured staff grants enforced by the database. Revoked or demoted staff cannot save changes. Existing purchase analytics retain their existing team access. Permission to view retention history does not establish permission to send email.

Actual recorded contacts/replies and customer messages are distinguished from drafts and simulated delivery. Purchases after the latest contact are shown as sequence, with product scope where recorded; they do not prove that outreach caused a purchase. Opens, clicks, automatic mailbox reply sync and provider delivery receipts need future integration. Consent is displayed and must be checked again before any future sending.

The previous universal inactivity threshold was removed from this retention screen. Existing separate marketing flows were not activated or redesigned. There is no automatic outreach triggered by opening this page.

## Email-provider discussion — deferred, not a selection

The recorded 17 October research recommended evaluating Amazon SES as a delivery service while TrueMark keeps its own customer history and controls. Mason did not select SES. Account readiness, production approval, catalog eligibility and sending identities remain unverified.

The same research recorded a research-use-only product restriction in Resend's acceptable-use policy and relevant pharmaceutical restrictions in Klaviyo's policy. Omnisend appeared in earlier account notes, but actual usage and suitability were unconfirmed. These are dated research findings, not permanent eligibility determinations. [The original research checkpoint and source links](SESSION_NOTES.md#retention-direction-and-email-provider-evaluation--17-october-2026) are retained; recheck current policies and intended transactional/marketing use when Mason resumes this decision. An existing adapter is not permission or evidence of provider activation.

No provider was contacted, enrolled, activated or paid for. No real customer messages were sent. Choosing a provider is not a prerequisite to reviewing or deploying the provider-independent history/manual follow-up foundation.

## Verification already completed

These results are from the implementation sessions on 17 October. The handoff preparation on 18 October checks documentation and source references; it does not claim a new hosted acceptance test or a repeat of the entire application suite.

| Area | Recorded local evidence |
| --- | --- |
| Inventory/database behavior | Local SQL tests cover incoming/partial receiving, duplicate retries, missing/failed/prearrival certificates, independent holds, FIFO 10 + 5, reservations, conflicts, substitution, cancellation, inspected returns, access denial, preserved shipment evidence and populated legacy upgrades. |
| Inventory regressions | Four inventory/customer tests and 59 existing adapter/shipping/message regressions passed. |
| Inventory browser | Desktop and 390 px viewport; 10 available + 100 incoming; 60 quarantined + 40 outstanding after partial receipt; then 110 available after completion and passing certificate. Duplicate entry retains the form and gives an actionable error. |
| Retention model/adapter | Seven new tests cover product/date filters, observed gaps, refunds, incomplete months, outcomes, voided contacts, preview persistence/isolation, stale changes and denied reads. Existing 23 business-intelligence tests passed. |
| Retention database | Owner-default access, grants/revocation/demotion, direct-write denial, duplicate/stale saves, immutable history, reminder completion, draft non-delivery, order/refund/consent/contact events, simulator exclusion, customer-only chat and populated reruns passed. |
| Retention browser | Product-specific versus latest-anything dates, seven-customer monthly drill-down, empty search, reminder save/completion, draft persistence, logged phone contact, edit history, 390 px layout, Escape closing and focus return. |
| Portable checks | Preview/live/launch builds, TypeScript, 29 release/security/routing boundary tests, all local SQL validators (eight at inventory completion; nine after retention), five function bundles and public browser-artifact scan passed. The final retention preview build and targeted tests passed after follow-up refinements. |

PGlite runs the migration SQL against local auth/storage stubs. Its single database connection does not prove native PostgreSQL simultaneous-transaction behavior or hosted Realtime. Production-volume performance and multi-session refresh/revocation behavior still need connected verification. Historical tests that depend on unavailable private assets/refs were not represented as passing by the portable subset. Local implementation used available Node 24; the documented deployment runtime remains Node 22.

All sample quantities, customers, contacts, reminders and drafts created during verification are fictional/local. No production inventory or customer records were seeded.

## Source map for the next implementer

| Responsibility | Files |
| --- | --- |
| Inventory screen and forms | [InventoryWorkspace.tsx](../../src/admin/InventoryWorkspace.tsx), [InventoryForms.tsx](../../src/admin/InventoryForms.tsx), [LotCertificateDrawer.tsx](../../src/admin/LotCertificateDrawer.tsx), [OrderInventory.tsx](../../src/admin/OrderInventory.tsx) |
| Inventory rules and persistence | [inventory.ts](../../src/platform/inventory.ts), [live adapter](../../src/platform/live/inventory.ts), [preview adapter](../../src/platform/preview/inventory.ts), [inventory migration](../../supabase/migrations/20261017000000_lot_inventory.sql) |
| Shipment/customer certificates | [shipping function](../../supabase/functions/shipping/server.ts), [message templates](../../supabase/functions/messages/templates.ts), [customer orders](../../src/shop/pages/account/Orders.tsx), [customer certificates](../../src/shop/pages/account/Certificates.tsx) |
| Retention screen and analysis | [Retention.tsx](../../src/admin/intelligence/Retention.tsx), [retention-model.ts](../../src/admin/intelligence/retention-model.ts), [customer entry point](../../src/admin/Customers.tsx) |
| Retention records and access | [record types/validation](../../src/platform/retention.ts), [live adapter](../../src/platform/live/retention.ts), [preview adapter](../../src/platform/preview/retention.ts), [retention migration](../../supabase/migrations/20261017000100_retention.sql) |
| Focused checks | [inventory tests](../../scripts/inventory.test.mjs), [inventory SQL](../../scripts/validate-inventory-sql.mjs), [retention tests](../../scripts/retention.test.mjs), [retention SQL](../../scripts/validate-retention-sql.mjs), [business intelligence tests](../../scripts/business-intelligence.test.ts) |
| Portable build/security verification | [check-owner-handoff.mjs](../../scripts/check-owner-handoff.mjs), [operating instructions](OPERATIONS.md) |

Both features have preview and live adapters. Preview persistence is browser-local; retention's design-lab storage is separately scoped. The live frontend expects the matching migrations. Source existence is not proof that production has those migrations.

## Reopen and review without changing production

The latest verified app preview in this conversation used port **5175**; the earlier port 5184 server had stopped. Studio uses a separate local surface, seen at port **5290**, and can display historical snapshots. Seeing Studio does not establish that the new operational app or its live database is open.

Use an existing suitable preview server if it is running. Otherwise, with the project's dependencies and Node runtime available, start an explicit sample preview from the repository root:

```sh
VITE_PLATFORM=preview VITE_LAUNCH=0 VITE_ROUTER=path npm run dev -- --port 5175 --strictPort
```

Open `/admin/products` and `/admin/retention` on the chosen local port. The isolated Command Center lab is `/design-lab/command/index.html`. Check that the UI says sample data before trying synthetic receipts or customer activity. A stopped server changes no saved source; restart it rather than rebuilding the feature. Do not treat a localhost link as a remotely shareable site or proof of production state.

Suggested review: receive part of the new example lot; confirm it is quarantined; finish receiving and save the matching passing certificate; inspect first-lot-first picking; then filter retention by that product, open a customer, save a reminder and prepare an unsent draft. Keep these exercises in the sample/test environment.

## Deployment and connected acceptance still required

1. Inspect the current branch/working tree and current remote/deployed state. Check [BOARD.md](../../BOARD.md) for relevant coordination without assuming another workspace has deployed these commits. Preserve unrelated changes.
2. Verify authenticated access to existing Supabase project `gydihnfzmuqmbnykaihg` and a TrueMark application owner login. An organization Owner role is separate from the app's owner role. No usable authenticated Supabase tool was available during the feature implementation; hosted state was not revalidated during this documentation pass.
3. Inspect actual migration history, data and recoverable backups. Export/reconcile real product/lot quantities, actual receipt dates, certificate/testing evidence and affected open orders with staff. Do not invent quantities from aggregate product stock, reset hosted data or seed fixtures.
4. Apply outstanding prerequisites in order, including [shipping labels](../../supabase/migrations/20261016000200_shipping_labels.sql) where pending, then inventory `20261017000000` and retention `20261017000100`. Do not assume the local migration list is the remote history. Assess any missing prerequisites before applying just these files.
5. Deploy the matching frontend and inventory-affected shipping/messages functions as a coordinated release. Keep real provider activation separate. Record migration IDs, commit, function versions, URLs and recovery plan in the continuation notes.
6. Verify actual owner, granted/ungranted staff and customer sessions. Exercise simultaneous allocation attempts, two staff sessions, partial receipt, upload failure/retry, certificate removal, split-lot shipment/return and customer certificate access in an appropriate connected test environment. Verify retention writes, stale edits, grants/revocation, known-history imports and cross-session updates.
7. Only after the retention migration is active can this new feature start collecting shared live interaction history. Confirm actual associations and data freshness; do not claim six months of data exists because the chart can show 24 columns. Continue preserving source events over time.

The client's authorization governs release. This handoff is not standing authorization to publish, send messages, spend money or alter production records. Preparing and reviewing local work can continue independently.

## Related outline that remains separate work

These items were inherited from the broader [Command Center implementation plan](../platform/COMMAND-CENTER-IMPLEMENTATION-PLAN.md). They are included for continuity, not claimed as new implementations in this conversation.

| Area | Remaining direction or missing fact |
| --- | --- |
| Real shipping | Label creation is not shipment. Verify the actual ShipStation/carrier evidence, printer workflow and physical pickup/drop-off process. Earlier local shipping corrections are documented in [the shipping update](../platform/SHIPPING-WORKFLOW-UPDATE.md). |
| Unified inbox | Consolidate contact messages and chat logs with in-app replies and owner-default grants. Confirm sending addresses, mailbox/forwarding arrangement and whether replies sent directly in Gmail must sync. Retention history does not complete the whole inbox or mailbox integration. |
| Financials | Distinguish actual sales/profit from potential profit in sellable inventory. Confirm costs, fees, testing, overhead and shared/personal assumptions with concrete examples. An inventory sell-through scenario does not forecast timing. This thread preserved financial calculations rather than rebuilding them. |
| Risk and forecasts | Exact replacement rules and terminology remain unsettled. Do not turn a proposed high-frequency risk change into automatic blocking or silently redesign forecasts. |
| Provider outreach | Resume provider selection and eligibility/sending-domain/event integration when Mason chooses. No automated winback/reorder policy was approved by the absence of a standard interval. |
| Broader ownership/release setup | Verify client-controlled hosting, domain, payment/provider accounts, production deployment and rollback. Accepted invitations alone do not prove operational independence. See [ACCESS.md](ACCESS.md). |
| Deferred scope | Barcode scanning, a full accounting replacement and optional native Ghost work are not dependencies for these manual workflows. Preserve approved brand/artwork and the delivered Studio collection. |

## Start the next session here

Read this document and the latest continuation notes, verify which checkout and preview are active, and follow Mason's current request. If no new priority is given, review the implemented inventory and retention examples with him, then prepare the shared-data rollout after checking real migration history/backups. Do not repeat settled FIFO, automatic certificate release, editability or fixed-reorder-window questions. Keep the provider decision deferred until he returns to it.
