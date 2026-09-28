import type { CSSProperties } from "react";

/** A peptide drawn as its residues, one bead per amino acid: the brand's helix, made literal. */
export function SequenceChain({ sequence, name }: { sequence: string; name: string }) {
  return (
    <p className="tm-chain" role="img" aria-label={`${name} sequence, ${sequence.length} residues: ${sequence}`}>
      {sequence.split("").map((residue, i) => (
        <span key={i} className="tm-chain-bead" style={{ "--tm-i": i } as CSSProperties}>
          {residue}
        </span>
      ))}
    </p>
  );
}
