# TrueMark design guide

Use this guide when changing the interface. It describes the existing project, not a new visual direction. Mason's current request and the approved product artwork govern the work. Read the owner handoff for operational requirements.

## Preserve the identity already in the code

The current platform tokens use Poppins for brand/display text and TeX Gyre Heros for information, with violet brand ink and carefully graded light/dark surfaces. Command Center supports purple, dark, light and system appearance; purple is the current default. These are verified implementation facts, not a claim that every historical design choice is permanently approved.

Start with the relevant running screen and its components. Reuse tokens, typography, spacing, buttons, drawers, tables, status labels and motion. Avoid importing a generic dashboard aesthetic, substituting Riley's personal preferences for TrueMark's brand, or redesigning unaffected screens.

| Concern | Source |
| --- | --- |
| Platform color/type/spacing tokens | `src/shop/tokens.css` |
| Shared controls, tables, drawers and shell | `src/app-kit/` |
| Command Center styles and appearance choices | `src/admin/admin.css`, `src/admin/appearance.tsx` |
| Business tools and financial displays | `src/admin/intelligence/` |
| Editable Command Center design lab | `design-lab/command/` |
| Product imagery already used by the application | `public/`, and imported assets referenced by the relevant component |

Original brand documents, editable Studio and historical photography are separate delivery items. Missing archives do not authorize recreating client labels or replacing approved artwork. Historical palettes and prototype briefs are context, not current instructions.

## Make daily work obvious

For orders, shipping and stock receiving, show the operator what they have, the next useful action, and the result of that action. Preserve context when opening drawers. Prefer clear verbs over internal state names. Keep products, quantities and lot identifiers legible; show exceptions where staff can act on them.

Do not hide incomplete integrations behind a polished success state. A printed label is not shipment. A certificate upload is not batch approval. A saved draft is not an email sent. Show sample data, estimates, errors and missing inputs honestly. Financial scenarios must show their assumptions and must not resemble guaranteed returns.

## Preview and verify

For substantial visual alternatives, reuse the Command Center lab and let Mason compare a small number of coherent directions. The lab already has controls, presets, saved variations and a copyable brief. Do not copy Riley's machine-local skills as a dependency. For another surface, isolate the relevant experiment within this repository when needed. Small fixes to an agreed direction can go directly into the component; do not restart a design-selection process for routine corrections.

For visual work, run the app and inspect the changed state in an available browser. Check desktop and a narrow viewport, keyboard navigation/focus, labels, contrast, overflow, loading/empty/error states and affected appearance modes. Respect reduced motion. Keep product text useful to the operator rather than exposing implementation details.

Show Mason what changed and why it helps his task. Keep the preview running. Record the selected direction and verification in the project notes. If browser inspection is unavailable, state that visual verification remains pending rather than calling the result visually verified.
