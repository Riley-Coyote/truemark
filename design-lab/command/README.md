# TrueMark command center lab

Run the existing Vite app from the repository root. The current development
instance is at <http://127.0.0.1:5337/design-lab/command/index.html>;
the integrated dashboard starts at <http://127.0.0.1:5337/admin/analytics>.

This isolated lab previews the new command workspaces using fictional TrueMark
fixtures and the existing Poppins/Heros app-kit. It never calls a payment,
shipping, marketing or database mutation. Its planning storage has a separate
namespace from the normal dashboard. It is not included in production routes.

Open **Design lab controls** for three coherent presets, density and chart-size
controls, named saved variations, a live copyable design brief and reset.
Financial assumptions, scenarios, reports and draft controls operate within the
preview. Links to existing product/order/settings screens belong to the real
dashboard and show an explanatory boundary when followed inside this lab.

The reference is RUObuilt’s October 2026 control surface, with TrueMark’s own
visual identity and records. The complete scope and integration boundaries are
in [the coverage map](../../docs/platform/COMMAND-CENTER-COVERAGE.md).

Verification includes desktop and 390 px layouts, saved forecast restoration,
CSV validation/export, campaign draft persistence, provider-safe shipment dry
runs, keyboard-accessible charts and Escape/focus behavior in drawers. Live
provider delivery and physical mobile hardware are outside this local check.

## Connected program scenes

Run `node scripts/preview-programs.mjs` alongside the existing Vite server on
5337. Shared marketing and Shared programs in the lab navigation use the actual
connected components against a throwaway local SQL backend on 5343. Its records
are synthetic, disappear on restart, and never reach Supabase or a provider.
The existing design controls and saved variations still apply. These scenes and
their test transport are private lab utilities, not public app routes.
