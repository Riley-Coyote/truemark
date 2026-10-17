# Command Center implementation plan

> 17 October update: Mason's brief settles FIFO by actual receipt, automatic testing release on saving a matching passing certificate, and editable lot quantities with history. The inventory implementation is now locally verified; [workflow and production rollout](LOT-INVENTORY-WORKFLOW.md) supersede the inventory discovery questions and proposed manual approval distinctions below. Hosted migration/acceptance remains outstanding.


Working plan · 16 October 2026 · Based on the client call, Riley’s subsequent clarifications, and inspection of the current local source.

This document plans implementation; it does not record implementation approval, completed changes, or verified production operation. Existing capabilities below were checked in source and migrations. Hosted configuration, deployed migration versions, carrier credentials, printer behavior, and real delivery were not tested for this plan. The public Studio remains a sample-data demonstration; the authenticated connected workspace is a separate surface.

**Local implementation update:** The first shipping corrections and removal of Review Moderation are now implemented locally. See [completed behavior, verification and remaining integration work](SHIPPING-WORKFLOW-UPDATE.md). The inventory, unified communications and finance work below remains planned.

**1. Intended outcome and settled direction**

The Command Center should let ordinary authorized staff run routine operations without repository access or an AI assistant. Staff enter information once; the platform maintains the related inventory, order, certificate, and customer-facing records.

The highest-priority workflows are fulfilling orders and receiving/releasing inventory. The client accepts more complexity in analytical screens while daily operations become easier to learn.

| Requirement | Current interpretation | Confidence |
| --- | --- | --- |
| Shipping workspace | Keep the operator in Shipping Desk when opening and completing an order. Print label before confirming packing. Keep a packing confirmation; remove its cold-shipping requirement. | Explicit in call |
| Shipping automation | Print through ShipStation. Bring label/tracking data back into shared records. Customers see shipped only after actual shipment, not label creation. | Clarified by Riley; authoritative shipment-event source must be verified |
| Barcode scanning | Exclude scanning from the current delivery dependency. Preserve room to add it as a separate job. | Riley recalls it as future work; not a firm contractual exclusion yet |
| Lot sequence | Exhaust one available released lot before using the next. An order may use quantities from multiple lots. | Clarified by Riley |
| Product and content administration | Staff can create/edit products, assign categories, receive new lots, upload certificates, and publish appropriate information to the website. Journal remains editable. | Explicit in call |
| Release authority | Authorized staff can release batches; certificate upload alone does not bypass quarantine. | Working assumption accepted by Riley |
| Communications | One interface for contact-page messages and chatbot logs, with replies sent inside it using the appropriate business email identity. Remove review moderation and public review submission. Owner-only by default with configurable staff grants. | Clarified by Riley; Gmail routing is tentative |
| Profit | Show current revenue/profit performance and projections informed by inventory and orders. | Core direction explicit; interpreting Riley’s “live review” as live revenue/performance, with exact projection questions still open |
| Retention | Make individual customers and product purchasing patterns actionable. Exact reorder and outreach rules are open. | Direction explicit; details unsettled |

**2. What already exists and what remains**

“Exists” means an implementation foundation is present, not that the production workflow has been signed off.

| Area | Existing foundation | Connection or extension needed | New work |
| --- | --- | --- | --- |
| Orders / Shipping Desk | Order lists and drawers; ready/shipped/held queues; manifests; packing confirmation; shipment retry controls. | Reuse the order drawer without navigating out of Shipping Desk; reconcile queue and action states with label-before-pack. | Focused operator flow, clear lot picking instructions, useful exception states. |
| ShipStation | Provider adapter exports orders; shipment webhook retrieves tracking; event deduplication, retry logic, cancellation handling, and simulator exist. | Verify client account configuration and supported label/tracking paths. Connect returned shipment data to the full workflow. | ShipStation handoff and label/tracking synchronization; retained provider references; tracking updates beyond current label handling where unsupported. Printing stays in ShipStation. |
| Products / categories | Existing-product editor, photo upload, category controls, price/availability edits, and a backend product upsert. | Reuse validation, uploads, and shared catalog reads. Ensure newly created products appear throughout catalog/category/product pages. | Complete new-product entry flow and integration with first-lot receiving. |
| Lots / certificates | Lot records and states; PDF upload; release validation; rejection; certificate replacement; public verification and library reads. | Connect release and lot quantities to sellable stock and checkout eligibility. | Staff receiving/new-lot flow; authoritative lot stock accounting; sequential allocation and split-lot fulfillment. |
| Journal | Article creation/editing, covers, drafts, publication, and live content adapter. | Verify publication in a separate customer session and refresh behavior. | Only usability gaps found during that verification; no basis for rebuilding the editor. |
| Communications | Contact inbox; handled/new status; email/SMS delivery log; stored assistant threads/messages; owner/staff team accounts. | Assemble these sources in one workspace and consistently enforce permissions. | Unified search/detail UI, in-app replies from authorized business identities, configurable staff access, and synchronized reply history. Confirm Gmail mailbox/alias/routing details. |
| Profit | Recorded-sales model with SKU costs or margin assumptions, shipping, fees, commissions, ad spend, overhead, and CSV. | Make cost assumptions clear and reusable; decide whether to persist them centrally. | Inventory sell-through profit scenario and any missing packaging/discount assumptions. |
| Retention | Customer identities and order links, repeat rate, recorded LTV, cohorts, observed reorder gaps, inactivity threshold, export. | Improve drill-down and connect selected audiences to existing marketing tools if approved. | Product-specific reorder views and selectable cohort history; exact rules require definition. |
| Marketing | Shared consent, campaigns, schedules, event flows including winback, and a simulated delivery outbox are documented and implemented. | Reuse these for retention follow-up; real delivery requires its own provider connection and verification. | No separate campaign engine is needed for this plan. |
| Risk / forecasts / reports | Risk signals and local review notes; forecasts and goals; reports, CSV, and local saved definitions. | Clarify terminology and agreed rules. | Only the changes the client specifies; no detailed redesign request was settled. |

**3. Inventory, lots, and certificates — operational foundation**

User outcome: an authorized employee can receive a new batch, keep it pending, release it with its certificate, and have the correct stock become available without editing the website separately.

Current technical gap: checkout decrements `products.stock` and assigns `products.lot`. The schema permits one order line per product, with one lot on that line. It does not currently allocate a product quantity across multiple lots. Lot release updates the certificate/release record but does not implement the requested stock rollover. Existing checkout validates the lot relationship, but the inspected placement path does not enforce released-lot allocation.

Implementation steps:

1. Establish one authoritative quantity model per lot: received, reserved, fulfilled, adjusted, and currently available. Retain product totals only as derived or transactionally maintained summaries; eliminate contradictory independent stock edits.
2. Add a receiving workflow: choose an existing product or create one, enter lot number and quantity, record receipt, and attach certificate information. Prevent duplicate receipt submission from increasing stock twice. Keep incomplete batches in quarantine/testing.
3. Extend the existing certificate-release workflow. Releasing a valid batch makes its available units sellable and its approved evidence visible in the relevant public surfaces. Upload, approval, product visibility, and purchasability remain distinct states.
4. Implement deterministic sequential allocation over eligible released lots. Preserve the client’s “finish one, then the next” behavior. Confirm whether the ordering field is receipt date, release date, or an explicit sequence.
5. Recommended data design: keep the commercial order line and add child lot allocations with lot, quantity, and reservation/fulfillment information. This preserves one priced product line while supporting multiple physical lots. Finalize this choice after checking all payment, refund, reporting, and shipping consumers.
6. Reserve quantities atomically so concurrent buyers cannot take the same final units. On cancellation or unpaid expiry, restore the original allocations exactly once. A financial refund alone should not assume stock physically returned; preserve and explicitly review current refund/stock behavior.
7. Show lot quantities in packing instructions, order detail, customer history, certificate links, and exports. Carry adequate lot information into shipping records without duplicating charged quantities or merchandise totals.
8. Ensure current stock/certificate changes reach already-open customer sessions. Inspect the bootstrap catalog snapshot and existing refresh/subscription paths; test propagation rather than assuming one database write refreshes every page.
9. Reconcile starting inventory before enabling allocation. Do not invent lot counts from a product total or silently rewrite historical orders. Backfill historical allocations only from supported recorded information. Preserve existing lot identifiers and certificate associations.

Acceptance checks:

- Lot A has 2 available units and lot B has 10; an order for 5 receives 2 from A and 3 from B. A reaches zero, B has 7 available, and both certificates are accessible from the order.
- Two simultaneous purchases cannot over-allocate A or B. A failed transaction leaves no partial reservation.
- Quarantined/rejected stock never fulfills an order or makes a sold-out product purchasable.
- Releasing a stocked batch restores availability in a separate customer session. If older stock remains, it is still allocated first.
- Cancellation restores the exact reserved lots once, including after repeated events. Rewards, discounts, taxes, commissions, and refunds retain correct totals.
- A new lot does not replace the certificate associated with a historical lot. Depleted lots remain accessible to prior buyers; certificate correction history needs a defined policy.

**4. Shipping Desk and Orders — simple daily workflow**

User outcome: a new operator can open an eligible order, obtain its label, pack the specified quantities/lots, confirm packing, and move to the next order without leaving Shipping Desk.

Current technical gap: the provider adapter creates ShipStation orders and fetches shipment information; the visible print-label action is a simulator action. The inspected shipment model has tracking fields but no retained label file/reference. The shipment event handler currently changes a paid or packed order to shipped when a label-related shipment event arrives. That can skip packing in the client’s requested sequence.

Implementation steps:

1. Separate packing progress from label/shipment progress. Store label readiness independently, so printing first does not remove the later packing action. Customer-facing shipped status and its notification require evidence of actual shipment. Verify the available ShipStation/carrier event that supplies that evidence; label creation alone is insufficient.
2. Keep the order drawer inside Shipping Desk, preserving queue filter, scroll position, and selection. Provide a clear completion state and next-order action.
3. Present an honestly labeled Print in ShipStation / Open in ShipStation action for an eligible paid order. Printing and reprinting happen in ShipStation. Link to the corresponding order when the supported provider workflow allows it; synchronize the resulting label/shipment information back into TrueMark.
4. Save provider shipment identifiers, carrier/service, tracking, and supported label references. Reuse ShipStation for purchase/print/reprint; do not build a second label-purchasing flow. Synchronization retries must not duplicate shipment records. Handle replacement/void information where available.
5. Show a packing checklist with products, quantities, and lot allocations. Keep Confirm packed with operator/time recorded. Remove cold-pack confirmation and the shipping adapter’s automatic “Cold chain” note; check adjacent generated messages for the same assumption. Broader shipping product/rate changes require separate confirmation.
6. Reuse the existing event processing and notifications for updates. Verify which real provider events are available for transit and delivery; the existing delivered function/simulator does not prove a live delivery-event source is wired.
7. Add clear states for label failure, printer/reprint needs, address problems, canceled orders, and delayed synchronization. Keep manual shipment overrides, if retained, outside the routine employee path and permission-controlled.

Acceptance checks:

- Open and complete an order without losing Shipping Desk context.
- A label can exist while packing remains incomplete; packing confirmation remains available afterward.
- Printing/reprinting is performed through ShipStation; synchronization retries produce no duplicate shipment. A canceled order cannot silently continue normal fulfillment.
- Packing displays the 2-from-A / 3-from-B example correctly.
- Duplicate or out-of-order provider events do not regress status or send duplicate customer notifications.
- Tracking shown to the owner, customer account, and transactional email comes from the same order/shipment record.
- No barcode scanner is required for this delivery. A physical printer and one controlled real-provider shipment are verified before calling printing production-ready.

**5. Unified communications and permissions**

User outcome: the owner can inspect customer inquiries and chatbot conversations in one place, and explicitly grant selected staff access.

Reuse contact messages, transactional outbox records, and the existing stored visitor-assistant threads. The current contact inbox’s reply action is a `mailto:` link; it does not provide a synchronized two-way email conversation inside TrueMark. Review moderation currently stores local planning records and does not publish production reviews.

Implementation steps:

1. Create a Communications navigation entry and workspace with source filters for Customer messages, Chat conversations, and Email/SMS history. Provide search, chronological detail, source/status labels, and customer/order links where identity is verified. Keep anonymous visitors anonymous unless there is supported identity linkage.
2. Build the transcript reader over existing backend threads/messages. Customer conversations are the default scope; private owner/partner assistant sessions and tool internals should not be indiscriminately mixed into customer support logs. Sample/offline conversations are not evidence of hosted logs.
3. Add owner-managed staff grants, with separate read and reply/manage capabilities. Revocation must stop subsequent authorized reads/writes and clear loaded data in the UI.
4. Enforce grants in database policies and server actions, not just navigation. Existing contact/outbox policies and visitor-thread policies allow owner and staff access; replace broad staff access for these customer-communications sources. Preserve a customer’s access to their own history where applicable. Audit adjacent subscriptions, exports, and assistant tools for alternate access paths.
5. Map old inbox/message links to the new location. Remove Review moderation from navigation and the presented product scope. The client does not want public review submission. Preserve existing local planning records during cleanup rather than deleting unrelated data.
6. Build replies inside Communications, with an explicit authorized business sending identity for each thread (for example the support address the customer contacted, never impersonating the customer). Add inbound reply synchronization, thread association, delivery/error state, and permission checks. Riley believes messages should also route to the owner’s Gmail; confirm the actual Gmail/Workspace account, addresses/aliases, and whether Gmail is the shared mailbox or a forwarded copy. Verify supported send-as identities before selecting the provider implementation. Prevent forwarding loops and duplicate replies, and decide whether replies sent directly in Gmail must appear in TrueMark.

Acceptance checks:

- Owner sees real persisted inquiries and customer chat transcripts; ordinary staff are denied by default, including direct data requests.
- Owner grants one staff account access, that account can use the allowed actions, and revoking the grant removes access.
- Search and filters distinguish customer inquiries, chatbot logs, and sent-message records. An authorized operator replies inside TrueMark; the customer receives the message from the agreed business address, subsequent replies join the correct thread, and the agreed Gmail routing is verified.
- New customer chat messages remain available after reload in the authenticated workspace; public Studio samples stay clearly separate.

**6. Profit and retention**

Profit should have two understandable views: **Profit from sales** and **Potential profit in stock**.

Reuse the existing recorded-sales model. Expose the costs included and whether each is actual or assumed. Add explicit packaging costs if not represented, and avoid subtracting discounts or commissions twice. Keep tax and refunded amounts consistent with existing financial definitions. Missing unit costs should produce an incomplete estimate rather than free inventory.

Build the inventory view on reconciled sellable stock. Estimate merchandise revenue under a selected price/discount scenario, subtract unit costs and expected fulfillment/processing/affiliate expenses, and expose per-order assumptions such as average units per package. Display quarantined/incoming stock separately. Label the result as potential sell-through profit; it does not predict when inventory will sell. Decide whether fixed overhead, ad spend, testing, and lot-specific acquisition costs belong in this view before promising “all expenses.”

Proposed acceptance: a small inventory fixture can be calculated by hand and matches the view; changing price, discount, packaging, or fees updates the estimate; missing costs and held stock are handled explicitly; recorded-sales totals remain unchanged.

Retention already identifies individual customers. Its current cohort display uses months 0–5, and its inactivity threshold applies across customer purchases. Improve visibility and drill-down before rebuilding the analysis.

Proposed extension: filter by product, inspect the people behind each cohort, choose the history window, show last purchase and repeat purchases, and optionally set a business-defined expected reorder interval per product. Treat intervals as business assumptions or observed purchasing behavior, not medical-use instructions. Do not infer a reason for non-return from a missing order.

If follow-up is approved, connect selected customers to the existing consent-aware marketing system. Product-specific retention automation is not established merely because a generic winback flow exists. Marketing’s current shared transport is simulated; real sending requires its own verified connection.

Proposed acceptance: an owner can choose a product, identify customers who have/have not reordered, open their records, and prepare an eligible audience. Suppressed/nonconsenting recipients remain excluded. The system does not send an automatic campaign merely because the new view was opened.

**7. Smaller sections and deferred work**

- Risk review: high order frequency is currently an explicit signal. The client questioned it and has not supplied replacement criteria. Propose configurable, explainable rules with frequency disabled by default pending agreement; do not turn that proposal into an approved rule or automatic blocking.
- Sales analytics: retain the current sales/revenue foundation. Clarify labels if needed; no specific calculation replacement was requested.
- Forecasts & goals: preserve current implementation while the client identifies unclear concepts and desired outputs. Inventory profit is its own scenario, not a replacement for demand forecasting.
- Report builder: retain current scope. Saved report definitions and delivery plans do not establish a working report scheduler; no scheduler expansion was requested in this call.
- Barcode scanning: future work based on Riley’s recollection. No current scanner purchase, integration, or mandatory verification step.
- Full accounting platform: explicitly excluded by the client’s correction. No QuickBooks replacement, bookkeeping ledger, or tax-accounting expansion is implied.

**8. Implementation order and dependencies**

These are dependency phases, not calendar or launch promises.

| Phase | Work | Exit condition |
| --- | --- | --- |
| 1. Confirm contract and source state | Verify deployed schema/provider modes; settle lot ordering, the actual-shipment event source, ShipStation handoff, and Gmail/sending identities. Reconcile inventory source data and choose allocation representation. | Business rules and migration path documented; live versus simulated behavior identified. |
| 2. Preview daily workflows | Reuse the existing Command Center design lab for focused receiving, split-lot packing, and communications scenes. Keep current TrueMark identity. Add failure states and permission examples. | The client selects the operator flow before experimental UI is integrated, following the project’s lab workflow. |
| 3. Shared data and access foundations | Add lot receiving/allocation/reservation rules, reconcile stock, preserve order financial behavior, and introduce communications permissions before exposing consolidated logs. | Database and access checks pass; historical records remain valid. |
| 4. Connect operations | Integrate product/lot/certificate publishing; shipping label and packing states; customer tracking; unified communications readers and approved reply scope. | Complete owner/staff/customer scenarios work against the connected test environment. |
| 5. Financial and retention refinements | Add inventory-profit scenarios and clearer retention drill-down using the finished shared data. Implement only agreed risk/forecast changes. | Results reconcile against controlled fixtures; client can perform the intended decisions. |
| 6. Production verification and handoff | Verify real provider configuration, printer behavior, customer notifications, multi-device refresh, permissions, rollback/migration evidence, and short staff instructions. | Client can receive/release stock and fulfill a split-lot order without developer or AI assistance. |

Inventory and communications can be developed as separate workstreams after their rules are defined. Final shipping acceptance depends on correct lot allocation. Inventory-profit accuracy depends on reconciled stock and cost inputs. Real retention delivery depends on provider configuration and agreed outreach rules.

**9. Decisions still needed**

| Decision | Who resolves it | When it matters | Proposed working position |
| --- | --- | --- | --- |
| Which field orders lots? | Client + Codex | Before allocation migration | Sequential released lots; confirm receipt date versus release date versus explicit order. |
| Which provider event proves actual shipment? | Engineering, with client confirmation of physical process | Before final shipping states/messages | Business meaning is settled: shipped only after actual shipment. Verify ShipStation/carrier evidence; do not use label creation. |
| How does TrueMark open the corresponding ShipStation order and receive updates? | Engineering | Before shipping handoff | Printing through ShipStation is settled; verify the supported navigation and synchronization path. |
| Which starting quantities belong to which lots? | Client supplies; engineering validates | Before enabling lot allocation | Reconcile actual quantities; no inferred breakdown of product-level totals. |
| Who may release a lot? | Owner | Before staff rollout | Authorized staff may release; exact permission assignment remains configurable. |
| Which business sending addresses and Gmail routing should be used? | Client supplies account/address facts; engineering selects integration | Before communication provider integration | In-app replies are required and review moderation is removed. Confirm mailbox versus forwarding, authorized aliases, and synchronization of replies sent directly in Gmail. |
| Chat log retention, deletion, exports, and anonymous identity handling | Owner + Codex | Before production log exposure | Restrict access by default; define retention and export policy without inventing identity links. |
| How are corrected certificates retained? | Owner + engineering | Before replacing evidence associated with orders | Preserve original lot associations; agree replacement/version history behavior. |
| Which current-performance and projection questions must the financial view answer? | Client directly, with Codex translating into requirements | Before final profit acceptance | Demonstrate actual sales/profit, potential profit in current stock, and time-based sales scenarios separately. Clarify costs and assumptions using concrete examples rather than asking Riley to specify financial models. |
| Shared or personal planning assumptions? | Owner + Codex | Before persisting profit settings | Shared owner-controlled costs are a proposed improvement; current planning assumptions are device-local. |
| Product reorder windows, history range, and manual versus automatic outreach? | Client | Before retention automation | Customer/product drill-down first; campaign rules remain open. |
| Risk rules and forecast terminology? | Client | Before those refinements | Preserve existing foundation; no speculative blocking or forecasting redesign. |
| Barcode project timing and scope? | Client + Codex | Later | Future job; not required for current manual workflows. |

These open items do not prevent building a concrete lab or preparing schema changes, but the dependent operational behavior should not be finalized silently.

**10. Verification and source map**

For implementation, extend the relevant existing SQL and integration tests rather than relying only on mocked UI clicks. Use the shipping, payments, certificates, and programs SQL validators for the affected transaction paths; extend business-intelligence tests for financial/retention work and assistant/message/team checks for access changes. Run the app build and relevant release checks after code changes.

Browser verification must cover owner, ungranted staff, granted staff, and customer sessions; desktop and narrow layouts; keyboard/focus behavior; empty/error states; and cross-session propagation. Real-provider verification is a separate evidence step from simulator success. Record the result of each operational acceptance scenario, including the split-lot order and repeated-event cases. This planning-only change does not require running the application test suite.

Core source references:

- [Current decisions](../handoff/DECISIONS.md), [coverage and financial definitions](COMMAND-CENTER-COVERAGE.md), and [connected marketing/program boundaries](CONNECTED-PROGRAMS.md).
- [Shipping Desk and risk screens](../../src/admin/intelligence/Operations.tsx), [fulfillment actions](../../src/admin/fulfilment.tsx), [shipment UI](../../src/admin/ShipmentSection.tsx), [shipping provider](../../supabase/functions/shipping/provider.ts), [shipping server](../../supabase/functions/shipping/server.ts), and [shipping database functions](../../supabase/migrations/20261005000300_shipping.sql).
- [Products](../../src/admin/Products.tsx), [product editor](../../src/admin/Commerce.tsx), [lots](../../src/admin/Lots.tsx), [certificate editor](../../src/admin/LotCertificateDrawer.tsx), [content adapter](../../src/platform/live/content.ts), and [journal](../../src/admin/Journal.tsx).
- [Order-line schema](../../supabase/migrations/20261001000000_platform.sql), [product/stock mutation foundation](../../supabase/migrations/20261001000500_commerce.sql), [current order placement replacement](../../supabase/migrations/20261016000000_customer_programs.sql), [payment/stock restoration](../../supabase/migrations/20261005000200_payments.sql), and [certificate release validation](../../supabase/migrations/20261006000000_certificates.sql).
- [Contact inbox](../../src/admin/Inbox.tsx), [sent messages](../../src/admin/SentMessages.tsx), [message access policies](../../supabase/migrations/20261005000100_messages.sql), [assistant storage/access policies](../../supabase/migrations/20261001000600_assistant.sql), [team settings](../../src/platform/live/TeamSettings.tsx), and [review planning](../../src/admin/intelligence/Content.tsx).
- [Financial/retention screens](../../src/admin/intelligence/Financials.tsx), [calculations](../../src/admin/intelligence/model.ts), [catalog bootstrap](../../src/platform/live/bootstrap.ts), and [existing Command Center design lab](../../design-lab/command/README.md).


**11. Direct client working sessions — recommended setup**

Use the native desktop Codex workflow on the client’s own account and Mac, with a prepared TrueMark working copy and a running preview. Supply this plan, the clarified business decisions, and project instructions. Verify voice availability in that account and test a small visual change first. The client can describe the business task in ordinary language, answer direct questions, and review changes in the built-in browser while work proceeds. Screen context is captured when requested/supported, not assumed to be a continuous video feed.

This would be a client Codex session with an explicit handoff, not automatic access to Riley’s private conversation or a live multi-user invitation into this chat. Prepare the correct source version; do not assume the public Studio or public repository contains all current local work. Keep work in a preview branch/environment, with the client authorizing releases. Riley has explicitly requested a fully independent owner handoff and is not a required reviewer. Small UI edits can be reviewed during the conversation; integrations and transactional changes need their normal implementation and verification time.

The client can work directly with Codex on their own machine and accounts. Codex asks the business questions, verifies implementation and records decisions. Riley may assist with initial account transfer but is not an ongoing scope, release or technical dependency. No meeting-audio bridge into Riley’s Codex is assumed. See [the owner handoff](../owner-handoff/START_HERE.md) for setup and transfer steps.

The existing TrueMark Ghost app is an alternate route to revisit: its local documentation describes screen assistance and a Codex Cloud build handoff, but the release notes record that a real cloud submission was not yet verified. That route requires account/environment setup and an end-to-end build/preview test before promising the same live editing experience.

Official capability references checked on 16 October 2026: [voice conversations and task coordination](https://learn.chatgpt.com/docs/features/voice), [shared browser previews and visual feedback](https://learn.chatgpt.com/docs/browser). Availability is account/workspace-dependent. The optional Ghost release checks and client setup guide are part of its separate native-source delivery, described in [the access checklist](../owner-handoff/ACCESS.md#materials-outside-the-source-snapshot). They are not required to work with Codex in this repository.
