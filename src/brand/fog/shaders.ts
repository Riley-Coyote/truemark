/*
 * The floor mist's shaders (fog.ts): the noise it is made of, the air that carries it, and the mist itself.
 * Every pass draws one full-screen triangle.
 */
import { MAX_PEDESTALS, SLAB } from "./scenes";

export const VERTEX = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

/* A tileable 3D noise volume, baked once: R, G gradient noise (4 and 8 cells per tile),
   B, A inverted cellular noise (4 and 8): soft structure and rounded billows. */
export const NOISE = /* glsl */ `#version 300 es
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

/* The air's passes share a head: one cell of the floor grid per fragment. */
const SIM_HEAD = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uTexel;
`;

export const CURL = /* glsl */ `${SIM_HEAD}
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
export const FORCE = /* glsl */ `${SIM_HEAD}
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

export const DIVERGENCE = /* glsl */ `${SIM_HEAD}
uniform sampler2D uVel;
void main() {
  float L = texture(uVel, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uVel, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uVel, vUv - vec2(0.0, uTexel.y)).y;
  float T = texture(uVel, vUv + vec2(0.0, uTexel.y)).y;
  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

export const SCALE = /* glsl */ `${SIM_HEAD}
uniform sampler2D uSrc;
uniform float uK;
void main() { outColor = texture(uSrc, vUv) * uK; }`;

export const PRESSURE = /* glsl */ `${SIM_HEAD}
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

export const GRADIENT = /* glsl */ `${SIM_HEAD}
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

export const ADVECT = /* glsl */ `${SIM_HEAD}
uniform sampler2D uVel;
uniform float uDt;
void main() {
  vec2 back = vUv - uDt * texture(uVel, vUv).xy * uTexel;
  outColor = texture(uVel, back);
}`;

/* The mist's state, carried by the air: xy how far the air has displaced its fine structure
   (world units, beyond the drift), z its thickness (1 = settled). A wake's thinness diffuses in
   from its sides and settles back; displacement relaxes slowly. */
export const STATE = /* glsl */ `${SIM_HEAD}
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
export const SPLAT = /* glsl */ `${SIM_HEAD}
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
export const RENDER = /* glsl */ `#version 300 es
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
uniform vec4 uPed[${MAX_PEDESTALS}];
uniform int uPedCount;
uniform float uTime;
uniform vec2 uDrift;
uniform float uTop;
uniform float uPile;
uniform float uClimb;
uniform float uFirm;
uniform float uSigma;
uniform float uTurb;
uniform float uLight;
uniform float uSteps;
uniform float uZNear;
uniform vec3 uLit;
uniform vec3 uShade;
uniform vec3 uSun;
uniform vec3 uSpot;
uniform vec2 uRoomLight;
uniform sampler2D uHistory;
uniform float uBlend;
uniform float uFrame;
const float SLAB = ${SLAB.toFixed(3)};

/* Where along its first step each pixel's march starts: interleaved gradient noise, moved on each frame (64 to a
   cycle). Neighbouring pixels and successive frames start far apart, so the few frames the history averages, and the
   eye across a few pixels, see the whole step covered: a smooth mist, not a grain. */
float startAt(vec2 p) {
  p += 5.588238 * uFrame;
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

/* The mist's body at a height: its surface lifted into soft rounded billows and broken into wisps.
   'mid' scales the middle structure (softer near the camera), 'fine' the finest (gone where the march
   can't resolve it). uFirm is how far up (a share of its top) it stays dense before rolling off: low, a
   haze thinning all the way up; higher, a bank with a surface its billows show on. */
float body(vec2 q, float y, float top, float mid, float fine) {
  vec3 dq = vec3(q.x, y * 2.2, q.y);
  vec4 n1 = texture(uNoise, dq * 0.34 + vec3(0.0, -uTime * 0.013, uTime * 0.0035));
  vec3 w = vec3(n1.g - 0.5, 0.0, n1.r - 0.5) * 0.35;
  vec4 n2 = texture(uNoise, (dq + w) * 1.45 + vec3(0.37, -uTime * 0.034, 0.11 + uTime * 0.006));
  float billow = n2.b * (2.0 - n2.b);
  float lift = ((n1.r - 0.5) * 1.2 + (n1.g - 0.5) * 0.8 + (billow - 0.72) * 1.3) * mid
             + ((n2.a - 0.55) * 0.8 + (n2.r - 0.5) * 0.6) * fine;
  float rel = (y - lift * top * uTurb) / max(top, 1e-3);
  float b = 1.0 - smoothstep(uFirm, 1.1, rel);
  return b * mix(b, 1.0, 0.35) * (0.45 + 0.8 * exp(-y / (0.42 * top + 0.008)));
}

void main() {
  vec2 px = vec2(mix(uRegion.x, uRegion.z, vUv.x), mix(uRegion.w, uRegion.y, vUv.y)) * uRoom;
  vec3 rd = vec3((px.x - 0.5 * uRoom.x) / uFocal, -(px.y - uHorizon) / uFocal, 1.0);
  vec4 prev = texelFetch(uHistory, ivec2(gl_FragCoord.xy), 0);
  outColor = prev * (1.0 - uBlend);
  if (rd.y > -1e-4) return;
  // From the camera (one unit above the floor) down through the slab of mist, to the floor, the back
  // wall, or a pedestal (its near side, or its top seen from above), whichever comes first. z equals t
  // along this ray.
  float t0 = (1.0 - SLAB) / -rd.y;
  float t1 = min(1.0 / -rd.y, uWallZ);
  for (int i = 0; i < ${MAX_PEDESTALS}; i++) {
    if (i >= uPedCount) break;
    vec4 pd = uPed[i];
    vec2 oc = -pd.xy;
    float a = dot(rd.xz, rd.xz), b = dot(oc, rd.xz), c = dot(oc, oc) - pd.z * pd.z;
    float disc = b * b - a * c;
    if (disc > 0.0) {
      float th = (-b - sqrt(disc)) / a;
      if (th > 0.0) {
        if (1.0 + rd.y * th < pd.w) t1 = min(t1, th);
        else {
          // Over the side's top edge: the ray comes down onto the top if it lands inside it.
          float tt = (1.0 - pd.w) / -rd.y;
          vec2 land = rd.xz * tt - pd.xy;
          if (dot(land, land) < pd.z * pd.z) t1 = min(t1, tt);
        }
      }
    }
  }
  if (t1 <= t0) return;
  float len = length(rd);
  float dt = (t1 - t0) / uSteps;
  float stepLen = dt * len;
  // The finest structure only where the march resolves it; elsewhere it would only be grain.
  float resolve = 1.0 - smoothstep(0.035, 0.1, stepLen);
  float t = t0 + dt * startAt(gl_FragCoord.xy);
  float trans = 1.0;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 64; i++) {
    if (float(i) >= uSteps || trans < 0.01) break;
    vec3 p = vec3(0.0, 1.0, 0.0) + rd * t;
    vec2 suv = (p.xz - uWorld.xy) / uWorld.zw;
    vec4 st = texture(uState, suv);
    vec4 ground = texture(uFloor, suv);
    float pool = ground.r;
    // The most the mist may reach here: near a pedestal, well under the vial standing on its top.
    float ceiling = ground.b * SLAB;
    vec2 q = p.xz - st.xy + uDrift;
    // Slow banks: where the layer runs thick and thin.
    float b1 = texture(uNoise, vec3(q * 0.085, uTime * 0.0021)).r;
    float b2 = texture(uNoise, vec3(q * 0.21 + 0.31, uTime * 0.0043 + 0.5)).g;
    float bank = clamp(0.5 + (b1 - 0.5) * 1.6 + (b2 - 0.5) * 0.9, 0.0, 1.0);
    // Close to the back wall the mist lies flatter and thinner; it piles up against each pedestal.
    float far = smoothstep(uWallZ - 0.8, uWallZ, p.z);
    float top = uTop * mix(0.5, 1.45, bank) * (1.0 + uPile * pool) * mix(1.0, 0.62, far) * st.z;
    // Now and then a wisp climbs higher: sparse, slow and rounded, mostly where the bank piles against a
    // pedestal, carried round its sides by the air.
    float plume = smoothstep(0.6, 0.9, texture(uNoise, vec3(q * 0.42 + vec2(0.71, 0.13), uTime * 0.0045 + 0.61)).b);
    top *= 1.0 + uClimb * plume * (0.35 + 0.65 * pool);
    // Ease it under the ceiling, softly, so the bank keeps its rise and fall under a low ceiling instead of
    // being cut flat; the rare billow that rides higher still fades out below the ceiling (see d).
    float cap = ceiling * 0.75;
    float knee = 0.7 * cap;
    if (top > knee) top = knee + (cap - knee) * (1.0 - exp(-(top - knee) / (cap - knee)));
    // Near the camera the mist is out of focus: larger, softer, its finest structure gone.
    float focus = smoothstep(uZNear + 0.1, uZNear + 1.5, p.z);
    float mid = mix(0.55, 1.0, focus);
    float fine = mix(0.15, 1.0, focus) * resolve;
    float thin = mix(1.0, 0.55, far) * mix(0.6, 1.0, focus);
    thin *= sqrt(clamp(st.z, 0.0, 1.6));
    float d = body(q, p.y, top, mid, fine) * thin * (1.0 - smoothstep(ceiling - 0.04, ceiling, p.y));
    if (d > 0.002) {
      // Self-shadowing toward the light overhead: brighter where the mist thins toward it, so its billows' tops catch
      // it and their undersides fall into shade.
      float dl = body(q + uSun.xz * 0.07, p.y + uSun.y * 0.07, top, mid, fine) * thin;
      float lit = clamp((d - dl) * 2.6 / (d + 0.25), 0.0, 1.0);
      float up = clamp(p.y / max(top, 1e-3), 0.0, 1.0);
      // The light's pool: full under it, falling off softly into the room.
      vec2 off = (p.xz - uSpot.xy) / uSpot.z;
      float inLight = exp(-dot(off, off));
      float k = clamp(0.56 + (0.3 * up + lit * 0.62 - 0.36) * uLight, 0.0, 1.0);
      vec3 col = mix(uShade, uLit, k) * mix(uRoomLight.x, 1.0, inLight);
      col = min(col * (1.0 + uRoomLight.y * inLight * min(d * 2.0, 1.0)), vec3(1.0));
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
export const PRESENT = /* glsl */ `#version 300 es
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
