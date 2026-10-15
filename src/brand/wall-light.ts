/**
 * The window's light on the room's wall, below the opening (Home.tsx, WallLight): the opening's room goes on down the
 * page, and its window throws light across the wall the page's words stand on. Each window's light is four panes and
 * the cross of their mullions, leaning down to the right as the photograph's light falls; it drifts as a day's light
 * does and dims a little as if clouds passed. Within the light, the glass it comes through ripples it into caustics,
 * their edges just split into colour. It is light only, never matter: it brightens the wall and never darkens it, so
 * every word on the wall keeps the contrast it has without it.
 *
 * The canvas stands still behind the page and is drawn from the page's scroll, the light moving at half the page's
 * pace, on a wall further off than the words. It is drawn at half the screen's resolution and only while the wall can
 * be seen; with reduced motion it holds still and is drawn again only as the page scrolls.
 */

const VERTEX = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAGMENT = `precision highp float;
uniform vec2 res;
uniform float px;
uniform float t;
uniform float scroll;
uniform float wallTop;
uniform float strength;

float box(vec2 p, vec2 lo, vec2 hi, float soft) {
  vec2 a = smoothstep(lo - soft, lo + soft, p);
  vec2 b = 1.0 - smoothstep(hi - soft, hi + soft, p);
  return a.x * a.y * b.x * b.y;
}

// Four panes and their mullions in a unit window.
float panes(vec2 q, float soft) {
  float m = 0.045;
  return box(q, vec2(0.0), vec2(0.5 - m), soft)
    + box(q, vec2(0.5 + m, 0.0), vec2(1.0, 0.5 - m), soft)
    + box(q, vec2(0.0, 0.5 + m), vec2(0.5 - m, 1.0), soft)
    + box(q, vec2(0.5 + m), vec2(1.0), soft);
}

// Light through moving water and glass (after joltz0r's tileable water caustic).
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

// One window's light on the wall: its panes, brightest nearest the window and fading along their fall, and a broad
// faint glow around them. The windows fall one to each stretch of the wall, alternately nearer its left and its right
// side, leaning down to the right as the photograph's light does, a little moved by the day.
float windowAt(vec2 wall, float k, float w, float unit, float period, float day) {
  float side = mod(k, 2.0);
  vec2 size = vec2(0.42, 0.8) * unit;
  float lean = 0.35;
  float leftX = 0.03 * w;
  float rightX = w - 0.03 * w - size.x - lean * size.y;
  vec2 origin = vec2(mix(leftX, rightX, side) + sin(day + k) * 0.03 * unit, (k + 0.12) * period + cos(day * 0.8 + k) * 0.02 * unit);
  vec2 local = wall - origin;
  local.x -= lean * local.y;
  vec2 q = local / size;
  float light = panes(q, 0.04) * mix(1.0, 0.45, clamp(q.y, 0.0, 1.0));
  float glow = box(q, vec2(-0.3, -0.15), vec2(1.3, 1.2), 0.35) * 0.18;
  return light + glow;
}

void main() {
  // This pixel on the screen, in CSS pixels from the top left, and the screen's size.
  vec2 css = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) * px;
  float w = res.x * px;
  float h = res.y * px;
  // A window's light is sized as a window is, not as the screen is: to the screen's width up to a laptop's.
  float unit = min(w, 900.0);
  // Where it lies on the wall: across, and down from the wall's top. The wall's top is the opening's foot; the light
  // on the wall moves at half the page's pace (at the moment the wall's top reaches the screen's top, the two
  // coincide).
  vec2 wall = vec2(css.x, css.y + 0.5 * (scroll - wallTop));
  // The wall begins at the opening's foot (on screen, wallTop - scroll), the light coming up out of its mist.
  float onWall = smoothstep(0.0, 0.6, (css.y - (wallTop - scroll)) / unit);

  // About one window to each screen of the wall. Each stretch draws its neighbours' light too, so no window's glow is
  // ever cut where one stretch meets the next.
  float day = t * 0.012;
  float period = 1.15 * h;
  float k = floor(wall.y / period);
  float light = windowAt(wall, k - 1.0, w, unit, period, day) + windowAt(wall, k, w, unit, period, day) + windowAt(wall, k + 1.0, w, unit, period, day);

  // Clouds: the light dims and returns, slowly.
  float cloud = 0.8 + 0.2 * sin(t * 0.11 + sin(t * 0.037) * 2.0);

  // The ripple of the glass in the light, its edges just split into colour.
  vec2 cp = wall / unit * 1.7 + vec2(t * 0.01, -t * 0.006);
  cp = mod(cp * 6.28318, 6.28318) - 250.0;
  float time = t * 0.3 + 23.0;
  float spread = 0.05;
  vec3 ripple = vec3(caustic(cp + vec2(spread, 0.0), time), caustic(cp, time), caustic(cp - vec2(spread, 0.0), time));

  // The panes' light first, the ripples within it carrying most of it: the window reads, and the water moving in it
  // is seen, as light on a pool's floor is.
  float lit = light * cloud * onWall * strength;
  vec3 colour = mix(vec3(0.97, 0.955, 1.0), vec3(1.0), clamp(ripple, 0.0, 1.0));
  float a = clamp(lit * (0.44 + 1.0 * clamp(ripple.g, 0.0, 1.3)), 0.0, 0.93);
  gl_FragColor = vec4(colour * a, a);
}`;

export type WallLight = { setActive: (on: boolean) => void; redraw: () => void; stop: () => void };

/** Draw the light into `canvas`, the wall beginning `wallTop()` px down the page; null where WebGL isn't available. */
export function startWallLight(canvas: HTMLCanvasElement, wallTop: () => number, still: boolean): WallLight | null {
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
  const res = u("res"), px = u("px"), time = u("t"), scroll = u("scroll"), top = u("wallTop"), strength = u("strength");
  gl.uniform1f(strength, 1);

  let frame = 0, active = false, stopped = false;
  const begun = performance.now();
  // Half the screen's resolution: the light is soft, and its ripples are wider than two pixels.
  const size = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth / 2)), h = Math.max(1, Math.round(canvas.clientHeight / 2));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(res, w, h);
    gl.uniform1f(px, canvas.clientWidth / w);
  };
  const paint = (now: number) => {
    size();
    gl.uniform1f(time, still ? 40 : (now - begun) / 1000);
    gl.uniform1f(scroll, window.scrollY);
    gl.uniform1f(top, wallTop());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const draw = (now: number) => {
    frame = 0;
    if (!active || stopped || document.hidden) return;
    paint(now);
    if (!still) frame = requestAnimationFrame(draw);
  };
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
      cancelAnimationFrame(frame);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
  };
}
