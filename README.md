# TrueMark Biolabs design prototype

A working frontend concept developed from the client's WordPress mockup, with Oath Research as the primary design reference and Fitish as a secondary reference.

The canonical repository is `~/Documents/Repositories/TrueMark`. Both `~/Repositories/TrueMark` and the original `~/Documents/ChatGPT/TrueMark` workspace point to this same folder.

## Preview

The current development server runs at **http://127.0.0.1:5174/products**. The homepage is at **http://127.0.0.1:5174/**.

```sh
npm install
npm run dev -- --port 5174
npm run build
```

React, TypeScript, Vite, and React Router. Fonts and generated concept photographs are stored locally. The preview does not depend on the original WordPress site.

## Included

- Homepage, 24-item catalog, eight compound classes, search, sorting, and empty states.
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
- [Authenticated Oath reference study](reference-study/OATH-PRIMARY-REFERENCE.md)
- [Initial reference analysis](reference-study/REFERENCE-ANALYSIS.md)

The account-protected source product, Handling, and About pages still need inspection once access is available. Those local pages contain proposed structure and copy; they are not reproductions of inaccessible source content. All commercial claims, laboratory records, specifications, prices, legal copy, and final branding require client validation before production.

## Code map

- `src/App.tsx`: page templates, navigation, search, lot lookup, demo forms, and bag state.
- `src/data.ts`: source catalog, compound classes, proposed process copy, FAQs, and editorial drafts.
- `src/styles.css`: shared design tokens, components, responsive layouts, and reduced-motion behavior.
- `public/images/`: generated packaging concepts, not photographs of actual inventory.

For deployment, serve the production `dist/` directory with a fallback to `index.html` for client-side routes. Production service integrations and deployment are outside this preview.
