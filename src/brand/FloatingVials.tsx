import type { CSSProperties } from "react";
import { productById, productCutout } from "../shop/catalog";
import { tone } from "../shop/ui";
import { sheenMask } from "./light";

type Float = {
  id: string;
  /** Position of the vial's centre, as a share of the field. */
  x: number;
  y: number;
  /** Width as a share of the field's width. */
  w: number;
  rotate: number;
  /** Far vials are smaller, softer and dimmer; 0 is nearest. */
  depth: 0 | 1 | 2;
  /** Seconds for one drift cycle. Primes, so no two vials ever fall into step. */
  cycle: number;
  delay: number;
};

/**
 * The collection, drifting. Used where the brand needs to feel alive rather
 * than sold: the sign-in gate. Cut-outs only; nothing recolours a label. Each
 * vial is glass for the scene's light (light.ts): it catches a highlight, and
 * shifts with its depth as the light moves.
 */
export function FloatingVials({ layout, className = "" }: { layout: Float[]; className?: string }) {
  return (
    <div className={`tm-floats ${className}`} aria-hidden="true">
      {layout.map((f, i) => {
        const product = productById(f.id);
        if (!product) return null;
        const src = productCutout(product, f.depth === 0 ? "lg" : "sm");
        return (
          <span
            key={f.id}
            className={`tm-float tm-float-d${f.depth}`}
            data-sheen
            style={
              {
                ...tone(product),
                left: `${f.x * 100}%`,
                top: `${f.y * 100}%`,
                width: `${f.w * 100}%`,
                "--tm-rot": `${f.rotate}deg`,
                "--tm-cycle": `${f.cycle}s`,
                "--tm-delay": `${f.delay}s`,
                "--tm-i": i,
              } as CSSProperties
            }
          >
            <span className="tm-float-body">
              <span className="tm-float-glow" />
              <img src={src} alt="" draggable={false} />
              <span className="tm-sheen" style={sheenMask(src)} />
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** The gate's constellation: clear of the statement (top left) and the lot line (bottom left). */
export const gateLayout: Float[] = [
  { id: "retatrutide-10-mg", x: 0.8, y: 0.54, w: 0.25, rotate: -7, depth: 0, cycle: 13, delay: 0 },
  { id: "ghk-cu-100-mg", x: 0.9, y: 0.15, w: 0.15, rotate: 12, depth: 1, cycle: 17, delay: -4 },
  { id: "bpc-157-10-mg", x: 0.66, y: 0.86, w: 0.12, rotate: -16, depth: 1, cycle: 19, delay: -9 },
  { id: "nad-500-mg", x: 0.97, y: 0.8, w: 0.16, rotate: 18, depth: 1, cycle: 23, delay: -2 },
  { id: "semax-10-mg", x: 0.66, y: 0.08, w: 0.08, rotate: -24, depth: 2, cycle: 29, delay: -11 },
  { id: "tesamorelin-10-mg", x: 0.47, y: 0.04, w: 0.07, rotate: 14, depth: 2, cycle: 31, delay: -6 },
  { id: "melanotan-ii-10-mg", x: 0.98, y: 0.42, w: 0.08, rotate: 28, depth: 2, cycle: 37, delay: -15 },
];
