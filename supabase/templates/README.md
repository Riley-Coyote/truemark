# TrueMark Auth emails

In Supabase Authentication → Email Templates:

- **Confirm signup**: subject `Confirm your email for TrueMark`; paste `confirm-signup.html` into the Body field.
- **Reset password**: subject `Reset your TrueMark password`; paste `reset-password.html` into the Body field.

Authentication → URL Configuration → Site URL must be the chosen deployment root,
with its trailing slash. The existing review uses `https://riley-coyote.github.io/truemark/live/`;
production will use `https://truemarkbiolabs.com/` or its `www` counterpart after the canonical
host is chosen. Allow that same root as a redirect URL. Do not change hosted settings during
local preparation.

These templates are delivered by Supabase Auth's separately configured SMTP service;
the application's message outbox does not deliver them. A Resend application adapter does
not mean Auth SMTP has been connected. Resend's policy currently prohibits RUO product content,
so it is not the selected production sender. Verify the eventual provider accepts the actual
business and supports the Auth delivery path before activation.

Run `npm run preview:messages` to render these and the application messages using synthetic data
in `dist/message-preview/`. The generator reads no credentials and sends nothing.

These links carry one-time token hashes. They work in another browser without a PKCE verifier. The existing `?code=` path remains supported.
