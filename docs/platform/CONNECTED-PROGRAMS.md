# Connected marketing and customer programs

Riley authorized backend connection of marketing, rewards and memberships on
16 October 2026. This extends the command-center release; the public Studio
walkthrough remains fictional. Shared writes require a signed-in team account.

Entry points:

- Studio → Platform → Owner workspace → **Open connected test workspace**.
- [Connected marketing](https://riley-coyote.github.io/truemark/live/#/admin/marketing)
- [Connected customer programs](https://riley-coyote.github.io/truemark/live/#/admin/programs)
- [Customer benefits](https://riley-coyote.github.io/truemark/live/#/account/programs)

## Client test path

1. Sign in with the existing team account. An owner can enable rewards and
   membership pricing, edit tiers and make audited point adjustments. Staff
   can manage marketing and inspect wallets, but cannot change money-like rules.
2. In Customer programs, enable the programs and save. For a short test, use
   10 earned points per USD, 100 points per USD credit, a 100-point minimum and
   a 10% redemption cap. Create a test tier with a zero spend threshold and
   a small benefit, or adjust a normal tier. These are shared settings, so
   record any test changes and restore the intended business rules afterward.
3. In a separate browser profile/device, use a verified research buyer account.
   Open Rewards & membership, opt into the newsletter if testing marketing,
   then place an order with the payment simulator. No card is charged.
4. Refresh the owner wallet/ledger (switch tabs or refocus the window) and the
   customer benefits page. Points should appear after payment capture. The
   customer’s membership benefit is compared with a promo code; only the larger
   applies. A later order can redeem whole-USD credit within the balance,
   minimum and percentage cap. The checkout shows the benefit breakdown.
5. Refund the order from its payment section or cancel an unpaid order. Earned
   points reverse as refunds arrive; redeemed points return proportionally.
   Unpaid cancellation/expiry releases the whole point reservation.
6. In Marketing → Subscribers, add a test address with explicit opt-in evidence
   or import a CSV with `name,email,consent_at,source`. The customer’s account
   newsletter preference also writes the same shared consent record.
7. Create and save a campaign, then queue it now or choose a future local time.
   Run due messages, then open Test outbox. Inspect its recipient, stored content
   and simulated result. Reload the page to confirm persistence.
8. Activate a flow before producing its event. Welcome starts at a new opt-in;
   post-purchase starts at a new captured order; winback checks for later orders;
   pending-order follow-up applies only while an order remains payable. Use a
   zero-hour delay for immediate flow tests. Pausing stops queued flow messages.
9. Queue a future campaign and opt out before it is due. It should be suppressed.
   Reimporting the address cannot reactivate it; renewed account opt-in can.

If checkout cannot load benefits after a connection problem, use **Retry benefits**.
Your delivery selection and the rest of checkout stay in place. An unavailable
or excessive point redemption blocks placement until corrected. Once an order is
held for payment, its summary uses the benefits already reserved on that order.

## Boundaries and rules

Marketing transport is **always the simulator** in this release. It stores
shared delivery records and never calls an email/SMS provider, including when
transactional email uses another mode. The database runs due messages every
minute, with an owner/staff Run due messages action for immediate testing. There
are no invented opens, clicks, campaign revenue or ROAS. Real provider delivery
is a separate integration once the client’s provider is configured.

Memberships are spend-qualified pricing tiers, with no recurring fees or paid
subscriptions. Qualification uses lifetime captured merchandise after discounts
and proportionally allocated refunds, excluding shipping, insurance and tax.
The highest active qualifying spend tier applies. The better of membership and
promotion applies first; eligible reward credit follows. Prior orders retain
their pricing. A refund can reduce qualification for future orders.

Rewards use an append-only ledger. Each order snapshots its earning rate at
placement, earns on captured net merchandise, reserves redemption at placement,
and reconciles on cancellation, expiry and refund. Repeated payment events do
not earn twice. Partial refunds proportionally reverse earned points and return
redeemed points; complete refunds remove all earnings and return the full
redemption. A refund after points have been spent can leave a negative balance;
redemption remains blocked until replenished. Point value cannot change after
the first ledger entry. Manual adjustments require an owner, reason and stable
idempotency key. Balances are serialized per customer to prevent concurrent
overspending. No old orders are retroactively awarded points.

All new tables use RLS and checked RPCs. Buyer ledger reads are scoped to their
own buyer ID; marketing addresses are team-only. No anonymous writes are added.
Optimistic versions prevent stale settings, tiers, contacts, campaigns and flows
from overwriting another session’s change. Consent events and settings changes
have audit records. Campaign audiences and content are snapshotted when queued;
consent, flow status and order eligibility are rechecked during processing.

## Local verification

`node scripts/validate-programs-sql.mjs` applies the complete migrations twice,
then exercises real PostgreSQL functions and RLS with synthetic accounts. It
covers pricing, role boundaries, reservations, refunds, retries, expiry,
manual-payment parity, scheduling, consent, suppression and flow enrollment.
The existing payment proof remains in place and excludes only the new neutral
order columns when comparing historical schema behavior.

`node scripts/preview-programs.mjs` starts a throwaway SQL-backed fixture at
`http://127.0.0.1:5343`. The existing command lab on port 5337 has Shared marketing
and Shared programs scenes using the actual connected components. Its fixture
transport accepts only loopback requests and the required RPC/table allowlist;
it has no credentials and makes no hosted calls. Restarting it clears its
synthetic records. The lab and fixture transport are not published.
