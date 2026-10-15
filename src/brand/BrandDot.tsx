import "./hero.css";

/** The logo's dot, used as a full stop: the one place the gradient touches type. */
export function BrandDot() {
  return (
    <>
      <span className="tm-brand-dot" aria-hidden="true" />
      <span className="sr-only">.</span>
    </>
  );
}
