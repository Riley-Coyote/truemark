/**
 * Deterministic boundary for visitor/partner user text, before any provider call.
 * - refuse: a request about using a compound (dosing, administration, cycles, one's own body or pet,
 *   safety, side effects, treatment, weight or body goals). The fixed refusal answers; no model runs.
 * - steer: a general question that mentions people or animals ("what do people use these for?").
 *   The model answers what the records can say (what the compound is, what it acts on, which research
 *   fields study it) under an added rule never to describe use or effects in people or animals.
 * - pass: everything else.
 */
export type Boundary = "refuse" | "steer" | "pass";

function normalise(message: string) {
  let text = message.normalize("NFKC").toLowerCase().replace(/[\u200b-\u200d\ufeff]/g, "").replace(/[’‘]/g, "'");
  // Remove only explicit lab/software phrases, never the whole sentence. A second
  // clause asking about a dose, body or animal still matches the checks below.
  text = text.replace(/\bnot (?:intended )?for (?:human(?: or animal)?|animal) (?:use|consumption)\b/g, " ")
    .replace(/\b(?:freeze[ -]thaw|pcr|thermal|instrument|inventory)\s+cycles?(?:\s+counts?)?\b/g, " ")
    .replace(/\bcycle counts?(?:\s+(?:on|of|for|in))?\s+(?:the\s+)?hplc\b/g, " ")
    .replace(/\b(?:software|technology|tech) stack\b|\bstack traces?\b|\bstack (?:the )?(?:labels|boxes|vials)\b/g, " ")
    .replace(/\b(?:account|site|website|business) administration\b/g, " ");
  return text;
}

const REFUSE = [
  /\b(?:dos(?:e|es|ing|age|ages)|microdos(?:e|es|ing))\b/,
  /\b(?:mg|mcg|milligrams?|micrograms?)\s*(?:\/|per|for (?:each|every))\s*(?:kg|kilograms?|kilos?|lb|pounds?)\b/,
  /\b(?:inject\w*|injections?|administer\w*|administration|subcutaneous|intramuscular|intravenous|intranasal|sub[ -]?q)\b/,
  /\b(?:cycles?|cycling|cycled|stacks?|stacking|stacked)\b/,
  /\b(?:how much|how many|how often|how long|when)\b.{0,60}\b(?:i|we|he|she|they|you|someone|a person|an adult)\b.{0,30}\b(?:take|use|consume|give|start)\b/,
  /\bhow (?:much|many)\b.{0,35}\b(?:for|to) (?:my |a |the )?(?:dog|cat|pet|rat|mouse|child)\b/,
  /\b(?:units?|milligrams?|mg|mcg) (?:a|per|each) (?:day|week)\b/,
  /\b(?:can|should|could|may|do)\s+(?:i|we|you|someone)\s+(?:safely\s+)?(?:take|consume|swallow|inhale|drink|snort)\b/,
  // Giving, trying or applying it to anyone, and anything about safety in a body, is a use request.
  /\b(?:give|given|giving|try|tried|apply|safe|safety)\b.{0,55}\b(?:humans?|people|patients?|persons?|adults?|children|kids|animals?|pets?|dogs?|cats?|mice|rats?|rabbits?|horses?|myself|my body)\b/,
  /\b(?:use|used|using|effects?|test|testing)\b.{0,55}\b(?:myself|my body|my (?:dog|cat|pet|kid|child|horse))\b/,
  /\b(?:human|animal|veterinary)\s+administration\b/,
  /\b(?:side[ -]?effects?|adverse (?:effects?|reactions?)|contraindications?|drug interactions?)\b/,
  /\b(?:treat\w*|cur(?:e|es|ing)|heal\w*|therap(?:y|eutic)|medicin(?:e|al)|medical advice)\b/,
  /\b(?:weight[ -]?loss|lose (?:weight|fat)|burn (?:fat|calories)|build muscle|body[ -]?composition|anti[ -]?aging)\b/,
  /\b(?:help|improve|reduce|relieve|fix)\b.{0,45}\b(?:my|our|your)\s+(?:sleep|pain|anxiety|injury|arthritis|diabetes|health)\b/,
  /\b(?:reconstitut\w*|mix|dilute)\b.{0,50}\b(?:to take|to use on myself|for (?:injection|myself|my dog))\b/,
];
const STEER = [
  /\b(?:human|animal|veterinary)\s+(?:use|consumption|testing|trials?)\b/,
  /\b(?:use|used|uses|using|effects?|test|testing)\b.{0,55}\b(?:humans?|people|patients?|persons?|adults?|children|kids|animals?|mice|rats?|rabbits?|horses?)\b/,
  /\b(?:humans?|people|folks|researchers|customers)\b.{0,40}\b(?:use|used|uses|using)\b/,
];

export function boundaryOf(message: string): Boundary {
  const text = normalise(message);
  if (REFUSE.some((pattern) => pattern.test(text))) return "refuse";
  return STEER.some((pattern) => pattern.test(text)) ? "steer" : "pass";
}
export const mustRefuse = (message: string) => boundaryOf(message) === "refuse";
