import { assetUrl } from "./assetUrl";

/** The client-supplied outlined lockup; never reconstructed as live text. */
export function BrandLogo({ variant = "black" }: { variant?: "black" | "white" | "gradient" }) {
  return (
    <img
      className="brand-logo"
      src={assetUrl(`images/brand/kit/lockup-${variant}.svg`)}
      alt="TrueMark BioLabs"
      width="164"
      height="40"
    />
  );
}
