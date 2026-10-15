/**
 * Evening mist for the dusk passage (Atmosphere.tsx): thin fog lying low across the screen, drifting slowly sideways
 * and turning over on itself, densest at the screen's foot and gone a third of the way up. It is drawn as matter,
 * not light: a pale lilac-grey of a few percent, laid over the falling light, with no bloom and nothing that
 * sparkles. Its strength is the page's (--tm-mist, atmosphere.css, as the layer's opacity); this only draws its
 * shape, at a third of the screen's resolution (fog has no fine detail), and only while it can be seen.
 */

const VERTEX = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

// Domain-warped value noise, advected sideways: banks of fog that drift and slowly turn over.
const FRAGMENT = `precision mediump float;
uniform vec2 res;
uniform float t;
uniform vec3 tint;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int k = 0; k < 4; k++) { v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / res;
  // Fog banks are wide and flat: the noise is stretched sideways.
  vec2 p = vec2(uv.x * res.x / res.y * 0.9, uv.y * 2.6);
  vec2 drift = vec2(t * 0.022, 0.0);
  vec2 q = vec2(fbm(p + drift), fbm(p + vec2(5.2, 1.3) - drift * 0.7 + vec2(0.0, t * 0.006)));
  float f = fbm(p + 1.7 * q + drift * 1.6);
  // Lying low: densest at the foot, thinning to nothing about half way up, never a bank with an edge.
  float lie = exp(-uv.y * 3.0) * (1.0 - smoothstep(0.2, 0.55, uv.y));
  float d = (0.35 + 0.65 * smoothstep(0.25, 0.95, f)) * lie * 0.36;
  gl_FragColor = vec4(tint * d, d);
}`;

export type DuskMist = { setActive: (on: boolean) => void; stop: () => void };

/** Draw the mist into `canvas`; null where WebGL isn't available (the page simply goes without it). */
export function startDuskMist(canvas: HTMLCanvasElement, tint: [number, number, number]): DuskMist | null {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return null;
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const v = shader(gl.VERTEX_SHADER, VERTEX), f = shader(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!v || !f || !program) return null;
  gl.attachShader(program, v);
  gl.attachShader(program, f);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const at = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  const res = gl.getUniformLocation(program, "res"), time = gl.getUniformLocation(program, "t");
  gl.uniform3f(gl.getUniformLocation(program, "tint"), ...tint);

  let frame = 0, active = false, stopped = false;
  const begun = performance.now();
  const size = () => {
    // A third of the screen's resolution: fog is soft, and the browser smooths it up.
    const w = Math.max(1, Math.round(canvas.clientWidth / 3)), h = Math.max(1, Math.round(canvas.clientHeight / 3));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(res, w, h);
  };
  const draw = (now: number) => {
    frame = 0;
    if (!active || stopped || document.hidden) return;
    size();
    gl.uniform1f(time, (now - begun) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frame = requestAnimationFrame(draw);
  };
  return {
    setActive(on) {
      if (on === active) return;
      active = on;
      if (on && !frame) frame = requestAnimationFrame(draw);
    },
    // The context is left to the canvas: a remount draws into it again (a lost one would show as a blank sheet).
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
  };
}
