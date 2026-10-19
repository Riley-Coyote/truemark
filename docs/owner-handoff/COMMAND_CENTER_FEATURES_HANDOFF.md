# TrueMark Command Center: complete feature handoff

Prepared 18 October 2026 for Mason, Riley and the next person continuing this work. Added alongside [Mason's complete notes and requests](MASON_REQUESTS.md) at Mason's request. This document preserves the completed Command Center work, settled decisions, implementation evidence and remaining work without replacing the existing notes.

## 1. Start here: what is complete and what is pending

Two connected workflows were implemented and tested locally:

1. **Products & inventory:** one place to manage products, multiple lots, incoming supply, receiving, quarantine, certificates, quantities and fulfillment allocations.
2. **Customer retention:** product and customer purchase analysis, customer history, editable notes, contact/reply logs, reminders, unsent drafts and recorded outcomes, without a universal reorder deadline.

The local implementation sessions recorded passing automated and browser checks. **This is not evidence that the changes are running against live business data.** Production database migrations, coordinated deployment and connected acceptance remain pending in this workspace's record. Email-provider selection and actual email delivery were expressly deferred by Mason.

Publishing this handoff on `mason/notes` adds documentation. It does not publish the feature code, merge into `main`, deploy the website, alter inventory, activate a provider or send customer messages.

| Work | Verified local source checkpoint | Recorded state |
| --- | --- | --- |
| Unified inventory and fulfillment | `31a8eaf09fceea37d7efe5c0c06babf44b2c93b1` — Unify product and lot inventory with FIFO fulfillment | Implemented and tested locally |
| Retention and follow-ups | `7b137fdfe5cce694e264ecfb79debc5c5a5153cb` — Build customer retention history and follow-ups | Implemented and tested locally; follows the inventory commit |
| Earlier consolidated implementation handoff | Local commit `790a87b`, followed by `c37e4cd` adding the supplied PDF | Preserved in Mason's local checkout |
| Existing combined requests on GitHub | `1653766aa76e85db2164657cdfca0cc68c6d277b` on `mason/notes` | Published before this document was added |
| Live rollout and actual customer activity collection | Existing Supabase project `gydihnfzmuqmbnykaihg` | Not performed by this work |

At preparation, the local checkout was on `codex/command-center-handoff` and contained both feature commits. Their earlier branches were `codex/unified-lot-inventory` and `codex/customer-retention`. The published notes branch was based on public main `117997da5e5868a8a97c4940a99d96c2b1ae9a81`; it is a documentation branch, not a substitute for the local feature source. Recheck both repositories before integrating code. Do not assume the source files described below exist on `mason/notes` merely because this handoff does.

## 2. Mason's settled operating decisions

These are already answered. Do not ask Mason to decide them again.

| Topic | Decision |
| --- | --- |
| Everyday use | Receiving, stock management and packing must be intuitive enough for an ordinary authorized employee to operate manually. |
| Products and lots | One product can have several lots. A different lot number does not require another product listing. Staff can also create a genuinely new product. |
| Lot sequence | Use the first lot actually received before the next eligible lot. Expected arrival, record creation and certificate upload times do not determine the order. |
| Quarantine | The supply has physically arrived and is waiting for testing results. It is on hand but unavailable for sale or allocation. |
| Certificate gate | Stock stays unavailable until it has been received, passing results are recorded and its matching certificate is attached. |
| Automatic release | Saving the matching passing certificate automatically clears testing quarantine. Independent holds still apply. |
| Editing | Names, strengths/variants, lot numbers, counts, receipt details, expectations, statuses and certificates must be editable with history and stock safeguards. |
| Fulfillment | Staff fulfill orders through Command Center, with clear lot numbers and quantities to pick. |
| Retention timing | Customer reorder timing varies too much for a standard deadline. Use observed history and show when there is not enough evidence. |
| Long-term history | Collect useful purchases and interactions from the beginning so six months of activity can inform decisions. Six months is a review milestone, not an automatic deletion date. |
| Follow-up tools | Customer groups, product drill-down, history, notes, contact/reply logs, reminders, drafts and outcome tracking are approved. |
| Email | Continue the retention work without selecting or activating an email provider yet. |

Mason owns product and release decisions. Riley is not a required approval intermediary. Ask one relevant business question at a time when a genuinely missing fact affects the next task. Keep the remaining backlog in the documents.

## 3. Products, lots, certificates and inventory

### The concrete stock example

Use a 30 mg product with 10 units remaining in an older eligible lot and 100 more units ordered under a different lot number. These are demonstration quantities, not a statement of actual stock.

| Stage | Physically on hand | Available to sell | Incoming | Unavailable on hand |
| --- | ---: | ---: | ---: | --- |
| New lot ordered, not received | 10 | 10 | 100 | None |
| All 100 new units received, awaiting tests | 110 | 10 | 0 | 100 in quarantine |
| Results pass, certificate still missing | 110 | 10 | 0 | 100 awaiting certificate |
| Matching passing certificate saved, with no other holds or reservations | 110 | 110 | 0 | None |

When both lots are eligible, an order for 15 units reserves 10 from the older lot and 5 from the newer lot. Staff see both picking instructions. The customer still has one priced product line and receives the certificates for both lots actually shipped.

Reservations reduce availability; shipment reduces physical on-hand stock. The same reserved units cannot be promised to another order. Uploading a certificate before a delivery arrives never makes incoming units available.

### What changed in the interface

- **One Products & inventory workspace:** product records open their lots, counts, incoming deliveries, certificate actions and recent history. Existing lot links still resolve.
- **Clear stock views:** available, incoming, quarantine, awaiting certificate and records needing attention are visible without piecing together disconnected pages.
- **Add a new product:** create the product and continue into receiving its supply.
- **Receive an existing product:** choose an existing or new lot without duplicating the product listing.
- **Partial receiving:** record only what arrived and retain the outstanding expected amount and date. Repeating a submitted receipt cannot add its units again.
- **Clear lot order:** see which eligible lot sells now, which comes next and why another lot is unavailable.
- **Editable records:** product and lot edits retain stable identities, relationships and change history. Renaming a lot does not create a new lot or lose its previous orders.

### Inventory and certificate rules implemented

Lot counts are the source of truth. Product totals are calculated from those lots; editing a product cannot independently manufacture stock. On-hand stock includes reserved units. Available stock is eligible on-hand stock minus reservations. Missing counts or receipt dates remain unknown until reconciled rather than being invented.

Adjustments record corrections, damage, samples and other additions or deductions with a reason. Conflicting quantities, attempts to invalidate reservations and stale edits are rejected. Audit history records previous and new values, reason, time and operator. The current inventory view shows the latest 100 entries; older entries remain stored. Archiving preserves historical records.

The certificate form requires staff to confirm the matching lot and record passing test results. **The application does not read, interpret or authenticate the contents of a certificate PDF automatically.** Automatic release means the valid form save clears testing quarantine; it does not mean any uploaded file is enough.

Setting testing back to pending detaches the current certificate so an old attachment cannot silently bypass testing. Certificates use versioned file paths. Replacing or detaching a current certificate preserves the historical files and completed shipment associations.

Independent holds, rejected or archived lots, missing evidence and incoming supply remain unavailable under the relevant eligibility rules. Existing owner/staff inventory permissions continue to apply. Customers cannot edit inventory or access internal adjustment history; a new fine-grained inventory permission system was not added.

### Fulfillment, cancellations and returns

- Checkout reserves eligible lots in actual receipt order. One product line can have several child lot allocations without changing its price calculation.
- Picking lists show the specific lot and amount for each allocation.
- Explicit lot substitution checks the replacement lot, requires a reason and returns a previously packed order to the packing queue.
- Shipment deducts the physical units once and records the actual lot labels and certificate versions used.
- Customers can access every certificate associated with their shipped allocations, even if a current lot certificate is later replaced or detached.
- Cancelling an order releases its reservations back to their original lots.
- A financial refund alone does not add physical stock. Returns require resale inspection and cannot exceed the shipped amount not already returned.
- Removing a required certificate makes the remaining stock unavailable and blocks affected unshipped allocations for resolution. It does not delete the order or rewrite a completed shipment.

### Existing-data implications

The migration preserves existing lot keys and introduces stable internal identity plus editable displayed lot numbers. Existing order/product relationships and public lot links are retained. It does not invent lot counts, receipt dates, passing test results or the split of a product total across multiple lots.

Availability can decrease, even to zero, where required evidence is missing. Staff must reconcile those records using real information. Affected open orders remain on file and need corrected evidence or an explicit eligible substitution.

Previously fulfilled allocations are marked legacy and retain the certificate association available during migration. PDF versions overwritten before this work cannot be reconstructed as original shipment evidence. Preserve backups and investigate uncertainty rather than implying that missing history was recovered.

## 4. Customer retention and interaction history

### What the operator can do

Choose a product to see who purchased it, how often, the most recent purchase of that product and the most recent purchase of anything. Open a customer to inspect product history, complete order history, activity and follow-ups. Customer records also provide an **Activity & follow-ups** entry point.

The workspace supports:

- Product, customer name, organization, email and purchase-date filtering.
- Groups for all customers, bought once, repeat buyers, three or more purchases, longer gaps and follow-ups due.
- Monthly comparisons over 6, 12 or 24 months, with counts or percentages opening the underlying customer records.
- Editable notes, contact logs, recorded replies, reminders and unsent drafts.
- Reminder completion, cancelled/voided records and archived drafts while preserving prior versions.
- Customer and activity CSV exports for later analysis.
- Current eligible product availability in customer product history, respecting the inventory and certificate rules above.

### How purchase patterns are interpreted

There is no universal inactivity threshold on this retention screen. A customer needs at least three distinct purchase times, giving at least two observed gaps, before the current gap is compared with their previous gaps. If the current gap is longer than their previous gaps for the selected product or selection, the screen shows **Longer gap**. With less history, it shows **Still learning**.

Example: buying a different product yesterday does not reset the last-purchase date for the selected 30 mg product. Likewise, narrowing the date filter does not turn an established repeat buyer into a first-time customer: the range selects customers, while repeat status and gaps use their full recorded history for that selection.

These are observations of purchase behavior, not predictions of churn, product consumption or a medical schedule. A longer gap is a reason for a human to review the record, not an automatic instruction to contact the customer.

Paid purchases with retained collected value count toward patterns. Unpaid, cancelled and fully refunded orders are excluded from those calculations but remain in complete order history. Partial refunds do not invent returned unit quantities.

Monthly comparisons retain recorded first-purchase months. A blank incomplete month is different from a completed month with zero purchases. Six months of activity does not guarantee enough evidence for every product or customer, and older useful history is retained.

### Activity collection and safeguards

The shared-data migration captures order and product-line changes, refunds, consent changes, matched contact forms, recorded message outcomes and authenticated customer chat. It also imports known existing history. When the original event date is unknown, the imported snapshot is explicitly undated; its import date is not presented as the historical event date.

Only live visitor/customer chat tied to an authenticated buyer is copied into the customer timeline. Anonymous conversations, preview chats, internal owner/partner chats and tool payloads are excluded. Contact forms use a unique email match and are labeled unverified; ambiguous matches are not assigned. Contact forms received before a buyer exists remain in the original inbox. Automatic retrospective matching was not added.

Manual activity keeps its edit history. Duplicate save retries do not create duplicate records, and stale edits cannot overwrite another person's changes. Private notes, contact history and follow-ups default to owner access. The owner can grant or revoke staff access, with enforcement in the database, including after revocation or demotion. Existing purchase analytics retain their existing team access.

Saving a draft or reminder never sends or schedules a message. Simulated delivery is not recorded as a real customer contact. A later purchase after contact is displayed as a sequence of events, not proof that outreach caused the sale. Current consent is visible and must be checked again before future sending.

### What retention does not yet provide

Live collection through this new feature starts only after its database migration and matching application are deployed. Local preview activity is fictional and saved only in that browser, with a separate storage scope for the Command Center lab.

Automatic mailbox reply synchronization, provider delivery receipts, opens, clicks and actual email sending require future integration. No provider was selected or activated. No automated reorder or winback policy was approved or enabled. Existing separate marketing flows were not activated or redesigned by this work.

## 5. Local verification already recorded

The following evidence comes from the feature implementation sessions on 17 October. Preparing and publishing this document checks documentation and source evidence; it is not a new production acceptance test or a rerun of the entire application suite.

| Area | Recorded checks and outcomes |
| --- | --- |
| Inventory behavior | Local SQL checks passed for partial receiving, duplicate retries, failed/missing/prearrival certificates, independent holds, first-received allocation, count conflicts, substitution, cancellations, inspected returns and preserved shipment evidence. |
| Inventory regression checks | Four focused inventory/customer tests and 59 existing adapter, shipping and messaging checks passed. |
| Existing-data migration | A populated legacy fixture retained quantities and commercial order lines; missing evidence blocked incomplete open allocations without deleting or cancelling those orders. Repeated migration checks passed. |
| Inventory browser review | Desktop and 390-pixel viewport; 10 available plus 100 incoming; a partial receipt of 60 quarantined with 40 outstanding; then 110 available after completion and matching passing certificate. Duplicate product errors preserved entered form values. |
| Retention calculations and adapters | Seven focused tests and 23 existing business-intelligence checks passed, including product/date distinctions, observed gaps, refunds, incomplete months, outcomes, persistence, stale edits and denied reads. |
| Retention database | Local SQL passed for owner/staff access, grants/revocation/demotion, version history, duplicate/stale saves, reminder handling, draft non-delivery, order/refund/consent/contact/chat events, simulator exclusion and populated reruns. |
| Retention browser review | Product filtering, latest-product versus latest-anything dates, monthly customer drill-down, empty search, reminders, unsent drafts, phone-contact logging, history, 390-pixel layout and keyboard focus return were checked. |
| Shared build/security checks | TypeScript, preview/live/launch builds, 29 portable boundary checks, the local SQL validators, five function bundles and the public browser-artifact scan passed. There were eight SQL validators at inventory completion and nine after retention. |

The local SQL runner uses PGlite with authentication and storage stubs. Its single connection does not prove native PostgreSQL concurrency, hosted Realtime or behavior at production volume. Those remain connected acceptance checks. Historical tests requiring unavailable private assets or Git references were not represented as passing by the portable subset. The implementation used available Node 24 locally; the documented deployment runtime is Node 22.

No production inventory, customer records or provider messages were created for these checks.

## 6. Implementation map

These are paths in the verified local feature source. They are intentionally listed as paths rather than links that imply the notes branch contains the feature implementation.

| Responsibility | Files |
| --- | --- |
| Inventory workspace and forms | `src/admin/InventoryWorkspace.tsx`, `src/admin/InventoryForms.tsx`, `src/admin/LotCertificateDrawer.tsx` |
| Picking and lot substitutions | `src/admin/OrderInventory.tsx`, `src/admin/OrderDrawer.tsx` |
| Inventory rules and persistence | `src/platform/inventory.ts`, `src/platform/inventory-store.ts`, `src/platform/live/inventory.ts`, `src/platform/preview/inventory.ts` |
| Inventory migration | `supabase/migrations/20261017000000_lot_inventory.sql` |
| Shipping and certificate messages | `supabase/functions/shipping/server.ts`, `supabase/functions/messages/server.ts`, `supabase/functions/messages/templates.ts` |
| Customer shipment evidence | `src/shop/pages/account/Orders.tsx`, `src/shop/pages/account/Certificates.tsx` |
| Retention screen and calculations | `src/admin/intelligence/Retention.tsx`, `src/admin/intelligence/retention-model.ts`, `src/admin/Customers.tsx` |
| Retention records and permissions | `src/platform/retention.ts`, `src/platform/retention-store.ts`, `src/platform/live/retention.ts`, `src/platform/preview/retention.ts` |
| Retention migration | `supabase/migrations/20261017000100_retention.sql` |
| Focused checks | `scripts/inventory.test.mjs`, `scripts/validate-inventory-sql.mjs`, `scripts/retention.test.mjs`, `scripts/validate-retention-sql.mjs`, `scripts/business-intelligence.test.ts` |
| Portable build/security checks | `scripts/check-owner-handoff.mjs` |
| Original detailed local workflow notes | `docs/platform/LOT-INVENTORY-WORKFLOW.md`, `docs/platform/CUSTOMER-RETENTION.md`, `docs/platform/LOT-INVENTORY-APPROVED-BRIEF.md` |

Before moving the feature source to a shared development branch, inspect the current local changes and the current remote code. Preserve unrelated website/partner interaction improvements already on main. Do not push private history or replace the remote repository wholesale. If continuing from a checkout that already contains the two feature commits, do not apply them again.

## 7. Safe preview and acceptance walkthrough

Use the operational application preview, which is separate from historical Studio snapshots. The last verified sample preview in this work used `http://127.0.0.1:5175/admin/products` and `/admin/retention`. This is a local address, not a remotely shareable or production URL. Check whether a suitable preview is already running before starting another.

With dependencies available, the documented sample-preview start command from the repository root is:

```sh
VITE_PLATFORM=preview VITE_LAUNCH=0 VITE_ROUTER=path npm run dev -- --port 5175 --strictPort
```

Confirm the sample-data notice before creating synthetic records. The isolated Command Center lab is `/design-lab/command/index.html`. Do not use production as a fixture sandbox.

| Scenario | Expected result |
| --- | --- |
| Receive 60 of 100 expected new units | 60 are received but quarantined; 40 remain incoming. The older eligible lot stays available. |
| Record passing results without a certificate | New stock stays unavailable. |
| Save a matching passing certificate after receipt | Testing quarantine clears automatically; an independent hold would still prevent sale. |
| Order 15 with 10 in the old lot | Picking shows 10 old plus 5 new, with one priced product line. |
| Repeat the same receipt or shipment request | Units are not counted or deducted twice. |
| Remove a certificate before shipment | Affected stock and allocations require resolution; existing orders remain on file. |
| Replace a certificate after shipment | The customer's shipped certificate association remains the historical version. |
| Refund without receiving a physical return | Inventory does not increase. |
| Filter retention to one product | Its last-purchase date remains distinct from the customer's last purchase of anything. |
| Review a customer with too few purchases | Show Still learning rather than an invented reorder deadline. |
| Save a note, reminder or draft | Save the record with history; do not send a message. |
| Edit an outdated copy or revoke staff access | Reject the stale or unauthorized write without losing the previous saved record. |

For connected acceptance, additionally test two simultaneous allocation attempts, two staff sessions, realtime updates, permission changes across sessions, upload failure/retry and realistic data volumes.

## 8. Remaining rollout work, in order

1. **Establish the source to release.** Compare current local feature commits with the shared repository, preserve other work, and integrate the required application, function and migration changes on a scoped development branch. A documentation commit on `mason/notes` does not complete this step.
2. **Verify existing access.** Use Mason's authenticated access to Supabase project `gydihnfzmuqmbnykaihg` and confirm the separate TrueMark application-owner role. Invitations were already reported accepted; do not ask for acceptance again. Organization ownership alone does not prove application-owner access.
3. **Inspect actual migration history and recoverable backups.** Do not replace the project, reset hosted data or assume the local migration list is the deployed history.
4. **Reconcile real inventory.** Export/read existing products, lots, open orders and certificates. Obtain actual physical counts, receipt dates and missing evidence from staff. Do not turn a product total into guessed lot quantities or import demonstration fixtures.
5. **Apply the required migrations in order under release authorization.** Check outstanding prerequisites, including `20261016000200_shipping_labels.sql` where pending, then inventory `20261017000000_lot_inventory.sql` and retention `20261017000100_retention.sql`. Resolve missing prerequisites rather than blindly applying isolated files.
6. **Deploy matching versions together.** Coordinate the frontend with affected shipping/messages functions and database changes. Keep provider activation separate. Record source commit, migration IDs, function versions, deployed URL and recovery plan.
7. **Run connected acceptance.** Verify owner, permitted staff, ungranted staff and customer sessions; concurrent allocation; partial receiving; certificate gates; split-lot picking/shipment/returns; retained customer certificates; shared activity; revoked access; and imported historical timestamps/associations.
8. **Verify live history collection.** Confirm real order/contact associations and freshness after deployment. A chart offering 24 columns does not prove 24 months of recorded activity exists. Keep gathering useful events over time.
9. **Resume email separately when Mason is ready.** Choose a suitable provider, verify the intended use and account eligibility, establish sending identities and consent handling, and connect delivery/reply events before enabling outreach. No provider choice is implied by adapter code or this handoff.

After new allocations exist, prefer a forward correction or coordinated database/application restore over reversing schema changes alone. A frontend rollback does not reverse migrated data. Do not expose service credentials in source, logs, chat or browser variables.

## 9. Other Command Center work discussed, still separate

| Area | Direction and unresolved work |
| --- | --- |
| Shipping | Earlier local corrections keep label creation separate from shipment, retain Shipping Desk context and distinguish ready-to-pack from packed queues. Actual ShipStation/carrier evidence and the physical pickup/drop-off/printer workflow still require connected verification. |
| Unified inbox | Combine contact messages and chat logs with in-app replies and owner-default configurable grants. Confirm business sending addresses, mailbox arrangements and whether replies made directly in Gmail must sync. Retention history does not complete this inbox integration. |
| Financial reporting | Show actual sales/profit separately from potential profit in sellable inventory. Confirm product, packaging, testing, shipping, fee, commission and overhead treatment using real examples. The retention work preserved existing financial calculations; it did not rebuild accounting. |
| Risk and forecasts | Mason questioned the high-frequency risk signal and forecasting language. Replacement rules remain unsettled; do not invent new automatic restrictions. |
| Hosting and ownership | Verify client-controlled hosting, domain, provider/payment accounts and a real deployment/rollback trial. Accepted invitations alone do not establish operational independence. |
| Deferred work | Barcode scanning, full accounting replacement and optional native Ghost work are not prerequisites for the manual inventory or retention workflows. |

Keep these items visible without presenting them as completed features or automatically starting them because they appear in this document.

## 10. Continuation instructions and documentation status

Read this with [Mason's notes and requests](MASON_REQUESTS.md), [Working with Mason](WORKING_WITH_MASON.md) and [continuation notes](SESSION_NOTES.md). Older handoff statements that still ask whether FIFO should use first receipt or whether quarantine requires a separate manual release are superseded by the settled decisions above.

The existing published `MASON_REQUESTS.md` collects the conversation requirements and the complete written content of the 14-page meeting PDF. The PDF's 10 visual references were subsequently restored in Mason's local handoff, but their GitHub image upload was rejected. That image correction remains a separate pending publication; this text-only handoff does not claim the pictures are already online or replace the broader meeting notes.

This addition was prepared from Mason's conversation decisions, the local implementation commits, current source files and recorded checks. The authenticated coordination-board search at preparation found no open matching coordination issues. No coordination message was sent. Hosted deployment state was not revalidated during documentation work.

The next developer should first verify the source and deployment state, then follow Mason's current priority. If no different priority is given, review the sample inventory and retention workflows with him and prepare the shared-data rollout. Do not repeat settled questions, assume fixtures are real data or activate email delivery as a side effect.
