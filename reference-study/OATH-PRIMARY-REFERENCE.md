# Oath Research — primary design reference

Live authenticated inspection in Riley's Comet browser, September 22, 2026. This supersedes the earlier gate-only interpretation of Oath. Riley explicitly identified Oath as the favorite and principal reference; Fitish is secondary. This document records observations and design interpretations for the forthcoming client prototype, not a final client specification.

**The essential character**

Oath feels composed, tangible, and assured. Its identity comes from the relationship between cream packaging, black serif branding, restrained interface typography, generous spacing, and consistent photography. The company name acts as a promise; the interface repeatedly connects that promise to sourcing, testing, fulfillment, and support. The strongest transferable idea is that confidence is established through consistency and accessible evidence.

There are two related visual modes. The homepage and shop use a quiet, utilitarian sans-serif system. The certificate library introduces a more expressive serif system, warm ivory, fine gold details, and structured scientific records. The login screen alone did not reveal this distinction. The client direction should deliberately reconcile these modes into one coherent system.

**Inspection coverage and general health**

| Step | Walkthrough | General health and observation |
|---|---|---|
| 1 | Homepage, service panels, product grid, footer | Strong composition and asset consistency. Some gray supporting text is faint. |
| 2 | Shop and inline filtering | Clear four-column desktop grid. Expanded filters and verified a maximum-price filter; the result set and active filter changed. Public-facing taxonomy could be more useful. |
| 3 | BPC-157 product detail | Strong product presentation. Changed 5mg to 10mg and verified price and quantity-discount tiers updated. Technical introductory copy is lengthy. |
| 4 | Product information tabs | Description and Additional information switch successfully. Evidence, explanation, specifications, and related products occupy separate regions. |
| 5 | Certificate library and search | Strong editorial presentation. Searching BPC-157 narrowed 44 products to four, including blends, with a visible result count. |
| 6 | Individual certificate | Clear summary, sample table, analysis, document area, test history, and navigation. The embedded PDF area appeared blank during this pass; the full-document links were present. |
| 7 | About and FAQs | Consistent neutral foundation. About has strong environmental photography; FAQs are a long text document with limited local navigation. |
| 8 | Narrow layouts and mobile navigation | Homepage, shop, product entry, and certificate library adapt. Menu opened successfully. Long product copy and single-column catalog cards require substantial scrolling. |
| 9 | Global search | A top overlay returned five relevant image/name/price results for BPC. Closed it and restored the homepage. |

No checkout, account changes, or purchases were performed. Narrow-screen checks used CSS viewport overrides, including approximately 391 × 844 after accounting for the user's existing 75% browser zoom. These were responsive-layout checks, not physical-phone tests. The override was reset.

**Composition and hierarchy**

The [homepage](https://oathresearch.com/) has a very wide photographic hero above a narrower, disciplined content grid. At the inspected desktop size, the hero measured 1600 × 500 CSS pixels, while the paired feature panels were each 600 pixels wide. This gives the opening atmosphere more room than the informational sections beneath it.

The centered wordmark balances light navigation on the left and small utility icons on the right. A thin charcoal announcement strip supplies a quiet high-contrast edge. The header remains available while scrolling. The page moves through an environmental image, paired light/dark promise panels, three numbered service rows beside a tall brand panel, and a consistent product grid.

The hierarchy is unusually restrained for ecommerce. Homepage headings are regular-weight Roboto, rather than oversized heavy display text. Much of the recognizable character lives in the wordmark and packaging. Buttons are compact contrasting rectangles; the surrounding containers have softer corners. That distinction keeps the actions crisp without making every surface visually hard.

The oversized cropped O on dark and light panels is a useful brand motif: it grows directly out of the identity and remains subordinate to the content. The numbered circles establish sequence. Neither requires a separate decorative visual language.

![Oath homepage](/Users/rileycoyote/Documents/ChatGPT/TrueMark/reference-study/oath-authenticated/27-home-restored.png)

**Color, type, and proportions**

White page backgrounds, charcoal, light gray, warm cream, and small gold accents dominate. Warmth largely comes from the photographs and packaging. The certificate pages also use muted green for selected states, testing signals, and a document action. That is a localized observation of this reference, not a requested client palette or a general Riley preference.

Selected computed measurements explain the relationships rather than prescribe tokens for the client:

| Element | Observed CSS |
|---|---|
| Homepage hero heading | Roboto, 34px / 40.8px, weight 400 |
| Feature-panel heading | Roboto, 28px / 33.6px, weight 400 |
| Feature supporting text | Roboto, 16px / 22.4px, weight 400 |
| Service heading | Roboto, 22px / 30.8px, weight 400 |
| Product grid name | Roboto, 16px / 22.4px |
| Main heading color | #282828 |
| Feature supporting text | #888888 on a light surface; #EEEEEE on dark |
| Service-panel surface | #EEEEEE |
| Hero and feature-panel corners | 20px |
| Product-image corners | 15px |
| Desktop product images | 287 × 287 CSS pixels |
| Individual certificate title | 52px, weight 500; declared family stack Fraunces, Playfair Display, Georgia, serif |
| Individual certificate section headings | 28px, weight 500; same serif stack |

The certificate font entry records the computed family stack; it does not establish which fallback rendered every glyph. The prior Playfair/Inter measurements apply to the entry screen, not to the entire shop.

**Art direction and product imagery**

The product grid derives much of its polish from uniform image production. Cream boxes and labels, black caps, clear glass, soft shadows, repeated camera angles, and consistent scale make very similar products read as one family. The oversized brand on the package remains recognizable even when the rest of the label becomes small.

The lab photography uses warm light, dark cabinetry, shallow focus, and physical materials. It gives research a tangible setting. Smaller service illustrations stay within the same world: a phone, a shipping box, and a softly modeled support icon. For the client, asset direction deserves as much attention as CSS. Inconsistent stock photography would undermine this effect even with the same spacing and palette.

**Language and persuasion**

The homepage's short phrases—“Our Oath.”, “Verified Compounds.”, and “Handled with care.”—are direct and self-contained. Periods create a firm stopping point. The [shop](https://oathresearch.com/shop/) pairs “Fast Shipping. Real Support” with practical fulfillment and contact detail. The [certificate library](https://oathresearch.com/lab-results-certificates/) uses “Every batch Every test.” as a memorable promise and places records beneath it.

The voice changes with the reader's task. Brand-level copy is economical and confident. Service copy answers practical concerns. Product pages become technical and specific. The [About page](https://oathresearch.com/about/) explains the brand through origin, process, and verification. The [FAQ](https://oathresearch.com/faq/) becomes literal and procedural. This progression gives short statements supporting depth rather than forcing every section into the same slogan style.

For the client, use a short proposition, a concrete explanation, and relevant evidence in that order. Prefer clear nouns and verbs. Keep the emotional temperature calm. Claims about testing, quality, origin, response times, and fulfillment must come from the client's actual operation. The useful reference is the language's construction and placement, not its exact promises.

**Shopping and evidence architecture**

The [BPC-157 page](https://oathresearch.com/product/bpc-157/) puts a large product image beside the name, price, technical introduction, trust icons, quantity offers, variant selection, and action. Selected quantity tiers use a warm fill and a clear outline. Discount labels remain relatively small. Evidence continues below the purchase area rather than being confined to a footer badge.

The certificate library is the most distinctive extension of the identity. A large serif proposition, ivory field, delicate gold punctuation, small uppercase labels, and a row of summary metrics precede search and a three-column record grid. Product photography provides continuity with shopping. Record cards then introduce identifiers, sizes, test status, and history.

The [individual certificate](https://oathresearch.com/lab-results/bpc-157-batch-2607290475/) translates that system into a readable technical document: prominent title, compact metadata card, contents navigation, tabular sample details, analysis, document access, and prior tests. This supports both a quick scan and deeper inspection. The values and claims were observed as site content; this study does not independently authenticate them.

![Certificate library](/Users/rileycoyote/Documents/ChatGPT/TrueMark/reference-study/oath-authenticated/13-lab-directory.png)

**Interaction and responsive behavior**

The interface uses familiar, limited motion: the announcement messages rotate, content fades into view, the mobile menu slides in over a dimmed page, and search expands into a white top panel with image results. Filters stay hidden until requested. The useful quality is clear response to an action; elaborate motion is not necessary to reproduce the feeling.

On narrow screens, the homepage swaps to a product-box scene and places its message beneath the image. Feature panels stack, and the desktop service presentation is reduced. The mobile shop becomes a single-column product stream at the inspected width. The product page places the image before the information; its long technical introduction pushes selection controls considerably further down. The certificate library preserves the serif character while arranging summary metrics in two columns.

**What to preserve and what to refine**

Preserve the consistent image family, generous outer space, disciplined repeated geometry, contrast between serif identity and quiet utility, restrained actions, and close connection between a promise and its evidence. Let Oath lead the aesthetic and voice. Fitish can contribute selective lessons in photographic storytelling and explaining a customer journey where the client's business warrants them.

Refine readability: some body and supporting text is very light, and important labels should not depend on faint gray. Refine product-page scanning: show essential identity, choice, and applicable evidence concisely, then give deeper technical material a clear place. Refine mobile browsing density based on the client's catalog rather than assuming one enormous product card per row is ideal.

Unify the type and component rules across brand pages, shop, and evidence. Improve FAQ navigation and distinguish questions more strongly. Use customer-facing filter labels rather than a production-oriented tag such as showcase. Label testing badges at the correct product or batch scope: this visit exposed a product-level endotoxin signal alongside certificate text distinguishing the current sample from other tested batches. A client design should make that distinction easy to understand wherever evidence is shown.

This is a visual and interaction reference study, not a comprehensive accessibility, performance, scientific, or checkout audit. Keyboard coverage was limited; reduced-motion behavior and exact animation timings were not measured. Some browser screenshot exports include extra canvas padding or a transition frame; the curated images embedded above show settled states.

**Direction for the forthcoming client prototype**

Start with Oath's composure, physical product presence, short assured language, and structured evidence. Build the client's identity around those principles using its own assets and content. When the existing prototype arrives, map its pages and decisions to this reference, resolve the information hierarchy, and then establish a unified visual system before implementation.
