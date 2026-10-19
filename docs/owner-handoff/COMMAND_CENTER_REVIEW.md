# Command Center review with Mason

Started 16 October 2026. Review every Command Center section with Mason to make routine work clear, fast and easy to learn. Discuss useful information and new capabilities before deciding what to build. This is an ongoing product review, not a completed audit or approval to deploy changes.

## Review direction

Mason requested a complete section-by-section review, questions that establish his needs, and durable notes of the discussion. His Tesla engineering comparison calls for thoughtful simplification and a seamless experience, not a change to TrueMark's visual identity.

For each section, establish who uses it, the decision or task it supports, the minimum information needed, and the next action. Review connected screens and tabs, mobile behavior, permissions, mistakes, missing data, and recovery. Keep confirmed decisions, proposals, unresolved questions, and implementation evidence separate. Ask one useful business question at a time.

Mason explicitly requires an overlap check before asking about additions: inspect other sections and their tabs to see whether the information or action already exists. Explain its current home before proposing a change. Prefer improving the existing screen, linking to it, or deliberately consolidating overlapping screens. A repeated summary is justified only by a distinct task and should reuse the same records and calculations. Do not ask Mason to rediscover capabilities that engineering can inspect.

Working design principles to apply during the review:

- Put the next useful action and exceptions ahead of dense information.
- Enter information once and reuse the same authoritative records.
- Start with sensible defaults; reveal advanced controls when needed.
- Preserve context between a list, its details, and the next task.
- Use plain action labels and explain consequential results before confirmation.
- Distinguish sample records, actual results, estimates and missing inputs.
- Add metrics only when they support a decision; identify their source and freshness.
- Automate repetitive work only with clear ownership, failure handling and appropriate approval.

The existing handoff remains the baseline: staff-friendly packing and receiving, sequential released lots and split-lot orders, no shipment notification merely from label creation, unified permission-controlled communications, and separation of actual profit from inventory scenarios. Revisit those decisions only if Mason changes them. Full accounting replacement is not assumed.

## Review coverage

The sidebar below was observed in the local sample Command Center. Reports has an agreed starting direction. Mason paused Overview and selected Lots and Certificates as the active discussion. Remaining rows are a review queue, not findings or approved additions. Expand each row to cover its tabs and dialogs when reviewed.

| Section | Business outcome to explore | Ideas and data to discuss |
| --- | --- | --- |
| Overview | Know what needs attention now | Prioritized tasks, exceptions, paid sales, backlog and stock warnings |
| Orders | Find and understand an order quickly | Payment, fulfillment, lots, customer history and contextual next action |
| Shipping desk | Pack and hand off orders reliably | Guided picking, split lots, label status, packing progress and carrier evidence |
| Risk review | Investigate explainable concerns | Evidence, review owner and resolution; no speculative automatic blocking |
| Sales analytics | Understand changes in sales | Period comparisons, product mix, discounts, refunds and record drill-down |
| Forecasts and goals | Plan with visible assumptions | Targets, scenarios, history sufficiency and reasons projections change |
| Profit planner | Separate earned profit from stock potential | Actual versus assumed costs, missing costs and sell-through scenarios |
| Customer retention | Understand and act on repeat purchasing | Product-level reorders, customer drill-down and consent-aware follow-up |
| Report builder | Answer recurring business questions | Useful presets, rolling periods, comparisons, exports and saved reports |
| Lots and certificates | Receive and release traceable stock | Quantities by lot, quarantine, release authority and certificate history |
| Journal | Prepare and publish content confidently | Draft review, preview, publishing status and customer-visible verification |
| Products and inventory | Maintain products without duplicate entry | Product creation, categories, stock derivation, images and availability |
| Restock planning | Know what to reorder and when | Demand, sellable stock, lead times, incoming stock and unknown quantities |
| Discount codes | Create understandable offers | Eligibility, dates, limits, stacking and margin impact |
| Applications | Approve research accounts with context | Complete/incomplete details, review queue and decision history |
| Customers | See the relationship in one place | Orders, account status, communications and permission-safe notes |
| Partners | Manage referrals and commissions clearly | Attribution, earning rules, refunds, approvals and payout records |
| Customer programs | Make rewards and tiers understandable | Customer benefit, qualification, adjustments, imports and wholesale scope |
| Traffic and funnel | Understand where visits become orders | Actual versus illustrative events, conversion definitions and data coverage |
| Marketing and audience | Reach eligible people intentionally | Consent, segmentation, drafts, approvals, suppression and delivery status |
| Search readiness | Prioritize useful website improvements | Catalog content checks, metadata and separately verified search performance |
| Inbox | Resolve customer questions | Unified threads, ownership, unread state and authorized reply identity |
| Email and SMS | Understand what was sent and why | Linked conversations, delivery failures, retries and customer history |
| Integrations | Know what is truly connected | Connection health, last success, failed work and safe recovery |
| Activity log | Understand meaningful changes | Actor, time, affected record and distinction from a complete security audit |
| Launch readiness | See remaining launch blockers | Verified evidence, accountable owner and specific next action |
| Handbook | Help employees finish real tasks | Short task guides linked to the relevant screen |
| Settings | Control the business safely | Roles, shared defaults, appearance, notifications and sensitive changes |

## Reports discussion

### Current behavior

Inspected the local sample screen at `/admin/reports` and `src/admin/intelligence/Financials.tsx`, function `Reports`, on source base `74da3b8` with existing local edits preserved.

- The page starts with a date range and daily table. Other groupings are product, customer, state or region, payment provider, and order attribution.
- CSV export is available. Saved definitions retain grouping and exact dates in device-local storage; reopening does not automatically advance a weekly window.
- Daily, weekly and monthly delivery choices are explicitly schedule drafts. Saving does not schedule or send an email.
- The financial coverage document specifies order-creation dates and current refunds restating that order cohort. This is different from a settlement-date cash report.
- The visible preview uses fictional TrueMark data through 25 September 2026 and UTC dates. It is not current business performance.

### Proposals for discussion

These proposals are held pending a distinct Reports use case and comparison with existing analytical screens; they are not an instruction to create another dashboard.

1. Lead with a few ready-to-use reports, such as Weekly business summary and Sales by product, with a custom builder underneath.
2. Show a short summary and comparison before the detailed table, and allow drilling into supporting records.
3. Distinguish a rolling period such as Last completed week from a saved fixed period. Make timezone and date basis understandable.
4. Consider shared, permission-controlled saved reports if Mason wants the same reports across devices or employees. Current storage is local only.
5. Keep exports separate from any future automatic delivery. Define recipients, sensitive fields, permission checks and failure handling before adding real scheduling.

The exact contents of a business summary are unresolved. Profit requires reliable cost inputs; revenue alone must not be labeled profit. These proposals do not authorize a redesign or scheduler implementation.

### Overlap check

Source inspection of `src/admin/intelligence/Financials.tsx` confirms that Sales analytics, Profit planner and Customer retention already provide CSV export. Sales analytics handles sales and product performance; Profit planner handles estimated results after costs; Retention handles repeat-customer analysis. Reports reuses the business-analysis foundation and adds grouped views with saved definitions. Export alone does not justify a separate screen.

Mason confirmed the reuse-first approach and that he needs reports both for his own review and to share with others. No decision to remove or consolidate Reports has been made. A proposed distinct role is to assemble, save and share selected information from the existing analytical sections, without creating duplicate calculations or another dashboard.

### Confirmed reporting needs

On 16 October 2026, Mason answered “both” when asked whether reports are for his own review or regular sharing with someone else. He then identified the audiences as **owner** and **bookkeeper/accountant**. Naming an audience does not grant account access or authorize automatic sending.

Mason confirmed that the bookkeeper/accountant does not already require a particular report or spreadsheet format.

Mason agreed to the recommended starting point: a monthly report pack with a concise owner summary and an accountant-friendly spreadsheet, reusing existing figures, with review before sending and automation optional. The monthly pack is a product direction, not a currently running job. Exact columns, file format, recipients, access and sending mechanism remain to be defined. Keep existing custom date ranges available. Mark estimates and missing inputs clearly; do not imply that estimated profit is reconciled accounting. Do not invent a duplicate reporting workflow.

### Reports followup

Choose report fields while reviewing the sections that own those figures, then assemble the agreed monthly pack. This avoids asking the same metric questions in Reports, Sales analytics and Profit planner. Verify each included figure's source, date basis, completeness and export meaning before implementation.

The existing delivery choices save schedule drafts only; no automation was created and no report was sent. The earlier broad question about weekly profit, products or problems is superseded by the overlap-first approach; it did not establish a preferred metric or new feature.

## Overview discussion

### Current behavior and overlap

Inspected `/admin` in the local sample preview and `src/admin/Overview.tsx`. It already contains order search, links to analytical sections, today's revenue and orders, an event feed, the order pipeline, period trends, partner information, recent orders, Needs attention and top compounds.

Needs attention already links to pending account applications, lots in quarantine/testing and delayed packed orders. Its implementation appears below the main financial panels and recent-order area; it is not the first thing visible at the inspected desktop size. The large Business workbench at the top repeats analytical destinations available in the sidebar.

Orders, Shipping desk, Applications and Lots remain the homes for completing those tasks. Sales analytics and Partners remain the homes for detailed analysis. Overview can summarize and link to them without adding another workflow or calculation. Sample activity and sample payout schedules are not evidence of live operations.

### Proposal for discussion

Prioritize actionable exceptions and a compact business snapshot, with clear links into the existing workspaces. Consider reducing the prominent repeated navigation and promoting the existing Needs attention component. Determine which actions belong to the owner versus staff before selecting the layout; do not assume the owner personally packs every order.

### Operating arrangement and pause

Mason answered “Both”: he will remain hands-on with orders and inventory while staff also handle daily operations. This is not a grant of identical permissions to every employee. Existing source has Owner and Staff roles (`src/platform/team.ts`, `src/platform/live/TeamSettings.tsx`); define any additional access rules once in Settings and reuse them across Overview and other sections. A complete financial-data permission audit has not been performed.

Mason then requested moving to Lots and Certificates. Pause Overview here; do not keep asking its questions. No Overview layout changes have been approved or implemented.

## Lots and Certificates discussion

### Current behavior and overlap

Opened the local `/admin/lots` preview, inspected fictional lot `SAMPLE-TZ30-B`, and opened its certificate form without submitting, uploading or changing status. Source checked: `src/admin/Lots.tsx`, `src/admin/LotCertificateDrawer.tsx`, `src/platform/live/content.ts`, and the related stock and lot displays in `src/admin/Products.tsx` and `src/admin/Commerce.tsx`.

- The list groups lots by quarantine, testing, released, rejected and archived status. It shows product, lot identifier, receipt/release dates and units. Search and first-batch/sample filters already exist.
- A lot's detail panel contains its record, results, certificate PDF link when available, status actions and a link to its public verification record when released.
- The release form already accepts the PDF, certificate number, analyzed date and component results, with validation. Preview saving is not a connected production release. The configured acceptance criteria need an explicit quality-specification review before any change; this review does not endorse a numerical threshold.
- No Receive new lot or lot-creation flow appears in the inspected list/detail UI. The existing implementation plan identifies receiving and authoritative lot quantities as unfinished work.
- Products and Inventory already lists a product's lots and links back to these records. Its live product editor has a separate Stock field, and its live total reads product stock; the preview instead totals eligible on-hand lot units. The source explicitly labels lot counts as separate from available product stock. Do not mistake the sample quantities for reconciled physical stock.
- Certificate replacement uploads to the same lot-named PDF path in the inspected adapter. Retaining earlier evidence and correction history needs review before treating replacement as versioned recordkeeping. No files were replaced.

### Proposed responsibilities

Lots and Certificates should own batch receiving, batch identity, quantities, test evidence and release decisions. Products and Inventory should own catalog information and show the resulting stock totals, with links to the underlying lots. Receiving a batch should not require entering its quantity twice. Order picking and Shipping desk should consume the same released-lot allocation records, not maintain another stock count.

Reuse the existing certificate editor and status foundation. A clear receiving action, meaningful quantity labels and explicit approval steps are proposed improvements, not newly implemented capabilities. Preserve the previously requested sequential lot use and split-lot orders rather than reopening that settled direction.

### First question

How is the lot number printed on TrueMark's vials currently assigned: does Mason create it, or does the supplier?

Answer pending. The existing TrueMark-style identifiers do not establish who assigns them. This answer determines the receiving form's identifier entry and whether a supplier batch reference must be linked separately; it should not be inferred from example records.

### Later review topics

- Receiving details, receipt date and supplier batch reference; prevent duplicate receipts.
- Clear meanings for received, held, reserved, available, fulfilled and adjusted quantities, including laboratory samples and damaged units.
- Testing progress, certificate entry, release authority and approved acceptance specifications; uploading evidence is not itself approval to sell.
- Sequential allocation rule, stock rollover and the existing split-lot requirement.
- Certificate corrections, preserved historical evidence and customer verification links.
- Staff access, action history, failure recovery and cross-session availability updates.

Discuss these in the context of one batch rather than asking the whole checklist at once. Keep current records intact; do not alter production quantities, certificates or release status during discovery.

## Confirmed decisions and open items

| Date | Item | State |
| --- | --- | --- |
| 16 October 2026 | Review every Command Center section interactively and retain discussion notes | Requested by Mason |
| 16 October 2026 | Prioritize straightforward, seamless and user-friendly workflows | Requested by Mason |
| 16 October 2026 | Check existing sections and tabs before asking about additions; avoid unnecessary duplication | Explicitly requested and confirmed by Mason |
| 16 October 2026 | Reports must support the owner and bookkeeper/accountant | Confirmed by Mason |
| 16 October 2026 | No existing accountant-required report or spreadsheet format | Confirmed by Mason |
| 16 October 2026 | Monthly owner summary and accountant spreadsheet; review before sending, automation optional | Agreed starting direction; exact fields, format and sending mechanism remain open; not implemented |
| 16 October 2026 | Begin with Reports because it is the open screen | Review sequence chosen by Codex; Mason may redirect |
| 16 October 2026 | Additional Reports presets, rolling dates and shared saved definitions | Proposals not yet selected |
| 16 October 2026 | Promote Overview's existing attention items and reduce repeated navigation | Proposal pending owner/staff operating context |
| 16 October 2026 | Mason and staff both handle daily orders and inventory | Confirmed by Mason; individual permissions are not implied |
| 16 October 2026 | Pause Overview and review Lots and Certificates now | Explicitly requested by Mason |

## Continuation and privacy

After each meaningful answer, capture Mason's decision and example, the reason it matters, unresolved dependencies, and how an implemented result would be checked. Preserve changed decisions as dated history rather than recording proposals as approved. Link implementation evidence only when work is actually completed.

These notes remain local unless publication is separately authorized. The repository is public: keep credentials, customer records and private financial figures out of publishable project notes. Summarize sensitive discussions as requirements without copying their private values.

Related guidance: [Working with Mason](WORKING_WITH_MASON.md), [design guide](../../DESIGN.md), [implementation plan](../platform/COMMAND-CENTER-IMPLEMENTATION-PLAN.md), and [coverage and financial definitions](../platform/COMMAND-CENTER-COVERAGE.md).
