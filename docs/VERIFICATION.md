# Prototype verification

Browser review performed September 22, 2026 using the local running application.

## Confirmed interactions

- Catalog starts with 24 entries. Neuropeptide filtering returns Semax, Selank and DSIP. Search has a no-match state and reset restores all 24.
- Sort control updates the URL and selected option. Global search for MOTS returns three presentations and keeps input focus while results update.
- BPC-157 detail opens, specifications change on click, and arrow-key navigation selects the next information tab. Tab identifiers and roving focus are implemented.
- Adding two BPC-157 units gives a $200 subtotal. Decreasing to one gives $100. Selection review explicitly stops before ordering. The bag persists across reload. Removal produces the empty state. Test selection was cleared afterward.
- BP10-2611A displays the illustrative record. An unknown lot shows a no-match explanation. Query changes synchronize the input with the selected record.
- A non-priced compound's inquiry link prefills the compound and presentation.
- Sample inquiry fields reach a local confirmation that nothing was sent. Sample account access reaches a confirmation that no authentication or account creation occurred.
- Mobile navigation opens and closes through a destination link. Search and bag dialogs close with Escape. FAQ disclosure expands.
- No warning or error console entries were observed during the interaction review.

## Visual and responsive checks

Visually inspected catalog, product detail, homepage, quality, handling, About, journal, certificate, mobile navigation, and contact layouts. Desktop review included a measured 1440-pixel CSS viewport. Phone review included 390 × 844, plus narrower product checks around 300–333 pixels.

All ten main page types passed the final 390 × 844 horizontal-overflow check. Measurements are stored in `screenshots/responsive-checks.json`.

The browser's zoom affected its initial screenshot export dimensions. Later captures use the browser's CDP screenshot capability for accurate visible output. Initial screenshots 01–04 are working observations; the later captures reflect subsequent refinements. Screenshots are evidence of specific views, not a substitute for a full accessibility or cross-browser audit.

Refinements from review: larger secondary labels, local italic font loading, stable search focus, continuous product photography, long-title wrapping, valid tab relationships, and quantity-dependent bag labels.

## Build and limits

`npm run build` runs the strict TypeScript check and production Vite build. The final build passes.

No production checkout, message delivery, account service, real certificate service, or WordPress integration is connected. No external form or purchase was submitted. Protected source pages remain unverified pending account access. A comprehensive screen-reader, contrast, and cross-browser audit remains production work.
