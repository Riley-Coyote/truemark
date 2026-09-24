# TrueMark BioLabs — brand refinement

September 24, 2026. Local revision of the first client presentation.

## What the client supplied

Reviewed the nine-page brand guidelines, the ZIP's documentation, color tokens,
catalog data, insert card and artwork, all supplied images/screenshots in
`docs/current-site` and `docs/client-documents`, and the authenticated WordPress
homepage and catalog. The current-site folder includes individual product
renders, not just screenshots of web pages.

The brand's anchors are its original TR monogram and outlined wordmark,
red–purple–blue gradient, violet ink, white surfaces, geometric typography,
rounded controls, and eight label colors. The stated personality is precise,
transparent and modern, with a consumer-grade finish. Research-only language
and verifiable documentation remain central.

## The proposed balance

- Preserve the first prototype's composition, generous spacing, clear hierarchy,
  information architecture, restrained interaction, and documentation emphasis.
- Use the supplied SVG logo directly. Preserve its proportions and colors.
- Bring in Poppins for headings at a quieter regular weight, with Manrope retained
  for readable UI/body text. This is an intentional proposed adaptation of the
  kit's heavier Poppins/Heros pairing, informed by the earlier Quiet modern choice.
- Use the signature gradient in the main call to action, and violet for type and
  selected controls. Most of the page stays light and uncluttered.
- Make category color tangible through the actual product labels, matching card
  accents, size pills and detail-page controls. No color casts on catalog photos.
- Interpret the client's “candy” metaphor as visual appeal, warmth, color and
  approachability. Do not introduce food imagery, consumption cues, health or
  performance promises, or language that implies injections are harmless.
- Give the main homepage its own group photograph; use glass for Quality,
  coastline for About, and water for the account preview.

## Product and asset decisions

Twenty individual supplied product renders are copied unchanged into
`public/images/products/`. Names, quantities and colors follow their artwork and
the brand kit. Prices and compound classes follow the authenticated WordPress
catalog as inspected on September 24. Label color is independent of compound
class; it is not used to infer a scientific classification.

The kit specifies CJC / Ipamorelin 5 mg / 5 mg, but the supplied image and live
catalog show 10 mg / 10 mg. Riley explicitly chose the version with supplied
artwork, so this revision uses 10 mg / 10 mg at the displayed $55 price.

Research peptides are shown and described as lyophilized powder. BAC Water
retains its supplied liquid image and is described as a research diluent.

The ZIP lists `04_Vial_Labels` and `05_Product_Images`, but omits those folders.
The individual labeled renders in `docs/current-site` supply the catalog imagery.
Separate print-label SVG masters remain absent. No labels or QR codes were
reconstructed for the product cards. Original client files remain in `docs/current-site`; deployed paths are recorded in `src/data.ts`.

The original three powder concept images were recovered byte-for-byte from
`08d519d^` for the earlier studies. Typography and landing studies are explicitly
identified as earlier explorations, including their original concept packaging.
They remain available in the review navigation.

## New homepage image

Tool: built-in image generation. Output:
`public/images/brand/hero-collection.png`.

The image is an illustrative composition, not production label/QR artwork.
The unmodified individual client renders remain the product-detail source.
No generated QR code should be used as a functional certificate link.

Prompt:

> Create a refined, inviting TrueMark BioLabs homepage product photograph using
> the supplied Retatrutide purple-label, BPC-157 teal-label, and GHK-Cu pink-label
> vial designs as identity references. Preserve the glass, white flip-off caps,
> silver seals, label layouts, monograms, product names, amounts and colors.
> White powder in Retatrutide and BPC-157; light blue powder in GHK-Cu; no liquid.
> Three sealed vials in an asymmetric still life: purple slightly forward on a
> low milky translucent glass disc, teal behind left, pink right. Off-white
> backdrop, subtle rosy reflected light on the left and lavender-blue on the
> right, real daylight, delicate shadows, curved translucent glass behind.
> Restrained photographic color; warm, tactile, optimistic and sophisticated.
> No food, sweets, pills, syringes, people, splashes, boxes or added text.
> Front-facing label faces, no floating. Square crop for a split homepage hero.

## Prototype boundaries

The existing illustrative lot record is kept separate from the client's printed
lot numbers. Product pages open the generic lookup, rather than attaching a
demonstration certificate to a current product. Commerce and forms remain local
demonstrations. This revision does not edit WordPress or publish to GitHub Pages.

Raw client documents and screenshots remain local source material; only selected
website assets are integrated into the application.
