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

## Typography exploration — September 22, 2026

Added an isolated `/type-study` route with three directions, collection/product/documentation specimens, an original-pairing reference, and a side-by-side comparison. No direction has been applied to the storefront.

- Inspected all three type families in the browser. Chrome's rendered-font report confirmed Instrument Serif, Bodoni Moda, and Manrope are custom loaded fonts rather than fallbacks.
- Visually reviewed the desktop comparison, collection, product, and certificate compositions. Checked mobile collection and documentation at 390 × 844, plus documentation/comparison overflow at 320 × 844. Refined the mobile display scale so the two collection statements each fit a line at 390 pixels.
- Verified direction and scene switching, comparison-to-context navigation, and the original-pairing toggle returning to the previously selected direction. Keyboard Tab moves between controls with a visible focus outline.
- Navigated back to `/products` and confirmed its heading still uses Newsreader and the study component is absent. The additional study styles are scoped, and its fonts and component load through a separate route chunk.
- Kept the lazy route component outside the root bootstrap to avoid a duplicate-root warning during Vite hot refresh. A fresh reload and final navigation check produced no new browser warnings or errors.
- Strict TypeScript and the production build pass. Screenshot: `screenshots/typography-comparison.png`.

## Quiet modern applied — September 22, 2026

Riley selected Quiet modern. Applied locally bundled Manrope throughout the storefront, including the wordmark, display headings, body copy, navigation, forms, and technical records. Removed decorative italic headline treatment, adjusted display proportions and responsive scales, enlarged supporting text, and added tabular numerals where figures need stable alignment. Alternative font families now load only with the study route; that route defaults to Quiet modern and preserves the initial pairing for reference.

- Inspected the homepage, catalog, product detail, journal, article, certificate, and search dialog in the browser. Checked 13 mobile routes at 390 pixels and 11 desktop routes at 1440 pixels for horizontal overflow and clipped headings, paragraphs, and controls. The only clipped label was the intentionally screen-reader-only lot label.
- Checked catalog, long product names, and the certificate at 320 pixels. Refined certificate column sizing and textual result sizes to fit inside the panel. Product categories now use the full card width above the name/price row, avoiding price-dependent wrapping.
- Confirmed search for MOTS displays its three presentations, Escape closes the dialog, and focus returns to the search control. No browser warnings or errors were recorded during review.
- TypeScript and the production build pass. Evidence: `screenshots/quiet-modern-catalog.png` and `screenshots/quiet-modern-checks.json`.

The generated packaging photographs still contain the earlier concept wordmark. The selected website typography is implemented as live text; packaging artwork requires a separate asset revision.

## Homepage imagery exploration — September 22, 2026

Added an isolated, lazy-loaded `/visual-study` route with four original generated images, full opening compositions, URL-preserved direction/view controls, and a two-column comparison that becomes one column on phones. The current storefront remains unchanged.

- Visually reviewed all four desktop compositions and the comparison. Adjusted opening height for a short desktop window so the main action is visible.
- Checked all four directions at a 390 × 844 CSS viewport: assets loaded, headline and primary action fit, and no horizontal page overflow. Visually reviewed coastal imagery at a narrower 333-pixel viewport, plus water and product compositions at 390 pixels.
- Checked comparison layout at 390 and 320 CSS pixels with no horizontal overflow; no overflowing headings, paragraphs, or buttons in the 390-pixel comparison.
- Confirmed direction switching, comparison-card-to-preview navigation, URL updates, and the primary catalog link. Catalog navigation removes the study component. No browser errors or warnings were reported.
- Temporary viewport overrides were reset after review. These are static imagery studies; no motion treatment has been selected or implemented.
- Keyboard Tab moves between the direction controls with a visible focus outline. Strict TypeScript and the production build pass.

## Clear-liquid vial correction — September 22, 2026

Riley clarified that the prototype should depict transparent fluid. Edited the three shared powder-containing photographs in place: hero still life, catalog vial, and sculptural object study. The glass macro had no visible powder and was retained. All consumers share these paths, including search, catalog cards, product detail, bag, quality, About, access, and the typography/visual studies. Six source presentation labels now say “Clear liquid”; quantities and illustrative certificate values remain unchanged.

- Parent visually approved the generated edits and inspected the live homepage, product detail, and object study after integration. Composition, labels, and lighting were preserved; no visible powder remains in those assets.
- Sol handled scoped copy changes, asset copying, and build checks. Terra audited asset consumers and documented provenance. Parent retained creative direction and visual judgment.
- No powder/lyophilized wording remains in active source. Original prompts and screenshots remain historical records. Liquid fill levels are illustrative, not product specifications.
- Production build and `git diff --check` pass. No layout or interaction changes were introduced.
