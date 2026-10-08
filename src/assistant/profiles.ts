/*
 * What each compound is, for the chat: what it is, what it acts on as published research describes it,
 * the research fields that study it, and the papers behind that. Never use, effects or results in
 * people or animals; never dosing; never a medicine's name.
 *
 * Drafted from the published literature for TrueMark to review. A profile marked `reviewed: false` is
 * a draft: it shows, labelled as one, on the review and live sites where the client reviews, and stays
 * out of the launch build until the client approves it (flip it to true).
 */

export type Reference = { title: string; author: string; year: number; url: string };
export type CompoundProfile = {
  /** The compound's name exactly as the catalog sells it. */
  name: string;
  what: string;
  origin?: string;
  target?: string;
  fields: string[];
  sequence?: string;
  references: Reference[];
  reviewed: boolean;
};

/* Drafted 2026-10-07 from the published literature; every reference was checked to resolve to its title.
   References whose titles speak of outcomes, treatment, doses or animal use were left out. */
export const profiles: CompoundProfile[] = [
  {
    "name": "BAC Water",
    "what": "Bacteriostatic water: sterile water containing 0.9% benzyl alcohol as a bacteriostatic preservative.",
    "origin": "A laboratory diluent rather than a research compound; the benzyl alcohol limits microbial growth in a vial that is opened repeatedly.",
    "fields": [
      "laboratory reagent preparation",
      "reconstitution of lyophilized peptides"
    ],
    "references": [],
    "reviewed": false
  },
  {
    "name": "BPC-157",
    "what": "A synthetic linear 15-amino-acid peptide (pentadecapeptide), C62H98N16O22, molecular weight about 1419.5.",
    "origin": "A partial sequence of body protection compound (BPC), a protein described from human gastric juice.",
    "target": "No specific receptor has been identified; cell studies link it to VEGFR2–Akt–eNOS signaling, FAK–paxillin phosphorylation and growth hormone receptor expression in fibroblasts.",
    "fields": [
      "VEGFR2 signaling",
      "cell adhesion and migration signaling",
      "gastric peptide biochemistry"
    ],
    "sequence": "GEPPPGKPADDAGLV",
    "references": [
      {
        "title": "Pentadecapeptide BPC 157 enhances the growth hormone receptor expression in tendon fibroblasts",
        "author": "Chang",
        "year": 2014,
        "url": "https://doi.org/10.3390/molecules191119066"
      }
    ],
    "reviewed": false
  },
  {
    "name": "BPC-157 / TB-500",
    "what": "A blend of two synthetic peptides: BPC-157, a 15-residue peptide, and TB-500, characterized in the literature as the N-acetylated heptapeptide Ac-LKKTETQ.",
    "origin": "BPC-157 is a partial sequence of gastric body protection compound; TB-500 corresponds to residues 17–23 of thymosin β4, the protein's central actin-binding region.",
    "target": "BPC-157 has no identified receptor (cell studies implicate VEGFR2 and FAK–paxillin signaling); thymosin β4, TB-500's parent protein, binds and sequesters monomeric G-actin.",
    "fields": [
      "actin cytoskeleton biochemistry",
      "cell adhesion and migration signaling",
      "peptide fragment biochemistry"
    ],
    "sequence": "BPC-157: GEPPPGKPADDAGLV · TB-500: Ac-LKKTETQ",
    "references": [
      {
        "title": "Biological activities of thymosin β4 defined by active sites in short peptide sequences",
        "author": "Sosne",
        "year": 2010,
        "url": "https://doi.org/10.1096/fj.09-142307"
      },
      {
        "title": "Pentadecapeptide BPC 157 enhances the growth hormone receptor expression in tendon fibroblasts",
        "author": "Chang",
        "year": 2014,
        "url": "https://doi.org/10.3390/molecules191119066"
      }
    ],
    "reviewed": false
  },
  {
    "name": "Cagrilintide",
    "what": "A synthetic, lipidated 37-amino-acid peptide with a Cys2–Cys7 disulfide, an amidated C-terminus and an N-terminal C20 fatty diacid on a γ-glutamyl linker.",
    "origin": "A long-acting analog of amylin, a peptide hormone co-secreted with insulin by pancreatic beta cells.",
    "target": "Acts as a non-selective agonist at the amylin receptors (AMY1R–AMY3R, calcitonin receptor–RAMP complexes) and at the calcitonin receptor.",
    "fields": [
      "amylin receptor pharmacology",
      "calcitonin-family GPCR signaling",
      "peptide lipidation chemistry"
    ],
    "sequence": "(C20 diacid–γGlu)-KCNTATCATQRLAEFLRHSSNNFGPILPPTNVGSNTP-NH2 (Cys2–Cys7 disulfide)",
    "references": [
      {
        "title": "Development of cagrilintide, a long-acting amylin analogue",
        "author": "Kruse",
        "year": 2021,
        "url": "https://doi.org/10.1021/acs.jmedchem.1c00565"
      },
      {
        "title": "AM833 is a novel agonist of calcitonin family G protein–coupled receptors: pharmacological comparison with six selective and nonselective agonists",
        "author": "Fletcher",
        "year": 2021,
        "url": "https://doi.org/10.1124/jpet.121.000567"
      },
      {
        "title": "Structural and dynamic features of cagrilintide binding to calcitonin and amylin receptors",
        "author": "Cao",
        "year": 2025,
        "url": "https://doi.org/10.1038/s41467-025-58680-y"
      }
    ],
    "reviewed": false
  },
  {
    "name": "CJC (No DAC) / Ipamorelin",
    "what": "A blend of two synthetic peptides: tetrasubstituted GRF(1–29)-NH2, a 29-residue GHRH analog, and ipamorelin, a pentapeptide containing non-coded residues.",
    "origin": "“No DAC” names CJC-1295's peptide, [D-Ala2, Gln8, Ala15, Leu27]-hGRF(1–29), without its drug affinity complex; ipamorelin derives from the GHRP series.",
    "target": "Modified GRF(1–29) acts at the growth hormone-releasing hormone receptor (GHRHR); ipamorelin is an agonist at the growth hormone secretagogue receptor (GHS-R1a, the ghrelin receptor).",
    "fields": [
      "GHRH receptor pharmacology",
      "ghrelin receptor pharmacology",
      "pituitary peptide signaling"
    ],
    "sequence": "Modified GRF(1–29): Y-(D-Ala)-DAIFTQSYRKVLAQLSARKLLQDILSR-NH2 · Ipamorelin: Aib-His-D-2Nal-D-Phe-Lys-NH2",
    "references": [
      {
        "title": "Enhanced stability and potency of novel growth hormone-releasing factor (GRF) analogues derived from rodent and human GRF sequences",
        "author": "Campbell",
        "year": 1994,
        "url": "https://doi.org/10.1016/0196-9781(94)90211-9"
      },
      {
        "title": "Ipamorelin, the first selective growth hormone secretagogue",
        "author": "Raun",
        "year": 1998,
        "url": "https://doi.org/10.1530/eje.0.1390552"
      }
    ],
    "reviewed": false
  },
  {
    "name": "GHK-Cu",
    "what": "A copper(II) complex of the tripeptide glycyl-L-histidyl-L-lysine (GHK).",
    "origin": "GHK occurs naturally in human plasma, where it is one of the peptides that bind copper(II) with high affinity.",
    "target": "GHK binds Cu(II) through its N-terminal amine, a deprotonated amide nitrogen and the histidine imidazole; the peptide is also studied for effects on gene expression in cultured cells.",
    "fields": [
      "copper peptide coordination chemistry",
      "copper transport biochemistry",
      "gene expression profiling"
    ],
    "sequence": "GHK (Gly-His-Lys), complexed with Cu(II)",
    "references": [
      {
        "title": "X-ray and solution structures of Cu(II)GHK and Cu(II)DAHK complexes: influence on their redox properties",
        "author": "Hureau",
        "year": 2011,
        "url": "https://doi.org/10.1002/chem.201100751"
      }
    ],
    "reviewed": false
  },
  {
    "name": "GLOW",
    "what": "A blend of three research compounds: GHK-Cu (50 mg), BPC-157 (10 mg) and TB-500 (10 mg).",
    "origin": "GHK-Cu is a copper complex of a plasma tripeptide; BPC-157 is a partial sequence of gastric body protection compound; TB-500 corresponds to thymosin β4 residues 17–23.",
    "target": "GHK binds Cu(II); BPC-157 has no identified receptor (cell studies implicate VEGFR2 and FAK–paxillin signaling); thymosin β4, TB-500's parent protein, sequesters monomeric G-actin.",
    "fields": [
      "copper peptide coordination chemistry",
      "actin cytoskeleton biochemistry",
      "cell adhesion and migration signaling"
    ],
    "sequence": "GHK-Cu: GHK·Cu(II) · BPC-157: GEPPPGKPADDAGLV · TB-500: Ac-LKKTETQ",
    "references": [
      {
        "title": "X-ray and solution structures of Cu(II)GHK and Cu(II)DAHK complexes: influence on their redox properties",
        "author": "Hureau",
        "year": 2011,
        "url": "https://doi.org/10.1002/chem.201100751"
      },
      {
        "title": "Pentadecapeptide BPC 157 enhances the growth hormone receptor expression in tendon fibroblasts",
        "author": "Chang",
        "year": 2014,
        "url": "https://doi.org/10.3390/molecules191119066"
      },
      {
        "title": "Biological activities of thymosin β4 defined by active sites in short peptide sequences",
        "author": "Sosne",
        "year": 2010,
        "url": "https://doi.org/10.1096/fj.09-142307"
      }
    ],
    "reviewed": false
  },
  {
    "name": "KPV",
    "what": "A synthetic tripeptide, Lys-Pro-Val.",
    "origin": "The C-terminal tripeptide (residues 11–13) of alpha-melanocyte-stimulating hormone (α-MSH).",
    "target": "Taken up by the di/tripeptide transporter PepT1 in epithelial and immune cells, and studied for inhibition of NF-κB and MAP kinase signaling in cultured cells.",
    "fields": [
      "melanocortin-derived peptides",
      "epithelial peptide transport (PepT1)",
      "NF-κB signaling"
    ],
    "sequence": "KPV",
    "references": [],
    "reviewed": false
  },
  {
    "name": "Melanotan II",
    "what": "A synthetic cyclic heptapeptide, Ac-Nle-cyclo[Asp-His-D-Phe-Arg-Trp-Lys]-NH2, closed by a lactam bridge between Asp and Lys (C50H69N15O9).",
    "origin": "A truncated, cyclic lactam analog of the alpha-melanocyte-stimulating hormone (α-MSH) fragment 4–10.",
    "target": "Binds and activates the melanocortin receptors MC1R, MC3R, MC4R and MC5R; it does not act at the ACTH-selective MC2R.",
    "fields": [
      "melanocortin receptor pharmacology",
      "cyclic peptide design",
      "GPCR ligand selectivity"
    ],
    "sequence": "Ac-Nle-c[D-H-(D-Phe)-R-W-K]-NH2 (lactam bridge Asp–Lys)",
    "references": [
      {
        "title": "Potent and prolonged-acting cyclic lactam analogs of α-melanotropin: design based on molecular dynamics",
        "author": "Al-Obeidi",
        "year": 1989,
        "url": "https://doi.org/10.1021/jm00132a010"
      },
      {
        "title": "Selectivity of cyclic [D-Nal7] and [D-Phe7] substituted MSH analogues for the melanocortin receptor subtypes",
        "author": "Schiöth",
        "year": 1997,
        "url": "https://doi.org/10.1016/s0196-9781(97)00079-x"
      }
    ],
    "reviewed": false
  },
  {
    "name": "MOTS-C",
    "what": "A 16-amino-acid peptide encoded by a short open reading frame in the mitochondrial 12S rRNA gene.",
    "origin": "A mitochondrial-derived peptide; the name stands for mitochondrial open reading frame of the 12S rRNA-c.",
    "target": "Cell studies report inhibition of the folate cycle and de novo purine synthesis, leading to AMPK activation, and AMPK-dependent translocation to the nucleus under metabolic stress.",
    "fields": [
      "mitochondrial-derived peptide biology",
      "AMPK signaling",
      "mitonuclear communication"
    ],
    "sequence": "MRWQEMGYIFYPRKLR",
    "references": [
      {
        "title": "The mitochondrial-encoded peptide MOTS-c translocates to the nucleus to regulate nuclear gene expression in response to metabolic stress",
        "author": "Kim",
        "year": 2018,
        "url": "https://doi.org/10.1016/j.cmet.2018.06.008"
      }
    ],
    "reviewed": false
  },
  {
    "name": "NAD+",
    "what": "Nicotinamide adenine dinucleotide in its oxidized form: adenosine and nicotinamide ribonucleotides joined by a pyrophosphate bridge (C21H27N7O14P2). Not a peptide.",
    "origin": "A coenzyme found in all living cells.",
    "target": "Serves as a redox coenzyme (NAD+/NADH) and as a substrate consumed by NAD+-dependent enzymes, including sirtuins, poly(ADP-ribose) polymerases and CD38.",
    "fields": [
      "redox biochemistry",
      "sirtuin and PARP enzymology",
      "mitochondrial metabolism"
    ],
    "references": [
      {
        "title": "NAD+ metabolism and the control of energy homeostasis: a balancing act between mitochondria and the nucleus",
        "author": "Cantó",
        "year": 2015,
        "url": "https://doi.org/10.1016/j.cmet.2015.05.023"
      }
    ],
    "reviewed": false
  },
  {
    "name": "Retatrutide",
    "what": "A synthetic 39-amino-acid peptide with three non-coded residues (Aib2, α-methyl-L-leucine13, Aib20), an amidated C-terminus and a C20 fatty diacid on Lys17 via a linker.",
    "origin": "Developed from a glucose-dependent insulinotropic polypeptide (GIP) backbone, research code LY3437943.",
    "target": "A single-molecule agonist at three class B GPCRs: the GIP receptor, the GLP-1 receptor and the glucagon receptor, with greater relative activity at GIPR.",
    "fields": [
      "incretin and glucagon receptor pharmacology",
      "class B GPCR structural biology",
      "multi-receptor peptide design"
    ],
    "sequence": "Y-Aib-QGTFTSDYSI-αMeL-LDKK*AQ-Aib-AFIEYLLEGGPSSGAPPPS-NH2 (K* = Lys17 with a C20 fatty diacid)",
    "references": [
      {
        "title": "Structural insights into the triple agonism at GLP-1R, GIPR and GCGR manifested by retatrutide",
        "author": "Li",
        "year": 2024,
        "url": "https://doi.org/10.1038/s41421-024-00700-0"
      }
    ],
    "reviewed": false
  },
  {
    "name": "Selank",
    "what": "A synthetic heptapeptide, Thr-Lys-Pro-Arg-Pro-Gly-Pro.",
    "origin": "An analog of tuftsin (Thr-Lys-Pro-Arg), extended at the C-terminus with Pro-Gly-Pro.",
    "target": "No receptor has been identified; gene-expression studies associate it with GABAergic signaling.",
    "fields": [
      "neuropeptide pharmacology",
      "GABAergic signaling",
      "gene expression profiling"
    ],
    "sequence": "TKPRPGP",
    "references": [],
    "reviewed": false
  },
  {
    "name": "Semaglutide",
    "what": "A synthetic 31-amino-acid peptide with Aib at position 2 and a C18 fatty diacid attached to Lys20 through a γGlu–2×OEG linker.",
    "origin": "An analog of human GLP-1(7–37) with two substitutions (Aib8, Arg34) and acylation at Lys26, in GLP-1 numbering.",
    "target": "Binds and activates the glucagon-like peptide-1 receptor (GLP-1R), a class B G protein-coupled receptor; its fatty diacid side chain binds serum albumin.",
    "fields": [
      "incretin receptor pharmacology",
      "class B GPCR signaling",
      "peptide acylation and albumin binding"
    ],
    "sequence": "H-Aib-EGTFTSDVSSYLEGQAAK*EFIAWLVRGRG-OH (K* = Lys20 with a C18 diacid via γGlu–2×OEG)",
    "references": [],
    "reviewed": false
  },
  {
    "name": "Semax",
    "what": "A synthetic heptapeptide, Met-Glu-His-Phe-Pro-Gly-Pro.",
    "origin": "An analog of the ACTH(4–10) fragment: the ACTH(4–7) sequence Met-Glu-His-Phe followed by Pro-Gly-Pro.",
    "target": "Binds specific, saturable sites in rat basal forebrain membranes and is studied for effects on BDNF expression; its receptor has not been identified.",
    "fields": [
      "neuropeptide pharmacology",
      "neurotrophin (BDNF/TrkB) signaling",
      "melanocortin-derived peptides"
    ],
    "sequence": "MEHFPGP",
    "references": [
      {
        "title": "Semax, an analogue of adrenocorticotropin (4–10), binds specifically and increases levels of brain-derived neurotrophic factor protein in rat basal forebrain",
        "author": "Dolotov",
        "year": 2006,
        "url": "https://doi.org/10.1111/j.1471-4159.2006.03658.x"
      }
    ],
    "reviewed": false
  },
  {
    "name": "Tesamorelin",
    "what": "A synthetic 44-amino-acid peptide: human GHRH(1–44)-NH2 carrying a trans-3-hexenoyl group on the N-terminal tyrosine.",
    "origin": "An analog of human growth hormone-releasing hormone (GHRH), research code TH9507.",
    "target": "An agonist at the growth hormone-releasing hormone receptor (GHRHR); the N-terminal acyl group confers resistance to dipeptidyl peptidase-IV cleavage.",
    "fields": [
      "GHRH receptor pharmacology",
      "hypothalamic–pituitary peptide signaling",
      "peptide stability chemistry"
    ],
    "sequence": "(trans-3-hexenoyl)-YADAIFTNSYRKVLGQLSARKLLQDIMSRQQGESNQERGARARL-NH2",
    "references": [],
    "reviewed": false
  },
  {
    "name": "Tirzepatide",
    "what": "A synthetic 39-amino-acid linear peptide with Aib at positions 2 and 13, an amidated C-terminus and a C20 fatty diacid on Lys20 via a linker.",
    "origin": "Designed on the sequence of glucose-dependent insulinotropic polypeptide (GIP), research code LY3298176.",
    "target": "A dual agonist at the GIP and GLP-1 receptors, reported to engage GIPR more strongly and to favor cAMP over β-arrestin signaling at GLP-1R.",
    "fields": [
      "incretin receptor pharmacology",
      "biased GPCR signaling",
      "peptide acylation chemistry"
    ],
    "sequence": "Y-Aib-EGTFTSDYSI-Aib-LDKIAQK*AFVQWLIAGGPSSGAPPPS-NH2 (K* = Lys20 with a C20 diacid via γGlu–2×OEG)",
    "references": [
      {
        "title": "Tirzepatide is an imbalanced and biased dual GIP and GLP-1 receptor agonist",
        "author": "Willard",
        "year": 2020,
        "url": "https://doi.org/10.1172/jci.insight.140532"
      }
    ],
    "reviewed": false
  }
];

const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9+]+/g, "");
/** The profile for a compound, by its catalog name (spacing, case and punctuation forgiven). */
export function profileFor(name: string, drafts = true): CompoundProfile | null {
  const found = profiles.find((p) => key(p.name) === key(name));
  return found && (found.reviewed || drafts) ? found : null;
}
