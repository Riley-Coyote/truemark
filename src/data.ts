export const categories = [
  { id: "all", name: "All compounds", short: "All compounds" },
  {
    id: "peptide-fragments",
    name: "Peptide fragments",
    short: "Peptide fragments",
  },
  {
    id: "secretagogue-peptides",
    name: "Secretagogue peptides",
    short: "Secretagogues",
  },
  { id: "neuropeptides", name: "Neuropeptides", short: "Neuropeptides" },
  {
    id: "mitochondrial-peptides",
    name: "Mitochondrial peptides",
    short: "Mitochondrial",
  },
  {
    id: "copper-complexes",
    name: "Copper complexes",
    short: "Copper complexes",
  },
  {
    id: "amino-acids",
    name: "Amino acids & derivatives",
    short: "Amino acids",
  },
  {
    id: "melanocortin-analogs",
    name: "Melanocortin analogs",
    short: "Melanocortins",
  },
  { id: "lab-supplies", name: "Lab supplies", short: "Lab supplies" },
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
  form: "Lyophilized powder" | "Research diluent";
  lot: string;
};

// Names, sizes, label colors and first-batch references come from the client brand kit.
// Prices reflect the client's current WordPress catalog.
export const products: Product[] = [
  {
    id: "retatrutide-10-mg",
    name: "Retatrutide",
    size: "10 mg",
    category: "peptide-fragments",
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
    category: "peptide-fragments",
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
    category: "peptide-fragments",
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
    category: "peptide-fragments",
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
    category: "peptide-fragments",
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
    category: "peptide-fragments",
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
    category: "peptide-fragments",
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
    category: "copper-complexes",
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
    category: "peptide-fragments",
    price: 75,
    image: "/images/products/glow-70-mg.png",
    color: "#CC3358",
    colorInk: "#7C1830",
    form: "Lyophilized powder",
    lot: "TM-GLW70-2609-01",
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
    category: "amino-acids",
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
  // The client chose the supplied 10 mg / 10 mg artwork while corrected 5 mg / 5 mg brand-kit art is pending.
  {
    id: "cjc-ipa-1010-mg",
    name: "CJC (No DAC) / Ipamorelin",
    size: "10 mg / 10 mg",
    category: "secretagogue-peptides",
    price: 55,
    image: "/images/products/cjc-no-dac-ipamorelin-10-mg-10-mg.png",
    color: "#0273D0",
    colorInk: "#00437A",
    form: "Lyophilized powder",
    lot: "TM-CJI10-2609-01",
  },
];

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
    text: "Released inventory remains under temperature control and is shipped to the receiving research organization.",
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

export const faqs = [
  [
    "Where do I find my lot number?",
    "Look for the lot identifier on your vial label. Enter it on the Verify a lot page to find the corresponding record. The sample record in this prototype is BP10-2611A.",
  ],
  [
    "What does the Certificate of Analysis include?",
    "The certificate associates a compound and lot identifier with the testing methods, reported results, and release information for that lot.",
  ],
  [
    "Who is the catalog intended for?",
    "The catalog is intended for qualified laboratory and institutional research buyers. Products are supplied for research use only, not for human or veterinary use.",
  ],
  [
    "Where can I find handling information?",
    "Use the Handling page to locate receiving and documentation guidance. Product-specific documentation and your laboratory’s procedures govern the handling of each material.",
  ],
];
