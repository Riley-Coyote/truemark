# Staging

A copy of TrueMark anyone can open, with sample data and simulated payments, shipping, email and text messages.
Use it for walkthroughs and to try a change before it reaches the real site. Nothing on staging is real: no card is
charged, no email or text is sent, no label is bought.

| Part | Where |
| --- | --- |
| Website | https://truemark-staging.pages.dev (Cloudflare Pages project `truemark-staging`) |
| Backend | Supabase project **TrueMark Staging**, `ovsulgeumastsrpdzblo`, in the TrueMark Biolabs organization |
| Real site's backend, for contrast | **TrueMark Website**, `gydihnfzmuqmbnykaihg`. Staging tooling refuses it by name. |

Search engines are asked not to index staging.

## Signing in

Staging has the same six sample accounts as the local platform (owner, staff, researcher, partner, pending and
procurement, all `@truemark.test`), with a password of its own, because the local one is published in this
repository and staging is public. It lives with staging's other details in `.local-platform/staging.env` on the Mac
that created staging (Git-ignored, never committed). New research accounts are created without an email
confirmation step, because staging sends no email.

## What was set up, in order

1. The project was created in the TrueMark Biolabs organization (us-west-2), with a generated database password.
2. `supabase link` to it, then `supabase db push`: every migration in `supabase/migrations`.
3. Function secrets (`supabase secrets set --env-file`): `FUNCTIONS_KEY`, `PAYMENTS_SIM_SECRET`,
   `SHIPPING_SIM_SECRET`, `SHIPPING_WEBHOOK_KEY` (random), `SITE_URL=https://truemark-staging.pages.dev` and
   `EMAIL_FROM`. No provider keys: every connection stays simulated.
4. `supabase functions deploy`: assistant, messages, payments, shipping, uploads.
5. Vault entries `tm_functions_url` (`https://<ref>.supabase.co/functions/v1`) and `tm_functions_key` (the same
   `FUNCTIONS_KEY`), so the scheduled jobs reach the functions.
6. Auth settings, pushed with `supabase config push` from a staging-only edit of `supabase/config.toml` (not
   committed): site URL and redirect URLs set to the staging website, email confirmations off, minimum password
   length 10.
7. Sample data: `node --import tsx scripts/staging.mjs seed`. It refuses anything but the project named in
   `.local-platform/staging.env`, and seeds once (a fresh project only).
8. Website: `VITE_REVIEW_SUPABASE_URL=https://<ref>.supabase.co`, `VITE_REVIEW_SUPABASE_ANON_KEY=<public anon key>`,
   `VITE_SITE_ORIGIN=https://truemark-staging.pages.dev`, then `node scripts/build-site.mjs launch` and
   `npx wrangler pages deploy dist/launch --project-name truemark-staging --branch main`.

## Updating staging

- **A website change:** rebuild (step 8) and deploy again. Cloudflare keeps every deployment and can roll back to
  any of them from its dashboard.
- **A database change:** `supabase db push` to staging first, check it there, and only then to the real project
  (after a backup; see [BACKUPS-AND-UNDO.md](BACKUPS-AND-UNDO.md)).
- **Fresh sample data:** easiest is a new staging project and steps 1 to 8 again.

## From staging to the real site

The real site is built the same way (step 8) against the real project, on a host in the owner's own account. His
domain then points at that host: add the domain in the host's dashboard, put the DNS records it shows wherever the
domain is registered, and set the real project's Auth site URL and redirect URLs to the domain.
