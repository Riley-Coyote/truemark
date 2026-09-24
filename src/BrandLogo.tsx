import { assetUrl } from "./assetUrl";

/** The client-supplied outlined lockup; never reconstructed as live text. */
export function BrandLogo() {
  return (
    <img
      className="brand-logo"
      src={assetUrl("images/brand/logo.svg")}
      alt="TrueMark BioLabs"
      width="200"
      height="62"
    />
  );
}
