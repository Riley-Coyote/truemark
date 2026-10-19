# TrueMark working platform

Read [the owner handoff](docs/owner-handoff/START_HERE.md) and its current decisions first.

## Ongoing local development — 18 October 2026

Riley requested the actual application as the continuing workspace for the future
production domain. Work on **codex/platform-local**, based on public main, and use
[the local platform guide](docs/platform/LOCAL-DEVELOPMENT.md).

Run `npm run dev:platform`. The Website, Partners and Command Center run at
http://127.0.0.1:5300 with launch routes and native local Supabase. Docker is not required.
The real account/database/function flows use synthetic local records and simulated
external services. Review and Studio remain separate presentation surfaces.

Check BOARD.md and the incoming owner handoff for Mason's latest requirements.
Preserve the older private checkout; never publish its history wholesale.
