# TrueMark design direction

September 22, 2026. This is a proposed direction for review, not a finalized brand identity.

## The idea

**Research, with a record.** Build the experience around the connection between compound, lot, documentation, and a research organization's next action. The client mockup already supplies a useful information architecture. Its arbitrary colors and placeholder identity are not design constraints.

Oath is the primary reference: disciplined space, quiet product presentation, tactile cream packaging, short statements, and a clear relationship between commerce and evidence. The new TrueMark concept translates that restraint into an original serif identity and a consistent documentation experience. Fitish contributes approachable navigation and product-led merchandising. Neither reference's assets or identity are copied into the application.

## Visual system

- Warm white page surfaces and neutral ink; subtle stone-colored dividers and panels.
- Newsreader for the proposed wordmark and display type; DM Sans for controls and reading text. Both are locally bundled.
- Photography with ivory labels, clear glass, black caps, and natural shadows. Product information remains selectable text outside the images.
- Consistent rounded photographic panels, restrained rules, a centered wordmark, and compact navigation.
- Four-column desktop and two-column phone catalogs. The mobile class filter scrolls horizontally within its own region.
- Short transitions for drawers, product hover, and content appearance, with a reduced-motion alternative.

## Source walkthrough and fidelity

| Step | Source inspected                  | Health / evidence                                                                                      | Result in the prototype                                                                                                                                               |
| ---- | --------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Products                          | Viewed after the entry screen was cleared; captured `reference-study/client-prototype/01-products.png` | Preserved 24 product presentations and eight classes. Replaced the visual system and browsing controls.                                                               |
| 2    | Homepage                          | Public content inspected and captured in `02-home.png`                                                 | Retained research-only positioning and the lot-to-documentation concept. Proposed new hierarchy and copy.                                                             |
| 3    | Verify                            | Public form and sample identifier inspected; `03-verify.png`                                           | Built a usable sample lookup and explicit no-match state. The original lookup's returned result was not verified. Sample result values came from the source homepage. |
| 4    | Quality                           | Public process and release framework inspected; `04-quality.png`                                       | Reorganized source, receipt/quarantine, independent testing, review/release, and storage into a readable sequence.                                                    |
| 5    | Product details, Handling, About  | Source redirected to account access                                                                    | Proposed local page templates and draft content. No claim to have inspected protected source content.                                                                 |
| 6    | Journal, contact, account and bag | Source navigation indicates these concepts; no complete source flow verified                           | Working local demonstrations, with clear confirmation boundaries.                                                                                                     |

The source public text suggests account-free lot verification while its account screen says accounts control access to certificates. The prototype lets users explore verification publicly. The client should resolve the intended access policy before backend integration.

## Page and interaction map

| Page             | Purpose                                          | Working interactions                                                             |
| ---------------- | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| Home             | Introduce the promise and collection             | Featured products, quality and verification links, journal links, FAQ            |
| Compounds        | Browse the source catalog                        | Class filters, name/size search, sort, reset, empty state, URL-preserved filters |
| Product          | Understand a selected presentation               | Size variants, information tabs, sample purchase or inquiry, related compounds   |
| Verify           | Connect a lot to a record                        | Known sample, unknown identifier, guide and compound links                       |
| Our standard     | Explain the documentation process                | Five process stages, source release framework, verification entry                |
| Handling         | Organize receiving and documentation information | Section links and support routes                                                 |
| About            | Explain the proposed brand premise               | Quality, collection, and inquiry navigation                                      |
| Journal          | Provide readable supporting content              | Three original draft notes and links to applicable tasks                         |
| Contact          | Preview a research inquiry                       | Required fields, compound context, local confirmation                            |
| Research account | Demonstrate access UX                            | Sign-in and request-access modes, sample-only confirmation                       |
| Bag              | Review selected materials                        | Quantity, removal, persistence, subtotal, demo review                            |

## Content boundaries

The BP10-2611A record uses the original mockup's BPC-157 10 mg sample: HPLC 99.31%, identity confirmed, endotoxin below 0.25 EU/mg, sterility pass, and reference TM-COA-0114. The page explicitly labels these as illustrative values. No real CoA PDF, lab identity, date, or independent verification is invented. Inconsistent source dates were not carried over.

Only BPC-157 10 mg showed an explicit source price of $100. Other prices are not fabricated. Product specifications beyond source name, size, class, presentation and research-only purpose need client data.

The imagery is an original generated packaging concept. The generic catalog vial is temporary and should be replaced by approved SKU photography, especially for laboratory supplies. Article copy, About copy, and handling text are proposed editorial content; no clinical efficacy claims or human-use instructions are added.

## Next decisions for the client review

1. Confirm the proposed identity, typography, photography direction, and tone.
2. Validate the catalog, prices, lot records, testing claims, institutional eligibility, and public-versus-account access rules.
3. Inspect the protected source pages to reconcile missing functional requirements.
4. Choose the production commerce/authentication/content implementation and connect approved assets and data.

The current deliverable is ready for visual and interaction feedback without requiring those production decisions first.
