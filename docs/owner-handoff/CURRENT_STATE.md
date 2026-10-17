# Current state and client decisions

Snapshot prepared 16 October 2026. Read the implementation plan for file-level evidence. Do not mistake an interactive demo, passing local tests or an active function for a verified production workflow.

## Local inventory update — 17 October 2026

Mason confirmed FIFO by actual receipt and automatic testing release when the matching passing certificate is saved. The unified product/lot workspace and underlying allocation, returns and history behavior are implemented and verified locally. Production migration, data reconciliation and hosted acceptance remain outstanding. See [inventory workflow](../platform/LOT-INVENTORY-WORKFLOW.md) and the latest continuation notes; these supersede the inventory next-step questions in the original snapshot below.

## Evidence gathered for this handoff

- Private local HEAD: `7c7dbc4` on `claude/brand-elevation`, with uncommitted work present. Never publish this branch wholesale.
- Public main queried from GitHub: `d8113b3803d3669f4a99d0b929526f20a0ae2e2b`, “Fix Look closer playback across layout changes”. Local `main` was stale; fetch actual remote state before comparing or importing.
- Studio manifest pins `studio-2026-10-16-v25`. Earlier START_HERE/GITHUB-STATUS version descriptions may be stale.
- Supabase project `gydihnfzmuqmbnykaihg` was active. `assistant`, `messages`, `payments`, `shipping`, `uploads` functions were active. Their gateway JWT verification setting was false; application auth checks require inspection before changing deployment settings.
- Hosted secret **names** included assistant/provider and simulator/function configuration. No ShipStation or Resend credential names were observed. Secret values were not extracted for delivery.
- Hosted migration contents, actual provider modes, user membership, billing ownership and real fulfilment were not revalidated during handoff preparation. Older recorded checks describe simulated commerce/marketing providers. Verify current state directly before implementation.

## Local shipping follow-up — 16 October 2026

The source accompanying this owner handoff includes the shipping correction: opening orders stays in Shipping Desk; ready-to-pack and packed queues are separate; label receipt stores tracking without shipping the order; packing confirmation no longer asserts cold packs; simulated pickup and delivery are separate events. Review Moderation navigation is removed and its old application route redirects to Inbox.

These changes are not deployed. Apply `20261016000200_shipping_labels.sql` before deploying the changed shipping function/UI. Real carrier event integration remains unfinished. See [shipping verification and deployment notes](../platform/SHIPPING-WORKFLOW-UPDATE.md). The earlier source ZIP predates these changes. Use this checkout or regenerate a fresh owner package rather than distributing that older ZIP.

Riley reports that Mason has accepted both the GitHub collaborator and Supabase organization Owner invitations. Effective permissions and authenticated access on Mason's machine remain unverified. GitHub ownership transfer is deferred; collaboration in the existing repository is the current plan.

## What exists and what remains

| Area | Existing foundation | Client's requested next behavior |
| --- | --- | --- |
| Shipping | Orders, packing/shipping actions, ShipStation order adapter, tracking fields, simulator | Keep Shipping Desk context. Print through ShipStation, then confirm packed. Remove cold-shipping step. Store tracking automatically; show shipped only after evidence of actual shipment, never merely label creation. |
| Stock and certificates | Product editor/upsert, lot release validations, certificate uploads, storefront data adapters | Staff receives stock, attaches COA, releases eligible lot and publishes updated availability/certificates from one interface. Full receive/create/connect flow still needs work. |
| Lot allocation | Product-level stock and one lot field per order line | Exhaust older eligible lot then next; a single product quantity may span multiple lots. Example: order 5, old lot has 2, next has 10 → allocate 2 + 3. Preserve commercial line totals with child lot allocations. Ordering field and starting lot quantities need confirmation. |
| Communications | Contact inbox, sent-message records, persisted chatbot threads | Remove Review Moderation tab/public review workflow. One inbox for contact messages and chat logs, in-app replies from authorized business addresses. Owner-only by default; configurable staff grants. Gmail routing/reply sync still undecided. Current mailto reply is insufficient. |
| Financial view | Recorded-sales calculations and local planning assumptions | Current sales/profit plus potential profit from sellable inventory and explicit assumptions. Clarify cost inclusion with concrete examples. A stock sell-through scenario is not a prediction of sales timing. |
| Retention | Cohorts, customer records, inactivity/winback foundations | Clear customer/product drill-down and longer/selectable history. Product reorder rules and actual campaign delivery remain decisions/integration work. |
| Risk/forecasts | Existing dashboard sections | Client questioned high-frequency risk signal and some forecasting language. No replacement rules agreed. |

Barcode scanning is deferred future work. Do not add it as a required packing step. Full accounting software is outside the requested scope. The client needs ordinary employees to operate the interface manually; owner conversations with Codex are for development and management, not a prerequisite for fulfilment.

The owner may authorize all future changes directly. Prior text requiring Riley to review releases or decide requirements does not apply to the client-owned continuation.

## Business questions for the relevant working session

Use [Working with Mason](WORKING_WITH_MASON.md) to introduce these one at a time when needed; check [continuation notes](SESSION_NOTES.md) first for answers already recorded. This is Codex's backlog, not a first-session questionnaire.

1. FIFO by actual first receipt is settled. Confirm actual quantities and missing receipt/testing records when reconciling production stock.
2. Does the carrier collect packages or does staff drop them off? Codex investigates which real ShipStation/carrier event proves shipment.
3. Which business email addresses should send replies? Is Gmail the actual mailbox or a forwarding destination? Must replies sent in Gmail also appear in TrueMark?
4. For an example sale and an example inventory batch, which costs should the profit view subtract? Which are estimates? Are future order quantities assumed or already placed?
5. Which staff can release lots or read/respond to communications?

The engineering implementation and provider research are Codex's work. The owner supplies business facts and checks that the resulting examples match the operation.
