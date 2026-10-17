# Product and lot inventory — 17 October 2026

## Agreed behavior

Mason's supplied implementation brief settles the ordering and release rules: first actual receipt first, among eligible lots. Received stock awaiting test results is quarantine. Staff upload the matching PDF and enter/confirm passing results in one form; the save automatically clears testing quarantine. Incoming stock and independent holds remain unavailable. All names, counts, receipt details, expectations, statuses and product fields remain editable with history.

## Implemented locally

Products & inventory replaces the separate Products and Lots navigation. Old lot links still resolve. Each product opens its lots, counts, incoming deliveries, certificate actions and recent history. The existing form field supports the product's form/variant; duplicate detection compares name, size and variant. Product creation can continue straight into receiving. Partial deliveries retain the outstanding expected quantity. A receipt retry cannot add units twice.

The authoritative quantities live on lots: on hand includes reservations, and available is eligible on-hand stock minus reservations. Product stock is derived; a product edit cannot independently add stock. Receipt dates and missing counts remain unknown when the source is unknown. Staff can reconcile these records in the lot editor. Returning a lot to pending testing detaches its current certificate, preventing a status edit from reusing old evidence to skip testing.

Checkout locks products in stable order and reserves child lot allocations in receipt order. One commercial line remains one priced line, even when an order draws 10 older units and 5 newer units. Picking shows each lot/quantity; substitution requires a reason and returns packed orders to the packing queue. Shipping deducts physical quantities once and snapshots each lot label and certificate version. Cancellation releases the original reservations. Financial refunds alone do not add physical inventory. The order return action bounds returns to the unreturned shipped amount and requires resale inspection.

Certificate paths are versioned. Replacing/detaching a certificate preserves previously attached files and shipped associations. Unshipped orders become blocked if their allocations lose eligibility; customer orders and certificate history retain shipped PDFs even when the current lot is held or its certificate is detached. New uploads require staff confirmation of lot identity and recorded passing results. The application does not interpret or authenticate PDF contents automatically.

The existing owner/staff role policy governs edits; customers cannot mutate inventory or see internal adjustment history. Audit entries retain before/after values, reason, time and operator identity. Current history displays the latest 100 entries; older entries remain stored.

## Verification

Local fixtures only; no production orders, inventory, provider messages or migrations were created.

- `scripts/validate-inventory-sql.mjs`: incoming stock; 60 + 40 partial receipts; idempotency; failed/missing certificates; independent holds; prearrival certificates; FIFO 10 + 5 with unchanged financial lines; count/version conflicts; renamed lot identity; certificate removal/packing gates; immutable shipped evidence; return inspection/limits/retries; cancellation; substitution; denied access; competing allocation attempts; new products/variants and audit identity. A populated legacy database is upgraded twice: historical order lines and lot quantities are preserved, and missing evidence blocks open orders without cancelling them.
- `scripts/inventory.test.mjs`: working browser-preview persistence/allocation/return logic, customer access to both shipped certificates after removal, separate historical PDF versions and live row mapping.
- Existing adapter, messaging and shipping tests; payment, membership/reward, certificate, shop-access, shipping and messaging SQL validators. Their synthetic stock setup now supplies received/certified lots rather than directly editing derived product stock.
- Portable owner checks: preview/live/launch compilation; 29 routing/security/configuration checks; all eight SQL validators; all five server bundles; browser artifact scan. Historical/private-source regression comparisons outside this documented subset are not claimed.
- Browser inspection at desktop and 390-pixel embedded viewport. Synthetic sample receipts show 10 available, 100 incoming, then 60 quarantined and 40 outstanding. Receiving the remaining 40 and saving its passing certificate shows 110 available, with the 10-unit lot selling now and the 100-unit lot up next. Duplicate product entry retains the form and displays an actionable error.

PGlite executes real migration SQL with local Supabase/auth/storage stubs. Its single database connection does not prove native PostgreSQL multi-connection contention or hosted Realtime delivery. Those require connected acceptance. The available local runtime was Node 24; the documented deployment runtime remains Node 22.

## Production rollout remaining

This is local source and fixture verification, not a deployment. No authenticated Supabase tool was available in this session. Before release, inspect actual migration history and backups on the existing `gydihnfzmuqmbnykaihg` project. Do not create a replacement project or seed production fixtures.

1. Read/export existing products, lots, open orders and certificate associations. Reconcile actual physical counts, receipt dates and missing test/certificate evidence with staff. Preserve unknowns; do not turn product totals into invented lot quantities.
2. Apply outstanding prerequisite migrations in order, then `20261017000000_lot_inventory.sql`. Product availability may decrease to zero where the required lot evidence is missing; use the workspace reconciliation notices. Open orders stay on file and require corrected evidence or an explicit eligible substitution.
3. Deploy the matching frontend and changed shipping/messages functions together. The older certificate-only replacement RPC deliberately refuses unchecked replacements and directs staff to the full results form.
4. Verify owner/staff/customer roles, two simultaneous checkout connections, two open staff sessions, partial receiving, upload failure/retry, certificate removal and actual split-lot shipment/return in an appropriate connected test environment. Keep provider activation separate from fixture testing.
5. A preexisting fulfilled allocation is marked legacy and retains the certificate association available at migration time. The system cannot recover PDF versions overwritten before this change. Preserve backups; investigate any historical uncertainty instead of claiming a reconstructed shipment snapshot is original evidence.

The migration keeps existing lot keys and adds stable UUID identity plus editable display numbers. Existing public links remain valid. It does not delete lots, orders, attachments or financial rows. Avoid a schema rollback after new allocations exist; take a backup and use a forward correction or restore a coordinated database/application backup.
