export type ClaimCheck = { passed: boolean; flags: string[]; disclosureIncluded: boolean; line: string };
const patterns = [
  /\b(?:treat(?:s|ed|ing|ment)?|cur(?:e[sd]?|ing)|heal(?:s|ed|ing)?)\b/gi,
  /\b(?:weight|fat)[\s-]*(?:loss|losing|reduction|burn(?:ing)?)\b|\b(?:lose|burn|shed)[\s-]+(?:weight|fat)\b|\b(?:muscle[\s-]*(?:gains?|growth)|(?:gain|build)[\s-]+muscle|body[\s-]*composition)\b/gi,
  /\banti[\s-]*ag(?:e|ing|eing)\b|\bresults?\b/gi,
  /\b(?:dos(?:e[sd]?|ing|age)|mg\s*\/\s*kg|inject(?:s|ed|ing|ion|ions|able)?|cycl(?:e[sd]?|ing)|stack(?:s|ed|ing)?)\b/gi,
  /\b(?:humans?|patients?|clients?|for\s+you)\b/gi,
  /\bbefore[\s/–—-]*(?:(?:and|&)[\s/–—-]*)?after\b/gi,
  /\b(?:ozempic|wegovy|mounjaro|zepbound|medicines?|medications?|prescriptions?|drugs?)[\s-]*(?:alternative|replacement|equivalent)?\b|\b(?:compared\s+to|better\s+than|works?\s+like|as\s+effective\s+as|alternative\s+to)\s+(?:a\s+)?(?:insulin|metformin|semaglutide|tirzepatide|antibiotics?|painkillers?)\b/gi,
];

/** Conservative phrase screening, not a medical classifier. Exempt only the exact mandatory disclaimer. */
export function checkClaims(text: string, requiredDisclosure?: string): ClaimCheck {
  const normalized = text.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "");
  const scan = normalized.replace(/Not for human consumption\./g, "");
  const flags = [...new Set(patterns.flatMap((pattern) => [...scan.matchAll(pattern)].map((m) => m[0])))];
  if (!/\b(?:for\s+)?(?:laboratory\s+)?research[ -]use\s+only\b/i.test(normalized)) flags.push("Research-use framing is missing");
  const disclosureIncluded = !!requiredDisclosure && normalized.startsWith(requiredDisclosure.normalize("NFKC"));
  if (requiredDisclosure && !disclosureIncluded) flags.push("The complete partner disclosure must come first");
  return { passed: flags.length === 0, flags, disclosureIncluded,
    line: flags.length ? "Needs a rewrite" : disclosureIncluded ? "Checked: no health claims · disclosure included" : "Checked: no health claims · research use only" };
}
