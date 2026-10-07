export type Category = {
  id: string;
  name: string;
  short: string;
  labelColor: string;
  position: number;
  onHome: boolean;
  members: string;
  vial?: string;
  productIds?: string[];
};

/** The client's eight classes, in filter/homepage order. Label colours never alter images. */
export const compoundClasses: Category[] = [
  {
    "id": "metabolic-peptides",
    "name": "Metabolic peptides",
    "short": "Metabolic",
    "labelColor": "#7A39B1",
    "members": "Retatrutide · Tirzepatide · Semaglutide · Cagrilintide",
    "vial": "retatrutide-10-mg",
    "productIds": [
      "retatrutide-10-mg",
      "retatrutide-20-mg",
      "retatrutide-30-mg",
      "retatrutide-60-mg",
      "tirzepatide-30-mg",
      "semaglutide-20-mg",
      "cagrilintide-10-mg"
    ]
  },
  {
    "id": "peptide-fragments",
    "name": "Peptide fragments",
    "short": "Peptide fragments",
    "labelColor": "#058F93",
    "members": "BPC-157 · BPC-157 / TB-500 · KPV",
    "vial": "bpc-157-10-mg",
    "productIds": [
      "bpc-157-10-mg",
      "bpc-tb-1010-mg",
      "kpv-10-mg"
    ]
  },
  {
    "id": "copper-peptides",
    "name": "Copper peptides",
    "short": "Copper peptides",
    "labelColor": "#CC3358",
    "members": "GHK-Cu · GLOW",
    "vial": "ghk-cu-100-mg",
    "productIds": [
      "ghk-cu-100-mg",
      "glow-70-mg"
    ]
  },
  {
    "id": "secretagogue-peptides",
    "name": "Secretagogue peptides",
    "short": "Secretagogues",
    "labelColor": "#0273D0",
    "members": "Tesamorelin · CJC (No DAC) / Ipamorelin",
    "vial": "tesamorelin-10-mg",
    "productIds": [
      "tesamorelin-10-mg",
      "cjc-ipa-1010-mg"
    ]
  },
  {
    "id": "mitochondrial-peptides",
    "name": "Mitochondrial peptides",
    "short": "Mitochondrial",
    "labelColor": "#B97102",
    "members": "MOTS-C",
    "vial": "mots-c-10-mg",
    "productIds": [
      "mots-c-10-mg"
    ]
  },
  {
    "id": "coenzymes-cofactors",
    "name": "Coenzymes & cofactors",
    "short": "Coenzymes",
    "labelColor": "#B97102",
    "members": "NAD+",
    "vial": "nad-500-mg",
    "productIds": [
      "nad-500-mg"
    ]
  },
  {
    "id": "neuropeptides",
    "name": "Neuropeptides",
    "short": "Neuropeptides",
    "labelColor": "#4E762E",
    "members": "Semax · Selank",
    "vial": "semax-10-mg",
    "productIds": [
      "semax-10-mg",
      "selank-10-mg"
    ]
  },
  {
    "id": "melanocortin-analogs",
    "name": "Melanocortin analogs",
    "short": "Melanocortins",
    "labelColor": "#AB531A",
    "members": "Melanotan II",
    "vial": "melanotan-ii-10-mg",
    "productIds": [
      "melanotan-ii-10-mg"
    ]
  }
].map((category, index) => ({ ...category, position: index + 1, onHome: true }));

/** The client's legal name and mailing address, as they gave them (Oct 6). */
export const business = {
  legalName: "TrueMark Supply Group LLC",
  tradeName: "TrueMark BioLabs",
  mailingAddress: ["5900 Balcones Drive, Suite #34195", "Austin, TX 78731"],
};

export const categories: { id: string; name: string; short: string }[] = [
  { id: "all", name: "All compounds", short: "All compounds" },
  ...compoundClasses,
  { id: "lab-supplies", name: "Lab supplies", short: "Lab supplies" },
];

/** The live bootstrap replaces metadata before screens import their catalog groupings. */
export function setCategories(values: Category[]) {
  const sorted = [...values].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  compoundClasses.splice(0, compoundClasses.length, ...sorted.filter((category) => category.onHome));
  categories.splice(1, categories.length - 1, ...sorted);
}

export const previewCategories = (): Category[] => [
  ...compoundClasses,
  { id: "lab-supplies", name: "Lab supplies", short: "Lab supplies", labelColor: "#486377", position: 9, onHome: false, members: "BAC Water" },
];

export type Product = {
  id: string;
  name: string;
  size: string;
  category: string;
  price?: number;
  image?: string;
  color: string;
  colorInk: string;
  form: string;
  lot: string;
  description?: string;
  stock?: number | null;
  active?: boolean;
  /** A merchandising tag on the product card. The client decides these; the two set here are placeholders. */
  tag?: string;
};

// Names, sizes, label colors and first-batch references come from the client brand kit.
// Prices reflect the client's current WordPress catalog.
export const products: Product[] = [
  {
    id: "retatrutide-10-mg",
    name: "Retatrutide",
    size: "10 mg",
    category: "metabolic-peptides",
    price: 50,
    image: "/images/products/retatrutide-10-mg.png",
    color: "#7A39B1",
    colorInk: "#471C6C",
    form: "Lyophilized powder",
    lot: "TM-RET10-2609-01",
  },
  {
    id: "retatrutide-20-mg",
    name: "Retatrutide",
    size: "20 mg",
    category: "metabolic-peptides",
    price: 80,
    image: "/images/products/retatrutide-20-mg.png",
    color: "#7A39B1",
    colorInk: "#471C6C",
    form: "Lyophilized powder",
    lot: "TM-RET20-2609-01",
  },
  {
    id: "retatrutide-30-mg",
    name: "Retatrutide",
    size: "30 mg",
    category: "metabolic-peptides",
    price: 100,
    image: "/images/products/retatrutide-30-mg.png",
    color: "#7A39B1",
    colorInk: "#471C6C",
    form: "Lyophilized powder",
    lot: "TM-RET30-2609-01",
  },
  {
    id: "retatrutide-60-mg",
    name: "Retatrutide",
    size: "60 mg",
    category: "metabolic-peptides",
    price: 155,
    image: "/images/products/retatrutide-60-mg.png",
    color: "#7A39B1",
    colorInk: "#471C6C",
    form: "Lyophilized powder",
    lot: "TM-RET60-2609-01",
  },
  {
    id: "tirzepatide-30-mg",
    name: "Tirzepatide",
    size: "30 mg",
    category: "metabolic-peptides",
    price: 70,
    image: "/images/products/tirzepatide-30-mg.png",
    color: "#7A39B1",
    colorInk: "#471C6C",
    form: "Lyophilized powder",
    lot: "TM-TRZ30-2609-01",
  },
  {
    id: "semaglutide-20-mg",
    name: "Semaglutide",
    size: "20 mg",
    category: "metabolic-peptides",
    price: 45,
    image: "/images/products/semaglutide-20-mg.png",
    color: "#7A39B1",
    colorInk: "#471C6C",
    form: "Lyophilized powder",
    lot: "TM-SEM20-2609-01",
  },
  {
    id: "cagrilintide-10-mg",
    name: "Cagrilintide",
    size: "10 mg",
    category: "metabolic-peptides",
    price: 70,
    image: "/images/products/cagrilintide-10-mg.png",
    color: "#7A39B1",
    colorInk: "#471C6C",
    form: "Lyophilized powder",
    lot: "TM-CAG10-2609-01",
  },
  {
    id: "bpc-157-10-mg",
    name: "BPC-157",
    size: "10 mg",
    category: "peptide-fragments",
    price: 40,
    image: "/images/products/bpc-157-10-mg.png",
    color: "#058F93",
    colorInk: "#005658",
    form: "Lyophilized powder",
    lot: "TM-BPC10-2609-01",
    tag: "Best seller",
  },
  {
    id: "bpc-tb-1010-mg",
    name: "BPC-157 / TB-500",
    size: "10 mg / 10 mg",
    category: "peptide-fragments",
    price: 80,
    image: "/images/products/bpc-157-tb-500-10-mg-10-mg.png",
    color: "#058F93",
    colorInk: "#005658",
    form: "Lyophilized powder",
    lot: "TM-BTB10-2609-01",
  },
  {
    id: "kpv-10-mg",
    name: "KPV",
    size: "10 mg",
    category: "peptide-fragments",
    price: 40,
    image: "/images/products/kpv-10-mg.png",
    color: "#058F93",
    colorInk: "#005658",
    form: "Lyophilized powder",
    lot: "TM-KPV10-2609-01",
  },
  {
    id: "ghk-cu-100-mg",
    name: "GHK-Cu",
    size: "100 mg",
    category: "copper-peptides",
    price: 40,
    image: "/images/products/ghk-cu-100-mg.png",
    color: "#CC3358",
    colorInk: "#7C1830",
    form: "Lyophilized powder",
    lot: "TM-GHK100-2609-01",
  },
  {
    id: "glow-70-mg",
    name: "GLOW",
    size: "70 mg",
    category: "copper-peptides",
    price: 75,
    image: "/images/products/glow-70-mg.png",
    color: "#CC3358",
    colorInk: "#7C1830",
    form: "Lyophilized powder",
    lot: "TM-GLW70-2609-01",
    tag: "New",
  },
  {
    id: "tesamorelin-10-mg",
    name: "Tesamorelin",
    size: "10 mg",
    category: "secretagogue-peptides",
    price: 75,
    image: "/images/products/tesamorelin-10-mg.png",
    color: "#0273D0",
    colorInk: "#00437A",
    form: "Lyophilized powder",
    lot: "TM-TES10-2609-01",
  },
  {
    id: "nad-500-mg",
    name: "NAD+",
    size: "500 mg",
    category: "coenzymes-cofactors",
    price: 55,
    image: "/images/products/nad-plus-500-mg.png",
    color: "#B97102",
    colorInk: "#6C4200",
    form: "Lyophilized powder",
    lot: "TM-NAD500-2609-01",
  },
  {
    id: "mots-c-10-mg",
    name: "MOTS-C",
    size: "10 mg",
    category: "mitochondrial-peptides",
    price: 50,
    image: "/images/products/mots-c-10-mg.png",
    color: "#B97102",
    colorInk: "#6C4200",
    form: "Lyophilized powder",
    lot: "TM-MOT10-2609-01",
  },
  {
    id: "semax-10-mg",
    name: "Semax",
    size: "10 mg",
    category: "neuropeptides",
    price: 40,
    image: "/images/products/semax-10-mg.png",
    color: "#4E762E",
    colorInk: "#2D4817",
    form: "Lyophilized powder",
    lot: "TM-SMX10-2609-01",
  },
  {
    id: "selank-10-mg",
    name: "Selank",
    size: "10 mg",
    category: "neuropeptides",
    price: 40,
    image: "/images/products/selank-10-mg.png",
    color: "#4E762E",
    colorInk: "#2D4817",
    form: "Lyophilized powder",
    lot: "TM-SLK10-2609-01",
  },
  {
    id: "melanotan-ii-10-mg",
    name: "Melanotan II",
    size: "10 mg",
    category: "melanocortin-analogs",
    price: 40,
    image: "/images/products/melanotan-ii-10-mg.png",
    color: "#AB531A",
    colorInk: "#682F0B",
    form: "Lyophilized powder",
    lot: "TM-MEL10-2609-01",
  },
  {
    id: "bacteriostatic-water-10-ml",
    name: "BAC Water",
    size: "10 mL",
    category: "lab-supplies",
    price: 10,
    image: "/images/products/bac-water-10-ml.png",
    color: "#486377",
    colorInk: "#253A49",
    form: "Research diluent",
    lot: "TM-BAC10-2609-01",
  },
  // Sold at the size its certificate tested (KMD TB-20260924-QC6H-01, lot TM-CJI5-2609-01), as the brand kit lists it
  // (Riley, 2026-10-06). The photograph still shows the supplied 10 mg / 10 mg label until the 5 mg / 5 mg art arrives.
  {
    id: "cjc-ipa-1010-mg",
    name: "CJC (No DAC) / Ipamorelin",
    size: "5 mg / 5 mg",
    category: "secretagogue-peptides",
    price: 55,
    image: "/images/products/cjc-no-dac-ipamorelin-10-mg-10-mg.png",
    color: "#0273D0",
    colorInk: "#00437A",
    form: "Lyophilized powder",
    lot: "TM-CJI5-2609-01",
  },
];

/**
 * The catalog as built, captured before live mode replaces `products` in place with the
 * database's (signed-out visitors get a price-free showcase). The preview's sample world is
 * computed from this copy, so it never depends on who is signed in.
 */
export const sampleCatalog: readonly Product[] = products.map((product) => ({ ...product }));

export const categoryName = (id: string) =>
  categories.find((c) => c.id === id)?.name ?? id;
export const money = (price: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    price,
  );

export const processSteps = [
  {
    title: "Source",
    label: "A defined starting point.",
    text: "Material is sourced against a written specification. The source batch is recorded before the lot enters our system.",
  },
  {
    title: "Receive & quarantine",
    label: "Logged. Separated. Held.",
    text: "Each incoming lot receives a TrueMark identifier and stays in temperature-controlled quarantine pending review.",
  },
  {
    title: "Test independently",
    label: "Evidence before release.",
    text: "Samples are sent to a contracted laboratory for purity, identity, endotoxin, and sterility testing.",
  },
  {
    title: "Review & release",
    label: "The record stays open.",
    text: "Results are reviewed against the release specification. The Certificate of Analysis accompanies the approved lot.",
  },
  {
    title: "Store & ship",
    label: "Care through the last mile.",
    text: "Released inventory remains under temperature control and is shipped with temperature control when applicable.",
  },
];

export const articles = [
  {
    id: "reading-a-certificate",
    category: "DOCUMENTATION",
    title: "A closer look at your Certificate of Analysis.",
    description:
      "A practical guide to the identifiers, methods, and results in a lot record.",
    time: "1 min read",
    number: "01",
    sections: [
      [
        "Start with the lot.",
        "Match the identifier printed on the vial to the identifier on the certificate. Product names alone do not identify a specific production lot.",
      ],
      [
        "Read the method alongside the result.",
        "Purity, identity, endotoxin, and sterility answer different questions. Review each reported result together with its method and the specification shown on the record.",
      ],
      [
        "Keep the record with your work.",
        "Retain the applicable certificate with your laboratory documentation. Ask the supplier for clarification if a label, date, or identifier does not match.",
      ],
    ],
  },
  {
    id: "lot-level-traceability",
    category: "TRACEABILITY",
    title: "The small number that connects the whole process.",
    description:
      "How a lot identifier connects receipt, testing, release, and distribution.",
    time: "1 min read",
    number: "02",
    sections: [
      [
        "One identifier. A connected record.",
        "A lot number links a vial to its batch documentation. It provides a shared reference for laboratory records, supplier inquiries, and testing documents.",
      ],
      [
        "From receipt to release.",
        "The TrueMark prototype tracks receipt, quarantine, sampling, testing, release, and shipment as separate stages. Keeping those stages distinct makes a record easier to interpret.",
      ],
      [
        "Verification at the point of use.",
        "Use the printed lot identifier to locate the applicable record. Check that the compound and presentation agree with the material received.",
      ],
    ],
  },
  {
    id: "receiving-a-research-shipment",
    category: "LAB PRACTICE",
    title: "A considered approach to receiving your shipment.",
    description:
      "Documentation and receiving checks for a clear handoff to your laboratory.",
    time: "1 min read",
    number: "03",
    sections: [
      [
        "Check the shipment.",
        "Compare the received material with your order and accompanying documentation. Record the lot identifiers and any visible shipping damage.",
      ],
      [
        "Follow the applicable documentation.",
        "Use the product-specific storage and handling information together with your institution’s standard operating procedures.",
      ],
      [
        "Resolve discrepancies early.",
        "Keep the packaging and relevant records if you need to ask about the shipment. Include the product and lot identifier in your inquiry.",
      ],
    ],
  },
];

// The client's own questions and answers, as published on their current home page (2026-09-25).
export const faqs = [
  [
    "Why does the material arrive as a dry powder?",
    "Lyophilization removes water from a frozen solution under vacuum, leaving a dry cake. Peptide bonds hydrolyze slowly in water and faster at room temperature; removing the water largely stops that. The dry form also stores for years at −20 °C and ships with temperature control when applicable.",
  ],
  [
    "Why doesn’t the vial weight match the certificate?",
    "Fill weight is gross. Lyophilized peptides carry a counterion, usually acetate, plus residual water, so net peptide content typically runs 80 to 90 percent of the labeled weight. The certificate reports both figures. Compare net content, not label weight.",
  ],
  [
    "How is the material stored, and what changes once it’s in solution?",
    "Sealed vials are held at −20 °C, protected from light. Once dissolved, hydrolysis and oxidation resume and stability is measured in weeks under refrigeration rather than years frozen. Solution stability is compound-specific and stated per product.",
  ],
  [
    "What is a retest date?",
    "Not an expiry. It is the date by which material still in storage should be re-analyzed to confirm it meets its original specification. Correctly stored lyophilized peptides frequently pass well beyond it. Nothing becomes unusable on that date. It becomes unverified.",
  ],
  [
    "What is the lot number for?",
    "Every vial carries a lot number, printed beside a QR code that opens the Verify page. Entering the number there returns the certificate for that specific batch. A certificate that names no lot describes no particular vial.",
  ],
  [
    "What does research use only mean?",
    "A legal classification, not a comment on quality. These materials are supplied for in vitro laboratory work. They are not drugs, are not approved for use in humans or animals, and are not produced to pharmaceutical manufacturing standards.",
  ],
];
