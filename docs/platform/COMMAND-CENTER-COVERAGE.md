# Command center expansion — 16 October 2026

Riley’s current instruction is to cover essentially all of the client’s original
[RUObuilt admin reference](https://www.ruobuilt.com/demo/admin), with particular
emphasis on useful sales, revenue and projected-revenue tools. This supersedes
the older statement that matching its control surfaces is outside scope.

The reference was revisited on 16 October: it now exposes **34** sidebar screens,
compared with 25 in the September archive. The fresh source capture is
`reference-study/ruobuilt/2026-10-16-control-surfaces.json`. It is external,
fictional demonstration content, not TrueMark business data. No reference
customer identities, metrics or operational claims were copied into the app.

## Delivery boundaries

The existing platform adapters remain authoritative for orders, customers,
products, lots, partners, messages and provider connections. New financial tools
read those same records. Preview uses the existing fictional TrueMark seed;
live mode uses the authenticated store behind TeamGate.

Planning assumptions, saved report definitions, wholesale plans, review moderation
plans and metadata drafts remain **device-local**. The public Studio still uses
fictional records. Its marketing and program plans do not write shared data.

The authenticated connected workspace now has shared consent records, campaigns,
schedules, flow enrollments and a simulated delivery outbox. Rewards use an
order-linked ledger, earning, redemption reservations and refund reconciliation;
spend-qualified membership tiers affect checkout pricing. Owner/staff/buyer roles
are checked in the backend. See [the end-to-end client test path](CONNECTED-PROGRAMS.md).
Marketing delivery stays provider-free and payments retain the existing simulator.
Visitor telemetry, wholesale submissions and product-review publication remain
unconnected. Transactional messages and shipping remain their own services. The
isolated lab uses a throwaway SQL fixture; none of its controls or test transport
ship into the product. No DNS changes are included.

## Reference coverage

All paths below are relative to `/admin`; query tabs are shareable.

| Reference screen | TrueMark control surface | Current behavior / remaining integration |
| --- | --- | --- |
| Dashboard | Overview | Existing pipeline and recent orders; workbench links; financial figures now use captured net revenue. |
| Live | `traffic?tab=live` | Historical, explicitly illustrative sample journeys; live mode requires an event source. |
| Orders | `orders` | Existing order search, filters, record detail and fulfillment workflow. |
| Fraud | `risk` | Self-referral, frequency, repeated-unpaid and incomplete-address signals; local review notes, no automatic verdict or blocking. |
| Funnel | `traffic?tab=funnel` | Recorded placed → captured → packed → shipped → delivered cohorts; uncollected value separate from revenue. Pre-order abandonment needs events. |
| Labels | `shipping` | Ready/shipped/held queues, selection and CSV packing manifests; existing per-order shipment controls. Carrier label purchase is not simulated as a real label. |
| Customers | `customers`, `retention` | Existing accounts/order histories plus recorded LTV, repeat behavior, cohorts and win-back list. |
| Customer import | `programs?tab=import` | CSV parsing, field/duplicate validation and pending-account import-plan export; shared bulk creation not connected. |
| Rewards | `programs?tab=rewards` | Shared earning/redemption rules, audited adjustments, immutable wallet history, checkout reservation and payment/refund reconciliation in the connected workspace; local estimates in preview. |
| Memberships | `programs?tab=memberships` | Shared tier definitions and lifetime-spend qualification, with authoritative checkout pricing in the connected workspace. No recurring subscriptions or fees. |
| Wholesale inquiries | `programs?tab=wholesale` | Local inquiry drafts, review state, notes and CSV; preview starts with fictional enquiries. No shared submission/reply service. |
| Affiliates | `partners` | Existing partner program, attribution, referrals, commission review and payout-recording workflow. |
| Footprints | `traffic?tab=footprints` | Searchable, filtered, exportable illustrative journey explorer; production events not connected. |
| Products | `products` | Existing product and inventory records. |
| Restock | `restock` | Paid-unit velocity, released stock, unknown counts, held lots, incoming assumptions, lead time, safety stock, stockout and purchase quantities. |
| Promo | `discounts`, `marketing` | Existing discount controls plus recorded code revenue, order count, AOV and discount breakdown. |
| COA Library | `lots` | Existing lot status, certificate and verification relationships. Real records and sample evidence remain distinct. |
| Reviews | `reviews` | Local moderation notes and approve/hide planning, filtering/export; production review source/publication not connected. |
| Messages | `inbox` | Existing real contact inbox in live mode; fictional enquiry and response-draft workspace in preview. |
| Emails | `messages` | Existing actual email/SMS delivery log in live mode; existing transactional email template previews in the public demo. |
| Email marketing | `marketing?tab=campaigns`, `marketing?tab=flows` | Shared campaigns, scheduled audience snapshots, four event flows, pause/cancel controls and a simulated delivery outbox. Preview retains local plans; no external marketing delivery. |
| Subscribers | `marketing?tab=subscribers` | Shared opt-in evidence and consent history, atomic CSV import, sticky suppression, customer account opt-in/out and delivery-time consent checks. Preview remains device-local. |
| Analytics | `analytics`, `traffic` | Date ranges/prior comparison, paid revenue, gross-to-net reconciliation, daily chart, product/attribution/region/payment tables. Actual visitor sources/devices need telemetry. |
| Reports | `reports` | Daily/product/customer/region/provider/attribution grouping, CSV, saved definitions and delivery-plan drafts; schedules do not run. |
| Marketing | `marketing` | Recorded code/partner attribution plus campaigns, flows and audience plans; no invented ROAS, CAC or engagement. |
| Profit | `profit` | Margin or SKU costing, shipping, fees, current commissions, manual ad spend and calendar overhead; estimated contribution, negative days, CSV. |
| Retention | `retention` | Unique captured buyers, repeat rate, recorded LTV, median reorder gap, completed-month cohorts and configurable quiet threshold. |
| SEO | `seo` | Actual catalog content checks and editable snippet drafts; verified production Search Console/indexing/rank data not connected. |
| Setup | `setup` | Record-based readiness checks and explicit provider/domain launch requirements. |
| Docs | `docs` | Searchable owner handbook linked to actual workspaces. |
| ShipStation re-push | `shipping` | Read-only batch check; live retry only after explicit confirmation and rechecking failed shipment plus paid/unshipped order state. Preview never calls a carrier. |
| Integrations | `integrations`, `settings?section=connections` | Integration requirement map linked to actual existing owner-controlled connection modes. No false connected states. |
| Settings | `settings` | Existing storefront, team, alerts, provider and store controls; no new secrets stored in planning forms. |
| Activity Log | `activity` | Search/filter/export of recorded order lifecycle events; explicitly not a full actor-attributed security audit. |

## Financial basis

- Financial revenue requires captured, partially-refunded or refunded payment
  history. Authorizations, pending and failed payments contribute no revenue.
- Net revenue is order total less current refunded cash and retained tax.
  Shipping and insurance retained are visible; merchandise discounts/refunds
  are separate. Missing full-refund amounts fall back to the full order total.
- Reports group by **order creation date**, not settlement date. Current refunds
  restate the original order cohort. Tax/merchandise refund splits are explicitly
  proportional estimates until actual line-level refunds exist.
- Monetary allocation and period costs conserve cents. Daily overhead uses real
  calendar months; missing SKU costs hide profit instead of treating unknown as
  free. Units are originally ordered units, without assumed returned inventory.
- Forecasts need at least 14 calendar days and five captured orders. They use up
  to eight weeks of recency-weighted weekday revenue, exclude an incomplete UTC
  day from training, and expose demand, basket, horizon, spread and monthly goal.
  Shaded ranges are user scenarios, not statistical confidence intervals.
- The old Overview, customer LTV and owner-assistant figures use the same paid
  and refund basis. Product-level trends remain net merchandise; the existing
  Top compounds panel explicitly shows gross line revenue.
- A missing promo code is **unattributed**, not proof of direct traffic.

## Implementation and verification

The workbench is in `src/admin/intelligence/`, using the existing app-kit,
appearance controls, responsive sidebar, sortable tables and focus-trapped
drawers. The live adapter already paginates complete records in stable 1,000-row
pages; no silent first-page financial totals were introduced.

`scripts/business-intelligence.test.ts` covers payment states, refunds, taxes,
cent allocation, UTC boundaries, overhead/ad budgets, missing costs, forecast
history and partial days, stock segregation, retention, consent, CSV validation
and injection prevention, shipping eligibility, reward limits and assistant
consistency. Existing platform/release tests and browser verification supplement
these cases. See `design-lab/command/README.md` for the isolated interactive lab.
