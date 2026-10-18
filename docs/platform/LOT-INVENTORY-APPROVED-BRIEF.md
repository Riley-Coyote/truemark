# Approved product and lot inventory brief

Supplied by Mason in this working conversation and preserved on 18 October 2026. The text below is the supplied implementation request, unchanged. The quantities are an acceptance example, not a production stock declaration. Current implementation and deployment status are in [the consolidated handoff](../owner-handoff/COMMAND-CENTER-HANDOFF-2026-10-18.md).

---

Redesign the Command Center’s Products, Inventory, Lots, and Certificates pages into one intuitive product and inventory workspace.

Inspect the existing application, inventory logic, checkout, and fulfillment workflow before implementing. Use the existing architecture and design. Preserve existing products, inventory, certificates, orders, and fulfillment history.

### 1. One product, multiple lots

A product can have multiple lots. Each lot has its own:
- Lot number.
- Received quantities and remaining inventory.
- Actual receipt date.
- Testing status.
- Certificate of analysis.
- Inventory and fulfillment history.

For example, a 30 mg product has 10 available units from an older lot. A new shipment contains 100 units of the same product under a different lot number.

Show:
- Before arrival: 10 available and 100 incoming.
- After receipt, while testing is pending: 110 on hand, consisting of 10 available and 100 in quarantine.
- After uploading the new lot’s passing test certificate: 110 available, assuming no reservations or other holds.

### 2. Receiving, quarantine, and automatic release

Use these clear stages:

**Incoming:** The shipment has not arrived. Its units cannot be sold or allocated.

**Quarantine:** The shipment has arrived and is awaiting testing results. Its units count as inventory on hand but cannot be sold or allocated.

**Awaiting certificate:** Testing has been recorded as passed, but the certificate has not been uploaded. Its units remain unavailable.

**Available:** The lot has been received, testing has passed, and its certificate is uploaded, with no other active hold.

Uploading a passing test certificate for a lot must automatically clear its testing quarantine and make its eligible received units available. Do not require a separate “Release from quarantine” action or manual status change.

Capture any necessary confirmation that the certificate represents passing results within the upload flow. An arbitrary attachment or failed test result must not release inventory.

Uploading a certificate before arrival must not make incoming units available. A passing certificate clears the testing restriction only; it must not override other active holds.

If a required certificate is removed, make the remaining stock unavailable and clearly flag affected unshipped allocations for resolution. Preserve completed shipment history and its associated certificate records.

Enforce these rules throughout the application, including checkout, allocation, fulfillment, and manual inventory edits.

### 3. Sell the first received lot first

Use first received, first sold (FIFO), based on actual receipt date and time.

Preserve the original receipt date when a lot leaves quarantine. Do not base FIFO on certificate upload, quarantine release, expected arrival, or record creation dates.

Only eligible inventory enters the sales queue. Skip incoming, quarantined, held, certificate-missing, and exhausted stock.

Automatically split orders across lots when needed. If an order requires 15 units and the older eligible lot has 10, allocate those 10 plus 5 from the next eligible lot.

Integrate reservations with the existing order lifecycle so concurrent orders cannot claim the same units.

### 4. One straightforward workspace

Create a product list showing:
- Product name, strength, and variant.
- Available and reserved quantities.
- Incoming quantities.
- Quantities in quarantine, awaiting certificates, or otherwise held.
- Product status.
- Clear actions to view, edit, or receive inventory.

Opening a product should show its lots, certificates, incoming shipments, and inventory history together.

Clearly identify which eligible lot is selling now and which comes next. Explain why unavailable lots cannot be sold.

Consolidate navigation so staff can complete a task without moving through disconnected pages. Keep appropriate underlying data relationships; a unified interface does not require one combined database table.

### 5. Easy product creation and receiving

Provide obvious actions:

**Add new product**
Create a product and optionally enter its first incoming shipment or received lot in the same guided flow.

**Receive inventory**
Choose an existing product, select an existing lot or add a new lot, enter quantity and receipt details, and optionally upload its certificate.

Newly received stock awaiting testing enters quarantine. If the exact lot already has passing results and its uploaded certificate, received units can become available once other eligibility conditions are satisfied.

Support incoming shipments, expected arrival dates, partial receipts, and outstanding quantities.

Prevent accidental duplicate products or lots. Additional receipts for an existing lot must preserve its identity and history. Repeated submissions must not add inventory twice.

### 6. Everything editable, with history

Allow staff to edit product names, strengths, variants, lot numbers, unit amounts, receiving details, expected quantities, statuses, certificates, and other existing product fields.

Provide clear inventory adjustments for:
- Count corrections.
- Damaged units.
- Samples.
- Returns.
- Other additions or deductions.

Record previous and updated values, adjustment reasons, timestamps, and the staff member making each change.

Use stable internal identifiers so renaming a product or correcting a lot number does not disconnect inventory, orders, or certificates.

Edits must maintain accurate inventory. If a change conflicts with reservations or active fulfillment, explain the issue and guide staff through resolving it. Status edits must not bypass testing or certificate requirements.

Allow archiving while preserving historical records.

### 7. Fulfillment and customer certificates

Command Center fulfillment must show the product, the lot or lots to pick, and the quantity required from each lot.

Record the actual lots shipped. If staff substitute a lot, provide an explicit action that updates allocations, verifies eligibility, and records the reason.

Customers must receive or access the certificate for each lot actually shipped. An order containing two lots must support both certificates with clear lot associations.

Never substitute another lot’s certificate or assume a product-level certificate covers all lots.

Handle cancellations, reservation releases, returns, and shipment completion without duplicate deductions or additions. Restore canceled allocations to their original lots. Returned units must be confirmed suitable for resale and satisfy all availability rules before becoming available.

### 8. Keep the interface simple

Use familiar labels, short forms, sensible defaults, and obvious next steps.

Receiving should feel like one task:

Choose product → enter lot and quantity → add receiving details and optional certificate → save.

After saving, clearly show what changed, the updated quantities, and any next action. For quarantined stock, explain that it is awaiting testing results. Make uploading its certificate easy to find.

### 9. Migration and verification

Preserve existing inventory quantities, relationships, and historical orders. Identify existing lots with missing testing or certificate information without inventing passing results. Flag affected open orders for resolution rather than silently canceling them.

Verify:
1. Incoming units remain unavailable.
2. Receiving 100 units awaiting testing adds 100 to quarantine and on-hand inventory, but not available inventory.
3. Uploading that lot’s passing certificate automatically releases its testing quarantine without another action.
4. Failed results or unrelated attachments do not release stock.
5. Other active holds remain effective after certificate upload.
6. FIFO uses original receipt dates and splits a 15-unit order into 10 older units plus 5 newer units when appropriate.
7. Partial receipts update quantities correctly.
8. Fulfillment tracks actual shipped lots and their matching certificates.
9. Edits preserve relationships and history.
10. Concurrent orders, cancellations, and repeated receipt submissions do not oversell or double-count.
11. Removing a required certificate prevents further sale or shipment and flags affected open allocations.
12. Existing historical orders and completed shipments remain intact.

Implement the complete workflow, including underlying inventory behavior. Explain the resulting experience, verification performed, and any remaining limitations.
