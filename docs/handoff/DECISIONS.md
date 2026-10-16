# Current TrueMark decisions — public continuation

This public brief summarizes the current direction. Riley's older design history and private source archives are separate materials, not hidden instructions or requirements to reconstruct every past concept. Read [the owner handoff](../owner-handoff/START_HERE.md), its current-state notes, and the implementation plan first.

## Authority and product

Mason directs TrueMark and may authorize development and releases. Riley is not a required intermediary. GitHub collaboration starts in the existing repository; ownership transfer is deferred. Keep the existing Supabase project, `gydihnfzmuqmbnykaihg`.

TrueMark is a custom storefront, research-account experience, certificate/lot verification surface, partner portal and Command Center. Preserve approved client artwork, product labels, current catalog and design. Product presentation is powder except BAC Water. Keep research-use language; do not introduce medical efficacy claims or human-use guidance. Preserve the `/verify` route and historical lot/certificate associations.

## Daily operations

Staff should be able to operate the interface manually without AI or repository access. Prioritize straightforward shipping and inventory workflows. Print through ShipStation before confirming packed. Labels do not imply actual shipment; real carrier updates remain a required integration. Barcode scanning is deferred.

Exhaust one eligible released lot before the next, allowing an order to span lots. Confirm the ordering rule and starting lot quantities with Mason. Uploading a certificate alone does not bypass release/quarantine checks. Receiving/release and availability must connect to the storefront.

Replace Review Moderation with unified customer communications, including contact inquiries, chatbot logs and in-app replies from authorized business identities. Owner access with configurable staff grants is the working direction; Gmail routing and reply synchronization remain undecided.

## Business tools

Command Center scope covers the original dashboard reference's control surfaces, with useful sales/revenue/profit visibility a priority. Reuse the current implementation rather than reproducing the reference's visual design. See [coverage](../platform/COMMAND-CENTER-COVERAGE.md).

Provide recorded results plus a clearly labeled inventory sell-through scenario; exact costs and assumptions need Mason's examples. This is not an accounting-software replacement. Retention should support customer/product drill-down; new risk signals and forecast rules remain to be agreed.

Marketing, rewards and memberships have connected backend foundations. Membership tiers are spend-qualified. Marketing uses a provider-free test outbox; real delivery is separate. See [connected programs](../platform/CONNECTED-PROGRAMS.md).

## Evidence and delivery

The public Studio is a sample-data demonstration. Working code, passing local tests and active functions do not establish complete production readiness. Inspect the current checkout and deployed state. Follow the owner handoff for separate Studio source/assets/Ghost delivery items and for remaining integration work. Never publish private development history to fill those gaps.
