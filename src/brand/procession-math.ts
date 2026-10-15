/** Geometry shared by the passage and the carousel. No DOM reads in the frame loop. */
export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (n: number) => { const t = clamp01(n); return t * t * t * (t * (t * 6 - 15) + 10); };
export const modulo = (n: number, count: number) => ((n % count) + count) % count;
export const distance = (i: number, position: number, count: number) => modulo(i - position + count / 2, count) - count / 2;

/** Critically damped spring, solved analytically so a dropped frame cannot destabilize it.
 * mass 1, stiffness 100, damping 20 at normal speed. Retargeting retains velocity. */
export function advance(position: number, velocity: number, target: number, dt: number, speed = 1) {
  const omega = 10 * speed, offset = position - target, v = velocity + omega * offset;
  const decay = Math.exp(-omega * dt);
  return { position: target + (offset + v * dt) * decay, velocity: (velocity - omega * v * dt) * decay };
}

/** One class every 12.5 seconds at normal speed. Integrating the velocity ramp
 * exactly keeps the first frame of autoplay at rest, without a frame-rate bias. */
export function advanceDrift(position: number, velocity: number, dt: number, speed = 1) {
  const cruise = .08 * speed, response = .5, decay = Math.exp(-dt / response);
  return {
    position: position + cruise * dt + (velocity - cruise) * response * (1 - decay),
    velocity: cruise + (velocity - cruise) * decay,
  };
}

/** A smooth lens-like emphasis. Unlike abs/linear scale, this has no kink at center. */
export function pose(d: number, spacing: number, height: number) {
  const emphasis = Math.exp(-.48 * d * d);
  const scale = .66 + .34 * emphasis;
  return { x: d * spacing, y: -height * .025 * (1 - emphasis), scale };
}

export const HANDOFF = .40, RISE = .62;

/** One rigid camera for the room and everything seated in it. Points are in the
 * resting viewport's coordinates; x/y + point * zoom is their filmed position.
 * The push leads the fall slightly. Copies never take over while glass is visible. */
export function scene(p: number, px: number, py: number, depth: number, fall: number) {
  const t = clamp01(p / HANDOFF), zoom = 1 + (depth - 1) * smooth(t);
  const drop = smooth((t - .12) / .88);
  return { zoom, x: px * (1 - zoom), y: py * (1 - zoom) + fall * drop, drop };
}
