# Company account setup

This guide prepares a consistent experience in Mason's company ChatGPT account and its Codex workspace. The repository configuration is ready to use after pulling it. Account preferences and sign-ins must be applied from the company's own authenticated session; this handoff does not change them remotely.

## The useful layers

| Layer | Purpose | Where it lives |
| --- | --- | --- |
| ChatGPT custom instructions | A consistent communication style for company conversations | Company's ChatGPT settings |
| A TrueMark ChatGPT project | Business planning, questions, writing and relevant reference documents | Company's ChatGPT project |
| Codex repository instructions | Project facts, authority, working style, design and verification | Root `AGENTS.md` and linked handoff |
| Two focused project skills | Turn operations requests into working behavior; coordinate across workspaces | `.agents/skills/` in this repository |
| Shared coordination board | Specific engineering questions and handoffs | GitHub Issues, described in `BOARD.md` |

Keep operational facts and code state in the repository. A ChatGPT project or uploaded document does not automatically track Git changes, and a shared company login does not connect two separate Codex conversations. Do not rely on ChatGPT personalization as a replacement for the repo's instructions.

## ChatGPT communication preferences

In ChatGPT, open Settings → Personalization → Custom Instructions and enable customization. Paste the following text, then adapt it to Mason's preference. This is a suggested starting point, not an account setting already applied. [Official custom-instructions guidance](https://help.openai.com/en/articles/8096356-chatgpt-custom-instructions).

```text
This account is for TrueMark BioLabs. Mason is the primary business decision-maker, but do not assume every colleague using a conversation is Mason. Riley helped develop the platform; the goal is to continue independently.

Treat us as capable business people without assuming developer vocabulary. Lead with the practical answer, use ordinary language, and explain unfamiliar terms briefly. Keep everyday responses concise, but go deeper when asked. Be warm, direct and candid, without hype or talking down to us.

Recommend a sensible next step. Use concrete examples for costs, stock, orders and customer workflows. Ask one relevant question at a time instead of giving us a long questionnaire. Handle technical investigation yourself when tools and access permit. Distinguish known facts, assumptions, estimates, previews and verified live behavior. Do not claim to remember another chat or access an account unless that context is actually available. Never ask us to paste passwords or secret keys into chat.
```

## Optional TrueMark business project in ChatGPT

Create a project named **TrueMark** for ongoing planning and company writing. Add current copies of START_HERE.md, WORKING_WITH_MASON.md, CURRENT_STATE.md and SESSION_NOTES.md from `docs/owner-handoff/` when useful. Refresh those copies after substantial changes; uploads are snapshots. Use the repository checkout for actual development.

Project instructions can hold the following brief. They apply within that project and override global custom instructions, so preserve the communication style here too. [Official project guidance](https://help.openai.com/en/articles/10169521-projects-in-chatgpt).

```text
Help us operate and develop TrueMark BioLabs. Read the available project context before asking us to repeat background. Explain outcomes simply, respect our business expertise, recommend a useful next step, and introduce decisions one at a time. Ask for a concrete example when business details are missing.

TrueMark includes a storefront, research accounts, lot certificates, a partner portal and an owner Command Center. Daily staff workflows should work without a developer or AI assistant. Mason directs product decisions; Riley is not a required intermediary. Preserve the approved brand and research-use language.

Use the newest verified source for implementation status. Uploaded documents may be stale. Distinguish business suggestions from approved decisions and sample demonstrations from real operations. When a request needs repository or service access, use available authenticated tools or explain the specific access needed. Do not pretend a planning conversation has changed the application. Keep decisions in a concise handoff for the repository when development needs to act on them.
```

## Codex on Mason's machine

Pull the latest repository, open its root in Codex, and ask it to read the owner handoff. Root AGENTS.md supplies the working approach. The two project skills are:

- **TrueMark workflow** (`truemark-workflow`): develop or assess an operating workflow using a concrete business example and relevant checks.
- **TrueMark coordination** (`truemark-coordination`): read shared project context and prepare an accurate cross-workspace note. Sending still requires human authorization.

Codex discovers repository skills under `.agents/skills`. If they do not appear, check that the folder is present in the current checkout and restart Codex if needed. Explicit invocation is also possible by naming the skill. This follows [the official skill documentation](https://learn.chatgpt.com/docs/build-skills). These skills have no external package dependency and do not change global skills or permissions.

Have Codex verify the existing GitHub and project-scoped Supabase connections using Mason's own sign-in, following ACCESS.md. Check the separate TrueMark application-owner login. Use whichever browser/voice tools are actually available in his installation; do not install Riley's full plugin collection or assume his machine's tools exist here. Add a new plugin only when a real task needs a capability the existing tools lack.

A practical first trial: open the sample Shipping Desk, explain one order's next step, make a small change Mason requests, show it, and record what changed. Then check that a new chat can read the continuation notes and pick up the task. A successful trial is better evidence than a long list of installed skills.

## Coordination readiness

GitHub Issues is enabled. The **Codex coordination** issue template and BOARD.md define how the workspaces can exchange authorized, publishable project notes. No welcome message, issue, comment, auto-reply or scheduled monitor is created by this setup. The repository is public; confidential questions need an agreed private channel.

For example, Mason can say: “Ask Riley's Codex whether the shipping migration has been deployed, using the project board.” His Codex should inspect the recorded state, post only the necessary authorized question, and return its link. Riley's Codex reads it when working on the project or when asked to check the board; it does not wake automatically. Any reply requires authorization in the responding workspace too.

When either person wants recurring checks or a broader standing exchange, define that scope explicitly in each account. This is optional and is not required for Mason to continue building independently.
