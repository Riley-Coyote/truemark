/*
 * The client's Research Blog, transcribed word for word from the live site
 * (reference-study/wordpress-2026-09-24/<slug>.txt). The ids are the client's
 * slugs, the order is the index page's order. Each article keeps its own words;
 * the one research-use notice that closes every article lives below, once.
 */

export type ArticleCategory = "quality-testing" | "handling-storage" | "traceability" | "chemistry";

export const articleCategories: { id: ArticleCategory; label: string }[] = [
  { id: "quality-testing", label: "Quality & Testing" },
  { id: "handling-storage", label: "Handling & Storage" },
  { id: "traceability", label: "Traceability" },
  { id: "chemistry", label: "Chemistry" },
];

/** A list item, or a term the sentence goes on to define. */
export type ArticleListItem = string | { term: string; text: string };

export type ArticleBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "list"; items: ArticleListItem[] }
  | { kind: "table"; rows: [string, string][] }
  | { kind: "quote"; text: string }
  | { kind: "references"; items: string[] }
  /** An illustration drawn by the page, not client copy. */
  | { kind: "figure"; figure: "chromatogram" };

/** The scene photographs in public/images/scenes/, with their full widths. */
export type SceneName = "collection" | "trio" | "lab" | "caustics" | "powder" | "powder-blue" | "frost";

export type Article = {
  id: string;
  category: ArticleCategory;
  title: string;
  dek: string;
  author: string;
  review: string;
  date: string;
  iso: string;
  readTime: string;
  featured?: boolean;
  /** The article's photograph, and where its subject sits when the frame is cropped. */
  image: { scene: SceneName; focus: string };
  body: ArticleBlock[];
};

const author = "TrueMark Quality Team";
const review = "Reviewed by the quality unit";

export const researchUseNotice = {
  lead: "Research use only.",
  text: "This article is educational material for laboratory researchers. It is not medical advice, and the materials discussed are not for human or veterinary use.",
};

export const articles: Article[] = [
  {
    id: "how-to-read-a-certificate-of-analysis",
    category: "quality-testing",
    title: "How to read a Certificate of Analysis",
    dek: "Every released lot ships with a CoA. Here is what each line means, and what to check before you log a vial into inventory.",
    author,
    review,
    date: "22 Aug 2026",
    iso: "2026-08-22",
    readTime: "1 min read",
    featured: true,
    image: { scene: "trio", focus: "50% 36%" },
    body: [
      {
        kind: "paragraph",
        text: "A Certificate of Analysis is the laboratory record for one specific lot of material. It is not a marketing document: every value on it comes from an analytical instrument, and the certificate is only issued after the lot passes its release specification. At TrueMark, the CoA for any released lot is retrievable by its lot number, with no account required.",
      },
      { kind: "heading", text: "The four results that matter" },
      {
        kind: "table",
        rows: [
          ["Purity (HPLC)", "Fraction of the sample that is the stated compound"],
          ["Identity (MS)", "Molecular mass matches the stated sequence"],
          ["Endotoxin (LAL)", "Bacterial endotoxin, reported in EU per milligram"],
          ["Sterility", "No viable microbial growth in sampled vials"],
        ],
      },
      {
        kind: "paragraph",
        text: "Purity and identity answer different questions. A sample can be 99% pure and still be the wrong compound; it can also be the right compound heavily diluted with impurities. A certificate needs both.",
      },
      {
        kind: "quote",
        text: "If a value is not on the certificate, treat it as untested. A CoA documents what was measured — nothing more.",
      },
      { kind: "heading", text: "Checking a vial against its CoA" },
      { kind: "paragraph", text: "Before logging a delivery into inventory:" },
      {
        kind: "list",
        items: [
          "Match the printed lot number on the label to the lot number on the certificate — character for character.",
          "Confirm the compound name and strength match the label claim.",
          "Check the test date and that the status reads Approved.",
          "Retain the certificate with your laboratory records, alongside the lot number.",
        ],
      },
      { kind: "heading", text: "References" },
      {
        kind: "references",
        items: [
          "United States Pharmacopeia. General Chapter <85> Bacterial Endotoxins Test.",
          "United States Pharmacopeia. General Chapter <71> Sterility Tests.",
          "ICH Q6A: Specifications — Test Procedures and Acceptance Criteria for New Drug Substances.",
        ],
      },
    ],
  },
  {
    id: "what-hplc-purity-actually-measures",
    category: "quality-testing",
    title: "What HPLC purity actually measures",
    dek: "High-performance liquid chromatography separates a sample into its components. What the ≥99% figure on a spec sheet does and does not tell you.",
    author,
    review,
    date: "15 Aug 2026",
    iso: "2026-08-15",
    readTime: "2 min read",
    image: { scene: "caustics", focus: "50% 50%" },
    body: [
      {
        kind: "paragraph",
        text: "High-performance liquid chromatography (HPLC) is one of the most common analytical techniques used to evaluate peptide preparations. A result such as ≥99% is useful, but it is often misunderstood. It describes how much of the detected chromatographic signal belongs to the main peak under the stated test conditions. It does not, by itself, prove identity, biological activity, sterility, or the absence of every possible contaminant.",
      },
      { kind: "heading", text: "What the chromatogram shows" },
      {
        kind: "paragraph",
        text: "During an HPLC run, the sample travels through a column whose chemistry interacts differently with different components. Those components leave the column at different retention times and are recorded as peaks. For many peptides, reversed-phase HPLC is used with a water–organic solvent gradient and ultraviolet detection.",
      },
      {
        kind: "paragraph",
        text: "The main peak normally represents the target compound. Smaller peaks may represent truncated sequences, deletion products, oxidation products, residual starting material, or other related substances. The reported purity is commonly calculated by dividing the area of the main peak by the total integrated peak area.",
      },
      { kind: "figure", figure: "chromatogram" },
      { kind: "heading", text: "Why ≥99% is not the whole composition" },
      {
        kind: "paragraph",
        text: "HPLC area percentage is a relative measurement of compounds detected by that method. Counterions, water, inorganic salts, and compounds with weak response at the selected wavelength may not be represented proportionally. A vial can therefore report high chromatographic purity while its gross mass also contains water, counterion, or other non-peptide material.",
      },
      {
        kind: "paragraph",
        text: "The result also depends on method details: column type, mobile phase, gradient, flow rate, temperature, detection wavelength, injection amount, and integration settings. Purity values are most meaningful when the certificate identifies the method and includes the chromatogram.",
      },
      { kind: "heading", text: "What to check on a certificate" },
      {
        kind: "list",
        items: [
          "Confirm that the sample or lot identifier matches the vial.",
          "Check the HPLC method and detection wavelength.",
          "Review the main peak retention time and integration.",
          "Look for unresolved shoulders or unexpected secondary peaks.",
          "Compare the result with the stated release specification.",
        ],
      },
      { kind: "heading", text: "Use HPLC with an identity test" },
      {
        kind: "paragraph",
        text: "HPLC answers a separation and relative-purity question. Mass spectrometry answers a different question: whether the observed molecular mass agrees with the expected compound. Strong release documentation uses complementary tests rather than treating one number as complete proof.",
      },
    ],
  },
  {
    id: "mass-spectrometry-and-peptide-identity",
    category: "quality-testing",
    title: "Mass spectrometry and peptide identity",
    dek: "Why purity alone is not enough: how MS confirms that the compound in the vial is the sequence on the label.",
    author,
    review,
    date: "8 Aug 2026",
    iso: "2026-08-08",
    readTime: "2 min read",
    image: { scene: "powder-blue", focus: "50% 56%" },
    body: [
      {
        kind: "paragraph",
        text: "A clean HPLC chromatogram can show that one component dominates a sample, but it cannot establish what that component is. Mass spectrometry (MS) provides the complementary identity check by measuring mass-to-charge ratios and comparing the observed result with the mass expected from the peptide sequence.",
      },
      { kind: "heading", text: "From sequence to expected mass" },
      {
        kind: "paragraph",
        text: "Every amino acid contributes a defined residue mass to a peptide. The complete sequence, terminal groups, disulfide bonds, labels, and other modifications determine the theoretical molecular mass. The analyst compares this calculated value with the mass derived from the spectrum.",
      },
      {
        kind: "paragraph",
        text: "Two common ionization approaches are electrospray ionization (ESI) and matrix-assisted laser desorption/ionization (MALDI). ESI often produces several charge states. The software deconvolutes that series into a neutral molecular mass. MALDI commonly produces a simpler spectrum dominated by singly charged ions.",
      },
      { kind: "heading", text: "How to read the reported result" },
      {
        kind: "paragraph",
        text: "A certificate may list a calculated mass and a found mass, or it may include the spectrum itself. Small differences can arise from instrument resolution, calibration, isotope selection, adducts, or the way average versus monoisotopic mass is reported. The appropriate tolerance depends on the method and specification.",
      },
      {
        kind: "paragraph",
        text: "Look for clear labeling of the sample and lot, the ionization method, the principal ion or deconvoluted mass, and the acceptance criterion. Sodium or potassium adducts and multiple charge states should be interpreted within the method rather than mistaken automatically for separate compounds.",
      },
      { kind: "heading", text: "What MS can reveal" },
      {
        kind: "paragraph",
        text: "A matching mass supports identity. Unexpected masses can point to deletion sequences, oxidation, deamidation, incomplete deprotection, adduct formation, or other modifications. Some different sequences can share the same nominal mass, however, so a mass match is not always complete sequence proof.",
      },
      { kind: "heading", text: "Why orthogonal testing matters" },
      {
        kind: "paragraph",
        text: "MS is highly informative for identity but does not replace chromatographic purity testing. A sample can have the expected molecular mass and still contain significant related impurities. Conversely, a dominant HPLC peak can belong to the wrong compound. Reviewing HPLC and MS together provides a stronger assessment than either result alone.",
      },
    ],
  },
  {
    id: "storing-lyophilized-peptides-correctly",
    category: "handling-storage",
    title: "Storing lyophilized peptides correctly",
    dek: "Temperature, light, moisture, and cycling — the four variables that preserve or degrade a lyophilized cake in storage.",
    author,
    review,
    date: "1 Aug 2026",
    iso: "2026-08-01",
    readTime: "2 min read",
    image: { scene: "frost", focus: "50% 50%" },
    body: [
      {
        kind: "paragraph",
        text: "Lyophilization removes water under controlled conditions to improve the storage stability of many research peptides. The dry cake is generally more stable than a solution, but it is not immune to degradation. Temperature, light, moisture, and repeated environmental cycling all affect how well a stored material retains its original characteristics.",
      },
      { kind: "heading", text: "Follow the product-specific documentation" },
      {
        kind: "paragraph",
        text: "There is no single storage temperature suitable for every peptide. Sequence, formulation, counterion, residual moisture, container closure, and planned storage duration all matter. Use the storage condition stated on the product label, certificate, or handling documentation. Where instructions differ, clarify the requirement before placing the lot into inventory.",
      },
      { kind: "heading", text: "Control moisture" },
      {
        kind: "paragraph",
        text: "A lyophilized cake can absorb water from humid air. Moisture may increase molecular mobility and accelerate chemical changes. Keep the vial sealed until it has reached an appropriate working temperature, because opening a cold container can encourage condensation. Minimize the time the closure is exposed and avoid unnecessary repeated access.",
      },
      { kind: "heading", text: "Limit temperature cycling" },
      {
        kind: "paragraph",
        text: "Moving a vial repeatedly between cold storage and room conditions can create condensation risk and impose physical stress. Organize inventory so the primary stock remains under its specified conditions. When the workflow permits, use planned aliquots or dedicated working material to reduce repeated handling of the original container.",
      },
      { kind: "heading", text: "Protect from light" },
      {
        kind: "paragraph",
        text: "Some residues and modifications are sensitive to light. Store vials in the supplied secondary packaging or another suitable light-protective container when the documentation calls for it. Do not assume that ordinary room lighting is harmless for every compound.",
      },
      { kind: "heading", text: "Maintain traceable storage records" },
      {
        kind: "list",
        items: [
          "Record receipt date, lot number, and storage location.",
          "Log transfers between storage units.",
          "Monitor and retain temperature records where required.",
          "Document excursions and assess them against approved procedures.",
          "Use clear labels to prevent repeated searching and door-open time.",
        ],
      },
      {
        kind: "paragraph",
        text: "Before use, inspect the vial for a damaged closure, unexpected discoloration, collapse, or other visible change. Appearance alone cannot establish quality, but an unusual observation should be documented and reviewed before the material enters a study.",
      },
    ],
  },
  {
    id: "from-source-batch-to-shipped-vial",
    category: "traceability",
    title: "From source batch to shipped vial",
    dek: "A walkthrough of lot-level traceability: what a lot number encodes, and how one number links receipt, testing, release, and distribution records.",
    author,
    review,
    date: "25 Jul 2026",
    iso: "2026-07-25",
    readTime: "2 min read",
    image: { scene: "collection", focus: "50% 44%" },
    body: [
      {
        kind: "paragraph",
        text: "Traceability is the documented connection between a shipped vial and the records used to receive, test, release, package, and distribute its source material. The visible link is usually the lot or batch number. The strength of the system depends not on the number alone, but on the records and controls connected to it.",
      },
      { kind: "heading", text: "Receiving the source batch" },
      {
        kind: "paragraph",
        text: "When material is received, the organization records the supplier identifier, internal lot identifier, quantity, condition, date, and storage requirement. Packaging and documentation are checked for consistency. Any discrepancy or damage should enter a controlled review rather than being resolved informally.",
      },
      { kind: "heading", text: "Sampling and testing" },
      {
        kind: "paragraph",
        text: "Samples used for analytical testing must remain linked to the correct batch. The chain of custody identifies who collected or transferred the sample, when it moved, and which method or laboratory generated each result. HPLC, mass spectrometry, endotoxin, and other applicable reports should all reference the same lot or a clearly documented derivative.",
      },
      { kind: "heading", text: "Review and release" },
      {
        kind: "paragraph",
        text: "Release is a documented decision that the available results and records meet the defined specification. A certificate of analysis summarizes selected outcomes, but it should be backed by controlled source records. The approval date and authorized reviewer help distinguish released material from material that is still quarantined or under investigation.",
      },
      { kind: "heading", text: "Filling, labeling, and reconciliation" },
      {
        kind: "paragraph",
        text: "When a source batch is divided into individual vials, the packaging record connects the bulk quantity with the vial count and label information. Reconciliation accounts for units filled, sampled, rejected, damaged, retained, and released. This step helps prevent label mix-ups and unexplained inventory differences.",
      },
      { kind: "heading", text: "Distribution history" },
      {
        kind: "paragraph",
        text: "Shipment records connect released units with order and destination information. If a question later arises, the lot number can be used to identify the test package, release record, packaging run, remaining inventory, and affected shipments.",
      },
      { kind: "heading", text: "What researchers should verify on receipt" },
      {
        kind: "list",
        items: [
          "Match the vial lot number to the certificate.",
          "Confirm that the product name and quantity agree with the order.",
          "Inspect the packaging and closure condition.",
          "Record receipt and storage promptly.",
          "Retain the certificate with the study or inventory record.",
        ],
      },
      {
        kind: "paragraph",
        text: "Good traceability turns a printed code into a navigable history. It supports investigation, inventory control, and reproducible laboratory documentation.",
      },
    ],
  },
  {
    id: "endotoxin-testing-with-the-lal-assay",
    category: "quality-testing",
    title: "Endotoxin testing with the LAL assay",
    dek: "What EU/mg means, where endotoxin comes from, and why release specifications set an upper bound for research materials.",
    author,
    review,
    date: "18 Jul 2026",
    iso: "2026-07-18",
    readTime: "2 min read",
    image: { scene: "lab", focus: "50% 30%" },
    body: [
      {
        kind: "paragraph",
        text: "Bacterial endotoxins are lipopolysaccharide components associated with the outer membrane of Gram-negative bacteria. They can remain after viable organisms are no longer present, which is why endotoxin testing answers a different question from a sterility or bioburden test.",
      },
      { kind: "heading", text: "What the LAL assay detects" },
      {
        kind: "paragraph",
        text: "The Limulus amebocyte lysate (LAL) assay uses a biological reagent that responds to endotoxin. Common formats include gel-clot, chromogenic, and turbidimetric methods. Each format has its own detection and calculation approach, but the reported result is usually expressed in endotoxin units (EU) relative to a reference standard.",
      },
      { kind: "heading", text: "Understanding EU/mg" },
      {
        kind: "paragraph",
        text: "A result in EU/mg normalizes the measured endotoxin amount to the mass of material tested. This allows a result to be compared with a release limit stated on the same basis. Some reports may use EU/mL or EU/vial instead; the unit, sample preparation, dilution, and calculation must be reviewed together.",
      },
      { kind: "heading", text: "Why sample interference matters" },
      {
        kind: "paragraph",
        text: "The test article can enhance or inhibit the assay response. Method suitability work is used to establish a dilution or preparation at which the assay can recover a known endotoxin challenge acceptably. A numerical result without evidence that interference was controlled may be difficult to interpret.",
      },
      { kind: "heading", text: "Where endotoxin can enter a process" },
      {
        kind: "paragraph",
        text: "Potential sources include water, raw materials, equipment, containers, handling, and the processing environment. Because endotoxin can be persistent, a process can require both preventive controls and an appropriate final test rather than relying on one measure alone.",
      },
      { kind: "heading", text: "Reading an endotoxin result" },
      {
        kind: "list",
        items: [
          "Verify the sample and lot identification.",
          "Confirm the reporting unit and specification limit.",
          "Check the assay format and sensitivity.",
          "Review dilution, recovery, and validity controls.",
          "Distinguish a quantified result from a result reported below a detection or quantitation limit.",
        ],
      },
      {
        kind: "paragraph",
        text: "An upper release specification defines the maximum acceptable result for the material and intended research context. The LAL result should be interpreted with the method record and other quality data; it is not a substitute for identity, purity, or sterility testing.",
      },
    ],
  },
  {
    id: "peptide-chemistry-a-primer-for-the-lab",
    category: "chemistry",
    title: "Peptide chemistry: a primer for the lab",
    dek: "Amino acids, peptide bonds, sequences, and molecular weight — the vocabulary printed on every spec sheet, explained.",
    author,
    review,
    date: "11 Jul 2026",
    iso: "2026-07-11",
    readTime: "2 min read",
    image: { scene: "powder", focus: "50% 58%" },
    body: [
      {
        kind: "paragraph",
        text: "Peptides are chains of amino-acid residues joined by peptide bonds. A specification sheet compresses a large amount of chemistry into a sequence, molecular formula, molecular mass, purity result, and notes about terminal groups or other modifications. Understanding those fields makes analytical documentation easier to evaluate.",
      },
      { kind: "heading", text: "Amino acids and sequence direction" },
      {
        kind: "paragraph",
        text: "Most peptide sequences are written from the amino terminus (N-terminus) on the left to the carboxyl terminus (C-terminus) on the right. One-letter or three-letter abbreviations identify each residue. Sequence order matters: two peptides containing the same amino acids in a different order are different compounds even if their overall elemental composition or nominal mass is similar.",
      },
      { kind: "heading", text: "How peptide bonds form" },
      {
        kind: "paragraph",
        text: "A peptide bond links the carboxyl group of one amino acid with the amino group of the next. The formal condensation relationship removes the elements of water as residues become part of the chain. That is why calculating a peptide’s mass is not simply a matter of adding the masses of free amino acids.",
      },
      { kind: "heading", text: "Terminal groups and modifications" },
      {
        kind: "paragraph",
        text: "The ends of a peptide may be unmodified or may carry groups such as N-terminal acetylation or C-terminal amidation. Other possibilities include labels, linkers, phosphorylation, lipidation, cyclization, or disulfide bonds. These features change the molecular formula, mass, charge behavior, and sometimes chromatographic retention. They should be included in the identity documentation.",
      },
      { kind: "heading", text: "Molecular mass and counterions" },
      {
        kind: "paragraph",
        text: "A specification may report average molecular weight or monoisotopic mass. These values are calculated differently and should not be compared without checking the convention. Peptides are also commonly supplied as salts containing counterions. The theoretical mass of the peptide molecule is therefore not necessarily the same as the total mass composition of the lyophilized material.",
      },
      { kind: "heading", text: "Purity, content, and identity are different" },
      {
        kind: "list",
        items: [
          { term: "Identity", text: "asks whether the material matches the expected compound." },
          { term: "Chromatographic purity", text: "describes the relative main-peak area under a defined method." },
          {
            term: "Peptide content",
            text: "addresses how much of the sample mass is peptide rather than water, counterion, or other components.",
          },
        ],
      },
      {
        kind: "paragraph",
        text: "No single field replaces the others. A useful certificate connects the exact lot with complementary analytical results and clearly stated specifications.",
      },
      { kind: "heading", text: "A practical review" },
      {
        kind: "paragraph",
        text: "Start with the sequence and terminal modifications, calculate or confirm the expected mass, compare it with the identity result, then review chromatographic purity and any content-related information. Finally, confirm that every page and attachment refers to the same lot.",
      },
    ],
  },
];

export function articleById(id: string | undefined): Article | undefined {
  return articles.find((article) => article.id === id);
}

export function categoryLabel(id: ArticleCategory): string {
  return articleCategories.find((c) => c.id === id)?.label ?? id;
}

export function isArticleCategory(value: string | null): value is ArticleCategory {
  return articleCategories.some((c) => c.id === value);
}

/**
 * "Keep reading", as the live site chooses it: the article's own category
 * first, then the most recent of the rest, three in all.
 */
export function relatedArticles(article: Article, count = 3): Article[] {
  const others = articles.filter((a) => a.id !== article.id);
  const same = others.filter((a) => a.category === article.category);
  const rest = others.filter((a) => a.category !== article.category);
  return [...same, ...rest].slice(0, count);
}

/** A heading's id inside its article, for the contents and for links. */
export function sectionId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
