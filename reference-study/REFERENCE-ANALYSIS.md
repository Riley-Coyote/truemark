# Fitish and Oath Research — prototype reference study

Inspected September 22, 2026. This is a design reference study for the forthcoming client prototype, not a specification or a build. Findings come from live browser inspection, screenshots, accessibility trees, and selected computed styles. The interpretations below describe the effect of the design; they do not claim knowledge of the designers' intentions.

**Updated after authenticated inspection:** Oath is Riley's primary and favorite reference; Fitish is secondary. The full Oath homepage, shop, product detail, certificate library, certificate detail, About, FAQ, search, and representative narrow layouts have now been inspected in Riley's logged-in Comet browser. Read [Oath — primary reference](/Users/rileycoyote/Documents/ChatGPT/TrueMark/reference-study/OATH-PRIMARY-REFERENCE.md) for the current analysis. The entry-screen observations below remain valid only for that screen.

Sources: [Fitish](https://fitish.com/), [Fitish clinic](https://fitish.com/pages/the-clinic), [Fitish collection](https://fitish.com/collections/weight-loss), [Fitish product detail](https://fitish.com/collections/weight-loss/products/compounded-semaglutide), [Oath Research](https://oathresearch.com/).

**The central distinction**

Fitish makes its offer feel like an extension of an active lifestyle. Oath creates composure through consistent product imagery, restrained shopping interfaces, and a more expressive serif certificate library. Their most useful common ground is the close relationship between packaging, photography, typography, and page composition. Oath now sets the lead direction for this client study.

**Inspection record**

1. Fitish homepage: strong visual identity and variety; competing promotional layers and considerable repetition. Inspected the hero, treatment mosaic, results, brand introduction, athlete compositions, process collage, skincare categories, testimonials, FAQ, and footer. Opened an FAQ successfully.
2. Fitish clinic and collection: coherent photographic branding; the clinic opens with a substantial image, while the collection becomes a simple image-heavy shopping grid.
3. Fitish product detail: clear image/information split and a prominent action; long educational content reduces scannability. Switched gallery thumbnails and verified the displayed image changed.
4. Fitish narrow-screen layout: homepage reflows and menu opens/closes; image height, tiny card labels, and floating widgets compete with navigation and the primary action. Inspected at a 390 × 844 CSS viewport.
5. Oath entry experience: cohesive desktop split composition and a compact mobile form. Inspected all three carousel presentations, switched slides manually, observed automatic slide changes, and inspected the 390 × 844 layout.
6. Oath deeper navigation: the initial public pass was blocked, then Riley supplied access through an existing authenticated Comet tab. The follow-up covered homepage, catalog filtering, product variants and information tabs, certificate search and detail, About, FAQ, global search, and narrow-screen layouts. See the linked primary-reference study for evidence and findings. Checkout remains uninspected.

**Fitish: confident, athletic, bright, approachable**

The visual balance is mostly white, soft gray, black, and natural skin tones. The vivid yellow-green accent is conspicuous because the surrounding system is restrained. It ties together selected headline words, primary actions, and small interface details. This is evidence of Fitish's brand palette, not a palette decision for the client.

The hero integrates its portrait into the page rather than placing a photograph inside a conventional card. A pale background and a fading image edge leave room for text. Large products and close portraits establish immediate recognition; they also make a technical category feel more familiar.

The type system has three distinct jobs. Aileron handles the main proposition and reading text. Horizon supplies the unusually wide, heavy athletic section headings and product labels. Space Mono introduces a technical register in supporting labels and FAQ questions. Their contrast is more memorable than simply increasing font weight throughout a page.

At the inspected desktop width, the main hero heading computed to 56px with a 67.2px line height and weight 600. A representative section heading was 32px/38.4px. Product labels included 14px Horizon and 10px Space Mono. These measurements explain the hierarchy; they are not proposed client tokens.

The page alternates dense product mosaics, centered statements, wide photographic compositions, small evidence blocks, and generous white space. Rectangular image panels provide structure, while pill-shaped actions soften the experience. Selected text/image combinations overlap or extend beyond an outlined frame, giving sections a designed composition rather than a repeated template.

The underlying persuasion pattern is aspiration, choice, reassurance, process, and another opportunity to act. Human imagery invites identification; product photography identifies the offer; customer material and explanatory sections support confidence. The client version should retain this purposeful sequencing while using fewer repeated sections.

![Fitish desktop hero](/Users/rileycoyote/Documents/ChatGPT/TrueMark/reference-study/screenshots/05-fitish-hero-desktop.png)

![Fitish photographic composition and category cards](/Users/rileycoyote/Documents/ChatGPT/TrueMark/reference-study/screenshots/08-fitish-categories.png)

**Fitish beyond the homepage**

The clinic page extends the brand through a fashion-like portrait and prominent packaging identity. The collection makes individual product renders unusually large, followed by centered names, ratings, and prices. The product page then uses a conventional two-column layout: gallery on the left, title, price, action, and explanation on the right. The consistency of the assets carries the identity even when the layout becomes more conventional.

The product-detail page also illustrates an opportunity: a strong opening hierarchy gives way to a long continuous body of information. For the new prototype, summary, specifications, supporting evidence, and detailed explanation should have distinct levels of emphasis, based on the client's actual content.

The FAQ disclosed its answer and changed its circular control from a plus to a minus. The gallery provided an updated image and an accessibility-tree status message. These small interactions are sufficient to make the interface feel responsive without elaborate animation.

![Fitish product detail](/Users/rileycoyote/Documents/ChatGPT/TrueMark/reference-study/screenshots/15-fitish-product-detail.png)

**Oath: restrained, tactile, precise, premium**

This assessment applies to the live account-entry experience. Its desktop composition is approximately 55% brand presentation and 45% form. The left side supplies atmosphere and product identity; the right side keeps the action stable. The separation permits expressive imagery without reducing form clarity.

The brand presentation alternates a charcoal product scene, a warm photographic packaging scene, and a small product grid. The restrained packaging, cream labels, black caps, wood, soft lighting, and serif identity create a tactile quality. The clinical subject matter is made visually approachable through materials rather than overtly medical decoration.

Playfair Display headings pair with Inter interface text. At 1280px wide, the display heading computed to 51.2px/58.88px at weight 600. Supporting text was 15.2px at weight 300. The form headline was 25.6px at weight 600. The contrast between large serif display and quiet sans-serif utility is central to the entry screen's character.

Charcoal, white, and warm neutrals carry almost the entire composition. Muted gold is reserved for small labels, icons, and carousel indicators. The observed active indicator was #C9A84C. The primary button is black with white text and an 8px radius: its prominence comes from contrast and placement rather than a bright fill.

Whitespace creates confidence here. The brand mark, proposition, field, action, trust markers, and footer each have a clearly separated place. The small trust row sits immediately below the action, where reassurance is relevant to a decision. This placement is a useful design pattern regardless of the particular claims.

The carousel changes the mood while the form remains fixed. On the narrow layout, the brand presentation becomes a shallow upper panel and the form sits below it. That preserves a recognizable visual introduction while keeping the action relatively close.

![Oath desktop entry composition](/Users/rileycoyote/Documents/ChatGPT/TrueMark/reference-study/screenshots/03-oath-entry-slide-one.png)

![Oath narrow-screen entry](/Users/rileycoyote/Documents/ChatGPT/TrueMark/reference-study/screenshots/20-oath-mobile-entry.png)

**What should transfer into the client prototype**

| Principle | Application when the client mockup arrives |
|---|---|
| Build identity through a small number of repeated decisions | Define type roles, spacing, image treatment, surfaces, and controls together. |
| Give imagery a clear job | Decide which images establish aspiration, identify a product, explain a process, or supply evidence. |
| Use contrast to guide attention | Reserve the strongest contrast for the main proposition and next action. Choose accent colors from the client identity. |
| Vary section composition with purpose | Alternate overview, close product inspection, explanation, and evidence without arbitrary layout changes. |
| Make products feel like one family | Keep lighting, crop, scale, background, and label legibility consistent across renders. |
| Place reassurance near decisions | Position applicable testing documents, support information, fulfillment details, or process explanations next to the relevant action. |
| Design mobile as its own composition | Reconsider image height, content order, readable labels, sticky controls, and thumb access. |
| Keep interaction quiet and legible | Use clear hover/focus feedback, image changes, disclosures, and restrained transitions. |

The updated direction is Oath-led: composed product presentation, disciplined neutral surfaces, economical language, and accessible evidence. Fitish supplies secondary lessons in photographic storytelling and customer-journey explanation. The client's audience, business model, brand assets, and existing prototype will determine the details. The references serve different purposes—consumer telehealth/beauty and research supply—so their calls to action and supporting content should not be treated as interchangeable.

**What to improve rather than carry over**

Fitish initially displayed an age gate alongside rewards messaging and other floating controls. On mobile, chat, rewards, and referral controls occupy substantial space and can overlap content or navigation. The opening image also precedes the main message, putting the initial action below the first viewport. Preserve the strength of the imagery while reducing this competition.

Some Fitish primary actions use white text on a bright fill, and some product subtitles are very small. Oath uses fine gray text and small gold details. These are contrast/readability risks to check during implementation, not claims of a complete accessibility audit. Some Fitish image descriptions also contain long keyword sequences rather than concise descriptions, as exposed in the accessibility tree.

The Oath account gate asks for commitment before visitors can explore the catalog. Its form is visually polished, but whether that pattern belongs in the client prototype depends on an actual access requirement. Aesthetic quality and browsing convenience should be assessed separately.

**Limits and next input**

This review did not test payment, account creation, medical intake, purchases, every keyboard path, screen-reader operation, measured performance, or reduced-motion behavior. Product and health statements were read as page content, not independently verified. Oath's authenticated shopping and supporting pages were subsequently inspected; checkout was not. Desktop and narrow CSS viewports were used; these are not tests on physical mobile devices.

When the client prototype is provided, map its content and user journey against this study, identify the material to retain, establish a coherent visual direction, and then define the pages and interactions for the build.
