# Accounts, ownership and remaining transfer work

No passwords, service keys, database connection passwords or private account recovery data belong in Git, this checklist, or a Codex chat. Enter credentials in the service's own sign-in/secret settings. Browser-visible Supabase publishable/anon keys are different from privileged service-role/secret keys.

## Required ownership

| Resource | Known target | What the client needs | Current handoff status |
| --- | --- | --- | --- |
| Codex | Native desktop app on the client's computer | Own account and usable subscription; permission to work in this project folder | Client setup not verified |
| GitHub | `Riley-Coyote/truemark`, currently public | Prefer repository transfer to client/organization; client controls admin, billing and Actions. Collaborator access can provide immediate access while transfer is arranged. | Riley reports Mason accepted the collaborator invitation on 16 October; effective role and client-machine access still need verification. Ownership transfer deferred. |
| Supabase | `gydihnfzmuqmbnykaihg`, TrueMark Website, us-west-2 | Own Supabase account. Owner access in a client-controlled organization, or initially an appropriate membership in the existing organization | Riley reports Mason accepted the Owner invitation for TrueMark Biolabs on 16 October; effective access on his machine still needs verification. Existing project retained. |
| TrueMark application | Owner account in the existing project's Auth/profile model | App owner role, independent of Supabase organization membership | Verify actual user and role; do not assume a Supabase Owner is automatically a TrueMark owner |
| Hosting | Current GitHub Pages site at `https://riley-coyote.github.io/truemark/` | Control of deploy workflow, repository configuration and chosen production hosting | Pages exists; final production host/domain setup remains open |
| Domain/DNS | `truemarkbiolabs.com` in project launch notes | Registrar/DNS account, renewal billing, DNS edit access | Owner/provider and apex-versus-www choice not verified |
| Shipping | ShipStation | Client-owned account, account administrator, integration credentials/webhooks and printer setup | Real integration credentials not observed in hosted secret names; label printing is through ShipStation |
| Payments | Provider to be finalized with client/specialist | Merchant account, settlement/billing ownership, API/webhook setup | Simulator foundation exists; production processor readiness unverified |
| Support email | Business sending identities and possibly Gmail | Mailbox/domain administrator, verified send-as identities, OAuth/forwarding configuration | Exact mailbox, addresses, routing and reply synchronization undecided |
| Marketing / transactional email | Existing adapters; Omnisend mentioned in previous project notes | Confirm chosen provider, account ownership, eligibility and actual integration | Do not activate a legacy adapter merely because code exists; recorded marketing transport is simulated |
| Storefront AI | Existing OpenRouter-backed assistant | Client-owned provider billing and server-side credential | `OPENROUTER_API_KEY` name exists; account/billing ownership unverified. Separate from the client's Codex subscription. |
| Native Ghost (optional) | Existing Mac app | Source/resource delivery; own Apple Developer signing for future distributed builds | Optional, not a prerequisite to using native Codex; cloud submission previously unverified |

## Supabase: retain the existing project

Project dashboard: <https://supabase.com/dashboard/project/gydihnfzmuqmbnykaihg>

Project URL: `https://gydihnfzmuqmbnykaihg.supabase.co`

The current organization identifier observed on 16 October is `hvwkmxhpwbxuudoghprs`. Do not give the client organization-wide ownership if that organization contains unrelated Riley resources. Prefer transferring **this project** into an organization the client owns. Supabase requires the source organization owner and appropriate target organization membership; check current transfer eligibility and billing before initiating. Keeping this project avoids a new-project data/Auth/storage migration. A transfer still requires a post-transfer check of integrations and access.

Mason has already accepted the reported Owner invitation. Authenticate his Codex through his account and verify its effective project access. Full independent ownership also requires billing and recovery control, not just an API credential.

After delivery, configure the supplied `.codex/config.toml` (or add the same project-scoped server in Codex settings):

```toml
[mcp_servers.truemark_supabase]
url = "https://mcp.supabase.com/mcp?project_ref=gydihnfzmuqmbnykaihg"
```

Complete the OAuth login in Codex; if using the CLI, run `codex mcp login truemark_supabase`. Trust this project folder when Codex asks so its project configuration can load. The connection intentionally permits writes allowed by the signed-in account; it is not configured read-only. Verify the project ID and inspect schema/migration state before changing it. OAuth does not grant membership in a project the account cannot already access.

For deployment, use the Supabase CLI on the client's machine, sign in with their account, initialize local CLI configuration if absent, and link to this exact project. Keep CLI auth and database passwords out of repository files. MCP access, CLI access and application login are separate checks.

## Repository transfer and publication details

Current decision: keep the repository under Riley for now and add the client as a contributor. Transfer ownership later when the client is ready.

Before transferring, inventory Actions variables, environments, integrations, releases and current Pages settings. GitHub repository URLs normally redirect after transfer, but the old GitHub Pages site URL does not. Update the Pages location, any custom domain, public links, Supabase Auth site/redirect URLs and webhook endpoints as applicable.

`scripts/studio-release.json` and `scripts/install-studio.mjs` currently pin/allowlist Riley's release URL. Update both together when releases move, preserving the asset checksum. Check native installer/download links as well. Existing publication automation rebuilds historical presentation material from repository refs; a source snapshot without history cannot run it unchanged. See OPERATIONS.md.

Keep the current public repository's history separate from Riley's private development history. Do not run `git push --mirror` from the private checkout. The older `scripts/package-handoff.py` bundles **all private Git history** and is not the public owner-source exporter.

## Materials outside the source snapshot

These are outstanding delivery items, not hidden dependencies for the storefront's normal `npm run build`:

- Editable Studio: `design-lab/universe/`, its resources, and the pinned compiled release. Historical reconstruction scripts depend on older Git refs/worktrees; document or replace that dependency before claiming a full Studio rebuild works on the client's machine.
- Original image library: `design-photography/` with INDEX/manifest/relocation maps; current website assets are already in `public/`. This library is intentionally ignored by Git. Transfer it privately as a separate asset package.
- Client originals: approved artwork and certificates under `docs/client-documents/`, delivered privately with their provenance. Do not publish the entire private evidence archive.
- Native Ghost: `agent/` source, resources, tests and packaging instructions, excluding build artifacts, local accounts and runtime memory. Native Codex is the recommended immediate workflow.

If the client wants every historical exploration, arrange a private archival delivery after checking it for credentials and unrelated personal material. This is separate from publishing maintainable application source.

## Final access trial

- [x] GitHub collaborator and Supabase Owner invitations accepted, as reported by Riley on 16 October.
- [ ] Client clones and verifies GitHub contribution access using their own login; ownership transfer remains deferred.
- [ ] Codex can read this Supabase project's schema through the client's OAuth session.
- [ ] Client controls Supabase organization/billing or has an agreed transfer completion date.
- [ ] Client logs into TrueMark as an application owner.
- [ ] Fresh checkout installs, runs and passes the portable checks.
- [ ] Client authorizes a small change; their Codex builds, previews and commits it.
- [ ] Deployment and rollback succeed through client-controlled accounts.
- [ ] Domain, email, ShipStation, payments and AI provider ownership are recorded, including unresolved integrations.
- [ ] Separate Studio/assets/Ghost deliveries are completed or explicitly deferred by the client.
- [ ] After access is proven, the owner decides whether to remove Riley's membership and rotate shared provider credentials.

Official setup references: [Supabase MCP](https://supabase.com/docs/guides/ai-tools/mcp), [project transfer](https://supabase.com/docs/guides/platform/project-transfer), [organization roles](https://supabase.com/docs/guides/platform/access-control), [GitHub repository transfers](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository), [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp).
