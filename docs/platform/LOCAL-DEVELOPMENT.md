# TrueMark working platform

This is the ongoing application for the future production domain: Website,
research accounts, Partners and Command Center, all from the same src/ code.
The local environment uses launch routes and the actual Supabase adapters,
database rules, Auth, Storage and server functions. External services are simulated.

The GitHub Pages review and Studio remain separate presentation surfaces.
Work continues on codex/platform-local, based on public main 117997d.
Check the coordination board for Mason's incoming handoff before changing requirements.

## Start

Use Node 22. The pinned Supabase CLI runs natively on Apple silicon macOS 14+
and supported Linux systems. Docker is not required. The CLI native runtime is
experimental; keep its pinned version until a deliberate upgrade is verified.

    npm ci
    npm run dev:platform

Open http://127.0.0.1:5300/ for the Website, /admin for Command Center,
and /partners/sign-in for Partners. There is no Studio/review frame.
First startup downloads the native services; later starts reuse them.
Allow several GB of free space for the services and database.

The command starts the backend, seeds it once, loads the simulator environment,
starts Vite and processes shipping/messages every five seconds. New signups and
password resets use the captured Auth email inbox at http://127.0.0.1:55424/.
No email leaves the machine, so the worker opens each sign-up confirmation link
about three seconds after it arrives, as the recipient would, and the sign-up
screen shows the step finish. Password-reset emails are left for you to open.
Use 127.0.0.1 consistently for the application and email links. The native runtime
uses default Auth email templates; custom template serving is not supported yet.
The branded production templates remain in supabase/templates/.

## Local test accounts

All six initial accounts use this local-only password: TrueMark-local-2026!

| Role | Email | Open |
| --- | --- | --- |
| Owner | owner@truemark.test | /admin |
| Fulfilment staff | staff@truemark.test | /admin |
| Verified researcher | researcher@truemark.test | /access |
| Active partner | partner@truemark.test | /partners/sign-in |
| Pending researcher | pending@truemark.test | /access |
| Second verified researcher | procurement@truemark.test | /access |

These are synthetic local identities. Accounts share the browser's Auth session,
as they do in the real application. Sign out before changing roles, or use separate
browser profiles to view the customer, operator and partner simultaneously.

The initial dataset includes 90 illustrative orders across six months, stock,
reward points, pending/approved referrals, an account application and visit history.
The product artwork and original certificate documents are preserved. Opening
stock, people, order history and program settings are examples, not business facts.
A membership benefit can supersede an equal or smaller promotional offer.

## Try the actual workflows

1. As a researcher, add a product, check out and choose an approved, declined
   or delayed simulated payment. No card details or real charge are needed.
2. As owner, find the same order. The local shipping worker exports it to the
   simulator. Print its simulated label, confirm packing, simulate carrier pickup,
   then simulate delivery. A label never marks the order shipped.
3. View the customer order history, tracking and certificates; inspect Email & SMS
   for rendered simulated notices. Auth messages are captured in the local inbox.
4. Use ALEX10 with a newly approved researcher to follow attribution into Partners.
   Try approval, commission review and recording a sample payout. Recording a payout
   never transfers funds.
5. Edit catalog/settings, submit a contact enquiry, approve the pending application,
   or test rewards/marketing test queues. These edits persist in the local database.

The storefront desk can give built-in answers without AI credentials. Open-ended
AI generation remains an optional provider integration. The full receiving/split-lot
workflow and unified in-app email replies remain development work in the owner
handoff; this setup does not replace those requirements with fake success states.

## Verify, retain and stop

    npm run platform:verify   # creates synthetic acceptance accounts/orders locally
    npm run platform:flush    # process shipping + transactional message queues now
    npm run platform:setup    # start/seed backend without the frontend
    npm run platform:stop     # stop backend while preserving its saved data

Ctrl-C in the dev terminal stops Vite and the worker. The database remains saved.
Running dev:platform again retains edits and does not reseed over them.
Do not delete .local-platform/ to clear caches: it also contains the database.
There is no automatic reset command.

platform:verify exercises real Auth, account approval, denied customer writes,
checkout/stock reservation, signed payment callbacks, partner attribution,
label/packing/shipment/delivery, rendered notices, refund/commission reversal,
declined payment cancellation, contact delivery and catalog persistence.
Its report is .local-platform/verification.json.

.local-platform/ holds the native database, downloads, logs and generated local
simulator keys; Git ignores the entire directory. The setup rejects non-loopback
API/database addresses and strips inherited hosted-provider credentials.
Vite denies serving this directory. Local logs are start.log and functions.log.

## Future production domain

Production uses npm run build:launch with the confirmed hosted public configuration.
It builds the same application with ordinary paths; local-only labels and helpers
do not enter that production build. Domain hosting needs an SPA fallback.
The local setup neither links nor deploys a Supabase project, changes DNS, publishes
Pages, charges money, buys a label or delivers an external message.

Use the owner handoff for production integrations and Mason's business decisions.
