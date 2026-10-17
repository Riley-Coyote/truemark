/*
 * Floor mist for the TrueMark opening.
 *
 * Cold mist pooled on the studio floor, lit by the windows at the upper left. Two parts:
 *
 *   The air: a low-resolution stable-fluids grid lying on the floor plane (advection, pressure
 *   projection, vorticity confinement), with a slow drift, a gentle curl-noise stir, and the
 *   pedestals standing in it as solid bodies. It carries two things the mist reads: how far the
 *   air has displaced the mist's fine structure, and how thick the mist is (a wake thins it, then
 *   it fills back in from its sides).
 *
 *   The mist: a thin volume over the floor, ray-marched through the room's own camera, so the far
 *   mist lies flat and fine and the near mist large and soft. Dense at the floor, thinning with
 *   height, banked a little against the pedestal bases, lit from the upper left with gentle
 *   self-shadowing, in the room's own lilac and white.
 *
 * The pointer is an invisible body moving through that air. Only its movement disturbs it: a wide,
 * weak, velocity-driven drag along the path it moved, and a little stirring that thins the mist in
 * its wake. A still pointer does nothing.
 *
 *   const fog = createFog(canvas, { scene: FOG_SCENES.collection, region, onFallback })
 *   fog.setPointer(clientX, clientY)   // on pointermove (client px); fog.releasePointer() on leave
 *   fog.set({ density, drift, turbulence, light, pointer })
 *   fog.resize(); fog.pause(); fog.resume(); fog.destroy()
 *
 * createFog returns null (after calling onFallback) when WebGL2 or float render targets are
 * missing; it calls onFallback('slow') and stops itself if the device can't hold a frame rate.
 * No dependencies. Plain ES module.
 */

/** The highest the mist reaches, in camera heights above the floor. */
const SLAB = 0.42;

/**
 * The rooms the mist lies in, measured on each room's first frame, in the room's own pixels: the
 * horizon (the floor's vanishing row), the focal length, the row where the floor meets the back wall,
 * and each pedestal's centre, half-width, the front of its base and the middle of its top.
 */
export const FOG_SCENES = {
  /** open-misty.mp4, 2560×1430: five pedestals. */
  collection: {
    room: { w: 2560, h: 1430 },
    horizon: 515,
    focal: 3200,
    wall: 1075,
    pedestals: [
      { x: 626, half: 136, base: 1203, top: 1015 },
      { x: 944.5, half: 137.5, base: 1195, top: 923 },
      { x: 1276, half: 146, base: 1203, top: 856 },
      { x: 1610.5, half: 137.5, base: 1200, top: 938 },
      { x: 1937, half: 135, base: 1217, top: 1039 },
    ],
  },
  /** open-phone-misty.mp4, 1080×1934: the middle three, more floor below. */
  collectionTall: {
    room: { w: 1080, h: 1934 },
    horizon: 923,
    focal: 2400,
    wall: 1400,
    pedestals: [
      { x: 181, half: 149, base: 1440, top: 1176 },
      { x: 537, half: 157, base: 1436, top: 1105 },
      { x: 897, half: 147, base: 1440, top: 1192 },
    ],
  },
};

/** The highest row of a room (a fraction of its height) that any mist can reach: put the canvas's top here. */
export function fogTop(scene) {
  const zWall = scene.focal / (scene.wall - scene.horizon);
  return Math.max(0, (scene.horizon + ((1 - SLAB) * scene.focal) / zWall) / scene.room.h - 0.02);
}

const DEFAULTS = {
  scene: FOG_SCENES.collection,
  /** The part of the room the canvas covers, as fractions of the room: { x0, y0, x1, y1 }. */
  region: null,
  density: 1,
  drift: 1,
  turbulence: 1,
  light: 1,
  pointer: 1,
  /** Phones: false. The air then moves only by itself. */
  interactive: true,
  /** Reduced motion: the mist drawn once, held still. */
  still: false,
  /** 'high' (desktop) or 'low' (phones: lower resolution, coarser air, fewer samples). */
  quality: 'high',
  /** Render pixels per CSS pixel (before the adaptive tiers). Defaults by quality. */
  scale: undefined,
  /** Pause by itself when off screen or when the tab is hidden. */
  autoPause: true,
  /** Step quality down when frames run long, and give up (onFallback('slow')) if that isn't enough. */
  adapt: true,
  onFallback: null,
  /** Tuning only: 'air' overlays the air's state on the floor. */
  debug: null,
};

/* Quality tiers the adaptive loop steps through: render scale and ray samples, as multipliers. */
const TIERS = [
  { scale: 1, steps: 1 },
  { scale: 0.84, steps: 0.84 },
  { scale: 0.7, steps: 0.7 },
  { scale: 0.56, steps: 0.6 },
];

/* The mist's colours, from the room: its lit mist and the lilac of its shaded wall. */
const LIT = [246 / 255, 242 / 255, 255 / 255];
const SHADE = [210 / 255, 201 / 255, 238 / 255];
/** Toward the windows: left, up, and a little toward the camera. */
const SUN = normalize3([-0.72, 0.6, -0.34]);

// ---------------------------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------------------------

const VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

/* A tileable 3D noise volume, baked once: R, G gradient noise (4 and 8 cells per tile),
   B, A inverted cellular noise (4 and 8): soft structure and rounded billows. */
const NOISE_FS = `#version 300 es
precision highp float;
precision highp int;
out vec4 outColor;
uniform float uLayer;
uniform float uSize;
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 rnd(ivec3 c, int period, uint seed) {
  ivec3 w = (c + period) % period;
  uvec3 h = pcg3d(uvec3(w) + uvec3(seed * 1013u, seed * 7919u, seed * 104729u));
  return vec3(h & uvec3(0xFFFFu)) / 65535.0;
}
float grad(ivec3 i, ivec3 o, vec3 f, int period, uint seed) {
  vec3 g = normalize(rnd(i + o, period, seed) * 2.0 - 1.0 + 1e-4);
  return dot(g, f - vec3(o));
}
float perlin(vec3 p, int period, uint seed) {
  ivec3 i = ivec3(floor(p));
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = grad(i, ivec3(0, 0, 0), f, period, seed);
  float n100 = grad(i, ivec3(1, 0, 0), f, period, seed);
  float n010 = grad(i, ivec3(0, 1, 0), f, period, seed);
  float n110 = grad(i, ivec3(1, 1, 0), f, period, seed);
  float n001 = grad(i, ivec3(0, 0, 1), f, period, seed);
  float n101 = grad(i, ivec3(1, 0, 1), f, period, seed);
  float n011 = grad(i, ivec3(0, 1, 1), f, period, seed);
  float n111 = grad(i, ivec3(1, 1, 1), f, period, seed);
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float worley(vec3 p, int period, uint seed) {
  ivec3 i = ivec3(floor(p));
  vec3 f = fract(p);
  float md = 8.0;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    ivec3 o = ivec3(x, y, z);
    vec3 d = vec3(o) + rnd(i + o, period, seed + 17u) - f;
    md = min(md, dot(d, d));
  }
  return sqrt(md);
}
void main() {
  vec3 p = vec3(gl_FragCoord.xy, uLayer + 0.5) / uSize;
  float a = perlin(p * 4.0, 4, 1u);
  float b = perlin(p * 8.0, 8, 2u);
  float c = 1.0 - worley(p * 4.0, 4, 3u);
  float d = 1.0 - worley(p * 8.0, 8, 4u);
  outColor = clamp(vec4(a * 0.9 + 0.5, b * 0.9 + 0.5, c, d), 0.0, 1.0);
}`;

const SIM_HEAD = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uTexel;
`;

const CURL_FS = `${SIM_HEAD}
uniform sampler2D uVel;
void main() {
  float L = texture(uVel, vUv - vec2(uTexel.x, 0.0)).y;
  float R = texture(uVel, vUv + vec2(uTexel.x, 0.0)).y;
  float B = texture(uVel, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uVel, vUv + vec2(0.0, uTexel.y)).x;
  outColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

/* Vorticity confinement, the room's own slow stir (curl of a drifting potential), and the drift the
   air relaxes toward; nothing moves inside a pedestal. */
const FORCE_FS = `${SIM_HEAD}
uniform sampler2D uVel;
uniform sampler2D uCurl;
uniform sampler2D uFloor;
uniform sampler3D uNoise;
uniform vec4 uWorld;
uniform vec2 uWind;
uniform float uDt;
uniform float uConfine;
uniform float uStir;
uniform float uRelax;
uniform float uTime;
uniform float uCell;
void main() {
  float L = abs(texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x);
  float R = abs(texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x);
  float B = abs(texture(uCurl, vUv - vec2(0.0, uTexel.y)).x);
  float T = abs(texture(uCurl, vUv + vec2(0.0, uTexel.y)).x);
  float C = texture(uCurl, vUv).x;
  vec2 f = 0.5 * vec2(T - B, R - L);
  f /= length(f) + 1e-4;
  f *= uConfine * C;
  f.y = -f.y;
  vec2 v = texture(uVel, vUv).xy + f * uDt;
  vec2 w = uWorld.xy + vUv * uWorld.zw;
  vec3 c = vec3(w * 0.21, uTime * 0.011);
  const float e = 0.015;
  float px = texture(uNoise, c + vec3(e, 0.0, 0.0)).r - texture(uNoise, c - vec3(e, 0.0, 0.0)).r;
  float pz = texture(uNoise, c + vec3(0.0, e, 0.0)).r - texture(uNoise, c - vec3(0.0, e, 0.0)).r;
  v += vec2(pz, -px) / (2.0 * e) * uStir * uDt / uCell;
  v = uWind + (v - uWind) * uRelax;
  v *= 1.0 - texture(uFloor, vUv).g;
  outColor = vec4(v, 0.0, 1.0);
}`;

const DIV_FS = `${SIM_HEAD}
uniform sampler2D uVel;
void main() {
  float L = texture(uVel, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uVel, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uVel, vUv - vec2(0.0, uTexel.y)).y;
  float T = texture(uVel, vUv + vec2(0.0, uTexel.y)).y;
  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const SCALE_FS = `${SIM_HEAD}
uniform sampler2D uSrc;
uniform float uK;
void main() { outColor = texture(uSrc, vUv) * uK; }`;

const PRESSURE_FS = `${SIM_HEAD}
uniform sampler2D uP;
uniform sampler2D uDiv;
void main() {
  float L = texture(uP, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uP, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uP, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uP, vUv + vec2(0.0, uTexel.y)).x;
  float d = texture(uDiv, vUv).x;
  outColor = vec4((L + R + B + T - d) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRAD_FS = `${SIM_HEAD}
uniform sampler2D uP;
uniform sampler2D uVel;
uniform sampler2D uFloor;
void main() {
  float L = texture(uP, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uP, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uP, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uP, vUv + vec2(0.0, uTexel.y)).x;
  vec2 v = texture(uVel, vUv).xy - 0.5 * vec2(R - L, T - B);
  v *= 1.0 - texture(uFloor, vUv).g;
  outColor = vec4(v, 0.0, 1.0);
}`;

const ADVECT_FS = `${SIM_HEAD}
uniform sampler2D uVel;
uniform float uDt;
void main() {
  vec2 back = vUv - uDt * texture(uVel, vUv).xy * uTexel;
  outColor = texture(uVel, back);
}`;

/* The mist's state, carried by the air: xy how far the air has displaced its fine structure
   (world units, beyond the drift), z its thickness (1 = settled). A wake's thinness diffuses in
   from its sides and settles back; displacement relaxes slowly. */
const STATE_FS = `${SIM_HEAD}
uniform sampler2D uVel;
uniform sampler2D uState;
uniform vec2 uWind;
uniform float uDt;
uniform float uCell;
uniform float uKeepD;
uniform float uKeepT;
uniform float uDiffuse;
void main() {
  vec2 v = texture(uVel, vUv).xy;
  vec2 back = vUv - uDt * v * uTexel;
  vec4 s = texture(uState, back);
  float n = texture(uState, back + vec2(0.0, uTexel.y)).z + texture(uState, back - vec2(0.0, uTexel.y)).z
          + texture(uState, back + vec2(uTexel.x, 0.0)).z + texture(uState, back - vec2(uTexel.x, 0.0)).z;
  s.z = mix(s.z, n * 0.25, uDiffuse);
  s.xy = clamp((s.xy + (v - uWind) * uCell * uDt) * uKeepD, vec2(-0.9), vec2(0.9));
  s.z = 1.0 + (s.z - 1.0) * uKeepT;
  outColor = s;
}`;

/* The body moving through the air. A weak drag pulls the air within its reach toward its own velocity;
   eddies are shed into its wake (the curl of a potential, so they push nothing anywhere, they only turn);
   the mist it passed through is thinned in patches and a little is pushed up at its sides. */
const SPLAT_FS = `${SIM_HEAD}
uniform sampler2D uSrc;
uniform sampler3D uNoise;
uniform vec4 uWorld;
uniform vec2 uA;
uniform vec2 uB;
uniform vec2 uGrid;
uniform float uCore;
uniform float uRadius;
uniform vec2 uBodyVel;
uniform float uDrag;
uniform float uSwirl;
uniform float uPhase;
uniform float uThin;
uniform float uRidge;
uniform int uMode;
void main() {
  vec2 p = vUv * uGrid;
  vec2 a = uA * uGrid, b = uB * uGrid;
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  float d = length(pa - ba * h);
  float core = exp(-d * d / (uCore * uCore));
  float reach = exp(-d * d / (uRadius * uRadius));
  vec4 s = texture(uSrc, vUv);
  vec2 w = uWorld.xy + vUv * uWorld.zw;
  if (uMode == 0) {
    s.xy = mix(s.xy, uBodyVel, reach * uDrag);
    vec3 c = vec3(w * 0.8, uPhase);
    const float e = 0.01;
    float px = texture(uNoise, c + vec3(e, 0.0, 0.0)).r - texture(uNoise, c - vec3(e, 0.0, 0.0)).r;
    float pz = texture(uNoise, c + vec3(0.0, e, 0.0)).r - texture(uNoise, c - vec3(0.0, e, 0.0)).r;
    vec2 g = vec2(pz, -px) / (2.0 * e) * 0.8;
    s.xy += g * uSwirl * reach;
  } else {
    float patchy = texture(uNoise, vec3(w * 0.9, 0.37)).g;
    s.z *= exp(-uThin * core * (0.3 + 1.4 * patchy));
    s.z *= 1.0 + uRidge * max(reach - core, 0.0);
    s.z = min(s.z, 1.6);
  }
  outColor = s;
}`;

/* The mist itself, ray-marched through the room's camera and composited (premultiplied) over it. */
const RENDER_FS = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv;
out vec4 outColor;
uniform sampler3D uNoise;
uniform sampler2D uState;
uniform sampler2D uFloor;
uniform vec4 uRegion;
uniform vec2 uRoom;
uniform float uHorizon;
uniform float uFocal;
uniform float uWallZ;
uniform vec4 uWorld;
uniform vec4 uPed[6];
uniform int uPedCount;
uniform float uTime;
uniform vec2 uDrift;
uniform float uTop;
uniform float uSigma;
uniform float uTurb;
uniform float uLight;
uniform float uSteps;
uniform float uZNear;
uniform vec3 uLit;
uniform vec3 uShade;
uniform vec3 uSun;
uniform sampler2D uHistory;
uniform float uBlend;
uniform float uSeed;
const float SLAB = ${SLAB.toFixed(3)};

float hash(vec2 p) {
  uvec2 q = uvec2(ivec2(p)) * uvec2(1597334673u, 3812015801u);
  uint n = (q.x ^ q.y) * 1597334673u;
  return float(n) * (1.0 / 4294967295.0);
}

/* The mist's body at a height: its surface lifted into soft rounded billows and broken into wisps.
   'mid' scales the middle structure (softer near the camera), 'fine' the finest (gone where the march
   can't resolve it). */
float body(vec2 q, float y, float top, float mid, float fine) {
  vec3 dq = vec3(q.x, y * 2.2, q.y);
  vec4 n1 = texture(uNoise, dq * 0.34 + vec3(0.0, -uTime * 0.013, uTime * 0.0035));
  vec3 w = vec3(n1.g - 0.5, 0.0, n1.r - 0.5) * 0.35;
  vec4 n2 = texture(uNoise, (dq + w) * 1.45 + vec3(0.37, -uTime * 0.034, 0.11 + uTime * 0.006));
  float billow = n2.b * (2.0 - n2.b);
  float lift = ((n1.r - 0.5) * 1.2 + (n1.g - 0.5) * 0.8 + (billow - 0.72) * 1.3) * mid
             + ((n2.a - 0.55) * 0.8 + (n2.r - 0.5) * 0.6) * fine;
  float rel = (y - lift * top * uTurb) / max(top, 1e-3);
  float b = smoothstep(1.1, 0.05, rel);
  return b * mix(b, 1.0, 0.35) * (0.45 + 0.8 * exp(-y / (0.42 * top + 0.008)));
}

void main() {
  vec2 px = vec2(mix(uRegion.x, uRegion.z, vUv.x), mix(uRegion.w, uRegion.y, vUv.y)) * uRoom;
  vec3 rd = vec3((px.x - 0.5 * uRoom.x) / uFocal, -(px.y - uHorizon) / uFocal, 1.0);
  vec4 prev = texelFetch(uHistory, ivec2(gl_FragCoord.xy), 0);
  outColor = prev * (1.0 - uBlend);
  if (rd.y > -1e-4) return;
  // From the camera (one unit above the floor) down through the slab of mist, to the floor, the back
  // wall, or the near face of a pedestal, whichever comes first. z equals t along this ray.
  float t0 = (1.0 - SLAB) / -rd.y;
  float t1 = min(1.0 / -rd.y, uWallZ);
  for (int i = 0; i < 6; i++) {
    if (i >= uPedCount) break;
    vec4 pd = uPed[i];
    vec2 oc = -pd.xy;
    float a = dot(rd.xz, rd.xz), b = dot(oc, rd.xz), c = dot(oc, oc) - pd.z * pd.z;
    float disc = b * b - a * c;
    if (disc > 0.0) {
      float th = (-b - sqrt(disc)) / a;
      if (th > 0.0 && 1.0 + rd.y * th < pd.w) t1 = min(t1, th);
    }
  }
  if (t1 <= t0) return;
  float len = length(rd);
  float dt = (t1 - t0) / uSteps;
  float stepLen = dt * len;
  // The finest structure only where the march resolves it; elsewhere it would only be grain.
  float resolve = 1.0 - smoothstep(0.035, 0.1, stepLen);
  float t = t0 + dt * fract(hash(gl_FragCoord.xy) + uSeed);
  float trans = 1.0;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 64; i++) {
    if (float(i) >= uSteps || trans < 0.01) break;
    vec3 p = vec3(0.0, 1.0, 0.0) + rd * t;
    vec2 suv = (p.xz - uWorld.xy) / uWorld.zw;
    vec4 st = texture(uState, suv);
    float pool = texture(uFloor, suv).r;
    vec2 q = p.xz - st.xy + uDrift;
    // Slow banks: where the layer runs thick and thin.
    float b1 = texture(uNoise, vec3(q * 0.085, uTime * 0.0021)).r;
    float b2 = texture(uNoise, vec3(q * 0.21 + 0.31, uTime * 0.0043 + 0.5)).g;
    float bank = clamp(0.5 + (b1 - 0.5) * 1.6 + (b2 - 0.5) * 0.9, 0.0, 1.0);
    // Far back the mist lies flatter and thinner; it pools a little against each pedestal.
    float far = smoothstep(uWallZ - 1.2, uWallZ, p.z);
    float top = uTop * mix(0.5, 1.45, bank) * (1.0 + 0.55 * pool) * mix(1.0, 0.62, far) * st.z;
    // Near the camera the mist is out of focus: larger, softer, its finest structure gone.
    float focus = smoothstep(uZNear + 0.1, uZNear + 1.5, p.z);
    float mid = mix(0.55, 1.0, focus);
    float fine = mix(0.15, 1.0, focus) * resolve;
    float thin = mix(1.0, 0.55, far) * mix(0.6, 1.0, focus);
    thin *= sqrt(clamp(st.z, 0.0, 1.6));
    float d = body(q, p.y, top, mid, fine) * thin;
    if (d > 0.002) {
      // Self-shadowing toward the windows: brighter where the mist thins toward the light.
      float dl = body(q + uSun.xz * 0.07, p.y + uSun.y * 0.07, top, mid, fine) * thin;
      float lit = clamp((d - dl) * 2.6 / (d + 0.25), 0.0, 1.0);
      float up = clamp(p.y / max(top, 1e-3), 0.0, 1.0);
      float k = clamp(0.56 + (0.3 * up + lit * 0.62 - 0.36) * uLight, 0.0, 1.0);
      vec3 col = mix(uShade, uLit, k);
      float a = 1.0 - exp(-d * uSigma * stepLen);
      acc += trans * a * col;
      trans *= 1.0 - a;
    }
    t += dt;
  }
  // The camera never moves, so each frame's samples (jittered differently) average into the last
  // few: the same mist, without the grain of any one frame's samples.
  outColor = mix(prev, vec4(acc, 1.0 - trans), uBlend);
}`;

/* Present the accumulated mist: dithered to 8 bits, premultiplied. */
const PRESENT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSrc;
float hash(vec2 p) {
  uvec2 q = uvec2(ivec2(p)) * uvec2(1597334673u, 3812015801u);
  uint n = (q.x ^ q.y) * 1597334673u;
  return float(n) * (1.0 / 4294967295.0);
}
void main() {
  vec4 c = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0);
  float g = (hash(gl_FragCoord.xy + vec2(7919.0, 104.0)) - 0.5) / 255.0;
  float a = clamp(c.a + g, 0.0, 1.0);
  outColor = vec4(clamp(c.rgb + g, vec3(0.0), vec3(a)), a);
}`;

/* For tuning only: the air over the floor, seen through the room's camera. Red: mist thinned, blue:
   piled up, green: how fast the air moves beyond the drift. */
const DEBUG_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSrc;
uniform sampler2D uState;
uniform sampler2D uVel;
uniform vec4 uRegion;
uniform vec2 uRoom;
uniform float uHorizon;
uniform float uFocal;
uniform float uWallZ;
uniform vec4 uWorld;
uniform vec2 uWind;
void main() {
  vec4 c = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0);
  vec2 px = vec2(mix(uRegion.x, uRegion.z, vUv.x), mix(uRegion.w, uRegion.y, vUv.y)) * uRoom;
  vec3 rd = vec3((px.x - 0.5 * uRoom.x) / uFocal, -(px.y - uHorizon) / uFocal, 1.0);
  outColor = c;
  if (rd.y > -1e-4) return;
  float t = min(0.94 / -rd.y, uWallZ);
  vec2 suv = (vec2(rd.x * t, t) - uWorld.xy) / uWorld.zw;
  vec4 st = texture(uState, suv);
  vec2 v = texture(uVel, suv).xy - uWind;
  vec3 k = vec3(clamp((1.0 - st.z) * 2.5, 0.0, 1.0), clamp(length(v) / 12.0, 0.0, 1.0), clamp((st.z - 1.0) * 4.0, 0.0, 1.0));
  float a = max(max(k.r, k.g), k.b) * 0.85;
  outColor = vec4(k * a, a) + c * (1.0 - a);
}`;

// ---------------------------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------------------------

export function createFog(canvas, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const params = {
    density: opts.density,
    drift: opts.drift,
    turbulence: opts.turbulence,
    light: opts.light,
    pointer: opts.pointer,
  };
  const low = opts.quality === 'low';
  const fail = (reason) => {
    try {
      opts.onFallback?.(reason);
    } catch {
      /* the host's handler is its own business */
    }
    return null;
  };

  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  if (!gl) return fail('webgl2');
  if (!gl.getExtension('EXT_color_buffer_float')) return fail('float-targets');

  // ---- the room's geometry, in camera heights (the camera stands one unit above the floor) ----
  let geo = deriveScene(opts.scene, low);
  let region = opts.region ?? { x0: 0, y0: fogTop(opts.scene), x1: 1, y1: 1 };

  // ---- GL plumbing ----
  let programs;
  try {
    programs = {
      noise: program(gl, VS, NOISE_FS),
      curl: program(gl, VS, CURL_FS),
      force: program(gl, VS, FORCE_FS),
      div: program(gl, VS, DIV_FS),
      scale: program(gl, VS, SCALE_FS),
      pressure: program(gl, VS, PRESSURE_FS),
      grad: program(gl, VS, GRAD_FS),
      advect: program(gl, VS, ADVECT_FS),
      state: program(gl, VS, STATE_FS),
      splat: program(gl, VS, SPLAT_FS),
      render: program(gl, VS, RENDER_FS),
      present: program(gl, VS, PRESENT_FS),
      debug: program(gl, VS, DEBUG_FS),
    };
  } catch (error) {
    console.warn('[fog]', error.message);
    return fail('shader');
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const tri = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tri);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);

  const noise = bakeNoise(gl, programs.noise, low ? 48 : 64);
  let sim = makeSim();

  function makeSim() {
    const { nx, nz } = geo;
    const t = (filter = gl.LINEAR) => target(gl, nx, nz, filter);
    const pair = () => {
      let a = t(), b = t();
      return { get read() { return a; }, get write() { return b; }, swap() { [a, b] = [b, a]; }, all: () => [a, b] };
    };
    const s = { vel: pair(), state: pair(), pres: pair(), curl: t(gl.NEAREST), div: t(gl.NEAREST), floor: floorMap(gl, geo) };
    resetSim(s);
    return s;
  }
  function resetSim(s) {
    const wind = windCells(0);
    for (const fb of s.vel.all()) clearTarget(fb, [wind[0], wind[1], 0, 1]);
    for (const fb of s.state.all()) clearTarget(fb, [0, 0, 1, 1]);
    for (const fb of s.pres.all()) clearTarget(fb, [0, 0, 0, 1]);
  }
  function clearTarget(t, value) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.viewport(0, 0, t.w, t.h);
    gl.clearBufferfv(gl.COLOR, 0, value);
  }
  function freeSim(s) {
    for (const p of [s.vel, s.state, s.pres]) for (const t of p.all()) freeTarget(gl, t);
    freeTarget(gl, s.curl);
    freeTarget(gl, s.div);
    gl.deleteTexture(s.floor);
  }

  // ---- time and drift ----
  let clock = 0; // seconds the mist has lived
  let flow = 37; // the mist's own evolution clock (runs with the drift)
  const drift = [0, 0]; // where the drift has carried the mist's structure
  function windWorld(time) {
    // A slow drift to the right and a little toward the camera, that breathes.
    const s = params.drift;
    const g = 1 + 0.25 * Math.sin(time * 0.071) + 0.15 * Math.sin(time * 0.023 + 1.3);
    return [0.022 * s * g, -0.008 * s * (1 + 0.4 * Math.sin(time * 0.041 + 0.7))];
  }
  function windCells(time) {
    const w = windWorld(time);
    return [w[0] / geo.cell, w[1] / geo.cell];
  }

  // ---- pointer: an invisible body in the air ----
  const pointer = { x: 0, y: 0, active: false, moved: false, prev: null, prevTime: 0 };
  let rect = canvas.getBoundingClientRect();
  let rectStamp = 0;
  function pointerToWorld(cx, cy) {
    if (performance.now() - rectStamp > 250) {
      rect = canvas.getBoundingClientRect();
      rectStamp = performance.now();
    }
    if (!rect.width || !rect.height) return null;
    const fx = (cx - rect.left) / rect.width;
    const fy = (cy - rect.top) / rect.height;
    if (fx < -0.05 || fx > 1.05 || fy < -0.2 || fy > 1.05) return null;
    const { room, focal, horizon } = opts.scene;
    const u = (region.x0 + fx * (region.x1 - region.x0)) * room.w;
    const v = (region.y0 + fy * (region.y1 - region.y0)) * room.h;
    const dx = (u - room.w / 2) / focal;
    const dy = -(v - horizon) / focal;
    if (dy > -1e-4) return null;
    const height = 0.08; // the body moves through the mist about this high
    let t = (1 - height) / -dy;
    for (const p of geo.peds) {
      // the ray (dx·t, t) against the pedestal's circle in the floor plane
      const a = dx * dx + 1;
      const b = -2 * (dx * p.x + p.z);
      const c = p.x * p.x + p.z * p.z - p.r * p.r;
      const disc = b * b - 4 * a * c;
      if (disc <= 0) continue;
      const th = (-b - Math.sqrt(disc)) / (2 * a);
      if (th > 0 && th < t) {
        if (1 + dy * th > 0.36) return null; // over a pedestal, above the mist
        t = th;
      }
    }
    if (t > geo.zWall) {
      if (1 + dy * geo.zWall > 0.45) return null; // on the wall, above the mist
      t = geo.zWall - 0.03;
    }
    return { x: dx * t, z: t };
  }

  // ---- resolution ----
  const baseScale = opts.scale ?? (low ? 0.6 : 0.8);
  const baseSteps = low ? 20 : 36;
  let tier = 0;
  function resize() {
    rect = canvas.getBoundingClientRect();
    rectStamp = performance.now();
    const s = baseScale * TIERS[tier].scale;
    const w = Math.max(2, Math.round(rect.width * s));
    const h = Math.max(2, Math.round(rect.height * s));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    if (opts.still) drawStill();
    else if (!running && !destroyed) draw();
  }

  // ---- one step of the air ----
  function bindTex(unit, tex, target3d = false) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target3d ? gl.TEXTURE_3D : gl.TEXTURE_2D, tex);
    return unit;
  }
  function run(out) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function use(prog) {
    gl.useProgram(prog.p);
    if (prog.u.uTexel) gl.uniform2f(prog.u.uTexel, 1 / geo.nx, 1 / geo.nz);
    return prog.u;
  }

  function splat(a, b, vx, vz, speed, path, dt) {
    const P = programs.splat;
    const u = use(P);
    const toUv = (w) => [(w.x - geo.xMin) / geo.xSize, (w.z - geo.zMin) / geo.zSize];
    const A = toUv(a), B = toUv(b);
    const strength = params.pointer;
    const core = 0.13;
    const reach = 0.27;
    // A casual drift of the hand barely registers; a deliberate sweep does.
    const gate = smoothstep(0.15, 1.2, speed) * strength;
    const swept = Math.min(path / core, 2);
    const speedCells = speed / geo.cell;
    gl.uniform2f(u.uA, A[0], A[1]);
    gl.uniform2f(u.uB, B[0], B[1]);
    gl.uniform2f(u.uGrid, geo.nx, geo.nz);
    gl.uniform4f(u.uWorld, geo.xMin, geo.zMin, geo.xSize, geo.zSize);
    gl.uniform1i(u.uNoise, bindTex(1, noise, true));
    gl.uniform1f(u.uCore, core / geo.cell);
    gl.uniform1f(u.uRadius, reach / geo.cell);
    gl.uniform2f(u.uBodyVel, vx / geo.cell, vz / geo.cell);
    // Per second, not per frame: the same hand stirs the same at any frame rate.
    gl.uniform1f(u.uDrag, Math.min(1 - Math.exp(-0.85 * gate * dt), 0.5));
    gl.uniform1f(u.uSwirl, 0.28 * speedCells * gate * dt);
    gl.uniform1f(u.uPhase, 0.5 + clock * 0.013);
    gl.uniform1f(u.uThin, 0.46 * gate * swept);
    gl.uniform1f(u.uRidge, 0.07 * gate * swept);
    gl.uniform1i(u.uSrc, bindTex(0, sim.vel.read.tex));
    gl.uniform1i(u.uMode, 0);
    gl.viewport(0, 0, geo.nx, geo.nz);
    run(sim.vel.write);
    sim.vel.swap();
    gl.uniform1i(u.uSrc, bindTex(0, sim.state.read.tex));
    gl.uniform1i(u.uMode, 1);
    run(sim.state.write);
    sim.state.swap();
  }

  function step(dt) {
    clock += dt;
    flow += dt * params.drift;
    const ww = windWorld(clock);
    drift[0] -= ww[0] * dt;
    drift[1] -= ww[1] * dt;
    const wind = [ww[0] / geo.cell, ww[1] / geo.cell];

    // The body, if it moved.
    if (opts.interactive && params.pointer > 0 && pointer.active && pointer.moved) {
      pointer.moved = false;
      const w = pointerToWorld(pointer.x, pointer.y);
      if (w && pointer.prev) {
        const dx = w.x - pointer.prev.x;
        const dz = w.z - pointer.prev.z;
        const path = Math.hypot(dx, dz);
        const elapsed = Math.max(clock - pointer.prevTime, 1 / 120);
        if (path > 1e-4 && path < 0.9) {
          const speed = Math.min(path / elapsed, 2.2);
          if (speed > 0.05) splat(pointer.prev, w, (dx / path) * speed, (dz / path) * speed, speed, path, Math.min(elapsed, 1 / 20));
        }
      }
      pointer.prev = w;
      pointer.prevTime = clock;
    }

    gl.viewport(0, 0, geo.nx, geo.nz);
    let u;
    // curl
    u = use(programs.curl);
    gl.uniform1i(u.uVel, bindTex(0, sim.vel.read.tex));
    run(sim.curl);
    // forces
    u = use(programs.force);
    gl.uniform1i(u.uVel, bindTex(0, sim.vel.read.tex));
    gl.uniform1i(u.uCurl, bindTex(1, sim.curl.tex));
    gl.uniform1i(u.uFloor, bindTex(2, sim.floor));
    gl.uniform1i(u.uNoise, bindTex(3, noise, true));
    gl.uniform4f(u.uWorld, geo.xMin, geo.zMin, geo.xSize, geo.zSize);
    gl.uniform2f(u.uWind, wind[0], wind[1]);
    gl.uniform1f(u.uDt, dt);
    gl.uniform1f(u.uConfine, 2.4 * params.turbulence);
    gl.uniform1f(u.uStir, 0.003 * params.turbulence * params.drift);
    gl.uniform1f(u.uRelax, Math.exp(-dt / 3.6));
    gl.uniform1f(u.uTime, flow);
    gl.uniform1f(u.uCell, geo.cell);
    run(sim.vel.write);
    sim.vel.swap();
    // divergence
    u = use(programs.div);
    gl.uniform1i(u.uVel, bindTex(0, sim.vel.read.tex));
    run(sim.div);
    // pressure
    u = use(programs.scale);
    gl.uniform1i(u.uSrc, bindTex(0, sim.pres.read.tex));
    gl.uniform1f(u.uK, 0.8);
    run(sim.pres.write);
    sim.pres.swap();
    u = use(programs.pressure);
    gl.uniform1i(u.uDiv, bindTex(1, sim.div.tex));
    for (let i = 0; i < geo.iterations; i++) {
      gl.uniform1i(u.uP, bindTex(0, sim.pres.read.tex));
      run(sim.pres.write);
      sim.pres.swap();
    }
    // projection
    u = use(programs.grad);
    gl.uniform1i(u.uP, bindTex(0, sim.pres.read.tex));
    gl.uniform1i(u.uVel, bindTex(1, sim.vel.read.tex));
    gl.uniform1i(u.uFloor, bindTex(2, sim.floor));
    run(sim.vel.write);
    sim.vel.swap();
    // advect the air by itself
    u = use(programs.advect);
    gl.uniform1i(u.uVel, bindTex(0, sim.vel.read.tex));
    gl.uniform1f(u.uDt, dt);
    run(sim.vel.write);
    sim.vel.swap();
    // carry the mist's state
    u = use(programs.state);
    gl.uniform1i(u.uVel, bindTex(0, sim.vel.read.tex));
    gl.uniform1i(u.uState, bindTex(1, sim.state.read.tex));
    gl.uniform2f(u.uWind, wind[0], wind[1]);
    gl.uniform1f(u.uDt, dt);
    gl.uniform1f(u.uCell, geo.cell);
    gl.uniform1f(u.uKeepD, Math.exp(-dt / 9));
    gl.uniform1f(u.uKeepT, Math.exp(-dt / 5));
    gl.uniform1f(u.uDiffuse, Math.min(1, 9 * dt));
    run(sim.state.write);
    sim.state.swap();
  }

  // ---- the mist, drawn ----
  // ---- the mist's history: the last frames, averaged (the camera is still) ----
  let history = null;
  let historyFresh = true;
  let seedIndex = 0;
  function ensureHistory() {
    if (history && history.w === canvas.width && history.h === canvas.height) return;
    if (history) for (const t of history.both) freeTarget(gl, t);
    const a = target(gl, canvas.width, canvas.height, gl.NEAREST);
    const b = target(gl, canvas.width, canvas.height, gl.NEAREST);
    history = { w: canvas.width, h: canvas.height, read: a, write: b, both: [a, b] };
    historyFresh = true;
  }

  function draw(blend = 1) {
    ensureHistory();
    const u = use(programs.render);
    gl.uniform1i(u.uHistory, bindTex(3, history.read.tex));
    gl.uniform1f(u.uBlend, historyFresh ? 1 : blend);
    seedIndex = (seedIndex + 1) % 4096;
    gl.uniform1f(u.uSeed, (seedIndex * 0.6180339887) % 1);
    const { room, focal, horizon } = opts.scene;
    gl.uniform1i(u.uNoise, bindTex(0, noise, true));
    gl.uniform1i(u.uState, bindTex(1, sim.state.read.tex));
    gl.uniform1i(u.uFloor, bindTex(2, sim.floor));
    gl.uniform4f(u.uRegion, region.x0, region.y0, region.x1, region.y1);
    gl.uniform2f(u.uRoom, room.w, room.h);
    gl.uniform1f(u.uHorizon, horizon);
    gl.uniform1f(u.uFocal, focal);
    gl.uniform1f(u.uWallZ, geo.zWall);
    gl.uniform4f(u.uWorld, geo.xMin, geo.zMin, geo.xSize, geo.zSize);
    gl.uniform4fv(u.uPed, geo.pedUniform);
    gl.uniform1i(u.uPedCount, geo.peds.length);
    gl.uniform1f(u.uTime, flow);
    gl.uniform2f(u.uDrift, drift[0], drift[1]);
    gl.uniform1f(u.uTop, 0.115 * (0.75 + 0.25 * params.density));
    gl.uniform1f(u.uSigma, 1.7 * params.density);
    gl.uniform1f(u.uTurb, 0.25 + 0.75 * params.turbulence);
    gl.uniform1f(u.uLight, params.light);
    gl.uniform1f(u.uSteps, Math.max(8, Math.round(baseSteps * TIERS[tier].steps)));
    gl.uniform1f(u.uZNear, geo.zNear);
    gl.uniform3fv(u.uLit, LIT);
    gl.uniform3fv(u.uShade, SHADE);
    gl.uniform3fv(u.uSun, SUN);
    gl.bindFramebuffer(gl.FRAMEBUFFER, history.write.fb);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    [history.read, history.write] = [history.write, history.read];
    historyFresh = false;
    present();
  }
  function present() {
    if (opts.debug === 'air') return presentDebug();
    const u = use(programs.present);
    gl.uniform1i(u.uSrc, bindTex(0, history.read.tex));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function presentDebug() {
    const u = use(programs.debug);
    const { room, focal, horizon } = opts.scene;
    const wind = windCells(clock);
    gl.uniform1i(u.uSrc, bindTex(0, history.read.tex));
    gl.uniform1i(u.uState, bindTex(1, sim.state.read.tex));
    gl.uniform1i(u.uVel, bindTex(2, sim.vel.read.tex));
    gl.uniform4f(u.uRegion, region.x0, region.y0, region.x1, region.y1);
    gl.uniform2f(u.uRoom, room.w, room.h);
    gl.uniform1f(u.uHorizon, horizon);
    gl.uniform1f(u.uFocal, focal);
    gl.uniform1f(u.uWallZ, geo.zWall);
    gl.uniform4f(u.uWorld, geo.xMin, geo.zMin, geo.xSize, geo.zSize);
    gl.uniform2f(u.uWind, wind[0], wind[1]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Reduced motion: one moment of the mist, averaged over many jittered samplings, held. */
  function drawStill() {
    if (destroyed) return;
    historyFresh = true;
    for (let i = 0; i < 16; i++) draw(1 / (i + 1));
  }

  /** Let the air settle around the pedestals before the first frame is seen. */
  function warm(seconds) {
    const n = Math.round(seconds * 30);
    for (let i = 0; i < n; i++) step(1 / 30);
  }

  // ---- the loop ----
  let raf = 0;
  let running = false;
  let destroyed = false;
  let userPaused = false;
  let inView = true;
  let last = 0;
  let settleUntil = 0;
  let windowStart = 0;
  let slowStrikes = 0;
  const intervals = [];
  const stats = { fps: 0, tier: 0, frames: 0, fallback: null };

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const ms = last ? now - last : 16.7;
    last = now;
    if (ms > 250) return; // came back from a stall: don't leap
    const dt = Math.min(ms / 1000, 1 / 30);
    step(dt);
    draw(1 - Math.exp(-dt / 0.06));
    stats.frames++;
    measure(ms, now);
  }
  /* Frame times, judged over windows of about a second and a half after a short settling time. Below
     48 fps the quality steps down (straight to the lowest step below 30 fps); at the lowest step, below
     24 fps, or below 34 fps twice running, the mist gives up and asks the host for the video. */
  function measure(ms, now) {
    if (now < settleUntil) return;
    if (!intervals.length) windowStart = now;
    intervals.push(ms);
    if (now - windowStart < 1500 && intervals.length < 120) return;
    const sorted = intervals.slice().sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    intervals.length = 0;
    const fps = 1000 / median;
    stats.fps = Math.round(fps * 10) / 10;
    if (!opts.adapt) return;
    const lowest = TIERS.length - 1;
    if (fps < 48 && tier < lowest) {
      tier = fps < 30 ? lowest : tier + 1;
      stats.tier = tier;
      resize();
      settleUntil = now + 500;
    } else if (tier === lowest && fps < 34) {
      if (fps < 24 || ++slowStrikes >= 2) {
        stats.fallback = 'slow';
        destroy();
        fail('slow');
      }
    } else slowStrikes = 0;
  }
  function sync() {
    const go = !destroyed && !opts.still && !userPaused && inView && !document.hidden;
    if (go && !running) {
      running = true;
      last = 0;
      settleUntil = performance.now() + 750;
      intervals.length = 0;
      raf = requestAnimationFrame(loop);
    } else if (!go && running) {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  let io = null;
  let ro = null;
  const onVisibility = () => sync();
  if (opts.autoPause) {
    io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    io.observe(canvas);
    document.addEventListener('visibilitychange', onVisibility);
  }
  ro = new ResizeObserver(() => resize());
  ro.observe(canvas);

  const onLost = (event) => {
    event.preventDefault();
    stats.fallback = 'context-lost';
    destroy();
    fail('context-lost');
  };
  canvas.addEventListener('webglcontextlost', onLost);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    running = false;
    cancelAnimationFrame(raf);
    io?.disconnect();
    ro?.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('webglcontextlost', onLost);
    if (!gl.isContextLost()) {
      freeSim(sim);
      if (history) for (const t of history.both) freeTarget(gl, t);
      gl.deleteTexture(noise);
      for (const p of Object.values(programs)) gl.deleteProgram(p.p);
      gl.deleteBuffer(tri);
      gl.deleteVertexArray(vao);
    }
  }

  // ---- start ----
  resize();
  warm(opts.still ? 2.5 : 1.5);
  if (opts.still) drawStill();
  else {
    draw();
    sync();
  }

  return {
    /** The pointer's position in client pixels. Only its movement stirs the air. */
    setPointer(x, y) {
      if (!opts.interactive || opts.still) return;
      if (!pointer.active) {
        pointer.prev = null;
        pointer.active = true;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.moved = true;
    },
    /** The pointer left: forget where it was, so its return doesn't leap. */
    releasePointer() {
      pointer.active = false;
      pointer.prev = null;
    },
    /** Tuning: density, drift, turbulence, light, pointer (1 is the default for each). */
    set(next) {
      Object.assign(params, next);
      if (opts.still) drawStill();
    },
    get params() {
      return { ...params };
    },
    /** Change which part of the room the canvas covers (fractions of the room). */
    setRegion(next) {
      region = { ...next };
      if (opts.still) drawStill();
    },
    /** Hold the mist still (reduced motion) or let it move again. */
    setStill(still) {
      opts.still = Boolean(still);
      if (opts.still) {
        pointer.active = false;
        sync();
        drawStill();
      } else sync();
    },
    resize,
    pause() {
      userPaused = true;
      sync();
    },
    resume() {
      userPaused = false;
      sync();
    },
    destroy,
    get stats() {
      return { ...stats, tier, width: canvas.width, height: canvas.height, grid: [geo.nx, geo.nz], running };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** The room's camera and pedestals in world units (camera heights), and the floor's air grid. */
function deriveScene(scene, low) {
  const { room, horizon, focal, wall } = scene;
  const zWall = focal / (wall - horizon);
  const peds = scene.pedestals.map((p) => {
    const zFront = focal / (p.base - horizon);
    const r = (p.half * zFront) / (focal - p.half);
    const z = zFront + r;
    return { x: ((p.x - room.w / 2) * z) / focal, z, r, h: ((p.base - p.top) * z) / focal };
  });
  // The nearest mist: where the bottom row of the room first enters the slab.
  const zNear = (1 - SLAB) / ((room.h - horizon) / focal);
  const halfW = ((room.w / 2) * zWall) / focal;
  const xMin = -halfW - 0.12;
  const xSize = 2 * (halfW + 0.12);
  const zMin = zNear - 0.12;
  const zSize = zWall + 0.06 - zMin;
  const nx = low ? 112 : 176;
  const cell = xSize / nx;
  const nz = Math.max(16, Math.round(zSize / cell));
  const pedUniform = new Float32Array(24);
  peds.slice(0, 6).forEach((p, i) => pedUniform.set([p.x, p.z, p.r, p.h], i * 4));
  return { zWall, zNear, peds, pedUniform, xMin, xSize, zMin, zSize: nz * cell, nx, nz, cell, iterations: low ? 14 : 22 };
}

/** Pooling near each pedestal (R) and its solid footprint (G), at the air's resolution. */
function floorMap(gl, geo) {
  const { nx, nz } = geo;
  const data = new Uint8Array(nx * nz * 4);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = geo.xMin + ((i + 0.5) / nx) * geo.xSize;
      const z = geo.zMin + ((j + 0.5) / nz) * geo.zSize;
      let pool = 0;
      let solid = 0;
      for (const p of geo.peds) {
        const d = Math.hypot(x - p.x, z - p.z) - p.r;
        pool += Math.exp(-Math.max(d, 0) / 0.16);
        solid = Math.max(solid, smoothstep(geo.cell, -geo.cell, d));
      }
      const k = (j * nx + i) * 4;
      data[k] = Math.round(Math.min(pool, 1) * 255);
      data[k + 1] = Math.round(solid * 255);
      data[k + 3] = 255;
    }
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, nx, nz, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  return tex;
}

/** Bake the tileable noise volume on the GPU, one layer at a time. */
function bakeNoise(gl, prog, size) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texStorage3D(gl.TEXTURE_3D, 1, gl.RGBA8, size, size, size);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  for (const wrap of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, wrap, gl.REPEAT);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.useProgram(prog.p);
  gl.uniform1f(prog.u.uSize, size);
  gl.viewport(0, 0, size, size);
  for (let layer = 0; layer < size; layer++) {
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, tex, 0, layer);
    gl.uniform1f(prog.u.uLayer, layer);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fb);
  return tex;
}

function target(gl, w, h, filter) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fog: float target incomplete');
  return { tex, fb, w, h };
}
function freeTarget(gl, t) {
  gl.deleteTexture(t.tex);
  gl.deleteFramebuffer(t.fb);
}

function program(gl, vs, fs) {
  const compile = (type, source) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'compile failed');
    return s;
  };
  const p = gl.createProgram();
  const v = compile(gl.VERTEX_SHADER, vs);
  const f = compile(gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link failed');
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function normalize3(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}
