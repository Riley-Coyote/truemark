# TrueMark Auth emails

In Supabase Authentication → Email Templates:

- **Confirm signup**: subject `Confirm your email for TrueMark`; paste `confirm-signup.html` into the Body field.
- **Reset password**: subject `Reset your TrueMark password`; paste `reset-password.html` into the Body field.

Authentication → URL Configuration → Site URL must be the live root:
`https://riley-coyote.github.io/truemark/live/`.

These links carry one-time token hashes. They work in another browser without a PKCE verifier. The existing `?code=` path remains supported.
