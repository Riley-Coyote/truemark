# TrueMark — owner handoff

Prepared 16 October 2026. This is the entry point for Mason and his Codex. The client is the decision-maker for development, database changes and releases. Riley is not an ongoing approval dependency. Older instructions assigning release approval to Riley are superseded for this handoff.

**Latest consolidated handoff — 18 October:** [Products, lots, certificates and customer retention](COMMAND-CENTER-HANDOFF-2026-10-18.md) collects Mason's settled decisions, the two local implementation commits, verification, the preserved inventory brief, deferred email choice and remaining rollout work. Read it after the continuation notes when resuming this work.

## What you are taking over

TrueMark has a React/TypeScript storefront and Command Center, Supabase database/Auth/storage/Edge Function code, and a published Studio that demonstrates the design using sample records. Backend code and active functions exist; this does **not** mean all real commerce providers are connected or that the client's requested operations are complete.

Keep the existing Supabase project **`gydihnfzmuqmbnykaihg`**. Do not create a replacement project or import fixtures into it as a setup step.

Read, in order:

1. [Working with Mason](WORKING_WITH_MASON.md): who Mason and Riley are, how to explain the work, and how to run a calm, useful first session.
2. [Continuation notes](SESSION_NOTES.md): the latest checkpoint and next useful action; update these as decisions are made.
3. [Current state and next work](CURRENT_STATE.md): implemented foundations, missing operations and unresolved decisions.
4. [Command Center implementation plan](../platform/COMMAND-CENTER-IMPLEMENTATION-PLAN.md): detailed requirements, source references and acceptance scenarios.
5. [Accounts and transfer checklist](ACCESS.md) and [run, verify and deploy](OPERATIONS.md): technical setup for Codex to handle, asking Mason only for steps that genuinely need him.

Read these yourself; do not require Mason to read the engineering documents or answer the entire question backlog. Use [FIRST_PROMPT.md](FIRST_PROMPT.md) if he wants a short opening message. The supplied [owner AGENTS template](AGENTS.owner.md) becomes root `AGENTS.md` in the exported owner snapshot, so its instructions are discoverable from the project. Opening an older GitHub checkout does not automatically bring in unpublished handoff files.

## Workspace tools

[Company account setup](ACCOUNT_SETUP.md) has ready-to-paste ChatGPT preferences and the Codex setup trial. [DESIGN.md](../../DESIGN.md) records the existing UI conventions. [BOARD.md](../../BOARD.md) explains the asynchronous GitHub coordination board. Two repository skills in `.agents/skills/` support operating workflows and handoffs; they do not create new access or automatic communication.

## Project scope map

This is one platform with several connected surfaces. The map describes scope and available foundations, not a statement that every integration is finished. Inspect source and live state before promising a capability.

| Surface | Purpose and scope | Start investigating here |
| --- | --- | --- |
| Storefront | Approved brand/design, catalog and product pages, journal, research-use presentation, shopping and checkout | `src/shop/`, `src/data.ts`, `docs/handoff/DECISIONS.md` |
| Customer account | Research-account application/approval, account access, order history, tracking and certificates | `src/shop/pages/account/`, `src/platform/`, current shop routes |
| Lot verification | Certificate library and lot verification; preserve historical lot/certificate associations and existing verification links | `src/admin/Lots.tsx`, `src/admin/LotCertificateDrawer.tsx`, Supabase certificate migrations |
| Partners | Affiliate/partner portal, referrals, discounts and commissions | `src/partners/`, shared platform types and Supabase migrations |
| Command Center | Orders/shipping, stock/products/lots, content, customers, communications, analytics, reports, settings and operational readiness | `src/admin/`, the implementation plan and [coverage map](../platform/COMMAND-CENTER-COVERAGE.md) |
| Customer programs and marketing | Rewards/memberships, consent, campaign/flow foundations and retention follow-up | [Connected programs](../platform/CONNECTED-PROGRAMS.md); test outbox is distinct from real delivery |
| Backend and services | Supabase data, identity, files and server functions; payment, shipping, email and storefront-assistant integrations | `supabase/`, `src/platform/live/`, CURRENT_STATE.md and ACCESS.md |
| Studio and optional Ghost app | Studio presents designs with sample data; Ghost is an optional native assistant project | [STUDIO.md](../../STUDIO.md) covers the delivered Studio source and content. Optional Ghost source remains separate; neither replaces the operational platform. |

Preserve approved design and research-use language. Follow the current decision log over historical prototype-only descriptions. The Command Center plan is the latest operational scope; it does not silently authorize rebuilding the storefront or every historical concept. Full accounting replacement and barcode scanning are outside the current required work.

## Source delivery

The public repository is currently [Riley-Coyote/truemark](https://github.com/Riley-Coyote/truemark). Current decision: collaborate in the existing repository first; Riley reports that Mason has accepted the GitHub invitation. Transfer the repository to the client later. The effective GitHub role and authenticated access on Mason's machine still need verification. Repository transfer and Supabase access are separate steps; Riley also reports that Mason accepted the Supabase Owner invitation. Verify effective access through Mason's own account; do not repeat the invitation step.

The local private development branch contains additional material and history that must not be pushed wholesale to the public repository. `node scripts/prepare-owner-handoff.mjs` produces a fresh source snapshot from selected current files, including these instructions and the editable current Command Center lab. It includes a file-hash manifest and no Git history, credentials, installed dependencies or automatic deployment workflow. Review and import that snapshot on a branch of the shared repository; ownership transfer can happen later. Its source metadata distinguishes local HEAD from the public main commit; it is not a claim that every local file is already published.

The repository also includes the editable Studio and the entire curated public Studio content package. See [STUDIO.md](../../STUDIO.md) to run it without Riley’s machine. Historical previews are compiled snapshots; the broader private recovery archive and native Ghost source remain separate items in ACCESS.md. Preserve the published release assets before changing repository ownership or release URLs.

## Completion means independence

The handoff is complete when the client can clone the repository, start a preview, make and verify a change, use their own Supabase access, administer the TrueMark owner account, and publish through accounts they control. Record a real trial deployment and rollback. Merely delivering this document or signing into Codex does not establish those capabilities.

The client supplies business decisions in ordinary language. Codex should ask the client directly about stock handling, shipping, messages and profit examples, translate answers into concrete behavior, and maintain a decision log. The client does not need Riley to translate requirements into technical specifications.
