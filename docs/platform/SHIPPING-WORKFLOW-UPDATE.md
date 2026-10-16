# Shipping workflow correction — 16 October 2026

Status: implemented and verified locally; included in the owner handoff source. Hosted deployment remains separate. This completes the first shipping correction slice of the [Command Center plan](COMMAND-CENTER-IMPLEMENTATION-PLAN.md), not the entire operational integration.

## Behavior

- Opening an order in Shipping Desk preserves the Shipping Desk route and filters. Ready to pack and packed awaiting carrier are separate queues.
- Staff prints in ShipStation first, then confirms items, quantities, lots, and packing. The packing confirmation no longer requires cold packs. Barcode scanning remains deferred.
- The live print action opens ShipStation. It is a general application link, not an order-specific deep link or a new label-purchasing API. Packing becomes available when label metadata syncs.
- A `SHIP_NOTIFY` label event now records tracking and label metadata without marking the order shipped or sending a shipped notification. The customer can access tracking while the order remains paid/packed.
- Routine manual shipped/delivered buttons are removed from the live drawer. Actual carrier evidence must drive those transitions. The simulator has separate label, packed, pickup, and delivery steps; these are clearly labeled in preview.
- Duplicate labels, older labels, cancelled orders, voided labels, and replacement labels have explicit handling. A voided current label clears preparation metadata without rewinding shipped/delivered history. Provider fetch failures return a retryable error instead of acknowledging a lost event.
- Review Moderation is removed from navigation. `/admin/reviews` redirects to the existing Inbox. A unified Communications interface, staff grants, chat-log consolidation, and in-app email replies are still future work.

ShipStation distinguishes label creation from tracking updates; label creation is not evidence of carrier possession. See the official [webhook overview](https://docs.shipstation.com/apis/docs/guides/webhooks-overview) and [v1 webhook model](https://www.shipstation.com/docs/api/models/webhook/).

## Implementation

`supabase/migrations/20261016000200_shipping_labels.sql` adds `label_created_at` and `provider_shipment_id` to shipments and service-only label-recording/voiding RPCs. Queue status stays `pushed` until an actual shipping event. Existing shipping event IDs are namespaced for label/void events so they do not collide with shipment events.

The shipping function now invokes the label RPC for label notifications. The existing shipment and delivery RPCs remain available for actual status transitions. UI packing eligibility is enforced in the drawer; this change does not add a general database rule requiring a label for every packing operation.

The Command design lab reuses the real packing component with isolated fixture actions. Closing its fixture drawer resets that example; it never calls a provider. The app's sample-data mode also performs no actual label purchase or printing.

## Verification

- Shipping HTTP/provider/component tests: 12 passed.
- Business intelligence tests: 23 passed.
- Shipping SQL acceptance: passed, including rerunnable migrations, service-only permissions, duplicate and out-of-order events, cancellation, export races, void/replacement labels, and distinct actual-shipment notifications.
- Six additional domain SQL validators: passed.
- Production build/typecheck and shipping function bundle: passed. The build retains an existing large-chunk warning.
- Public build artifact audit: passed for 71 artifacts.
- Browser checks cover in-context order opening, print/pack confirmation, focus progression, packed awaiting-carrier feedback, retained queue filters after closing, the retired reviews route redirect, and the 390px-wide drawer/queue. No horizontal page overflow at that width; no browser console errors in the checked application tab.

The migration version was corrected before publication to `20261016000200` so it does not collide with the existing marketing migration. The portable handoff check now rejects duplicate migration versions.

## Before production activation

1. Apply the new migration before deploying the updated shipping function and UI. Test in a non-production environment with the intended provider settings.
2. Connect and authenticate real carrier tracking events. Map accepted physical-shipment evidence and delivery into the existing status RPCs, including duplicate, retry, and out-of-order handling. **This connection is not implemented by this change.** Until then, the live interface correctly waits for carrier confirmation but cannot automatically progress from packed to shipped.
3. Verify real ShipStation export, label creation/void notifications, customer tracking access, and notification delivery with a controlled order. Printing and actual shipping have only been tested with fixtures/simulators here.
4. Reconcile any historical orders incorrectly marked shipped by the former label webhook. The migration intentionally does not rewrite their status history automatically.
5. Regenerate the owner source package before delivery; the earlier ZIP predates these changes. Riley reports Mason accepted GitHub collaborator and Supabase Owner invitations; effective permissions and client-machine connections remain unverified. GitHub ownership transfer remains deferred.

The remaining larger slices are receiving/releasing stock and certificates, quantities split across sequential lots, unified communications and Gmail behavior, and financial actuals versus inventory scenarios. Their existing foundations and unresolved business decisions remain in the implementation plan.
