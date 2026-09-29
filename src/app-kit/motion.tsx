/**
 * Figures that travel to their values, shared by the partner portal's sale moment
 * and the command center's pulse. A rise counts up from the figure last shown; a
 * fall lands at once, and with reduced motion every change does.
 */
import { useEffect, useRef, useState } from "react";
import { MoneyFigure } from "./components";

/** How long a figure takes to travel to its value. */
const COUNT_MS = 900;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A number that travels to its value. It starts at `from` when given (the toast counts
 * up from zero), otherwise at the value itself; after that, each rise counts up from the
 * figure last shown. Falls land at once, and with reduced motion every change does.
 */
export function useCountUp(value: number, from?: number): number {
  const [shown, setShown] = useState(() => (from !== undefined && !prefersReducedMotion() ? from : value));
  const current = useRef(shown);
  useEffect(() => {
    const start = current.current;
    if (start === value) return;
    if (value < start || prefersReducedMotion()) {
      current.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    let began: number | null = null;
    const step = (now: number) => {
      began ??= now;
      const t = Math.min(1, (now - began) / COUNT_MS);
      const eased = 1 - (1 - t) ** 3;
      const next = t === 1 ? value : start + (value - start) * eased;
      current.current = next;
      setShown(next);
      if (t < 1) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}

/** A money figure with quiet cents that counts up to each new value. */
export function CountingMoney({ value, from }: { value: number; from?: number }) {
  const shown = useCountUp(value, from);
  return <MoneyFigure value={Math.round(shown * 100) / 100} />;
}
