/**
 * The window's light on the room's wall, below the opening (Home.tsx, WallLight): the opening's room goes on down the
 * page, and its light falls through the TrueMark symbol across the wall the page's words stand on. Each symbol is
 * filled with light, leaning down to the right as the photograph's light falls; it drifts as a day's light
 * does and dims a little as if clouds passed. Within the light, the glass it comes through ripples it into caustics,
 * their edges just split into colour. It is light only, never matter: it brightens the wall and never darkens it, so
 * every word on the wall keeps the contrast it has without it.
 *
 * The canvas stands still behind the page and is drawn from the page's scroll, the light moving at half the page's
 * pace, on a wall further off than the words. It is drawn at half the screen's resolution and only while the wall can
 * be seen; with reduced motion it holds still and is drawn again only as the page scrolls.
 */

import { softenLightMask } from "./light-mask";

const VERTEX = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAGMENT = `precision highp float;
uniform vec2 res;
uniform float px;
uniform float t;
uniform float scroll;
uniform float actualScroll;
uniform float wallTop;
uniform float strength;
uniform sampler2D symbol;
uniform float symbolAspect;
uniform float trailCenter;
uniform float viewHeight;
uniform float overscan;
uniform float pass;
uniform sampler2D illumination;

// The supplied artwork is black on white. Only its filled strokes transmit light;
// the white background and the symbol's open spaces stay transparent.
float logo(vec2 q) {
  // Give the low-resolution illumination pass a small bleed around the entire
  // mark. Its coarse coverage must never become the high-resolution outline.
  if (pass > 0.5 && pass < 1.5) {
    return (q.x >= -0.02 && q.y >= -0.02 && q.x <= 1.02 && q.y <= 1.02) ? 1.0 : 0.0;
  }
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return 0.0;
  return 1.0 - texture2D(symbol, q).r;
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

// One logo-shaped projection, brightest at the top and fading along its fall.
// The projections fall one to each stretch of the wall, alternately nearer its left and its right
// side, leaning down to the right as the photograph's light does, a little moved by the day.
float windowAt(vec2 wall, float k, float w, float unit, float period, float day) {
  float side = mod(k, 2.0);
  vec2 size = vec2(0.65, 0.65 / symbolAspect) * unit;
  float lean = 0.35;
  float leftX = 0.03 * w;
  float rightX = w - 0.03 * w - size.x - lean * size.y;
  vec2 origin = vec2(mix(leftX, rightX, side) + sin(day + k) * 0.03 * unit, (k + 0.12) * period + cos(day * 0.8 + k) * 0.02 * unit);
  vec2 local = wall - origin;
  local.x -= lean * local.y;
  vec2 q = local / size;
  return logo(q) * mix(1.0, 0.45, clamp(q.y, 0.0, 1.0));
}

void main() {
  // This pixel on the screen, in CSS pixels from the top left, and the screen's size.
  vec2 css = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) * px - vec2(0.0, overscan);
  float w = res.x * px;
  float h = viewHeight;
  // A window's light is sized as a window is, not as the screen is: to the screen's width up to a laptop's.
  float unit = min(w, 900.0);
  // Where it lies on the wall: across, and down from the wall's top. The wall's top is the opening's foot; the light
  // on the wall moves at half the page's pace (at the moment the wall's top reaches the screen's top, the two
  // coincide).
  vec2 wall = vec2(css.x, css.y + 0.5 * (scroll - wallTop));
  // The wall begins at the opening's foot (on screen, wallTop - scroll), the light coming up out of its mist.
  // Account for the compositor's translation so rebasing cannot change the
  // opening's fade. On desktop scroll === actualScroll, preserving its formula.
  float onWall = smoothstep(0.0, 0.6, (css.y + 0.5 * (scroll - actualScroll) - (wallTop - actualScroll)) / unit);

  // About one window to each screen of the wall. Each stretch draws its neighbours' light too, so no window's glow is
  // ever cut where one stretch meets the next.
  float day = t * 0.012;
  float period = 1.15 * h;
  float k = floor(wall.y / period);
  float light = windowAt(wall, k - 1.0, w, unit, period, day) + windowAt(wall, k, w, unit, period, day) + windowAt(wall, k + 1.0, w, unit, period, day);
  if (trailCenter >= 0.0) {
    // The extra upright mark shares the wall's coordinates, clock and drift.
    // Place it near the timeline, but never pin or clip it to that section.
    vec2 size = vec2(0.65, 0.65 / symbolAspect) * unit;
    vec2 center = vec2(w * 0.5, 0.5 * (trailCenter - wallTop) + 0.25 * h);
    center += vec2(sin(day) * 0.03, cos(day * 0.8) * 0.02) * unit;
    vec2 q = (wall - center + size * 0.5) / size;
    light = max(light, logo(q) * mix(1.0, 0.45, clamp(q.y, 0.0, 1.0)));
  }

  // Most of the canvas has no window light. Skip the three expensive caustic
  // calculations there; the original output at these pixels is transparent too.
  if (light * onWall * strength <= 0.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  // Mobile's second pass only resolves the silhouette at display resolution.
  // The costly caustics were already rendered into a smaller shared texture.
  if (pass > 1.5) {
    vec4 shine = texture2D(illumination, gl_FragCoord.xy / res);
    float a = clamp(light * shine.a * 2.0, 0.0, 0.93);
    gl_FragColor = vec4(shine.rgb * a, a);
    return;
  }

  // Clouds: the light dims and returns, slowly.
  float cloud = 0.8 + 0.2 * sin(t * 0.11 + sin(t * 0.037) * 2.0);

  // The ripple of the glass in the light, its edges just split into colour.
  vec2 cp = wall / unit * 1.7 + vec2(t * 0.01, -t * 0.006);
  cp = mod(cp * 6.28318, 6.28318) - 250.0;
  float time = t * 0.3 + 23.0;
  float spread = 0.05;
  vec3 ripple = vec3(caustic(cp + vec2(spread, 0.0), time), caustic(cp, time), caustic(cp - vec2(spread, 0.0), time));

  // The logo's light first, the ripples within it carrying most of it: the symbol reads, and the water moving in it
  // is seen, as light on a pool's floor is.
  vec3 colour = mix(vec3(0.97, 0.955, 1.0), vec3(1.0), clamp(ripple, 0.0, 1.0));
  float radiance = cloud * onWall * strength * (0.44 + clamp(ripple.g, 0.0, 1.3));
  if (pass > 0.5) {
    gl_FragColor = vec4(colour, radiance / 2.0);
    return;
  }
  float lit = light * cloud * onWall * strength;
  float a = clamp(lit * (0.44 + 1.0 * clamp(ripple.g, 0.0, 1.3)), 0.0, 0.93);
  gl_FragColor = vec4(colour * a, a);
}`;

export type WallLight = { setActive: (on: boolean) => void; redraw: () => void; stop: () => void };

/** Draw the light into `canvas`, the wall beginning `wallTop()` px down the page; null where WebGL isn't available. */
export function startWallLight(canvas: HTMLCanvasElement, wallTop: () => number, still: boolean, trailCenter: () => number = () => -1, options: { mobile?: boolean; pixelRatio?: number } = {}): WallLight | null {
  const mobile = options.mobile ?? matchMedia("(any-pointer: coarse)").matches;
  const nativeScroll = mobile && CSS.supports("animation-timeline", "scroll(root block)");
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
  const trail = u("trailCenter");
  const actualScroll = u("actualScroll");
  const viewHeight = u("viewHeight"), overscan = u("overscan"), pass = u("pass");
  gl.uniform1i(u("illumination"), 1);
  // Never render to a texture that is simultaneously sampled by the active program.
  const spare = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, spare);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const lightTexture = mobile ? gl.createTexture() : null;
  const lightBuffer = mobile ? gl.createFramebuffer() : null;
  let lowWidth = 0, lowHeight = 0;
  let baseScroll = window.scrollY;
  let appliedBaseScroll = baseScroll;
  let scrollRangeDirty = true;
  const pageResize = nativeScroll ? new ResizeObserver(() => { scrollRangeDirty = true; }) : null;
  pageResize?.observe(document.documentElement);
  pageResize?.observe(document.body);
  if (nativeScroll) {
    canvas.dataset.nativeScroll = "";
    canvas.style.setProperty("--tm-light-base", `${baseScroll * 0.5}px`);
  }
  canvas.dataset.lightRenderer = mobile ? "retina-mask" : "desktop";

  let frame = 0, active = false, stopped = false;
  // Prepare the soft silhouette once, not on each animation frame. Keep the
  // original PNG intact; the same mask and shader are used on phones and desktop.
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  gl.uniform1i(u("symbol"), 0);
  gl.uniform1f(u("symbolAspect"), 3600 / 2905);
  const artwork = new Image();
  artwork.onload = () => {
    if (stopped) return;
    const mask = document.createElement("canvas");
    mask.width = 1024;
    mask.height = Math.round(mask.width * artwork.naturalHeight / artwork.naturalWidth);
    const ctx = mask.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, mask.width, mask.height);
    // Proportional padding leaves room for soft edges without clipping the mark.
    const nativeFilter = Reflect.has(ctx, "filter");
    if (nativeFilter) ctx.filter = "blur(5px)";
    ctx.drawImage(artwork, mask.width * 0.03, mask.height * 0.03, mask.width * 0.94, mask.height * 0.94);
    if (!nativeFilter) {
      const pixels = ctx.getImageData(0, 0, mask.width, mask.height);
      softenLightMask(pixels.data, mask.width, mask.height);
      ctx.putImageData(pixels, 0, 0);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
    gl.uniform1f(u("symbolAspect"), mask.width / mask.height);
    if (active && !frame) frame = requestAnimationFrame(draw);
  };
  artwork.src = `${import.meta.env.BASE_URL}images/brand/light-symbol.png`;
  const begun = performance.now();
  const size = (cssWidth: number, cssHeight: number) => {
    // Desktop is unchanged. Mobile resolves edges at up to 2 device pixels per
    // CSS pixel, while its shimmer still renders at half CSS resolution.
    const scale = mobile ? Math.min(options.pixelRatio ?? (window.devicePixelRatio || 1), 2) : 0.5;
    const w = Math.max(1, Math.round(cssWidth * scale)), h = Math.max(1, Math.round(cssHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(res, w, h);
    gl.uniform1f(px, cssWidth / w);
    return { w, h };
  };
  const paint = (now: number) => {
    const cssWidth = canvas.clientWidth, cssHeight = canvas.clientHeight;
    const viewportHeight = nativeScroll ? cssHeight / 2 : cssHeight;
    if (nativeScroll) {
      // Browser-owned transforms move the last frame continuously through a
      // swipe. Rebase only before its half-screen safety margin runs out.
      if (Math.abs(window.scrollY - baseScroll) > viewportHeight * 0.75) baseScroll = window.scrollY;
      if (scrollRangeDirty) {
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - document.documentElement.clientHeight);
        canvas.style.setProperty("--tm-light-travel", `${-maxScroll * 0.5}px`);
        scrollRangeDirty = false;
      }
    }
    const { w, h } = size(cssWidth, cssHeight);
    gl.uniform1f(viewHeight, viewportHeight);
    gl.uniform1f(overscan, nativeScroll ? viewportHeight / 2 : 0);
    gl.uniform1f(time, still ? 40 : (now - begun) / 1000);
    gl.uniform1f(scroll, nativeScroll ? baseScroll : window.scrollY);
    gl.uniform1f(actualScroll, window.scrollY);
    gl.uniform1f(top, wallTop());
    gl.uniform1f(trail, trailCenter());
    if (mobile) {
      const lw = Math.max(1, Math.round(cssWidth / 2)), lh = Math.max(1, Math.round(cssHeight / 2));
      gl.activeTexture(gl.TEXTURE1);
      if (lw !== lowWidth || lh !== lowHeight) {
        lowWidth = lw; lowHeight = lh;
        gl.bindTexture(gl.TEXTURE_2D, lightTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, lw, lh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, lightBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, lightTexture, 0);
      } else gl.bindFramebuffer(gl.FRAMEBUFFER, lightBuffer);
      gl.bindTexture(gl.TEXTURE_2D, spare);
      gl.viewport(0, 0, lw, lh);
      gl.uniform2f(res, lw, lh);
      gl.uniform1f(px, cssWidth / lw);
      gl.uniform1f(pass, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, lightTexture);
      gl.viewport(0, 0, w, h);
      gl.uniform2f(res, w, h);
      gl.uniform1f(px, cssWidth / w);
      gl.uniform1f(pass, 2);
    } else gl.uniform1f(pass, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (nativeScroll && baseScroll !== appliedBaseScroll) {
      canvas.style.setProperty("--tm-light-base", `${baseScroll * 0.5}px`);
      appliedBaseScroll = baseScroll;
    }
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
      pageResize?.disconnect();
      cancelAnimationFrame(frame);
      gl.clear(gl.COLOR_BUFFER_BIT);
      artwork.onload = null;
      gl.deleteTexture(texture);
      gl.deleteTexture(spare);
      gl.deleteTexture(lightTexture);
      gl.deleteFramebuffer(lightBuffer);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(v);
      gl.deleteShader(f);
      delete canvas.dataset.nativeScroll;
      delete canvas.dataset.lightRenderer;
      canvas.style.removeProperty("--tm-light-base");
      canvas.style.removeProperty("--tm-light-travel");
    },
  };
}
