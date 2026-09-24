# TrueMark BioLabs design prototype

Public GitHub repository: [Riley-Coyote/truemark](https://github.com/Riley-Coyote/truemark).

GitHub Pages presentation (September 22 version): [riley-coyote.github.io/truemark](https://riley-coyote.github.io/truemark/). In production, the bare site URL opens the client review; `#/` opens the website directly.

A working frontend concept developed from the client's WordPress mockup, with Oath Research as the primary design reference and Fitish as a secondary reference.

The canonical repository is `~/Documents/Repositories/TrueMark`. Both `~/Repositories/TrueMark` and the original `~/Documents/ChatGPT/TrueMark` workspace point to this same folder.

## Preview

The current development server runs at **http://127.0.0.1:5174/review**. This unified client package provides shared navigation to the Website, Landing visuals, and Typography review surfaces. The Website route opens the working prototype; the visual and typography studies remain interactive explorations for comparing directions and contexts.

The homepage is at **http://127.0.0.1:5174/** and the catalog is at **http://127.0.0.1:5174/products**. The individual review routes also remain available at **http://127.0.0.1:5174/visual-study** and **http://127.0.0.1:5174/type-study**.

**September 24 brand refinement:** the current local website integrates the client’s supplied SVG logo, color-coded product imagery, violet ink and gradient accents. Poppins display type is set at a quieter weight alongside Manrope body/UI text, preserving the earlier Quiet modern direction’s restraint. [Design rationale and source decisions](docs/BRAND-REFINEMENT.md). This revision has not been deployed to GitHub Pages. The exploration at **http://127.0.0.1:5174/type-study** preserves Sculptural (Instrument Serif / Manrope), Precise (Bodoni Moda / Manrope), Quiet modern, and the original font pairing for reference. It includes collection, product, documentation, and side-by-side specimens.

**Homepage imagery studies** are at **http://127.0.0.1:5174/visual-study**: Open horizon, Living patterns, Light through glass, and The research object. Each has a full homepage-opening preview; “Compare all” puts them together. These are isolated explorations with original generated assets, not an applied homepage redesign. [Creative intent, asset paths, and prompts](docs/VISUAL-STUDIES.md).

```sh
npm install
npm run dev -- --port 5174
npm run build
```

React, TypeScript, Vite, and React Router. Fonts and generated concept photographs are stored locally. The preview does not depend on the original WordPress site.

## Included

- Homepage, 20-item catalog, eight compound classes, search, sorting, and empty states.
- Product details with real size variants from the source catalog, keyboard-accessible information tabs, and inquiry links.
- Lot lookup with the original mockup's illustrative BP10-2611A record and an unknown-lot state.
- Quality, handling, About, research journal, three editorial drafts, inquiry, and account preview pages.
- Persistent sample bag, quantity editing, removal, and selection review.
- Responsive navigation, focus-managed dialogs, reduced-motion support, and semantic forms.

This is a frontend prototype. Forms do not send messages or authenticate accounts. The bag does not place orders or collect payment. Only BPC-157 10 mg has a sourced price ($100); the other products use an inquiry flow. The displayed certificate is explicitly illustrative.

## Working notes

- [Design direction and content map](docs/DESIGN-NOTES.md)
- [Verification record](docs/VERIFICATION.md)
- [Generated image provenance and prompts](docs/IMAGE-PROVENANCE.md)
- [Deployment notes](docs/DEPLOYMENT.md)
- [Authenticated Oath reference study](reference-study/OATH-PRIMARY-REFERENCE.md)
- [Initial reference analysis](reference-study/REFERENCE-ANALYSIS.md)

The account-protected source product, Handling, and About pages still need inspection once access is available. Those local pages contain proposed structure and copy; they are not reproductions of inaccessible source content. All commercial claims, laboratory records, specifications, prices, legal copy, and final branding require client validation before production.

## Code map

- `src/App.tsx`: page templates, navigation, search, lot lookup, demo forms, and bag state.
- `src/data.ts`: source catalog, compound classes, proposed process copy, FAQs, and editorial drafts.
- `src/styles.css`: original design tokens and components. `src/brand-refinement.css` and `src/BrandLogo.tsx`: the scoped client-brand integration.
- `src/TypeStudy.tsx` and `src/type-study.css`: typography directions and their isolated comparison surface, loaded only on `/type-study`.
- `src/VisualStudy.tsx` and `src/visual-study.css`: homepage image compositions and their responsive comparison surface, loaded only on `/visual-study`.
- `public/images/products/`: the client’s individual labeled vial renders, copied unchanged.
- `public/images/brand/`: original SVG marks and a generated homepage group composition. Earlier concept imagery remains available for the studies.

Production builds use hash-based routes so the static `dist/` directory works
from the GitHub Pages project path without server-side rewrites. See the
[deployment notes](docs/DEPLOYMENT.md) for the manual publishing workflow and
local production preview. Production service integrations remain outside this
preview.
