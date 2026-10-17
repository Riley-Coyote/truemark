# Customer retention — local implementation, 17 October 2026

Mason approved product/customer drill-down, purchase groups, shared history, editable notes and follow-ups, and outcome tracking. Reorder timing varies: there is no standard reorder deadline. Six months is a review milestone, not a deletion date. Mason then deferred choosing an email provider and requested implementation to continue.

## Operator workflow

Choose a product to see who bought it, their latest purchase of that product, and their latest purchase of anything. Open a customer to inspect products, complete order history, contact history and follow-ups. Add a note, log a contact/reply, set a reminder or prepare an unsent draft. Complete a reminder when handled. Edits preserve previous versions; a stale edit cannot overwrite somebody else's change.

For example, a customer with three Retatrutide 30 mg purchases has two observed gaps. A gap longer than both previous gaps appears as “Longer gap,” with the actual observations shown. Two purchases are still “Still learning.” Another product purchased yesterday does not reset the selected product's last-purchase date. This describes purchasing behavior and does not estimate consumption or prescribe use.

Date filters select customers with a purchase during that period; repeat status uses their full recorded history for the selected product. Paid, retained purchases count; unpaid, cancelled and fully refunded purchases do not. Partial refunds retain the order without inventing returned unit quantities. All orders remain available in the customer history. Monthly comparisons offer 6, 12 or 24 columns and all recorded first-purchase months; incomplete months stay blank, distinct from a completed month with zero purchases. Counts and percentages open the underlying customers. Customer and activity CSV exports support later analysis.

## History and access

The migration stores versioned manual activity and append-only events for orders, product lines, refunds, consent, matched contact forms, message outcomes and authenticated customer chat. Only live visitor/customer chat is copied: anonymous conversations, preview sessions, internal owner/partner chats and tool payloads are excluded. Email-matched contact forms are labeled unverified; ambiguous matches are not assigned. Existing known history is imported, and current-state snapshots with unknown event dates stay explicitly undated. Original communication sources remain intact.

Private activity is owner-only by default. Owners can grant or revoke staff access. Database rules enforce these grants; editing a browser field cannot bypass them. Revocation and demotion are checked on each write. Existing purchase analytics retain their existing team access.

Drafts and reminders never queue messages. Simulated delivery never counts as an actual contact. A purchase after a recorded contact is shown as sequence, not proof of campaign causation. Provider opens, clicks, replies and delivery receipts require future integration; no provider is selected or activated by this work. Current consent is displayed, and any future sending must recheck it.

## Verification and limits

- `scripts/retention.test.mjs`: product/date filters, observed gaps, refunds, incomplete months, outcomes, preview persistence/isolation, stale edits and denied private reads.
- `scripts/validate-retention-sql.mjs`: real local SQL for owner/staff boundaries, immutable history, duplicate saves, grants/revocation/demotion, stale edits, date validation, reminders, draft non-delivery, order/refund events, consent/contact capture, customer chat identity and populated migration reruns.
- Existing business-intelligence regressions, TypeScript, preview/live/launch builds, portable boundary checks, other SQL validators, function bundles and browser artifact audit passed locally.
- Browser checks: product filtering and latest-product versus latest-anything dates; monthly customer drill-down; empty search; reminder creation/completion; draft and manual phone-contact persistence; edit history; 390 px layout; Escape returns focus to the customer row.

Preview activity persists only in that browser, with a separate namespace for the Command Center lab. It is fictional data, not the shared database. Live interaction collection starts only after the migration is deployed. Hosted Realtime, multi-session behavior and performance at production volume remain connected acceptance checks. Contact forms received before the buyer exists stay in the source inbox; automatic retrospective identity reconciliation is not included. Anonymous chats are never guessed into a customer history.

## Deployment sequence

1. Verify authenticated owner access to existing Supabase project `gydihnfzmuqmbnykaihg`, migration history and a recoverable backup. Reconcile pending inventory/shipping migrations using their own rollout instructions; do not seed synthetic data into production.
2. Apply pending migrations in order, including `20261017000100_retention.sql`, then deploy the matching frontend. This migration makes no provider setting change.
3. Verify an owner can save/edit a note, another permitted session sees it, ungranted staff cannot read private activity, and revocation blocks writes. Confirm known order and consent history imports without invented timestamps. Inspect one actual customer order/contact association before broad use.
4. Keep email delivery deferred until Mason selects a provider and the intended use, account eligibility, consent and event integration are verified.

No hosted migration, deployment, provider activation or customer message was performed for this local implementation.
