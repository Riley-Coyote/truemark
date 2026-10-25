/**
 * The room's daylight through water (RoomLight.ts): the opening's arches are lit from openings high above, and that
 * light comes down through water, so wherever it falls on the arches it ripples, as light does on a pool's floor. It is
 * the window light's water (wall-light.ts) carried into the room: the same ripples, their edges just split into colour,
 * laid on the arches in the corridor's own perspective, finer toward its far end and fading into its haze. It falls only
 * where the photograph is already lit, gathering that light into lines and leaving a little less between them, as water
 * does; never more than a fifth less, so the words over the room keep their contrast.
 *
 * Drawn at half the screen's resolution, only while the room can be seen; with motion off it holds still and is drawn
 * again only when asked. After every frame it tells the room (onFrame), so the liquid's water can bend what was drawn.
 */

const VERTEX = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAGMENT = `precision highp float;
uniform vec2 res;
uniform float t;
uniform sampler2D room;
uniform vec4 fit;
uniform vec2 vp;
uniform vec2 box;
uniform float aspect;
uniform float strength;
uniform float floorAt;
uniform float shadeBetween;

// Light through moving water (after joltz0r's tileable water caustic), as on the wall below the opening.
float caustic(vec2 p, float time) {
  vec2 i = p;
  float c = 1.0;
  const float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = time * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 6.0);
}

void main() {
  // This pixel, from the canvas's top left, 0 to 1 each way.
  vec2 p = vec2(gl_FragCoord.x / res.x, 1.0 - gl_FragCoord.y / res.y);
  // The floor the pedestals stand on keeps the beam's own still light.
  float above = 1.0 - smoothstep(floorAt - 0.08, floorAt, p.y);
  if (above <= 0.0) { gl_FragColor = vec4(0.0); return; }
  // Only where the photograph is lit does the light fall.
  vec3 photo = texture2D(room, p * fit.xy + fit.zw).rgb;
  float lit = smoothstep(0.6, 0.86, dot(photo, vec3(0.2126, 0.7152, 0.0722))) * above;
  if (lit <= 0.0) { gl_FragColor = vec4(0.0); return; }

  // Where this pixel lies in the corridor: on a side or the vault (a box seen down its length), how far along it, and
  // where across it. The ripples are laid on that surface, so they run finer toward the far end.
  vec2 q = (p - vp) * vec2(aspect, 1.0) / box;
  float z, s;
  if (abs(q.x) > abs(q.y)) { z = 1.0 / abs(q.x); s = q.y * z; } else { z = 1.0 / abs(q.y); s = q.x * z; }
  z = min(z, 40.0);
  vec2 cp = vec2(z * 0.6 + t * 0.012, s * 0.6);
  cp = mod(cp * 6.28318, 6.28318) - 250.0;
  float time = t * 0.2 + 23.0;
  float spread = 0.05;
  vec3 ripple = vec3(caustic(cp + vec2(spread, 0.0), time), caustic(cp, time), caustic(cp - vec2(spread, 0.0), time));

  // Water gathers the light it passes into lines and leaves a little less between them: on a wall already lit almost
  // white, the lines alone would barely show. Farther off, fainter, as the haze takes it.
  float here = lit * min(exp(-0.22 * (z - 1.0)), 1.0) * (1.0 - smoothstep(3.0, 6.0, z));
  // Thin lines, never pools: where ripples gather, the light sharpens rather than spreads, and it never fills a wall
  // white.
  float bright = clamp(here * strength * pow(clamp(ripple.g, 0.0, 1.3), 1.6), 0.0, 0.55);
  float shade = here * shadeBetween * (1.0 - clamp(ripple.g, 0.0, 1.0));
  vec3 colour = mix(vec3(0.97, 0.955, 1.0), vec3(1.0), clamp(ripple, 0.0, 1.0));
  gl_FragColor = vec4(colour * bright, bright + shade);
}`;

/** The corridor as the photograph shows it: its vanishing point and the near arch's half width and height (in the
 *  canvas's heights), and where its floor begins (0 to 1, down). */
export type Corridor = { vp: [number, number]; box: [number, number]; floorAt: number };

export type RoomLight = { setActive: (on: boolean) => void; redraw: () => void; stop: () => void };

/** Draw the light into `canvas`, laid over `photo` as the page shows it; null where WebGL isn't available. */
export function startRoomLight(canvas: HTMLCanvasElement, photo: HTMLImageElement, corridor: Corridor, still: boolean, onFrame: () => void): RoomLight | null {
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
  const u = (name: string) => gl.getUniformLocation(program, name);
  const res = u("res"), time = u("t"), fit = u("fit"), aspect = u("aspect");
  gl.uniform1i(u("room"), 0);
  gl.uniform2f(u("vp"), corridor.vp[0], corridor.vp[1]);
  gl.uniform2f(u("box"), corridor.box[0], corridor.box[1]);
  gl.uniform1f(u("floorAt"), corridor.floorAt);
  gl.uniform1f(u("strength"), 1.15);
  gl.uniform1f(u("shadeBetween"), 0.2);

  // The photograph, as a texture the light reads where it falls.
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  let loaded = false, stopped = false;
  const upload = () => {
    if (stopped || !photo.complete || !photo.naturalWidth) return;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, photo);
    loaded = true;
  };
  upload();

  let frame = 0, active = false;
  const begun = performance.now();
  // Half the screen's resolution: the light is soft, and its ripples are wider than two pixels.
  const size = () => {
    const d = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round((canvas.clientWidth * d) / 2)), h = Math.max(1, Math.round((canvas.clientHeight * d) / 2));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(res, w, h);
    gl.uniform1f(aspect, w / h);
    // The photograph is fitted to the room as the page fits it: covering it, from its middle.
    const k = photo.naturalWidth / photo.naturalHeight / (w / h);
    const sx = k > 1 ? 1 / k : 1, sy = k > 1 ? 1 : k;
    gl.uniform4f(fit, sx, sy, (1 - sx) / 2, (1 - sy) / 2);
  };
  const paint = (now: number) => {
    if (!loaded) upload();
    if (!loaded) return;
    size();
    gl.uniform1f(time, still ? 40 : (now - begun) / 1000 + window.scrollY * 0.004);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    onFrame();
  };
  const draw = (now: number) => {
    frame = 0;
    if (!active || stopped || document.hidden) return;
    paint(now);
    if (!still) frame = requestAnimationFrame(draw);
  };
  // A photograph still arriving is taken up as it arrives, unless the light has been put away by then.
  const listening = new AbortController();
  if (!photo.complete) photo.addEventListener("load", () => { upload(); if (active && !frame) frame = requestAnimationFrame(draw); }, { once: true, signal: listening.signal });
  return {
    setActive(on) {
      if (on === active) return;
      active = on;
      if (on && !frame) frame = requestAnimationFrame(draw);
    },
    redraw() {
      if (active && !stopped && !frame) frame = requestAnimationFrame(draw);
    },
    stop() {
      stopped = true;
      listening.abort();
      cancelAnimationFrame(frame);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.deleteTexture(texture);
    },
  };
}
