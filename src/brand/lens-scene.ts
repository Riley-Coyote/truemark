/** WP-23. All art direction and timing live here; no React and no frame-based integration. */
export const SCENE = {
  vials: [
    { id: "retatrutide-10-mg", x: 0.815, y: 0.47, z: 1, roll: -7, focus: true,
      motion: { x: 0.004, y: 0.03, depth: 0.02, roll: 2.5 } },
    { id: "bpc-157-10-mg", x: 0.905, y: 0.165, z: 1.6, roll: 14, focus: true,
      motion: { x: 0.02, y: 0.026, depth: 0.04, roll: 6 } },
    { id: "semax-10-mg", x: 0.705, y: 0.10, z: 2.6, roll: -19, focus: true,
      motion: { x: 0.02, y: 0.026, depth: 0.04, roll: 6 } },
    { id: "tesamorelin-10-mg", x: 0.56, y: 0.06, z: 3.1, roll: 11, focus: true,
      motion: { x: 0.02, y: 0.026, depth: 0.04, roll: 6 } },
    { id: "nad-500-mg", x: 0.655, y: 0.70, z: 3.2, roll: -13, focus: true,
      motion: { x: 0.02, y: 0.026, depth: 0.04, roll: 6 } },
    { id: "melanotan-ii-10-mg", x: 0.995, y: 0.5, z: 2.8, roll: 24, focus: false,
      motion: { x: 0.02, y: 0.026, depth: 0.04, roll: 6 } },
    { id: "ghk-cu-100-mg", x: 0.98, y: 0.88, z: 0.58, roll: 28, focus: false,
      motion: { x: 0.02, y: 0.026, depth: 0.04, roll: 6 } },
  ],
  width: 0.245,
  image: { width: 578, height: 1112, largeDeviceWidth: 260, swapSeconds: 0.42 },
  clearance: { text: 12, trace: 24, peakHalfWidth: 60, peakAt: 0.64, traceHeight: 72, directions: 256, refinements: 24 },
  optics: { strength: 23, referenceWidth: 720, maxStrength: 40, sharpRadius: 0.5, maxTaps: 64, tapsPerPixel: 4,
    highlightWeight: 2.5, highlightLow: 0.78, highlightHigh: 1, luma: [0.2126, 0.7152, 0.0722],
    toneFloor: 0.86, toneSlope: 0.05, mipBias: -0.5,
    spiralNoise: { scale: 52.9829189, x: 0.06711056, y: 0.00583715 } },
  glint: { seconds: 1.2, curve: [0.45, 0, 0.55, 1], peak: 0.5,
    // The five stops are the asymmetric .tm-sheen falloff, normalized to its peak.
    stops: [-0.20, -0.07, 0, 0.025, 0.06], levels: [0, 0.16, 1, 0.22, 0],
    travel: [-0.10, 1.24], fringeSeparation: 0.015, fringeStrength: 0.15,
    leading: [233 / 255, 40 / 255, 76 / 255], trailing: [10 / 255, 46 / 255, 169 / 255] },
  motion: { seed: 23011, truck: 0.014, truckPeriod: 47, pedestal: 0.012, pedestalPeriod: 61,
    push: 0.035, pushPeriod: 71, pushSubject: 0,
    driftPeriods: [23, 29, 31, 37, 41, 43], depthPeriods: [53, 59, 67],
    rollPeriods: [19, 31, 37] },
  opening: { fade: 1.2, rackAt: 0.35, rackSeconds: 2.6, fromDepth: 2.2, defocus: 14,
    push: -0.06, pushSeconds: 4, easeOut: [0, 0, 0.58, 1] },
  focus: { baseSeconds: 1.6, diopterSeconds: 0.35, minSeconds: 1.6, maxSeconds: 2.4,
    curve: [0.65, 0, 0.35, 1], arrival: 0.6,
    sequence: [{ vial: 0, hold: 11 }, { vial: 1, hold: 7 }, { vial: 2, hold: 7 },
      { vial: 0, hold: 11 }, { vial: 3, hold: 7 }, { vial: 4, hold: 7 }] },
  pointer: { dwell: 0.26, inset: 0.12, rackSeconds: 1.2, resumeAfter: 3, tapSlop: 10 },
  mobile: { breakpoint: 960, width: 0.22,
    vials: [{ vial: 0, x: 0.88, y: 0.5 }, { vial: 2, x: 0.66, y: 0.2 }, { vial: 3, x: 0.74, y: 0.86 }],
    sequence: [{ vial: 0, hold: 9 }, { vial: 2, hold: 7 }] },
  dpr: 2,
} as const;

export type LotPhase = "opening" | "leave" | "enter" | "still";
export type KeepClear = { left: number; top: number; right: number; bottom: number; kind: "text" | "trace" };
export type LensSource = { small: string; large: string };
export type LensLayout = { width: number; height: number; scale: number; dpr: number; mobile: boolean };
export const POSE = { x: 0, y: 1, z: 2, width: 3, height: 4, roll: 5, cos: 6, sin: 7, stride: 8 } as const;
const COUNT = SCENE.vials.length;
const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const ASPECT = SCENE.image.height / SCENE.image.width;
const LANDING = SCENE.opening.rackAt + SCENE.opening.rackSeconds;
// Module lifetime is page lifetime. StrictMode's discarded mount never consumes the opening.
let openingPlayed = false;
const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));

/** Invert x, then evaluate y: easing the parameter itself is not CSS cubic-bezier. */
export function ease(t: number, curve: readonly number[]) {
  if (t <= 0 || t >= 1) return clamp(t);
  let low = 0, high = 1, u = t;
  for (let i = 0; i < 18; i++) {
    const v = 1 - u;
    const x = 3 * v * v * u * curve[0] + 3 * v * u * u * curve[2] + u * u * u;
    if (x < t) low = u; else high = u;
    u = (low + high) / 2;
  }
  return 3 * (1 - u) ** 2 * u * curve[1] + 3 * (1 - u) * u * u * curve[3] + u ** 3;
}

// Seeded once, never at frame time. The two sine components share the specified amplitude.
const waves = new Float64Array(COUNT * 10);
let seed: number = SCENE.motion.seed;
for (let i = 0; i < COUNT; i++) {
  for (let j = 0; j < 6; j++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    waves[i * 10 + j] = (seed >>> 0) / 4294967296 * TAU;
  }
  for (let j = 0; j < 4; j++) waves[i * 10 + 6 + j] = SCENE.motion.driftPeriods[(i + j * 2 + (j > 1 ? 1 : 0)) % SCENE.motion.driftPeriods.length];
}

export function inField(index: number, mobile: boolean) {
  if (!mobile) return true;
  for (let i = 0; i < SCENE.mobile.vials.length; i++) if (SCENE.mobile.vials[i].vial === index) return true;
  return false;
}

/** Existing scene entries are returned directly; the frame loop allocates no positions. */
function restPosition(index: number, mobile: boolean) {
  if (mobile) for (let i = 0; i < SCENE.mobile.vials.length; i++) {
    if (SCENE.mobile.vials[i].vial === index) return SCENE.mobile.vials[i];
  }
  return SCENE.vials[index];
}

/** Writes into the caller's scratch buffer. All dimensions and positions are CSS pixels. */
export function project(t: number, layout: LensLayout, still: boolean, out: Float64Array) {
  const { width, height, scale, mobile } = layout;
  const m = SCENE.motion;
  const subject = restPosition(m.pushSubject, mobile);
  const originX = subject.x * width, originY = subject.y * height;
  const cameraX = still ? 0 : m.truck * width * Math.sin(TAU * t / m.truckPeriod);
  const cameraY = still ? 0 : m.pedestal * width * Math.sin(TAU * t / m.pedestalPeriod);
  const cameraZ = still ? 0 : m.push * Math.sin(TAU * t / m.pushPeriod)
    + SCENE.opening.push * (1 - ease(t / SCENE.opening.pushSeconds, SCENE.opening.easeOut));
  for (let i = 0; i < COUNT; i++) {
    const vial = SCENE.vials[i], w = i * 10, p = i * POSE.stride;
    const rest = restPosition(i, mobile);
    const z = vial.z * (1 + (still ? 0 : vial.motion.depth * Math.sin(TAU * t / m.depthPeriods[i % m.depthPeriods.length] + waves[w + 4])));
    const ze = z - cameraZ;
    const dx = still ? 0 : vial.motion.x * width *
      (Math.sin(TAU * t / waves[w + 6] + waves[w]) + Math.sin(TAU * t / waves[w + 7] + waves[w + 1])) / 2;
    const dy = still ? 0 : vial.motion.y * width *
      (Math.sin(TAU * t / waves[w + 8] + waves[w + 2]) + Math.sin(TAU * t / waves[w + 9] + waves[w + 3])) / 2;
    const roll = (vial.roll + (still ? 0 : vial.motion.roll * Math.sin(TAU * t / m.rollPeriods[i % m.rollPeriods.length] + waves[w + 5]))) * RAD;
    // Own drift is screen-space. Only camera parallax and the hero-centred push use depth.
    out[p + POSE.x] = originX + (rest.x * width - originX) * z / ze - cameraX / ze + dx;
    out[p + POSE.y] = originY + (rest.y * height - originY) * z / ze - cameraY / ze + dy;
    out[p + POSE.z] = ze;
    out[p + POSE.width] = scale / ze;
    out[p + POSE.height] = scale / ze * ASPECT;
    out[p + POSE.roll] = roll;
    out[p + POSE.cos] = Math.cos(roll);
    out[p + POSE.sin] = Math.sin(roll);
  }
}

export function circleOfConfusion(width: number, z: number, focusDepth: number) {
  return Math.min(SCENE.optics.maxStrength, SCENE.optics.strength * width / SCENE.optics.referenceWidth) * Math.abs(1 / z - 1 / focusDepth);
}

/** Support of the complete roll envelope, including extrema between the end angles. */
function rollSupport(theta: number, roll: number, amplitude: number) {
  const low = (roll - amplitude) * RAD - theta;
  const high = (roll + amplitude) * RAD - theta;
  let result = Math.max(Math.abs(Math.cos(low)) + ASPECT * Math.abs(Math.sin(low)),
    Math.abs(Math.cos(high)) + ASPECT * Math.abs(Math.sin(high)));
  const peak = Math.atan(ASPECT);
  for (let turn = -3; turn <= 3; turn++) {
    for (let sign = -1; sign <= 1; sign += 2) {
      const angle = turn * Math.PI + sign * peak;
      if (angle >= low && angle <= high) result = Math.sqrt(1 + ASPECT * ASPECT);
    }
  }
  return result;
}

/**
 * A separating line protects the entire rotated motion envelope at the text/trace
 * clearance, not just the current pose or a finite set of timestamps. Screen drift
 * stays outside the perspective division. Depth/camera extrema are evaluated
 * together (linear-fractional extrema occur at the four corners).
 * Binary search on size is unnecessary: solve its support inequality for S directly.
 */
export function vialScaleLimit(width: number, height: number, mobile: boolean, obstacles: readonly KeepClear[], index: number) {
  if (!inField(index, mobile) || (mobile && index !== SCENE.motion.pushSubject)) return Infinity;
  let scale = Infinity;
  const m = SCENE.motion;
  const vial = SCENE.vials[index], position = restPosition(index, mobile), subject = restPosition(m.pushSubject, mobile);
  const originX = subject.x * width, originY = subject.y * height;
  for (const rect of obstacles) {
    if (rect.kind === "trace" && (!vial.focus || mobile)) continue;
    const clearance = vial.focus ? SCENE.clearance[rect.kind] : 0;
    const limit = (theta: number) => {
      const nx = Math.cos(theta), ny = Math.sin(theta);
      const near = (nx >= 0 ? rect.left : rect.right) * nx + (ny >= 0 ? rect.top : rect.bottom) * ny;
      const drift = width * (vial.motion.x * Math.abs(nx) + vial.motion.y * Math.abs(ny));
      const gap = near - originX * nx - originY * ny - clearance - drift;
      const rest = (position.x * width - originX) * nx + (position.y * height - originY) * ny;
      const cameraSupport = width * (m.truck * Math.abs(nx) + m.pedestal * Math.abs(ny));
      const halfExtent = rollSupport(theta, vial.roll, vial.motion.roll) / 2;
      let bound = Infinity;
      for (let depth = -1; depth <= 1; depth += 2) {
        const z = vial.z * (1 + depth * vial.motion.depth);
        for (let push = -1; push <= 1; push += 2) {
          // During the four-second settle the 71s sine is nonnegative. Its negative
          // extreme cannot coincide with the opening's negative push.
          const camera = push < 0 ? Math.min(-m.push, SCENE.opening.push) : m.push;
          bound = Math.min(bound, (gap * (z - camera) - rest * z - cameraSupport) / halfExtent);
        }
      }
      return bound;
    };
    let best = -Infinity, angle = 0;
    const step = TAU / SCENE.clearance.directions;
    for (let n = 0; n < SCENE.clearance.directions; n++) {
      const candidate = limit(n * step);
      if (candidate > best) { best = candidate; angle = n * step; }
    }
    // Refine the best supporting direction, including non-smooth rectangle corners.
    let low = angle - step, high = angle + step;
    for (let n = 0; n < SCENE.clearance.refinements; n++) {
      const a = low + (high - low) / 3, b = high - (high - low) / 3;
      const va = limit(a), vb = limit(b);
      best = Math.max(best, va, vb);
      if (va < vb) low = a; else high = b;
    }
    scale = Math.min(scale, Math.max(0, best));
  }
  return scale;
}

export function fitScale(width: number, height: number, mobile: boolean, obstacles: readonly KeepClear[]) {
  let scale = width * (mobile ? SCENE.mobile.width : SCENE.width);
  for (let i = 0; i < COUNT; i++) scale = Math.min(scale, vialScaleLimit(width, height, mobile, obstacles, i));
  return scale;
}

export function hitTest(x: number, y: number, mobile: boolean, poses: Float64Array) {
  let hit = -1, nearest = Infinity;
  for (let i = 0; i < COUNT; i++) {
    if (!SCENE.vials[i].focus || !inField(i, mobile)) continue;
    const p = i * POSE.stride;
    const dx = x - poses[p + POSE.x], dy = y - poses[p + POSE.y];
    const lx = dx * poses[p + POSE.cos] + dy * poses[p + POSE.sin];
    const ly = -dx * poses[p + POSE.sin] + dy * poses[p + POSE.cos];
    const inset = 0.5 - SCENE.pointer.inset;
    if (Math.abs(lx) <= poses[p + POSE.width] * inset && Math.abs(ly) <= poses[p + POSE.height] * inset && poses[p + POSE.z] < nearest) {
      hit = i; nearest = poses[p + POSE.z];
    }
  }
  return hit;
}

export function rackSeconds(from: number, to: number) {
  return clamp(SCENE.focus.baseSeconds + SCENE.focus.diopterSeconds * Math.abs(1 / SCENE.vials[from].z - 1 / SCENE.vials[to].z),
    SCENE.focus.minSeconds, SCENE.focus.maxSeconds);
}
export type FocusSample = { from: number; to: number; progress: number; start: number; duration: number; sequence: number; opening: boolean };
export const newFocusSample = (): FocusSample => ({ from: 0, to: 0, progress: 1, start: 0, duration: 0, sequence: 0, opening: true });
const desktopStarts = new Float64Array(SCENE.focus.sequence.length + 1);
const mobileStarts = new Float64Array(SCENE.mobile.sequence.length + 1);
for (const mobile of [false, true]) {
  const sequence = mobile ? SCENE.mobile.sequence : SCENE.focus.sequence;
  const starts = mobile ? mobileStarts : desktopStarts;
  for (let i = 0; i < sequence.length; i++) starts[i + 1] = starts[i] + sequence[i].hold + rackSeconds(sequence[i].vial, sequence[(i + 1) % sequence.length].vial);
}

/** Random access to the automatic film: review stills and normal playback use the same path. */
export function automaticFocus(time: number, mobile: boolean, out: FocusSample) {
  out.opening = time < LANDING;
  if (out.opening) {
    out.from = -1; out.to = 0; out.start = SCENE.opening.rackAt;
    out.duration = SCENE.opening.rackSeconds;
    out.progress = clamp((time - out.start) / out.duration); out.sequence = 0;
    return;
  }
  const sequence = mobile ? SCENE.mobile.sequence : SCENE.focus.sequence;
  const starts = mobile ? mobileStarts : desktopStarts;
  const loop = starts[sequence.length], within = (time - LANDING) % loop;
  const base = time - within;
  for (let i = 0; i < sequence.length; i++) {
    if (within >= starts[i + 1]) continue;
    const entry = sequence[i], next = sequence[(i + 1) % sequence.length];
    const rackAt = starts[i] + entry.hold;
    out.sequence = i;
    if (within < rackAt) {
      out.from = entry.vial; out.to = entry.vial; out.progress = 1;
      out.start = base + starts[i]; out.duration = 0;
    } else {
      out.from = entry.vial; out.to = next.vial; out.start = base + rackAt;
      out.duration = rackSeconds(entry.vial, next.vial); out.progress = (within - rackAt) / out.duration;
    }
    return;
  }
}

/** Wall time is only integrated when pausing. Nothing is accumulated per rendered frame. */
export class SceneClock {
  constructor(private elapsed = 0) {}
  private anchor: number | null = null;
  read(now: number) { return this.elapsed + (this.anchor === null ? 0 : (now - this.anchor) / 1000); }
  resume(now: number) { if (this.anchor === null) this.anchor = now; }
  pause(now: number) { this.elapsed = this.read(now); this.anchor = null; }
}

const glsl = (n: number) => n.toFixed(8);
const vertexSource = `#version 300 es
precision highp float;
layout(location=0) in vec2 corner;
uniform vec2 viewport;
uniform vec2 centre;
uniform vec2 size;
uniform vec2 rotation;
uniform float radius;
out vec2 uv;
void main() {
  vec2 local = corner * (size * 0.5 + radius);
  uv = local / size + 0.5;
  vec2 rotated = vec2(local.x * rotation.x - local.y * rotation.y,
                      local.x * rotation.y + local.y * rotation.x);
  vec2 screen = (centre + rotated) / viewport;
  gl_Position = vec4(screen.x * 2.0 - 1.0, 1.0 - screen.y * 2.0, 0.0, 1.0);
}`;
const fragmentSource = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 colour;
uniform sampler2D smallImage;
uniform sampler2D largeImage;
uniform vec2 size;
uniform float radius;
uniform int taps;
uniform vec2 mip;
uniform float imageMix;
uniform float tone;
uniform float opacity;
uniform float glint;
const float GOLDEN = ${glsl(Math.PI * (3 - Math.sqrt(5)))};
float IGN(vec2 p) {
  return fract(${glsl(SCENE.optics.spiralNoise.scale)} * fract(dot(p, vec2(${glsl(SCENE.optics.spiralNoise.x)}, ${glsl(SCENE.optics.spiralNoise.y)}))));
}
float band(float x) {
  ${SCENE.glint.stops.slice(0, -1).map((stop, i) => `if (x >= ${glsl(stop)} && x < ${glsl(SCENE.glint.stops[i + 1])}) return mix(${glsl(SCENE.glint.levels[i])}, ${glsl(SCENE.glint.levels[i + 1])}, smoothstep(${glsl(stop)}, ${glsl(SCENE.glint.stops[i + 1])}, x));`).join("\n  ")}
  return 0.0;
}
vec4 glass(vec2 p) {
  // CLAMP_TO_EDGE alone repeats edge texels across the expanded blur quad.
  if (any(lessThan(p, vec2(0.0))) || any(greaterThan(p, vec2(1.0)))) return vec4(0.0);
  vec4 sampleColour = textureLod(smallImage, p, mip.x);
  if (imageMix > 0.0) sampleColour = mix(sampleColour, textureLod(largeImage, p, mip.y), imageMix);
  if (glint >= 0.0) {
    float centre = mix(${SCENE.glint.travel.map(glsl).join(", ")}, glint);
    float x = p.x - centre;
    vec3 white = vec3(band(x));
    vec3 fringe = (band(x - ${glsl(SCENE.glint.fringeSeparation / 2)}) * vec3(${SCENE.glint.leading.map(glsl).join(", ")})
                + band(x + ${glsl(SCENE.glint.fringeSeparation / 2)}) * vec3(${SCENE.glint.trailing.map(glsl).join(", ")})) * 0.5;
    vec3 light = ${glsl(SCENE.glint.peak)} * min(vec3(1.0), white + ${glsl(SCENE.glint.fringeStrength)} * fringe * (vec3(1.0) - white));
    // Screen blend in premultiplied space: never brighten transparent margins.
    sampleColour.rgb += (vec3(sampleColour.a) - sampleColour.rgb) * light;
  }
  return sampleColour;
}
void main() {
  vec4 total = vec4(0.0);
  float weights = 0.0;
  float spiralRotation = ${glsl(TAU)} * IGN(gl_FragCoord.xy);
  for (int i = 0; i < ${SCENE.optics.maxTaps}; i++) {
    if (i >= taps) break;
    float r = taps == 1 ? 0.0 : sqrt((float(i) + 0.5) / float(taps));
    float angle = float(i) * GOLDEN + spiralRotation;
    vec4 sampleColour = glass(uv + vec2(cos(angle), sin(angle)) * r * radius / size);
    float luma = sampleColour.a > 0.00001 ? dot(sampleColour.rgb / sampleColour.a, vec3(${SCENE.optics.luma.map(glsl).join(", ")})) : 0.0;
    float weight = 1.0 + ${glsl(SCENE.optics.highlightWeight)} * smoothstep(${glsl(SCENE.optics.highlightLow)}, ${glsl(SCENE.optics.highlightHigh)}, luma);
    total += sampleColour * weight;
    weights += weight;
  }
  colour = total / weights * opacity;
  colour.rgb *= tone;
}`;

type Material = { small: WebGLTexture | null; large: WebGLTexture | null; smallWidth: number;
  largeWidth: number; mixAt: number; mixFrom: number; mixTo: number; pending: Promise<void> | null };

/** GPU resources are owned by one mounted gate. All drawing scratch storage is reused. */
class Film {
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private materials: Material[] = SCENE.vials.map(() => ({ small: null, large: null, smallWidth: 0, largeWidth: 0, mixAt: 0, mixFrom: 0, mixTo: 0, pending: null }));
  private order = new Uint8Array(COUNT);
  private disposed = false;
  private gl: WebGL2RenderingContext;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) throw new Error("Lens: WebGL2 unavailable");
    this.gl = gl;
    try {
      this.program = gl.createProgram();
      if (!this.program) throw new Error("Lens: program allocation failed");
      for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Lens: shader allocation failed");
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const reason = gl.getShaderInfoLog(shader); gl.deleteShader(shader);
          throw new Error(`Lens: ${reason}`);
        }
        gl.attachShader(this.program, shader); gl.deleteShader(shader);
      }
      gl.linkProgram(this.program);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(`Lens: ${gl.getProgramInfoLog(this.program)}`);
      this.vao = gl.createVertexArray(); this.buffer = gl.createBuffer();
      if (!this.vao || !this.buffer) throw new Error("Lens: geometry allocation failed");
      gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(this.program);
      for (const name of ["viewport", "centre", "size", "rotation", "radius", "taps", "mip", "imageMix", "tone", "opacity", "glint", "smallImage", "largeImage"]) {
        this.uniforms[name] = gl.getUniformLocation(this.program, name);
      }
      gl.uniform1i(this.uniforms.smallImage, 0); gl.uniform1i(this.uniforms.largeImage, 1);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
    } catch (error) { this.dispose(); throw error; }
  }

  private async decode(src: string) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    await img.decode();
    return img;
  }

  private upload(img: HTMLImageElement) {
    const gl = this.gl, texture = gl.createTexture();
    if (!texture) throw new Error("Lens: texture allocation failed");
    try {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      if (gl.getError() !== gl.NO_ERROR) throw new Error("Lens: texture upload failed");
    } catch (error) { gl.deleteTexture(texture); throw error; }
    return texture;
  }

  async loadSmall(sources: readonly LensSource[]) {
    const images = await Promise.all(sources.map((source) => this.decode(source.small)));
    if (this.disposed) return;
    for (let i = 0; i < COUNT; i++) {
      this.materials[i].small = this.upload(images[i]);
      this.materials[i].smallWidth = images[i].naturalWidth;
    }
  }

  async loadLarge(sources: readonly LensSource[], layout: LensLayout, now: () => number) {
    const jobs: Promise<void>[] = [];
    for (let i = 0; i < COUNT; i++) {
      const vial = SCENE.vials[i], material = this.materials[i];
      // Atmosphere is never sharp; it does not need a large texture, even in the foreground.
      // Preload any size the motion can require. The actual sharp width selects it at draw time.
      const sharpWidth = layout.scale / (vial.z * (1 - vial.motion.depth) - SCENE.motion.push) * layout.dpr;
      if (!inField(i, layout.mobile) || !vial.focus || sharpWidth <= SCENE.image.largeDeviceWidth || material.large) continue;
      if (!material.pending) material.pending = this.decode(sources[i].large).then((img) => {
        if (this.disposed) return;
        material.large = this.upload(img); material.largeWidth = img.naturalWidth; material.mixAt = now();
      });
      jobs.push(material.pending);
    }
    await Promise.all(jobs);
  }

  resize(layout: LensLayout) {
    const width = Math.max(1, Math.round(layout.width * layout.dpr)), height = Math.max(1, Math.round(layout.height * layout.dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    this.gl.viewport(0, 0, width, height);
  }

  draw(time: number, layout: LensLayout, poses: Float64Array, focusDepth: number, extraBlur: number, opacity: number, glintIndex: number, glintProgress: number, still: boolean) {
    const gl = this.gl, u = this.uniforms;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program); gl.bindVertexArray(this.vao);
    gl.uniform2f(u.viewport, layout.width, layout.height); gl.uniform1f(u.opacity, opacity);
    // Stable, allocation-free insertion sort. Drifting depths may exchange draw order.
    for (let i = 0; i < COUNT; i++) {
      let j = i;
      while (j > 0 && poses[this.order[j - 1] * POSE.stride + POSE.z] < poses[i * POSE.stride + POSE.z]) {
        this.order[j] = this.order[j - 1]; j--;
      }
      this.order[j] = i;
    }
    for (let n = 0; n < COUNT; n++) {
      const i = this.order[n];
      if (!inField(i, layout.mobile)) continue;
      const p = i * POSE.stride, material = this.materials[i];
      const width = poses[p + POSE.width], z = poses[p + POSE.z];
      if (width <= 0 || !material.small) continue;
      const c = circleOfConfusion(layout.width, z, focusDepth), radius = Math.hypot(c, extraBlur);
      const taps = radius < SCENE.optics.sharpRadius ? 1 : Math.min(SCENE.optics.maxTaps, Math.ceil(radius * SCENE.optics.tapsPerPixel));
      const spacing = Math.max(1 / layout.dpr, taps === 1 ? 0 : Math.sqrt(Math.PI * radius * radius / taps));
      gl.uniform2f(u.centre, poses[p + POSE.x], poses[p + POSE.y]);
      gl.uniform2f(u.size, width, poses[p + POSE.height]);
      gl.uniform2f(u.rotation, poses[p + POSE.cos], poses[p + POSE.sin]);
      gl.uniform1f(u.radius, radius); gl.uniform1i(u.taps, taps);
      gl.uniform2f(u.mip, Math.max(0, Math.log2(spacing * material.smallWidth / width) + SCENE.optics.mipBias),
        Math.max(0, Math.log2(spacing * (material.largeWidth || material.smallWidth) / width) + SCENE.optics.mipBias));
      const wanted = material.large && width * layout.dpr > SCENE.image.largeDeviceWidth ? 1 : 0;
      let imageMix = material.mixFrom + (material.mixTo - material.mixFrom) * ease((time - material.mixAt) / SCENE.image.swapSeconds, SCENE.opening.easeOut);
      if (wanted !== material.mixTo) {
        material.mixFrom = imageMix; material.mixTo = wanted; material.mixAt = time;
      }
      if (still) imageMix = wanted;
      gl.uniform1f(u.imageMix, imageMix);
      gl.uniform1f(u.tone, Math.max(SCENE.optics.toneFloor, 1 - SCENE.optics.toneSlope * Math.max(0, z - 1)));
      gl.uniform1f(u.glint, i === glintIndex ? glintProgress : -1);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, material.small);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, material.large ?? material.small);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    for (const material of this.materials) { gl.deleteTexture(material.small); gl.deleteTexture(material.large); }
    gl.deleteBuffer(this.buffer); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.program);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

export type LensCallbacks = {
  lot: (index: number, phase: LotPhase) => void;
  ready: () => void;
  fallback: () => void;
  paused: (paused: boolean) => void;
};
export type LensReview = { time?: number; focus?: number; hud?: HTMLElement };

/** Choreography and the pausable clock. Events store anchors, never integrate a pose. */
export class LensPlayer {
  private film: Film | null = null;
  private clock: SceneClock;
  private poses = new Float64Array(COUNT * POSE.stride);
  private focus = newFocusSample();
  private frame = 0;
  private visible = false;
  private loaded = false;
  private disposed = false;
  private failed = false;
  private presented = false;
  private resizeVersion = 0;
  private inverse = 1 / SCENE.opening.fromDepth;
  private autoShift = 0;
  private manualTarget = -1;
  private manualAt = 0;
  private manualFrom = 0;
  private manualTouch = false;
  private resumeAt = Infinity;
  private mouseX = NaN;
  private mouseY = NaN;
  private hover = -1;
  private hoverAt = 0;
  private lotIndex = -1;
  private lotPhase: LotPhase = "opening";
  private openingGlint = true;
  declare private review?: LensReview;
  declare private hudAt: number;
  declare private hudFrames: number;

  constructor(canvas: HTMLCanvasElement, private sources: readonly LensSource[], private layout: LensLayout,
    private reduced: boolean, private callbacks: LensCallbacks, review?: LensReview) {
    if (import.meta.env.DEV) { this.review = review; this.hudAt = 0; this.hudFrames = 0; }
    let initialTime = openingPlayed || reduced ? Math.max(LANDING, SCENE.opening.pushSeconds) : 0;
    if (import.meta.env.DEV && review?.time !== undefined) initialTime = 0;
    this.clock = new SceneClock(initialTime);
    this.autoShift = initialTime ? initialTime - LANDING : 0;
    this.openingGlint = !openingPlayed && !reduced;
    try { this.film = new Film(canvas); }
    catch { this.fail(); return; }
    void this.film.loadSmall(sources).then(async () => {
      if (this.disposed || this.failed || !this.film) return;
      // The reduced-motion still uses its final textures on its only initial draw.
      let finalTextures = this.reduced;
      if (import.meta.env.DEV && this.review?.time !== undefined) finalTextures = true;
      if (finalTextures) {
        let textureLayout: LensLayout;
        do {
          textureLayout = this.layout;
          await this.film.loadLarge(sources, textureLayout, this.now);
        } while (textureLayout !== this.layout && !this.disposed && !this.failed);
      }
      else void this.film.loadLarge(sources, this.layout, this.now).catch(this.fail);
      if (this.disposed || this.failed) return;
      this.loaded = true;
      this.film.resize(this.layout);
      this.wake();
    }).catch(this.fail);
  }

  private now = () => this.clock.read(performance.now());
  private fail = () => {
    if (this.disposed || this.failed) return;
    this.failed = true;
    this.stop(); this.film?.dispose(); this.film = null;
    this.callbacks.lot(0, "still"); this.callbacks.fallback();
  };
  contextLost() { this.fail(); }

  private stop() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.clock.pause(performance.now());
    this.callbacks.paused(true);
  }

  private wake() {
    if (this.disposed || this.failed || !this.loaded || !this.visible || this.frame) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  setVisible(visible: boolean) {
    if (visible === this.visible) return;
    this.visible = visible;
    if (!visible) this.stop();
    else if (!this.reduced || !this.presented) this.wake();
  }

  setReduced(reduced: boolean) {
    if (this.reduced === reduced) return;
    this.stop(); this.reduced = reduced; this.manualTarget = -1;
    if (!reduced && this.now() < SCENE.opening.pushSeconds) {
      this.clock = new SceneClock(SCENE.opening.pushSeconds);
      this.autoShift = SCENE.opening.pushSeconds - LANDING;
      this.openingGlint = false;
    }
    this.hover = -1; this.mouseX = NaN; this.mouseY = NaN;
    this.resize(this.layout);
  }

  resize(layout: LensLayout) {
    if (this.disposed || this.failed) return;
    if (this.layout.mobile !== layout.mobile) {
      this.manualTarget = -1; this.hover = -1; this.autoShift = 0;
    }
    this.layout = layout;
    if (!this.loaded || !this.film) return;
    const version = ++this.resizeVersion;
    const textures = this.film.loadLarge(this.sources, layout, this.now);
    if (this.reduced) {
      this.stop(); this.presented = false;
      void textures.then(() => {
        if (version !== this.resizeVersion || this.disposed || this.failed) return;
        this.film?.resize(this.layout); this.wake();
      }).catch(this.fail);
    } else {
      this.film.resize(layout); this.wake();
      void textures.catch(this.fail);
    }
  }

  pointer(x: number, y: number) {
    if (this.reduced || this.layout.mobile) return;
    this.mouseX = x; this.mouseY = y;
  }
  leave() { this.mouseX = NaN; this.mouseY = NaN; }
  tap(x: number, y: number) {
    if (this.reduced || !this.loaded || this.failed || !this.visible) return;
    const index = hitTest(x, y, this.layout.mobile, this.poses);
    if (index >= 0) this.requestFocus(index, this.now(), true);
  }

  private requestFocus(index: number, time: number, touch: boolean) {
    this.manualTouch = touch;
    // A completed tap has already left the glass; its three-second grace starts here.
    this.resumeAt = touch ? time + SCENE.pointer.resumeAfter : Infinity;
    if (this.manualTarget === index) return;
    this.manualFrom = this.inverse; this.manualTarget = index; this.manualAt = time;
    this.openingGlint = false;
    this.emitLot(this.lotIndex < 0 ? 0 : this.lotIndex, "leave");
  }

  private resumeAutomatic(time: number) {
    const sequence = this.layout.mobile ? SCENE.mobile.sequence : SCENE.focus.sequence;
    const starts = this.layout.mobile ? mobileStarts : desktopStarts;
    let current = 0;
    // Keep the active hero occurrence when possible; otherwise use the first matching stop.
    if (sequence[this.focus.sequence]?.vial === this.manualTarget) current = this.focus.sequence;
    else for (let i = 0; i < sequence.length; i++) if (sequence[i].vial === this.manualTarget) { current = i; break; }
    this.autoShift = time - (LANDING + starts[current] + sequence[current].hold);
    this.manualTarget = -1; this.resumeAt = Infinity;
  }

  private emitLot(index: number, phase: LotPhase) {
    if (index === this.lotIndex && phase === this.lotPhase) return;
    this.lotIndex = index; this.lotPhase = phase;
    this.callbacks.lot(index, phase);
  }

  private updateHover(time: number) {
    if (this.reduced || this.layout.mobile) return;
    const hit = hitTest(this.mouseX, this.mouseY, false, this.poses);
    if (hit !== this.hover) { this.hover = hit; this.hoverAt = time; }
    if (hit >= 0) {
      if (time - this.hoverAt >= SCENE.pointer.dwell) this.requestFocus(hit, time, false);
      if (this.manualTarget >= 0 && !this.manualTouch) this.resumeAt = Infinity;
    } else if (this.manualTarget >= 0 && !this.manualTouch && this.resumeAt === Infinity) {
      this.resumeAt = time + SCENE.pointer.resumeAfter;
    }
  }

  private tick = (timestamp: number) => {
    this.frame = 0;
    if (!this.visible || this.disposed || this.failed || !this.film) return;
    this.clock.resume(timestamp);
    let time = this.reduced ? 0 : this.clock.read(timestamp);
    let reviewFocus = -1, frozen = false;
    if (import.meta.env.DEV && this.review) {
      if (this.review.time !== undefined) { time = this.review.time; frozen = true; }
      reviewFocus = this.review.focus ?? -1;
    }
    project(time, this.layout, this.reduced, this.poses);
    let glintIndex = -1, glintProgress = -1, extraBlur = 0, opacity = 1;
    if (this.reduced || reviewFocus >= 0) {
      const target = this.reduced ? 0 : reviewFocus;
      this.inverse = 1 / this.poses[target * POSE.stride + POSE.z];
      this.emitLot(target, "still");
    } else {
      if (this.manualTarget >= 0 && time >= this.resumeAt) this.resumeAutomatic(time);
      automaticFocus(time - this.autoShift, this.layout.mobile, this.focus);
      const f = this.focus;
      if (this.manualTarget < 0) {
        const from = f.from < 0 ? 1 / SCENE.opening.fromDepth : 1 / this.poses[f.from * POSE.stride + POSE.z];
        const to = 1 / this.poses[f.to * POSE.stride + POSE.z];
        const amount = ease(f.progress, SCENE.focus.curve);
        this.inverse = amount === 1 ? to : from + (to - from) * amount;
      }
      if (!frozen) this.updateHover(time);
      if (this.manualTarget >= 0) {
        const progress = clamp((time - this.manualAt) / SCENE.pointer.rackSeconds);
        const to = 1 / this.poses[this.manualTarget * POSE.stride + POSE.z];
        const amount = ease(progress, SCENE.focus.curve);
        this.inverse = amount === 1 ? to : this.manualFrom + (to - this.manualFrom) * amount;
        this.emitLot(progress < SCENE.focus.arrival ? (this.lotIndex < 0 ? 0 : this.lotIndex) : this.manualTarget,
          progress < SCENE.focus.arrival ? "leave" : "enter");
        const sinceLanding = time - this.manualAt - SCENE.pointer.rackSeconds;
        if (sinceLanding >= 0 && sinceLanding < SCENE.glint.seconds) {
          glintIndex = this.manualTarget; glintProgress = ease(sinceLanding / SCENE.glint.seconds, SCENE.glint.curve);
        }
      } else {
        const leaving = f.duration > 0 && !f.opening && f.progress < SCENE.focus.arrival;
        this.emitLot(leaving ? f.from : f.to, f.opening ? "opening" : leaving ? "leave" : "enter");
        const sinceLanding = time - LANDING;
        if (this.openingGlint && sinceLanding >= 0 && sinceLanding < SCENE.glint.seconds) {
          glintIndex = 0; glintProgress = ease(sinceLanding / SCENE.glint.seconds, SCENE.glint.curve);
        }
      }
      extraBlur = SCENE.opening.defocus * (1 - ease((time - SCENE.opening.rackAt) / SCENE.opening.rackSeconds, SCENE.focus.curve));
      opacity = ease(time / SCENE.opening.fade, SCENE.opening.easeOut);
    }
    this.film.draw(time, this.layout, this.poses, 1 / this.inverse, extraBlur, opacity, glintIndex, glintProgress, this.reduced || frozen);
    if (!this.presented) {
      this.presented = true;
      if (!frozen && reviewFocus < 0) openingPlayed = true;
      this.callbacks.ready();
    }
    if (import.meta.env.DEV && this.review?.hud) {
      this.hudFrames++;
      if (time - this.hudAt >= 0.25 || frozen || this.reduced) {
        this.review.hud.textContent = `${Math.round(this.hudFrames / Math.max(time - this.hudAt, 0.001))} fps · ${SCENE.vials[this.manualTarget >= 0 ? this.manualTarget : reviewFocus >= 0 ? reviewFocus : this.focus.to].id} · z_f ${(1 / this.inverse).toFixed(3)}`;
        this.hudFrames = 0; this.hudAt = time;
      }
    }
    if (!this.reduced && !frozen) { this.callbacks.paused(false); this.wake(); }
    else this.stop();
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.stop(); this.film?.dispose(); this.film = null;
  }
}
