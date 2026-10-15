/**
 * The light the lot leaves on its record (TrailCarrier.tsx): drawn on a canvas under the record's words. Nothing in it
 * is blurred: it is light as a camera sees it, caught by fine things.
 *
 * The line the vial has travelled is a filament lit in the brand's own gradient, the one the lot's dot was lit with:
 * ember at the first station, through iris, to blue where the lot is now. It has a bright core, and light runs along
 * inside it toward the vial, slowly, as light along a fibre. Behind the moving vial a murmuration of grains streams off
 * the line: one body, every grain carried by the same slow field of flow, so they sweep and fold together instead of
 * scattering, and are drawn back onto the line as they fade. Each grain is a fine flake in the colour of the stretch
 * of line it rose from, most of them very small and a few larger, nearer; as each turns, its facet catches the light
 * for an instant and flashes white, the way glitter or dust in a sunbeam does. Grains moving fast are drawn as the
 * short streak a shutter would catch. Where the vial is set down, a spray of sparks leaves the station.
 *
 * Once the journey is over the line stays alive: now and then a grain rises from it, or catches the light on it, and
 * the light runs along it still. With motion off it is drawn once: the lit filament, no grains.
 */

export type Point = { x: number; y: number };

/** The brand gradient (tokens.css --tm-gradient), from the first station to the last. */
const STOPS: [number, [number, number, number]][] = [
  [0, [233, 40, 76]],
  [0.28, [179, 20, 107]],
  [0.55, [122, 42, 160]],
  [0.8, [47, 20, 146]],
  [1, [10, 46, 169]],
];
/** How far the light may reach beyond the record's line on either side (px). */
export const REACH = { across: 26, along: 18 } as const;

type RGB = [number, number, number];
const colourAt = (t: number): RGB => {
  const u = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i++) {
    const [b, cb] = STOPS[i];
    const [a, ca] = STOPS[i - 1];
    if (u <= b) {
      const k = (u - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k];
    }
  }
  return STOPS[STOPS.length - 1][1];
};
const rgba = ([r, g, b]: RGB, a: number) => `rgba(${r | 0},${g | 0},${b | 0},${Math.min(1, Math.max(0, a)).toFixed(3)})`;
/** Toward white by `k`: the colour as more of the light is reflected straight back. */
const lift = ([r, g, b]: RGB, k: number): RGB => [r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k];

/** A grain: where it is along the line (s) and across it (n), how it moves, its life, how near it is (z, 0 to 1: size
 *  and brightness), its facet (when and how fast it turns into the light), and its colour. */
type Grain = { s: number; n: number; vs: number; vn: number; age: number; life: number; z: number; facet: number; turn: number; spark: boolean; colour: RGB };

export function createTrailLight(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  let points: Point[] = [];
  let vertical = false;
  let scale = 1;
  let width = 0;
  let height = 0;
  let grains: Grain[] = [];
  // Along the line (s) and across it (n), in the canvas's own pixels: the record's line is straight either way.
  let s0 = 0;
  let s1 = 1;
  let line = 0;
  const toXY = (s: number, n: number): Point => (vertical ? { x: line + n, y: s } : { x: s, y: line + n });
  const sOf = (p: Point) => (vertical ? p.y : p.x) + REACH.along;
  const share = (s: number) => Math.min(1, Math.max(0, (s - s0) / (s1 - s0 || 1)));

  /** The record's stations (relative to its rail) and the rail's size: the canvas covers the rail and the light's
   *  reach around it. */
  function layout(stations: Point[], isVertical: boolean, rail: { width: number; height: number }) {
    points = stations;
    vertical = isVertical;
    scale = Math.min(2, window.devicePixelRatio || 1);
    const padX = vertical ? REACH.across : REACH.along;
    const padY = vertical ? REACH.along : REACH.across;
    width = rail.width + padX * 2;
    height = rail.height + padY * 2;
    canvas.style.left = `${-padX}px`;
    canvas.style.top = `${-padY}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    if (!points.length) return;
    const first = points[0];
    s0 = sOf(first);
    s1 = sOf(points[points.length - 1]);
    line = vertical ? first.x + padX : first.y + padY;
  }

  const along = (a: Point, b: Point, k: number, alpha: number) => {
    const g = ctx!.createLinearGradient(a.x, a.y, b.x, b.y);
    for (const [at, colour] of STOPS) g.addColorStop(at, rgba(lift(colour, k), alpha));
    return g;
  };

  /** The lit filament from the first station to the head (the vial), and the light running inside it. */
  function drawLine(head: number, time: number, running: boolean) {
    if (!ctx || head <= s0 + 0.5) return;
    const from = toXY(s0, 0);
    const to = toXY(s1, 0);
    const end = toXY(head, 0);
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";
    // The filament, and its bright core.
    for (const [lineWidth, k, alpha] of [[1.9, 0.04, 0.92], [0.7, 0.72, 0.9]] as const) {
      ctx.strokeStyle = along(from, to, k, alpha);
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    if (!running) return;
    // Light running along inside it toward the vial: short bright lengths of the core, sharp across, fading along.
    const span = head - s0;
    for (let k = 0; k < 3; k++) {
      const phase = (((time * 0.15 + k / 3) % 1) + 1) % 1;
      const mid = s0 + phase * span;
      const half = 26;
      const a = toXY(Math.max(s0, mid - half), 0);
      const b = toXY(Math.min(head, mid + half), 0);
      const fade = Math.sin(Math.PI * phase);
      const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, `rgba(255,255,255,${(0.9 * fade).toFixed(3)})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  function spawn(s: number, n: number, vs: number, vn: number, life: number, spark = false) {
    if (grains.length > 780) grains.shift();
    // Most grains are fine and far, a few large and near.
    const z = spark ? 0.55 + Math.random() * 0.45 : Math.random() ** 2.2;
    grains.push({ s, n, vs, vn, age: 0, life, z, facet: Math.random() * Math.PI * 2, turn: 2 + Math.random() * 5, spark, colour: colourAt(share(s)) });
  }

  /** A spray of sparks from station `i`, as the vial is set down on it. */
  function burst(i: number) {
    const p = points[i];
    if (!p) return;
    const s = sOf(p);
    for (let k = 0; k < 14; k++) {
      const angle = (k / 14) * Math.PI * 2 + Math.random() * 0.45;
      const speed = 70 + Math.random() * 95;
      spawn(s, 0, Math.cos(angle) * speed, Math.sin(angle) * speed * 0.8, 0.45 + Math.random() * 0.55, true);
    }
  }

  /** The one field of flow that carries every grain: larger, slower currents, so neighbours move together. */
  const flow = (s: number, n: number, t: number) =>
    2.4 * Math.sin(s * 0.0068 + t * 0.4) + 1.6 * Math.sin(n * 0.045 - t * 0.58 + s * 0.0027) + 1 * Math.sin(s * 0.0036 - n * 0.03 + t * 0.25);

  function drawGrain(g: Grain, time: number) {
    if (!ctx) return;
    const u = g.age / g.life;
    const presence = Math.pow(Math.sin(Math.PI * Math.min(1, u)), 0.6);
    // The facet turning through the light: dark most of the time, then for an instant a flash.
    const glint = Math.pow(Math.max(0, Math.sin(g.facet + time * g.turn)), 9);
    const size = 0.6 + g.z * 1.7 + glint * 0.6;
    const alpha = presence * (0.5 + 0.4 * g.z + 0.45 * glint);
    const colour = lift(g.colour, 0.12 + 0.82 * glint);
    const p = toXY(g.s, g.n);
    const speed = Math.hypot(g.vs, g.vn);
    ctx.globalAlpha = 1;
    if (speed > 34) {
      // Fast: the streak a shutter would catch, as long as a frame's travel.
      const k = Math.min(7, speed * 0.018) / speed;
      const tail = toXY(g.s - g.vs * k, g.n - g.vn * k);
      ctx.strokeStyle = rgba(colour, alpha);
      ctx.lineWidth = size * 0.85;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else {
      ctx.fillStyle = rgba(colour, alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      // A near grain turned full into the light throws the small four-point star a lens records of a real glint.
      if (g.z > 0.55 && glint > 0.8) {
        const reach = 2.5 + g.z * 4 * glint;
        const strength = presence * (glint - 0.8) * 4;
        ctx.lineWidth = 0.6;
        ctx.lineCap = "butt";
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const a = { x: p.x - dx * reach, y: p.y - dy * reach };
          const b = { x: p.x + dx * reach, y: p.y + dy * reach };
          const ray = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          ray.addColorStop(0, "rgba(255,255,255,0)");
          ray.addColorStop(0.5, `rgba(255,255,255,${Math.min(1, strength).toFixed(3)})`);
          ray.addColorStop(1, "rgba(255,255,255,0)");
          ctx.strokeStyle = ray;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
  }

  /**
   * One frame: `head` is the vial's place on the line (null before it is set down), `speed` how fast it is carried
   * (px/s, along the line), and `travelling` whether the journey is still under way.
   */
  function frame(time: number, dt: number, head: Point | null, speed: number, travelling: boolean) {
    if (!ctx || !points.length) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const h = head ? sOf(head) : s0;
    const direction = Math.sign(s1 - s0) || 1;
    if (head) {
      // Off the moving vial, a stream; from the lit line once it has stopped, now and then a grain.
      const moving = travelling && Math.abs(speed) > 4;
      const rate = moving ? 130 + Math.abs(speed) * 0.4 : 9;
      let count = rate * dt;
      while (count > 0) {
        if (Math.random() < count) {
          if (moving) {
            spawn(h - direction * Math.random() * 8, (Math.random() - 0.5) * 4, -direction * (12 + Math.random() * 26), (Math.random() - 0.5) * 26, 2.2 + Math.random() * 1.9);
          } else if (!travelling) {
            spawn(s0 + Math.random() * (h - s0), (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 12, 2.6 + Math.random() * 2.2);
          }
        }
        count -= 1;
      }
    }
    drawLine(h, time, Boolean(head));
    // The murmuration: each grain carried by the field and held toward the line, more firmly as it fades, so it
    // settles back into the line it rose from. Sparks fly free and slow on their own.
    const lo = Math.min(s0, h) - 16;
    const hi = Math.max(s0, h) + 16;
    let kept = 0;
    for (const g of grains) {
      g.age += dt;
      if (g.age >= g.life) continue;
      if (g.spark) {
        g.vs -= g.vs * 3.2 * dt;
        g.vn -= g.vn * 3.2 * dt;
      } else {
        const angle = flow(g.s, g.n, time);
        const settle = 0.9 + 7.5 * (g.age / g.life) ** 2;
        g.vs += (Math.cos(angle) * 34 - g.vs * 1.1) * dt;
        g.vn += (Math.sin(angle) * 27 - g.n * settle - g.vn * 1.3) * dt;
      }
      g.s = Math.min(hi, Math.max(lo, g.s + g.vs * dt));
      g.n = Math.max(-REACH.across + 3, Math.min(REACH.across - 3, g.n + g.vn * dt));
      drawGrain(g, time);
      grains[kept++] = g;
    }
    grains.length = kept;
    ctx.globalAlpha = 1;
  }

  /** Motion off: the lit filament to `head`, drawn once. */
  function still(head: Point) {
    if (!ctx || !points.length) return;
    grains = [];
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawLine(sOf(head), 0, false);
  }

  /** The colour of the light at station `i`, for its dot. */
  const stationColour = (i: number) => {
    const p = points[i];
    return p ? rgba(colourAt(share(sOf(p))), 1) : "";
  };

  return { layout, frame, burst, still, stationColour };
}

export type TrailLight = ReturnType<typeof createTrailLight>;
