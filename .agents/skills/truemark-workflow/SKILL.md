---
name: truemark-workflow
description: Translate a TrueMark operations request into a concrete business example and implement or assess the workflow. Use for shipping, lot receiving, communications or financial scenarios; not general company writing or unrelated coding.
---

# TrueMark operating workflow

Read the repository's `docs/owner-handoff/WORKING_WITH_MASON.md` and current `SESSION_NOTES.md` before asking for requirements. Use the Command Center implementation plan for the relevant domain, not as a questionnaire.

1. Identify the operator, starting state, requested action and observable result. Use a small concrete example: an order of five units split two from one lot and three from the next. Distinguish agreed behavior from an assumption.
2. Inspect the existing route, component, data adapter, server operation and database rules that support it. Mark each as present, connected, simulated or unverified. Do not infer production readiness from a demo.
3. Resolve engineering choices yourself. Ask Mason only for the business fact that changes the next implementation decision, in ordinary language. Continue independent work while awaiting that fact; do not invent lot counts, cost inputs or permissions.
4. Implement the authorized scope with the existing components. For visual work read `DESIGN.md` and reuse the lab when exploring a substantial new direction.
5. Verify the example and the failure paths appropriate to the change: duplicate events, cancelled orders, split-lot quantities, denied staff access, delivery failure or missing costs. Keep customer/order financial totals consistent. Select tests from `OPERATIONS.md` and the domain plan; do not activate a real provider for a local test.
6. Show the result and explain its practical effect. State local/test/deployed status. Record the decision and evidence in SESSION_NOTES.md. Any outstanding publication or production authorization remains separate.

Non-obvious invariants: label creation is not shipment; quarantine is not sellable stock; a product can need multiple lot allocations; drafts are not sends; refunds do not prove physical returns; inventory sell-through is a scenario, not a timed revenue prediction. Preserve these distinctions in both data and UI.
