# Generated image provenance

**September 24 update:** the original powder versions below are restored for earlier studies. The current website uses supplied labeled product renders and a new branded group composition. See [Brand refinement](BRAND-REFINEMENT.md) for source decisions and the new image prompt. The September 22 liquid edits below are historical records.

The additional homepage exploration assets in `public/images/studies/` are documented, with full generation prompts, in [VISUAL-STUDIES.md](VISUAL-STUDIES.md). These include environmental, abstract nature, glass macro, and product sculpture concepts.

These are original concept assets for the local TrueMark design preview, generated with the built-in image generation tool on September 22, 2026. They are proposed packaging, not photographs of the client's actual products. Oath Research was an art-direction reference; no Oath assets were copied into the build.

## Hero still life

File: `public/images/hero-still-life.png`

Historical generation prompt: Use case: product-mockup. Asset type: photographic hero for a refined research-compound catalog prototype called TrueMark Biolabs. Create one beautiful, photorealistic landscape studio still life, 1536x1024. Art direction: the calm, tactile cream-and-black research packaging, soft shadows and careful material lighting exemplified by https://oathresearch.com/, but original TrueMark branding and composition. On a warm pale limestone surface stand two premium clear borosilicate research vials with satin black crimp caps and ivory paper labels, beside a tall slim ivory carton. One vial prominent foreground, one further back, carton just behind; balanced diagonal composition concentrated around center-right with breathing room on the left and above. Natural soft sidelight from upper left, subtle long shadows, warm-white plaster background, slight surface texture. Label typography: beautiful black serif brand wordmark "TrueMark" and small sans-serif "BIOLABS"; secondary short exact text "BPC-157" and "10 mg", and tiny "RESEARCH USE ONLY". Carton carries TrueMark wordmark and a very restrained small square crosshair mark. Looks like an expensive real product shoot, physically accurate glass, understated professional scientific supplier, high detail. No people, no needles, no bright colors, no green, no gradients or decorative atoms, no floating objects, no fake certification seals, no website UI, no watermark. This image fills a wide rounded hero panel on an off-white website; make cropping forgiving and keep label readable.

September 22 clear-liquid revision: replace the same asset path while preserving the framing, materials, labels, and light. Remove all powder, sediment, and cloudiness from both vials; depict clear, colorless illustrative liquid at roughly two-thirds of each vial's internal height with a subtle meniscus. This illustrative fill is not an actual fill specification. The historical prompt did not request powder, though the original output showed it.

## Catalog vial

File: `public/images/research-vial.png`

Historical generation prompt: Use case: product-mockup. Create a single square 1024x1024 high-end catalog photograph for TrueMark Biolabs research compound website. One clear glass 3ml laboratory vial with an understated matte black crimp cap and subtle silver metal collar, standing upright, complete vial uncropped. Vial centered in lower-middle of image, about 68 percent of image height, ample margins; soft natural studio light from top left, realistic gentle shadow falling right, seamless pale warm off-white background #efeee9. Premium softly textured ivory label, black refined serif wordmark "TrueMark", tiny spaced sans-serif "BIOLABS", very fine horizontal hairline and tiny words "RESEARCH COMPOUND" and "RESEARCH USE ONLY". No specific compound name, no dosage, no CAS number, no purity percentage. The label is minimal and precise. Glass physically plausible, a little dry white lyophilized powder at bottom visible through glass base. Straight-on camera with a little top visibility of cap, attractive tactile studio realism similar in restraint to Oath Research packaging but its own brand. No carton, no other objects, no colored accent, no green, no giant shadows, no watermarks, no website UI. Entire background uniform neutral so image sits seamlessly on product card.

September 22 clear-liquid revision: replace the same asset path while preserving the framing, materials, label, and light. Remove all powder, sediment, and cloudiness; depict clear, colorless illustrative liquid at roughly two-thirds of the vial's internal height with a subtle meniscus. This illustrative fill is not an actual fill specification.

The generic vial is reused across the draft catalog. Production needs approved photographs for each presentation, including the laboratory supply. The rendered page provides the actual compound and size as text outside the photograph.

## Exact clear-liquid edit prompts

Built-in image-generation edits, each using its original asset as the referenced image. Each prompt consists of this prefix, its asset-specific instruction below, and the shared preservation suffix.

Prefix: Use case: precise-object-edit. Edit the supplied photograph with one localized change:

- `public/images/hero-still-life.png`: Both vials, including the foreground and background vial, must contain perfectly clear, colorless transparent liquid. Remove ALL visible white powder, grains, sediment and cloudy material from both vials, including the base below each label and the shoulder above the label. The liquid should fill roughly two thirds of each vial's internal height with a physically plausible subtle meniscus and clear refractive optics. No added text or fill-volume markings.

- `public/images/research-vial.png`: The single vial must contain perfectly clear, colorless transparent liquid instead of powder. Remove ALL white powder, grains, sediment and cloudiness from the visible glass at the base. Fill roughly two thirds of the vial's internal height, with clear glass/liquid refraction, a subtle physically plausible liquid surface behind the label or at its upper edge. It must read as clear liquid, not an empty vial. No added text or volume markings.

- `public/images/studies/object.png`: The single vial on the stone plinth must contain perfectly clear, colorless transparent liquid instead of powder. Remove ALL white powder and grains at its bottom. Fill about two thirds of its internal height, with realistic optical refraction and a subtle meniscus; clear transparent base with no sediment, foam or cloudiness. No added text or volume markings.

Shared suffix: Preserve the original composition, camera angle, exact framing and aspect ratio, object dimensions and positions, caps, all label typography and wording, carton if present, background, stone surfaces, natural lighting, shadows, colors, and photographic detail. Do not redesign, relabel, reframe, or add objects. The only intended change is replacing solid powder contents with clear liquid.
