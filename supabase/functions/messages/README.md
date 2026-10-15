# Messages

Deploy with gateway JWT verification **off** (`--no-verify-jwt`). `/flush` verifies the functions key; `/sms/inbound` verifies Twilio's signature. All configuration is supplied by the function environment, as listed in ROUND-12. No credentials belong in the application or repository.

The local SQL and Node proofs use only fixtures. Simulated email/text never calls a provider. Email HTML and text bodies are stored in the outbox for team review.

Production sender selection is pending. The existing Resend adapter is a technical implementation,
not permission to use that provider: its current acceptable-use policy excludes RUO product content.
Do not activate it for this catalog. Omnisend eligibility and its delivery role are also unconfirmed.
Auth confirmation/reset delivery is configured separately through Supabase Auth.

Set `SITE_URL` to the full HTTPS deployment root (HTTP is allowed only for local loopback). A
trailing slash is normalized; credentials, queries and fragments are refused before rendering.
The worker claims one row at a time, stops starting more rows after 40 seconds (or 200 rows),
and leaves at least 45 seconds on the two-minute lease before sending. Provider requests time
out after 15 seconds. A later cron invocation resumes remaining rows. These limits do not supply
provider-side idempotency: accepted sends with lost acknowledgements still need reconciliation
in the selected production transport.

Run `npm run preview:messages` for local HTML/plain-text proofs using synthetic data only.
